import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { call, login, setup, type TestApp } from "../test/helpers";

// Passkey routes against a small software authenticator: a P-256 key, "none" attestation and real
// ECDSA signatures, so the actual @simplewebauthn/server verification runs end to end.

const ORIGIN = "https://tatakae.example.me";
const RP_ID = "tatakae.example.me";

// ---- minimal CBOR (ints, byte strings, text strings, maps) ----
function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 0xff]);
}
type Cbor = number | string | Buffer | Map<Cbor, Cbor>;
function cbor(v: Cbor): Buffer {
  if (typeof v === "number") return v >= 0 ? head(0, v) : head(1, -1 - v);
  if (typeof v === "string") return Buffer.concat([head(3, Buffer.byteLength(v)), Buffer.from(v)]);
  if (Buffer.isBuffer(v)) return Buffer.concat([head(2, v.length), v]);
  return Buffer.concat([head(5, v.size), ...[...v].flatMap(([k, x]) => [cbor(k), cbor(x)])]);
}

const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest();

class SoftAuthenticator {
  readonly credId = randomBytes(16);
  private readonly key: KeyObject;
  private readonly cose: Buffer;
  private counter = 0;

  constructor(private readonly origin = ORIGIN, private readonly rpId = RP_ID) {
    const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    this.key = privateKey;
    const jwk = publicKey.export({ format: "jwk" });
    const x = Buffer.from(String(jwk.x), "base64url");
    const y = Buffer.from(String(jwk.y), "base64url");
    this.cose = cbor(new Map<Cbor, Cbor>([[1, 2], [3, -7], [-1, 1], [-2, x], [-3, y]]));
  }

  register(challenge: string) {
    const clientDataJSON = JSON.stringify({ type: "webauthn.create", challenge, origin: this.origin, crossOrigin: false });
    const len = Buffer.from([this.credId.length >> 8, this.credId.length & 0xff]);
    // flags: UP | UV | BE | BS | AT  → a synced (multi-device, backed up) passkey
    const authData = Buffer.concat([sha256(this.rpId), Buffer.from([0x01 | 0x04 | 0x08 | 0x10 | 0x40]), Buffer.alloc(4), Buffer.alloc(16), len, this.credId, this.cose]);
    const attestationObject = cbor(new Map<Cbor, Cbor>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]));
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: "public-key",
      clientExtensionResults: {},
      response: { clientDataJSON: b64u(clientDataJSON), attestationObject: b64u(attestationObject), transports: ["internal", "hybrid"] },
    };
  }

  assert(challenge: string, origin = this.origin) {
    this.counter += 1;
    const clientDataJSON = JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false });
    const count = Buffer.alloc(4);
    count.writeUInt32BE(this.counter);
    const authData = Buffer.concat([sha256(this.rpId), Buffer.from([0x01 | 0x04 | 0x08 | 0x10]), count]);
    const signature = sign("sha256", Buffer.concat([authData, sha256(clientDataJSON)]), this.key);
    return {
      id: b64u(this.credId),
      rawId: b64u(this.credId),
      type: "public-key",
      clientExtensionResults: {},
      response: { clientDataJSON: b64u(clientDataJSON), authenticatorData: b64u(authData), signature: b64u(signature) },
    };
  }
}

async function env() {
  return setup({ PUBLIC_ORIGIN: ORIGIN });
}

async function registerOne(app: TestApp, headers: Record<string, string>, device: SoftAuthenticator, name = "Laptop") {
  const opts = await call(app, "POST", "/passkeys/register/options", {}, headers);
  expect(opts.status).toBe(200);
  expect(opts.body["rp"]).toMatchObject({ id: RP_ID, name: "Tatakae" });
  const res = await call(app, "POST", "/passkeys", { response: device.register(String(opts.body["challenge"])), name }, headers);
  return res;
}

async function signIn(app: TestApp, device: SoftAuthenticator, origin?: string) {
  const opts = await call(app, "POST", "/passkeys/login/options", {}, {});
  expect(opts.status).toBe(200);
  const response = device.assert(String(opts.body["challenge"]), origin);
  return { res: await call(app, "POST", "/passkeys/login", { response, deviceName: "laptop-2" }, {}), response };
}

describe("passkey routes", () => {
  it("registers a passkey, then signs in with it (web cookie that authenticates /me)", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const device = new SoftAuthenticator();
    const reg = await registerOne(app, web, device, "Laptop fingerprint");
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ name: "Laptop fingerprint", deviceType: "multiDevice", backedUp: true, lastUsedAt: null });

    const { res } = await signIn(app, device);
    expect(res.status).toBe(200);
    const cookie = (res.res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    expect(cookie).toMatch(/^tatakae_session=/);
    const me = await call(app, "GET", "/session/me", undefined, { cookie });
    expect(me.body).toMatchObject({ client: "web", deviceName: "laptop-2" });

    const list = await call(app, "GET", "/passkeys", undefined, web);
    const keys = list.body["passkeys"] as { lastUsedAt: string | null; publicKey?: string }[];
    expect(keys).toHaveLength(1);
    expect(keys[0]?.lastUsedAt).not.toBeNull();
    expect(keys[0]?.publicKey).toBeUndefined(); // never leaves the server
  });

  it("a challenge works once: replaying the same assertion is refused", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const device = new SoftAuthenticator();
    await registerOne(app, web, device);
    const first = await signIn(app, device);
    expect(first.res.status).toBe(200);
    const replay = await call(app, "POST", "/passkeys/login", { response: first.response, deviceName: "x" }, {});
    expect(replay.status).toBe(401);
    expect(replay.body["error"]).toBe("passkey_failed");
  });

  it("refuses a wrong origin, an unknown passkey and a removed one", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const device = new SoftAuthenticator();
    const reg = await registerOne(app, web, device);

    expect((await signIn(app, device, "https://evil.example")).res.status).toBe(401);
    expect((await signIn(app, new SoftAuthenticator())).res.status).toBe(401);

    const id = String(reg.body["id"]);
    expect((await call(app, "DELETE", `/passkeys/${id}`, undefined, web)).status).toBe(200);
    expect((await signIn(app, device)).res.status).toBe(401);
    expect((await call(app, "GET", "/passkeys", undefined, web)).body["passkeys"]).toEqual([]);
  });

  it("refuses a registration made for another origin", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const opts = await call(app, "POST", "/passkeys/register/options", {}, web);
    const response = new SoftAuthenticator("https://evil.example").register(String(opts.body["challenge"]));
    const res = await call(app, "POST", "/passkeys", { response, name: "x" }, web);
    expect(res.status).toBe(400);
    expect(res.body["error"]).toBe("passkey_invalid");
  });

  it("renames; management needs a session, sign-in options don't", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const reg = await registerOne(app, web, new SoftAuthenticator());
    const id = String(reg.body["id"]);
    const renamed = await call(app, "PATCH", `/passkeys/${id}`, { name: "  Phone  " }, web);
    expect(renamed.body["name"]).toBe("Phone");

    expect((await call(app, "GET", "/passkeys", undefined, {})).status).toBe(401);
    expect((await call(app, "POST", "/passkeys/register/options", {}, {})).status).toBe(401);
    expect((await call(app, "DELETE", `/passkeys/${id}`, undefined, {})).status).toBe(401);
    expect((await call(app, "POST", "/passkeys/login/options", {}, {})).status).toBe(200);
  });

  it("excludes already registered passkeys and uses PUBLIC_ORIGIN's host as RP ID", async () => {
    const { app } = await env();
    const web = await login(app, "web");
    const device = new SoftAuthenticator();
    await registerOne(app, web, device);
    const opts = await call(app, "POST", "/passkeys/register/options", {}, web);
    expect(opts.body["excludeCredentials"]).toEqual([{ id: device.credId.toString("base64url"), type: "public-key", transports: ["internal", "hybrid"] }]);
    expect(opts.body["authenticatorSelection"]).toMatchObject({ residentKey: "required" });
  });

  it("rate-limits sign-in attempts", async () => {
    const { app } = await env();
    let last = 0;
    for (let i = 0; i < 21; i++) last = (await call(app, "POST", "/passkeys/login/options", {}, {})).status;
    expect(last).toBe(429);
  });
});
