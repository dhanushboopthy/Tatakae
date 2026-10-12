import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import type { Env } from "../env";

/** Files live on local disk (FILES_DIR). Off-box copies go to S3-compatible Object Storage. */

/** Object Storage is optional: every S3_* variable must be set. */
export function offsiteConfigured(env: Env): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_REGION && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
}

let client: { key: string; s3: S3Client } | null = null;

function s3(env: Env): S3Client {
  const key = `${env.S3_ENDPOINT}|${env.S3_REGION}|${env.S3_ACCESS_KEY_ID}`;
  if (client?.key !== key) {
    client = {
      key,
      s3: new S3Client({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        forcePathStyle: true, // OCI's S3 compatibility API needs path-style URLs
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? "" },
      }),
    };
  }
  return client.s3;
}

/** Absolute path for a storage key under FILES_DIR; refuses keys that would escape it. */
export function localPath(env: Env, key: string): string {
  const root = resolve(env.FILES_DIR);
  const path = resolve(root, key);
  if (!path.startsWith(root + sep)) throw new Error(`storage key escapes FILES_DIR: ${key}`);
  return path;
}

export async function writeLocal(env: Env, key: string, body: Uint8Array): Promise<void> {
  const path = localPath(env, key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function readLocal(env: Env, key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(env, key));
  } catch {
    return null;
  }
}

/** Copy to Object Storage. No-op (false) when it isn't configured. */
export async function putObject(env: Env, key: string, body: Uint8Array, contentType: string): Promise<boolean> {
  if (!offsiteConfigured(env)) return false;
  await s3(env).send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }));
  return true;
}

/** Nightly JSON backup → `backups/YYYY-MM-DD.json`; keeps the newest `keep` objects. */
export async function uploadBackup(env: Env, key: string, json: string, keep = 30): Promise<{ uploaded: boolean; pruned: number }> {
  if (!offsiteConfigured(env)) return { uploaded: false, pruned: 0 };
  await putObject(env, key, new TextEncoder().encode(json), "application/json");
  const prefix = key.slice(0, key.lastIndexOf("/") + 1);
  const keys: string[] = [];
  let token: string | undefined;
  do {
    const page = await s3(env).send(new ListObjectsV2Command({ Bucket: env.S3_BUCKET, Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) if (o.Key) keys.push(o.Key);
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  const old = keys.sort().reverse().slice(keep); // date-named keys sort chronologically
  if (old.length > 0) {
    await s3(env).send(new DeleteObjectsCommand({ Bucket: env.S3_BUCKET, Delete: { Objects: old.map((Key) => ({ Key })) } }));
  }
  return { uploaded: true, pruned: old.length };
}
