# Runbook

For the Administrator. Covers OPS-01 … OPS-04 and the GitHub settings. Screenshots are added in Phase 4 (placeholders marked 📷).

> PINs, the signing keystore and secrets never go into the repository, a chat, or an email.

## 1. One-time setup (OPS-01)

### 1.1 Tools on your computer

- Node.js 22 and npm.
- clasp: `npm install -g @google/clasp@3.4.1`, then `clasp login` with the Google account that will own the Sheet (P-01).
- Enable the Apps Script API for that account: <https://script.google.com/home/usersettings>.

### 1.2 Create the Sheet and the Apps Script project

Do this twice: once for **TEST** ("Aluthgama Daily Report – Data – TEST") and once for **production** ("Aluthgama Daily Report – Data"). Use a separate folder for each so their `.clasp.json` files do not clash.

```sh
git clone <this repository> && cd <repo>
npm ci
cd backend
clasp create --type sheets --title "Aluthgama Daily Report – Data" --rootDir dist
npm run build          # writes dist/Code.js and dist/appsscript.json
clasp push --force
```

📷 The new spreadsheet in Google Drive.

1. Open the spreadsheet and reload it. An **Admin** menu appears.
2. **Admin → Run setup.** Approve the permissions. It creates the tabs Reports, Submissions_Log, Weather, Config and Audit, sets the time zone to Asia/Colombo, writes Config defaults and creates the secrets. Running it again changes nothing.
3. **Admin → Set PINs.** Enter the Manager PIN, then the Owner PIN (6 digits each, different). Only salted hashes are stored.
4. **Admin → Load seed data.** Adds the reports for 2 and 3 Nov 2026 (production only).

📷 The Admin menu.

### 1.3 Deploy the web app

In the Apps Script editor (Extensions → Apps Script): **Deploy → New deployment → Web app**

- Execute as: **Me**
- Who has access: **Anyone**

Copy the `/exec` URL. Check it: open `<URL>?action=health` in a browser; it shows `{"ok":true,…}`.

### 1.4 GitHub settings

Repository → Settings:

- **Secrets and variables → Actions → Variables**
  - `VITE_API_URL` = the production `/exec` URL
  - `TEST_API_URL` = the TEST `/exec` URL (used by the integration suite, Phase 3)
- **Secrets and variables → Actions → Secrets** (AND-04)
  - `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` (see 1.5)
- **Pages → Build and deployment → Source: GitHub Actions.** On the Free plan the repository must be public (OQ-05).
- **Branches → Add branch ruleset for `main`** (CICD-07):
  - Require a pull request before merging.
  - Require status checks to pass: `1 quality`, `2 unit`, `4 e2e`, `5 backend`, `6 android`.
  - Block force pushes.

Until the four signing secrets exist, job `6 android` fails on purpose with a message naming them.

### 1.5 Create the release keystore (once, ever)

```sh
keytool -genkeypair -v -keystore aluthgama-release.keystore -alias aluthgama \
  -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 aluthgama-release.keystore > keystore.b64   # paste this into ANDROID_KEYSTORE_BASE64
```

- Keep `aluthgama-release.keystore` and its passwords **offline** (for example two USB drives in different places) (NFR-SEC-04, R-03). If it is lost, no update can ever be installed over the existing app.
- Delete `keystore.b64` after pasting it.

### 1.6 Release and install

```sh
npm version 1.0.0 --no-git-tag-version   # set the version in package.json, commit via a PR
git tag v1.0.0 && git push origin v1.0.0
```

The pipeline creates the GitHub Release with `aluthgama-daily-1.0.0.apk` and its `.sha256`, and publishes the PWA and `version.json`.

On the outlet phone: open the Release page in Chrome, download the APK, allow **Install unknown apps** for Chrome when asked, install, open, enter the device name, then the Manager PIN.

## 2. Updating the backend (OPS-02)

```sh
cd backend && npm run build && clasp push --force
```

Then **Deploy → Manage deployments → (the web app) → Edit → Version: New version → Deploy.** Never create a new deployment for production: the `/exec` URL would change and every installed app would stop working.

## 3. Rotating PINs (OPS-03)

**Admin → Set PINs.** It also increments `TOKEN_VERSION`, so every device is signed out and must enter the new PIN. Drafts and unsent reports stay on the phones.

## 4. Restore (OPS-04)

Weekly backups go to the Drive folder "Aluthgama Daily Report – Backups" (Phase 3). To restore, either copy the backup's tabs over the live spreadsheet, or set the Script Property `SHEET_ID` (Project Settings → Script Properties) to the backup's ID.

## 5. Weekly checks

- Audit tab: look for many `auth_fail` or `lockout` rows from unknown devices (ADR-0005).
- Submissions_Log: `rejected` rows with error codes.
- Open-Meteo: their free tier is for non-commercial use; see OQ-21.

## 6. Local development

```sh
npm ci
npm run mock            # mock API on http://localhost:8787 (Manager 111111, Owner 999999)
npm run dev             # app on http://localhost:5173
npm test                # unit and component tests
npm run test:e2e        # Playwright journeys and accessibility suite
```
