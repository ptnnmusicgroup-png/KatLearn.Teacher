# KatLearn Teacher

Teacher portal for KatLearn.

## Firebase Admin production configuration

The Teacher portal server APIs use Firebase Admin SDK. Configure the following Netlify Production environment variable(s):

- Preferred: `FIREBASE_SERVICE_ACCOUNT_JSON` = the complete Firebase service-account JSON.
- Alternative: `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` = Base64 of the complete service-account JSON.
- Or the three fields: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.

Never commit a service-account JSON/private key to GitHub. After changing Netlify environment variables, redeploy the project.

## Classroom Games

The Teacher portal includes a classroom games area for no-repeat random student selection, a name wheel, and random team assignment. The roster is loaded only for the signed-in teacher's own classes and is kept in memory for the current page session.

The no-repeat selection flow is adapted from [Sid Roberts' Random Name Picker](https://github.com/SidRoberts/random-name-picker), MIT License. See `THIRD-PARTY-NOTICES/CLASSROOM-RANDOM-PICKER-MIT.txt`.

The Teacher portal also includes a copy of the LMS `katlearn-defaultdarkmode.css` stylesheet, licensed GPL-3.0-only. See `THIRD-PARTY-NOTICES/KATLEARN-LMS-THEME.txt`.
