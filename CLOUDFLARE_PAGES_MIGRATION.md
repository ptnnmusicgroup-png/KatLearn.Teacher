# KatLearn Teacher — Cloudflare Pages migration

This branch prepares the Teacher static frontend for Cloudflare Pages and adds an API routing layer under Pages Functions.

## Cloudflare Pages build settings

- Framework preset: None
- Root directory: repository root
- Build command: node scripts/cloudflare-pages-build.mjs
- Build output directory: dist
- Production build variables:
  - KATLEARN_TEACHER_URL: actual production URL for the Teacher Pages project
  - KATLEARN_LMS_URL: actual production URL for the LMS Pages project
- Pages Functions runtime variables:
  - KATLEARN_API_ORIGIN: HTTPS origin of the current Teacher API backend
  - KATLEARN_ALLOWED_ORIGINS: comma-separated exact production LMS and Teacher origins

Create both Pages projects and use the actual URLs assigned by Cloudflare. Do not guess project names or production URLs.

## Important backend boundary

The current API handlers depend on the official firebase-admin SDK, including Auth and Firestore server-side operations. Cloudflare Workers/Pages Functions do not provide a complete Node.js http2 implementation for the gRPC transport used by the Admin SDK, so this branch does not pretend those handlers can be imported and executed natively. The middleware currently routes /api/* through the configured KATLEARN_API_ORIGIN so the app can move to Pages without breaking authentication, SSO, class management, student progress, or Teacher/Admin flows.

For now, the origin must point to the existing Node-compatible backend. This is a staged compatibility bridge, not the final removal of the old backend host. Do not remove the current backend deployment until API handlers are ported to a Cloudflare-compatible data/auth implementation and end-to-end smoke-tested.

## Release checklist

1. Create Cloudflare Pages projects for both repos and set the actual cross-site URLs.
2. Set the Pages Function runtime variables, including the exact CORS origins.
3. Deploy as previews first and verify /, login/signup, /api/*, LMS↔Teacher SSO, teacher management, AI pack generation, and Admin/catalog flows.
4. Only switch custom domains after both apps pass the smoke tests.
