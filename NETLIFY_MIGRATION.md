# KatLearn Teacher — Netlify deployment

This repository is prepared for a static multi-page site plus Node.js 22 Netlify Functions. Static assets are published from `dist/`; Teacher/Admin API handlers are exposed through `/api/*`.

## Netlify site settings

The root `netlify.toml` defines:
- Build command: `node scripts/netlify-build.mjs`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js version: `22`

Import `ptnnmusicgroup-png/KatLearn.Teacher` into Netlify and use `main` as the production branch. The configuration currently lives on branch `migration/netlify-fullstack`; review/merge it before building production from `main`.

## Environment variables

Configure these in **both** Netlify sites. Because URLs are injected into the static build, enable both URL variables for **Builds** and **Functions**; enable allowed origins for **Functions**.

- `KATLEARN_LMS_URL=https://lms-katlearn.netlify.app`
- `KATLEARN_TEACHER_URL=https://teacher-katlearn.netlify.app`
- `KATLEARN_ALLOWED_ORIGINS=https://lms-katlearn.netlify.app,https://teacher-katlearn.netlify.app`

Use the real origins assigned to your Netlify sites if those names are unavailable. Keep values synchronized between sites.

Required Teacher Functions variables:
- `FIREBASE_SERVICE_ACCOUNT_JSON`: full service-account JSON for Firebase project `elp---katlearn` (or the supported three-field route in `.env.example`).
- `LMS_ADMIN_URL=https://lms-katlearn.netlify.app/api/admin-hub`: URL of the LMS Admin Hub endpoint. Change the hostname if the LMS site name differs.

Optional:
- `LMS_AI_PACK_URL`: override URL for LMS `/api/ai-pack`; otherwise Teacher uses `KATLEARN_LMS_URL` plus `/api/ai-pack`.

Never commit service-account JSON, private keys or API keys to Git or put them in static build output.

## Safe deployment order

1. Deploy and smoke-test the LMS site first so the Teacher portal has a working upstream API.
2. Deploy Teacher. Test login, signup, LMS ↔ Teacher SSO, teacher registration/approval, class/assignment operations, catalog/admin operations, and Teacher AI pack generation using test accounts.
3. In Firebase Console → Authentication → Settings → Authorized domains, add both actual Netlify hostnames. Keep the old hosts until SSO has been verified.
4. Confirm CORS and Firestore effects for each test. Only after every check passes should custom domains be switched or the old deployments be stopped.

## Cost and legacy hosting

These files do not grant the Netlify Open Source plan automatically. Netlify must approve the application. Keep auto-recharge disabled and avoid paid add-ons if the hosting target is 0₫. Cloudflare Worker Containers documented in `CLOUDFLARE_WORKERS_MIGRATION.md` require a Workers Paid plan and usage-based charges; that is not the free-first deployment route.
