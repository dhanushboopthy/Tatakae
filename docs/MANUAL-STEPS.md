# Manual steps — Phase 0

Everything the code can't do for you, in order. Do the steps top to bottom; each says what "done" looks like.
Replace `<name>` with your `.me` name and `<owner>` with your GitHub username **in lowercase**.

Laptop tools you need: `terraform` ≥ 1.6, `gh` (GitHub CLI, logged in), `ssh`, `openssl`, `dig`, Node 22 + pnpm
(already used for the repo), and for the phone later: Android Studio (SDK + platform-tools) with JDK 17.

---

## 1. Oracle Cloud account (task 0.2)
1. Sign up at <https://signup.cloud.oracle.com>. Card verification is required (a small hold, refunded).
2. **Home region: Mumbai (`ap-mumbai-1`) or Hyderabad (`ap-hyderabad-1`).** This is permanent. Always Free
   A1 capacity exists only in the home region. Mumbai is the default in `terraform.tfvars.example`.
3. Wait for the "account is ready" email (can take up to an hour). Log in to <https://cloud.oracle.com>.

Done when you can open the console and see your tenancy name.

## 2. Pay-As-You-Go decision + ₹1 budget (task 0.2)
Recommended: **upgrade to Pay-As-You-Go (PAYG).**
- Why: Oracle may **reclaim idle Always Free instances** (CPU, network and memory all under 20 % for 7 days;
  a one-user app looks idle). PAYG accounts are not reclaimed, and A1 capacity is usually easier to get.
- Always Free resources stay free on PAYG. Everything in `infra/terraform` stays within Always Free.
- Risk: anything you create outside Always Free gets billed. The budget alert below catches that.

Steps:
1. Console → ☰ → **Billing & Cost Management** → **Upgrade and Manage Payment** → **Upgrade to Pay As You Go**.
   Confirm the card. The upgrade can take a few minutes to a day.
2. Turn on the budget in step 6 (`enable_budget = true`, `budget_amount = 1`, your email). The amount is in
   your account currency, so `1` = ₹1 on an Indian account. You get an email on any actual or forecast spend.
3. Record the decision (PAYG yes/no, date, region) as a new numbered entry in `docs/DECISIONS.md`.

Done when the decision is in `docs/DECISIONS.md`.

## 3. OCI API key for Terraform
1. Console → profile icon (top right) → **My profile** → **API keys** (on newer consoles under
   **Tokens and keys**) → **Add API key** → **Generate API key pair** → **Download private key** → **Add**.
2. Move the key and lock it down:
   ```bash
   mkdir -p ~/.oci
   mv ~/Downloads/*.pem ~/.oci/oci_api_key.pem
   chmod 600 ~/.oci/oci_api_key.pem
   ```
3. The console shows a **Configuration file preview**. Paste it into `~/.oci/config` and fix `key_file`:
   ```ini
   [DEFAULT]
   user=ocid1.user.oc1..aaaa...
   fingerprint=12:34:...:ef
   tenancy=ocid1.tenancy.oc1..aaaa...
   region=ap-mumbai-1
   key_file=~/.oci/oci_api_key.pem
   ```
   ```bash
   chmod 600 ~/.oci/config
   ```
4. Note the **tenancy OCID** (`tenancy=` above) and your **user OCID** (`user=`); step 6 needs them.

## 4. SSH key for the VM
```bash
ssh-keygen -t ed25519 -f ~/.ssh/tatakae -C "tatakae-vm"
cat ~/.ssh/tatakae.pub            # goes into terraform.tfvars as ssh_public_key
```
You only use this key until Tailscale SSH works (step 15). Keep it as a break-glass key.

## 5. Tailscale account, policy and the VM's auth key
1. Sign up at <https://login.tailscale.com> (GitHub login is fine). Install Tailscale on both laptops and log in.
   Turn on **MagicDNS** (Admin console → **DNS**) if it is off.
2. Admin console → **Access controls**. Add these sections to the policy file and save (merge with what is
   there; if you still have the default allow-all `grants`/`acls` rule, the `grants` below replace it):
   ```jsonc
   {
     "tagOwners": {
       "tag:server": ["autogroup:admin"],
       "tag:ci":     ["autogroup:admin"]
     },
     "grants": [
       // you, on any of your devices, can reach everything
       { "src": ["autogroup:member"], "dst": ["*"], "ip": ["*"] },
       // GitHub Actions can only reach SSH on the VM
       { "src": ["tag:ci"], "dst": ["tag:server"], "ip": ["tcp:22"] }
     ],
     "ssh": [
       // you → the VM as ubuntu (use "check" instead of "accept" to re-confirm in the browser every 12 h)
       { "action": "accept", "src": ["autogroup:member"], "dst": ["tag:server"], "users": ["ubuntu", "root"] },
       // deploys → the VM as ubuntu only
       { "action": "accept", "src": ["tag:ci"], "dst": ["tag:server"], "users": ["ubuntu"] }
     ]
   }
   ```
3. Admin console → **Settings** → **Keys** → **Generate auth key**:
   - Reusable: **off**. Ephemeral: **off**. Pre-approved: **on** (only shown if device approval is on).
   - Tags: **`tag:server`** (tagged machines don't expire, so the VM never drops off the tailnet).
   - Expiration: **7 days** (enough for "Out of host capacity" retries; it's single-use anyway).
   - Copy the `tskey-auth-...` value. It goes into `terraform.tfvars` as `tailscale_auth_key`.

## 6. Terraform: create the VM (task 0.3)
```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
```
Fill in `terraform.tfvars` (it is git-ignored):
- `region`, `tenancy_ocid` (step 3), `ssh_public_key` (step 4), `tailscale_auth_key` (step 5).
- `admin_cidr`: your current public IP as `/32` (`curl -s https://ifconfig.me; echo`). If your IP changes
  before step 15, update it and `terraform apply` again.
- `enable_budget = true`, `budget_amount = 1`, `budget_alert_email = "<you>"` (step 2).
- Leave `create_s3_key = false` (step 9 makes the key in the console, which keeps the secret out of state).

Then:
```bash
terraform init          # creates .terraform.lock.hcl: commit it
terraform plan
terraform apply         # type yes
terraform output        # public_ip, s3_endpoint, namespace, bucket, ...
```

**"Out of host capacity"** on the instance is normal for A1. Everything else is already created; only the VM
failed. Retry:
- Off-peak (early morning IST) with a loop, and stop it once it succeeds:
  `until terraform apply -auto-approve; do echo "retrying in 10 min"; sleep 600; done`
- Mumbai and Hyderabad have a single availability domain, so changing `availability_domain` doesn't help there.
- PAYG (step 2) usually gets capacity quickly.
- If the auth key expired during retries, make a new one (step 5) and update `terraform.tfvars`.

Done when `terraform apply` finishes and `terraform output public_ip` prints an address.

## 7. Check the VM
First boot takes 5–10 minutes (packages, Docker, Tailscale, waiting for the data volume).
```bash
ssh -i ~/.ssh/tatakae ubuntu@$(terraform output -raw public_ip)
cloud-init status --wait                     # → status: done
sudo tail -n 40 /var/log/tatakae-bootstrap.log   # ends with "done."
tailscale status                             # the VM is online
findmnt /srv/tatakae                         # the 100 GB volume is mounted
docker run --rm hello-world                  # log out and in once first (docker group)
sudo ufw status
```
If bootstrap stopped (e.g. the volume attached late), fix the cause and run it again:
`sudo /usr/local/sbin/tatakae-bootstrap`. It is idempotent.

From the laptop, over the tailnet (no key needed, Tailscale SSH):
```bash
ssh ubuntu@tatakae            # MagicDNS short name, or tatakae.<tailnet>.ts.net
```

## 8. Domain (task 0.5)
1. Open <https://education.github.com/pack>, find **Namecheap** → **.me domain**, follow it to <https://nc.me>
   and sign in with GitHub. Claim `<name>.me` (prefer your own name: it doubles as your portfolio domain).
2. Namecheap → **Domain List** → your domain → **Manage**:
   - **Auto-Renew: off** (renewal is about $20/yr after year one; decide before it expires).
3. **Advanced DNS** tab:
   - Delete the parking records (`CNAME www → parkingpage...` and the `URL Redirect @` record).
   - **Add new record** → **A Record**, Host `tatakae`, Value = `terraform output -raw public_ip`, TTL Automatic.
   - Keep the root (`@`) free for a portfolio.
4. Check (can take a few minutes):
   ```bash
   dig +short tatakae.<name>.me      # → the reserved IP
   ```
Done when `dig` prints the reserved IP. (Fallback if the claim is delayed: DuckDNS, see `docs/DOMAIN.md`.)

## 9. S3 credentials for backups (Customer Secret Key)
1. Console → profile icon → **My profile** → **Customer secret keys** (under **Tokens and keys** on newer
   consoles) → **Generate secret key** → name it `tatakae-backups`.
2. **Copy the secret now; it is shown only once.** That is `S3_SECRET_ACCESS_KEY`.
3. Close the dialog. The **Access key** column of the new row is `S3_ACCESS_KEY_ID`.
4. The rest comes from Terraform:
   ```bash
   terraform output -raw s3_endpoint   # S3_ENDPOINT
   terraform output -raw s3_region     # S3_REGION
   terraform output -raw bucket        # S3_BUCKET
   ```
OCI allows 2 customer secret keys per user. Store this one in your password manager.

## 10. `/opt/tatakae/.env` on the VM
1. On the laptop, generate the values:
   ```bash
   openssl rand -hex 32                 # SESSION_SECRET
   openssl rand -hex 32                 # API_TOKEN
   deploy/scripts/hash-password.sh      # asks for your login password twice, prints OWNER_PASSWORD_HASH='...'
   ```
   `hash-password.sh` uses the repo's `@node-rs/argon2` after `pnpm install`, or Docker if that's missing.
2. Copy the template and edit it on the VM:
   ```bash
   scp deploy/.env.example ubuntu@tatakae:/opt/tatakae/.env
   ssh ubuntu@tatakae
   chmod 600 /opt/tatakae/.env
   nano /opt/tatakae/.env
   ```
3. Fill in: `GH_OWNER=<owner>` (lowercase), `DOMAIN=tatakae.<name>.me`, `PUBLIC_ORIGIN=https://tatakae.<name>.me`,
   `ACME_EMAIL`, `OWNER_EMAIL`, `SESSION_SECRET`, `API_TOKEN`, all `S3_*` (step 9).
4. **Replace the whole `OWNER_PASSWORD_HASH=` line with the line `hash-password.sh` printed, single quotes
   included.** The hash contains `$` signs, and Docker Compose would try to expand them without the quotes.
5. Store a copy of the finished `.env` in your password manager (it's needed for a restore on a new VM).

## 11. Tailscale OAuth client for GitHub Actions
1. Tailscale admin console → **Settings** → **OAuth clients** (called **Trust credentials** on newer consoles) →
   **Generate OAuth client**.
2. Scopes: **Keys → Auth Keys: Write**. Tags: **`tag:ci`**.
3. Copy the **Client ID** and **Client secret** (shown once).

## 12. GitHub secrets and variables
In the repo directory (or GitHub → Settings → Secrets and variables → Actions):
```bash
gh secret set TS_OAUTH_CLIENT_ID            # paste (step 11)
gh secret set TS_OAUTH_SECRET               # paste (step 11)
gh secret set VM_USER --body ubuntu
gh secret set VM_TAILNET_HOST --body tatakae.<tailnet>.ts.net   # full MagicDNS name: `tailscale status` on the VM
gh variable set DOMAIN --body tatakae.<name>.me
```
Android signing secrets come in step 17. Full list (also in `docs/08-operations.md`):

| Kind | Name | Value |
|---|---|---|
| secret | `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | step 11 |
| secret | `VM_USER` | `ubuntu` |
| secret | `VM_TAILNET_HOST` | `tatakae.<tailnet>.ts.net` |
| secret | `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | step 17 |
| variable | `DOMAIN` | `tatakae.<name>.me` (no `https://`) |

## 13. First deploy and GHCR visibility (tasks 0.6, 0.8)
1. GitHub → **Actions** → **deploy** → **Run workflow** (or push to `main`). The first run builds both images.
2. GHCR creates new packages as **private**, so the VM can't pull them and the deploy job fails at "pull".
   Pick one:
   - **Public packages (simplest).** The images contain only built code, never secrets. For each of
     `tatakae-api` and `tatakae-web`: GitHub → your profile → **Packages** → the package → **Package settings**
     → **Danger Zone** → **Change visibility** → **Public**. Then re-run the failed deploy job.
   - **Private packages.** Create a classic personal access token with only `read:packages`, then once on the VM:
     ```bash
     ssh ubuntu@tatakae
     docker login ghcr.io -u <owner>      # paste the token as the password
     ```
3. Check:
   ```bash
   curl -sI https://tatakae.<name>.me | head -n 1        # HTTP/2 200, valid certificate
   curl -s https://tatakae.<name>.me/api/health          # {"ok":true,...}
   ```
Done when both work, and a later push to `main` redeploys by itself.

## 14. Backups are flowing (task 0.7)
```bash
ssh ubuntu@tatakae 'cd /opt/tatakae && docker compose logs --tail 20 litestream'
```
Then Console → **Storage** → **Buckets** → `tatakae-backups`: a `litestream/tatakae/generations/...` folder
with a snapshot should appear within a minute of the first deploy. Done when you see it.

## 15. Close public SSH (task 0.4)
Only after `ssh ubuntu@tatakae` over Tailscale works:
1. `infra/terraform/terraform.tfvars`: `allow_public_ssh = false`, then `terraform apply`.
2. On the VM, run bootstrap once more so ufw drops its temporary 22/tcp rule (it only keeps it while Tailscale
   is down): `ssh ubuntu@tatakae sudo /usr/local/sbin/tatakae-bootstrap`.
3. Check from the laptop with Tailscale **off** (or from your phone's hotspot):
   `nc -vz -w 5 $(terraform output -raw public_ip) 22` must time out.
Done when SSH works only over the tailnet.

## 16. Android phone: development build (task 0.11)
1. In `apps/mobile/app.config.ts`, replace `dev.OWNER.tatakae` with your real package id
   (e.g. `dev.<name>.tatakae`). This is the app's permanent identity; set it before the first install.
2. Laptop: Android Studio → SDK Manager: an Android SDK Platform, **Android SDK Platform-Tools**,
   **Build-Tools**. Then in your shell profile:
   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$ANDROID_HOME/platform-tools:$PATH"
   export JAVA_HOME=/opt/android-studio/jbr     # or any JDK 17
   ```
3. Phone: **Settings → About phone → tap "Build number" 7 times** → **Developer options** → **USB debugging: on**
   (Xiaomi/Redmi/POCO: also **Install via USB**). Connect by USB, accept the "Allow USB debugging" prompt.
   `adb devices` must list the phone as `device`.
4. Build, install and start the dev client against production:
   ```bash
   EXPO_PUBLIC_API_URL=https://tatakae.<name>.me pnpm --filter mobile android
   ```
   Later sessions only need Metro: `EXPO_PUBLIC_API_URL=https://tatakae.<name>.me pnpm dev:mobile`, then open
   the app (same Wi‑Fi, or over USB after `adb reverse tcp:8081 tcp:8081`).
   `EXPO_PUBLIC_*` values are baked in when Metro bundles, so always start Metro with the variable set.
5. Alternative without a local Android SDK (EAS free tier, queue can be slow):
   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile development   # install the APK from the link it prints
   EXPO_PUBLIC_API_URL=https://tatakae.<name>.me pnpm dev:mobile
   ```
Done when the dev client is installed and logs in to production.

## 17. Android release keystore (needed for `mobile.yml`, used from v4)
1. Generate it once, outside the repo:
   ```bash
   cd ~ && keytool -genkeypair -v -storetype PKCS12 -keystore tatakae-release.keystore \
     -alias tatakae -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Tatakae, C=IN"
   ```
   PKCS12 uses one password for the store and the key: use the same value for both secrets below.
2. **Save the keystore file and the password in your password manager** (as an attachment), plus one offline
   copy. If you lose it, you can never update the installed app in place again.
3. Add the GitHub secrets:
   ```bash
   base64 -w0 ~/tatakae-release.keystore | gh secret set ANDROID_KEYSTORE_BASE64
   gh secret set ANDROID_KEYSTORE_PASSWORD     # paste the password
   gh secret set ANDROID_KEY_PASSWORD          # same password
   gh secret set ANDROID_KEY_ALIAS --body tatakae
   ```
4. A release: set `version` in `apps/mobile/app.config.ts`, commit, then
   `git tag mobile-v0.1.0 && git push origin mobile-v0.1.0`. The APK appears under GitHub → Releases.
   On the phone, open the release, download the APK and allow your browser to "install unknown apps".
5. Notes:
   - The dev build (debug key) and the release APK share the package id but not the signature. Uninstall the
     dev build before installing a release APK (local app data is lost; it resyncs from the server).
   - `updates.url` in `app.config.ts` still has a placeholder EAS project id. Run `npx eas-cli@latest init` in
     `apps/mobile` (or remove the `updates` block) before the first release build.
   - Never commit the keystore; `*.keystore` and `*.jks` are git-ignored.
