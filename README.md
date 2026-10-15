# KatLearn Teacher

Teacher and administrator portal for KatLearn.

## Cloudflare Workers deployment

- Frontend Worker: teacher-katlearn
- Other frontend Worker: lms-katlearn
- API Worker: katlearn-teacher-api, using Cloudflare Workers Containers with Node.js 22 and the existing Firebase Admin API handlers.
- Data/auth: Firebase project elp---katlearn.

See CLOUDFLARE_WORKERS_MIGRATION.md for build settings, API deployment, secrets and smoke tests. Keep all service-account credentials and API keys in Cloudflare Worker secrets, never in Git.

## Build and deploy

Build command: node scripts/cloudflare-workers-build.mjs
Deploy command: npx wrangler deploy
Static assets output: dist
Frontend Worker config: wrangler.toml
API Worker config: wrangler-api.toml

Workers Containers require the Workers Paid plan and incur usage-based charges. Deploy the API Worker before deploying the frontend Worker because the frontend's KATLEARN_API service binding targets the API Worker. Do not switch production domains until both frontend Workers and authenticated API smoke tests pass.
