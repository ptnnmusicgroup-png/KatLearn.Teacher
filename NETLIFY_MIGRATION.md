# KatLearn Teacher — Netlify deployment

## Build configuration

The repository is configured for Netlify:
- Build command: `node scripts/build-netlify.mjs`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Runtime/build Node.js version: `22`

Teacher/Admin endpoints remain available through Netlify Functions at the existing `/api/*` routes. Teacher registration is handled by `/api/teacher-register`, which verifies the Firebase ID token and writes the pending profile through Firebase Admin; do not relax public Firestore write rules to work around registration errors.

## Netlify environment variables

Set these in the Teacher Netlify site's environment settings:

- `KATLEARN_LMS_SITE_URL=https://lms-katlearn.netlify.app`
- `KATLEARN_TEACHER_SITE_URL=https://quanly-giaovien-katlearn.netlify.app`
- `KATLEARN_ALLOWED_ORIGINS=https://lms-katlearn.netlify.app,https://quanly-giaovien-katlearn.netlify.app`
- `FIREBASE_SERVICE_ACCOUNT_JSON`: full service-account JSON for Firebase project `elp---katlearn` (secret).

The site URL variables are used during the static build and by runtime functions; configure them for both Builds and Functions. Allowed origins and Firebase Admin credentials must be available to Functions. The Teacher portal calls the LMS site's Admin Hub and AI endpoints, so the LMS hostname must match the actual Netlify LMS site.

Never commit service-account JSON, private keys or API keys.

## Verification and rollout

Test teacher login/sign-up, LMS ↔ Teacher SSO, teacher registration/approval, class/assignment management, admin/catalog operations, Teacher AI and Firestore effects with test accounts. Ensure both Netlify hostnames are present in Firebase Authentication's authorized domains and both sites use synchronized origin settings.

## Free-only target

Netlify Open Source plan access requires approval and continuing eligibility. Keep auto-recharge disabled and do not enable paid add-ons while the target is 0₫.
