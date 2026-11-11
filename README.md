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


## Teaching tools library

The Teacher portal includes a searchable teaching-tools library: random name wheel, quick draw, random teams, student pairing, flashcards, a matching game, question draw, word scramble, a class countdown timer, and a two-team score board. The additional tools in `teacher-learning-tools.js` are original KatLearn implementations; they do not add third-party runtime dependencies. The student roster tools continue to use the existing teacher-authorized class API. Text entered into tools and roster results are held in page memory only and are not saved to local storage.


## LMS design system parity

The user-facing Teacher pages load the complete `katlearn-defaultdarkmode.css` stylesheet copied byte-for-byte from the active LMS source (with a separate source/license header). The Teacher dashboard keeps only its structural base styles (`style.css`, `extras.css`, `teacher.css`) and uses `teacher-katlearn-theme.css` for Teacher-specific layout adaptation. Login, Teacher signup, pending-verification, and SSO pages use `teacher-katlearn-auth-theme.css` on top of the same LMS design tokens.

The LMS `katlearn-polish.css` file is not linked by the current LMS pages; it is not part of the active single-stylesheet system and is therefore not added as a competing legacy layer here. The separate Admin Control Center keeps its existing admin-specific design.
