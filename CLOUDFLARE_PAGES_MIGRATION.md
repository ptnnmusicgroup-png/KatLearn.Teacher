# KatLearn Teacher — Cloudflare Pages + Workers Containers

This branch prepares the Teacher static frontend for Cloudflare Pages and moves its API runtime into a Cloudflare Workers Container running Node 22 and the existing Firebase Admin handlers. The Pages Functions middleware forwards /api/* to that Cloudflare Worker API origin; there is no Netlify runtime dependency in the target deployment.

## 1. Create the API Worker

From the repository root, deploy the API Worker after signing into Wrangler:
- npx wrangler deploy --config wrangler-api.toml

The initial deploy builds a Docker image and may take several minutes to become ready. Workers Containers require the Cloudflare Workers Paid plan and are billed by usage.

Set these Worker secrets with Wrangler (do not commit them):
- FIREBASE_SERVICE_ACCOUNT_JSON (recommended; service-account JSON for Firebase project elp---katlearn), or supported alternative credential variables

Set non-secret Worker variables as appropriate:
- KATLEARN_ALLOWED_ORIGINS: comma-separated exact production Pages origins
- KATLEARN_LMS_SITE_URL: production LMS Pages URL
- KATLEARN_TEACHER_SITE_URL: production Teacher Pages URL

## 2. Create Cloudflare Pages for the static frontend

- Framework preset: None
- Root directory: repository root
- Build command: node scripts/cloudflare-pages-build.mjs
- Build output directory: dist
- Production build variables:
  - KATLEARN_TEACHER_URL: actual production URL assigned to the Teacher Pages project
  - KATLEARN_LMS_URL: actual production URL assigned to the LMS Pages project
- Pages Functions runtime variables:
  - KATLEARN_API_ORIGIN: deployed Cloudflare Teacher API Worker origin
  - KATLEARN_ALLOWED_ORIGINS: comma-separated exact production LMS and Teacher Pages origins

Use the actual Pages and Worker URLs assigned by Cloudflare. Set these runtime variables in both Pages projects, with each KATLEARN_API_ORIGIN pointing to its corresponding API Worker.

## 3. Validate before changing domains

1. Deploy Worker API previews and confirm GET /health and /api/* routes work.
2. Deploy Pages previews for both repos.
3. Smoke-test login/signup, LMS↔Teacher SSO, teacher management, AI-pack generation, and Admin/catalog flows.
4. Switch custom domains only after the smoke tests pass.

Cloudflare Pages and Workers are prepared by these source changes, but deployment still requires access to your Cloudflare account, the actual project URLs, and secret values. Existing production deployments are not changed by this branch.
