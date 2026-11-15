# KatLearn Teacher

Standalone Teacher portal for the KatLearn ecosystem.

## Runtime

- Node.js 22 or newer
- Firebase project: `elp---katlearn`
- Default local address: `http://127.0.0.1:3100`
- KatLearn LMS is expected at `http://127.0.0.1:3000` during local development.

## Configure

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. Set `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` in `.env.local` to the Base64-encoded Firebase Admin service-account JSON for project `elp---katlearn`.

   The service-account key is a server-only secret. Never place it in browser code, Git, or a message.

4. Keep `KATLEARN_LMS_SITE_URL=http://127.0.0.1:3000` while the LMS is running locally. The Teacher Admin Hub and Teacher Kat AI proxy call the LMS server through this URL.

5. Keep the exact local origins in `KATLEARN_ALLOWED_ORIGINS`. Add production origins only when the corresponding domains are configured.

## Run

Start KatLearn LMS in its own terminal on port 3000, then start Teacher:

```powershell
npm.cmd start
```

Open `http://localhost:3100`.

## Test

```powershell
npm.cmd run test:local
npm.cmd run check
```

The standalone server serves the source web files directly and routes the five API endpoints to their Node.js Web Request handlers. Private source directories, environment files, package metadata, and Firebase credential files are not served.

## Architecture

```text
Browser
  ├── KatLearn LMS :3000
  └── KatLearn Teacher :3100
          ├── Firebase Auth / Firestore
          ├── Admin Hub proxy ───────> LMS /api/admin-hub
          └── Kat AI proxy ──────────> LMS /api/ai-pack
```

The Teacher and LMS applications use the same Firebase project. Teacher SSO exchanges a verified Firebase ID token for a Firebase custom token; it does not copy passwords or expose Admin credentials.

Do not expose either server publicly until authentication, Firestore rules, CORS origins, and reverse-proxy settings have been reviewed. Keep both servers bound to `127.0.0.1` during local testing.
