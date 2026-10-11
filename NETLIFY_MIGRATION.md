# KatLearn Teacher — Netlify migration

The `migration/netlify` branch contains the Netlify static build and the adapter for the existing `/api/admin-hub` proxy. The current Vercel Teacher site remains unchanged until both Netlify sites are tested.

## Build settings

- Build command: `node scripts/netlify-build.mjs`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
- Node.js: `22`

The build publishes public HTML, JavaScript, CSS, images, and catalog data but excludes the server-side `api/` directory, function sources, repository metadata, and credential-looking files.

## Required Netlify environment variables

- `LMS_ADMIN_URL`: the final KatLearn LMS Netlify origin plus `/api/admin-hub` (for example, `https://<actual-lms-site>.netlify.app/api/admin-hub`). This must be set when the LMS Netlify site is deployed; otherwise the proxy intentionally falls back to the current Vercel endpoint.
- `KATLEARN_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins permitted to call this Teacher API, including this site's actual `.netlify.app` origin.

Keep all API keys and service credentials in Netlify's environment settings, not in Git. The LMS site separately needs the Firebase Admin and Gemini variables currently used in Vercel.

## Cutover sequence

1. Deploy this branch to a new Netlify site and confirm the Teacher UI and catalog load.
2. Set `LMS_ADMIN_URL` to the LMS site's final URL and set `KATLEARN_ALLOWED_ORIGINS`.
3. Test sign-in flow, teacher signup, school catalog loading, Admin actions, and API errors on both previews.
4. Only then assign custom domains or turn off the Vercel sites.
