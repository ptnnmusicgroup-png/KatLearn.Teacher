# KatLearn Teacher

Teacher portal for KatLearn.

## Firebase Admin runtime configuration

The Teacher registration API uses the Firebase Admin SDK and needs credentials at runtime.
Configure the Netlify site environment variable `FIREBASE_SERVICE_ACCOUNT_JSON` with the
complete service-account JSON for Firebase project `elp---katlearn`. The API also accepts
`FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` (Base64-encoded JSON), or the three separate fields
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.

**Important for previews:** create the secret for the **Deploy Previews** context as well
as **Production**. Setting it only for Production leaves PR Deploy Preview Functions
without credentials and the registration API returns
`firebase_credentials_missing`. The variable must be available to Netlify Functions
(use the Functions scope, or all scopes if scope selection is unavailable).

For the current canonical Teacher site, configure this on the Netlify site
`quanly-giaovien-katlearn`. If testing its secondary preview site
`teacher-katlearn1`, configure that Netlify site separately too.

Mark the value as secret/sensitive. Never commit a service-account JSON/private key to
GitHub, put it in browser code, or paste it into chat. After changing Netlify environment
variables, trigger a new deploy so Functions receive the updated value.
## Classroom Games

The Teacher portal includes a classroom games area for no-repeat random student selection, a name wheel, and random team assignment. The roster is loaded only for the signed-in teacher's own classes and is kept in memory for the current page session.

The no-repeat selection flow is adapted from [Sid Roberts' Random Name Picker](https://github.com/SidRoberts/random-name-picker), MIT License. See `THIRD-PARTY-NOTICES/CLASSROOM-RANDOM-PICKER-MIT.txt`.

The Teacher portal also includes a copy of the LMS `katlearn-defaultdarkmode.css` stylesheet, licensed GPL-3.0-only. See `THIRD-PARTY-NOTICES/KATLEARN-LMS-THEME.txt`.


## Teaching tools library

The Teacher portal includes a searchable teaching-tools library: random name wheel, quick draw, random teams, student pairing, flashcards, a matching game, question draw, word scramble, a class countdown timer, and a two-team score board. The additional tools in `teacher-learning-tools.js` are original KatLearn implementations; they do not add third-party runtime dependencies. The student roster tools continue to use the existing teacher-authorized class API. Text entered into tools and roster results are held in page memory only and are not saved to local storage.


## LMS design system and Teacher workspace

The Teacher workspace is served from `/home.html`. It uses the full `katlearn-defaultdarkmode.css` stylesheet from the active LMS plus a scoped Teacher workspace adapter, a layout-only auth stylesheet and the dedicated classroom-tools layer. Sidebar, topbar, buttons, cards, modals, typography, motion and responsive behavior follow the KatLearn LMS glass design system.

The dashboard, classes, students, packs, progress and teaching-tools areas are separate page modules with direct links: `/home.html#dashboard`, `#classes`, `#students`, `#packs`, `#progress` and `#games`. The legacy root `index.html` redirects to `/home.html` while preserving query strings and fragments for SSO and deep links.

The retired light/blue dashboard and authentication stylesheets have been removed from the repository and static output. Admin Control Center remains a separately scoped administration interface. Admin Control Center remains a separately scoped administration interface. The active LMS does not link `katlearn-polish.css`, so it is not loaded as a competing theme layer.

The copied LMS stylesheet is GPL-3.0-only; see `THIRD-PARTY-NOTICES/KATLEARN-LMS-THEME.txt`.