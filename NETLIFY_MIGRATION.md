# KatLearn Teacher — Netlify deployment

## Netlify settings
Import `ptnnmusicgroup-png/KatLearn.Teacher` into Netlify using production branch `main`.
The repository defines:
- Build command: `node scripts/build-netlify.mjs`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js version: `22`

The Teacher/Admin API remains exposed at its existing `/api/*` routes through Netlify Functions.

## Environment variables
Set these on the Teacher site:
- `FIREBASE_SERVICE_ACCOUNT_JSON` — privileged Firebase service-account JSON for project `elp---katlearn` (secret; never commit it).
- `KATLEARN_LMS_SITE_URL` — exact LMS Netlify URL, e.g. `https://lms-katlearn.netlify.app`.
- `KATLEARN_TEACHER_SITE_URL` — exact Teacher Netlify URL, e.g. `https://teacher-katlearn.netlify.app`.
- `KATLEARN_ALLOWED_ORIGINS` — comma-separated exact origins for both sites.

The current handler reads `KATLEARN_LMS_SITE_URL` and defaults to the expected Netlify LMS URL, so a separate `LMS_ADMIN_URL` is not required. Make both site URL variables available during Builds and Functions; allowed origins and Firebase credentials must be available to Functions. Use the actual URLs if Netlify assigns different site names.

## Safe rollout
1. Deploy/test the LMS site first because Teacher's admin proxy and AI-pack features call its API.
2. Deploy Teacher and test login/signup, LMS ↔ Teacher SSO, teacher signup/approval, class/assignment management, admin/catalog operations and Teacher AI.
3. Add both actual Netlify hostnames in Firebase Console → Authentication → Settings → Authorized domains.
4. Verify CORS and Firestore effects using test accounts. Don't stop previous hosting until all tests pass.

## Free hosting
The Netlify Open Source plan requires approval and the project must remain non-commercial. Disable auto-recharge and avoid paid add-ons while the goal is 0₫.
