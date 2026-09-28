# KatLearn Teacher

Teacher portal for KatLearn.

## Firebase Admin production configuration

The Teacher portal server APIs use Firebase Admin SDK. Configure the following Vercel Production environment variable(s):

- Preferred: `FIREBASE_SERVICE_ACCOUNT_JSON` = the complete Firebase service-account JSON.
- Alternative: `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` = Base64 of the complete service-account JSON.
- Or the three fields: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

Never commit a service-account JSON/private key to GitHub. After changing Vercel environment variables, redeploy the project.
