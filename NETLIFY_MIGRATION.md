# KatLearn Teacher — Netlify migration

This branch prepares the Teacher portal for Netlify hosting while leaving the current Vercel deployment available for rollback.

## Build and publish

- Build command: `node scripts/netlify-build.mjs`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js: `22`

The build publishes the public Teacher UI and catalog files. It excludes server-side API code, function sources, Git/Vercel metadata, dependency folders, and credential-looking files. It injects `site-config.js` into published HTML to select the matching LMS and Teacher origins.

## Netlify environment variables

Configure variables in Netlify's dashboard, never in the repository.

**Build-time site URLs**
- `KATLEARN_TEACHER_URL`: this Teacher site's final HTTPS origin.
- `KATLEARN_LMS_URL`: the LMS site's final HTTPS origin.

**Functions/runtime variables**
- `LMS_ADMIN_URL`: the LMS site's final origin followed by `/api/admin-hub`.
- `LMS_AI_PACK_URL`: the LMS site's final origin followed by `/api/ai-pack`.
- `KATLEARN_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins allowed by the Teacher SSO and teacher-management APIs. Include both the Netlify Teacher origin and Netlify LMS origin.
- Firebase Admin credentials: use the existing production service-account variable, preferably `FIREBASE_SERVICE_ACCOUNT_JSON`. Supported alternatives are implemented in `api/_firebase-admin.js`.

The Teacher portal should continue using the existing Firebase project, so current accounts, school/class records, roles, and teacher applications are not migrated or recreated.

## Netlify Functions

The branch adapts the existing API handlers to Netlify Functions:
- `/api/admin-hub` — proxy to the LMS Admin API.
- `/api/auth-exchange` — teacher/LMS sign-in exchange.
- `/api/teacher-manage` — teacher class and assignment management.
- `/api/ai-pack` — proxy to the LMS AI pack generator.

The original `/api/*` URL shape is preserved through Netlify rewrites.

## Release checklist

1. Deploy this branch to a new Netlify site and set the environment variables above.
2. Confirm the Teacher pages load and that `site-config.js` contains the intended LMS and Teacher URLs.
3. Verify email/Google/Apple sign-in flows as supported, teacher registration and pending verification, catalog loading, class management, assigned packs, Admin actions, and Kat AI pack generation.
4. Verify both sites share the existing Firebase project and the Teacher's server-side proxy points to the LMS Netlify site rather than Vercel.
5. Only after both sites pass end-to-end testing, configure custom domains/DNS. Keep Vercel available for rollback until the new deployment is stable.

No Firebase data migration is required for a hosting-only move.
