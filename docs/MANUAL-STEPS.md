# Manual steps

Everything the code can't do for you, in order. Each step says what "done" looks like.

Hosting is not covered here: the Oracle Cloud and Zoho Catalyst setups were removed, and the server side will be
documented in `docs/08-operations.md` once the new hosting plan is chosen. Replace `<owner>` with your GitHub username
**in lowercase** and `<api-url>` with the address where your API runs.

Laptop tools you need: `gh` (GitHub CLI, logged in), `openssl`, Node 22 + pnpm, and for the phone: Android Studio
(SDK + platform-tools) with JDK 17.

---

## 1. Android phone: development build (task 0.11)
1. The app's package id is `dev.dhanush.tatakae` (`apps/mobile/app.config.ts`). It is the app's permanent identity:
   change it before the first install if you want a different one, because changing it later means a fresh install.
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
4. Build, install and start the dev client against your API:
   ```bash
   EXPO_PUBLIC_API_URL=<api-url> pnpm --filter mobile android
   ```
   Later sessions only need Metro: `EXPO_PUBLIC_API_URL=<api-url> pnpm dev:mobile`, then open
   the app (same Wi‑Fi, or over USB after `adb reverse tcp:8081 tcp:8081`).
   `EXPO_PUBLIC_*` values are baked in when Metro bundles, so always start Metro with the variable set.
   To test against the API on your laptop over USB, use `adb reverse tcp:8787 tcp:8787` and
   `EXPO_PUBLIC_API_URL=http://localhost:8787`.
5. Alternative without a local Android SDK (EAS free tier, queue can be slow):
   ```bash
   cd apps/mobile
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile development   # install the APK from the link it prints
   EXPO_PUBLIC_API_URL=<api-url> pnpm dev:mobile
   ```
Done when the dev client is installed and logs in to your API.

## 2. Android release keystore (needed for `mobile.yml`, used from v4)
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
   - JS-only fixes (EAS Update, optional): run `npx eas-cli@latest init` in `apps/mobile` once (free Expo
     account), copy the project id it prints, then `gh variable set EAS_PROJECT_ID --body <id>`. Release APKs
     built after that check the `production` channel on launch and apply a fix on the next launch. Publish a
     fix with `EAS_PROJECT_ID=<id> npx eas-cli@latest update --channel production --message "…"` from
     `apps/mobile`; it reaches only APKs with the same `version`. Without the variable the build has no
     `updates` block and nothing changes.
   - **Updates must be signed** (the app refuses unsigned ones; without the certificate it gets no `updates`
     block at all). Once, in `apps/mobile`:
     ```bash
     npx expo-updates codesigning:generate --key-output-directory keys \
       --certificate-output-directory certs --certificate-validity-duration-years 10 \
       --certificate-common-name "Tatakae"
     git add certs/certificate.pem    # public, committed; keys/ is git-ignored
     ```
     Keep `keys/private-key.pem` in your password manager. Publish with
     `npx eas-cli@latest update --channel production --private-key-path keys/private-key.pem --message "…"`.
     Turn on two-factor authentication for the Expo account too: whoever controls it could otherwise publish
     to the channel.
   - "Update available" on the phone: after a release, set `MIN_MOBILE_VERSION` (the new version) and
     `LATEST_APK_URL` (the APK's download link from the release) in the server's env and restart the API. Older
     phones then show a calm banner on Today and in Settings; nothing is blocked.
   - Never commit the keystore; `*.keystore` and `*.jks` are git-ignored.
