# KatLearn Teacher

Teacher and administrator portal for KatLearn.

## Deployment target: Netlify

This repository is being migrated to a static multi-page site plus Node.js 22 Netlify Functions. Netlify publishes frontend assets from `dist/` and routes the existing teacher/admin API handlers through `/api/*`.

- Netlify configuration: `netlify.toml`
- Static build: `node scripts/netlify-build.mjs`
- API adapters: `netlify/functions/`
- Firebase project: `elp---katlearn`

Read [NETLIFY_MIGRATION.md](NETLIFY_MIGRATION.md) before importing or promoting the site. Keep Firebase service-account credentials in Netlify runtime environment variables only—never in Git.

Cloudflare Worker files remain for legacy reference. Their Container-based API path requires a Workers Paid plan and usage-based charges, so it is not the free-first deployment path. The Netlify Open Source plan also requires approval; do not enable paid usage if the goal is 0₫.
