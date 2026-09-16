import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const allowedOrigins = new Set([
  'https://teacher-katlearn.netlify.app',
  'https://lms-katlearn.netlify.app'
]);

function headers(origin) {
  const h = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  };
  if (allowedOrigins.has(origin)) {
    h['access-control-allow-origin'] = origin;
    h['access-control-allow-methods'] = 'POST, OPTIONS';
    h['access-control-allow-headers'] = 'content-type';
    h['vary'] = 'Origin';
  }
  return h;
}

function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  return { auth: getAuth(), db: getFirestore() };
}

export default async (request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: headers(origin) });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: headers(origin) });
  if (!allowedOrigins.has(origin)) return Response.json({ error: 'Origin not allowed' }, { status: 403, headers: headers(origin) });

  try {
    const body = await request.json();
    const idToken = String(body?.idToken || '');
    if (!idToken) return Response.json({ error: 'Missing ID token' }, { status: 400, headers: headers(origin) });

    const { auth, db } = admin();
    const decoded = await auth.verifyIdToken(idToken, true);
    const snap = await db.collection('users').doc(decoded.uid).get();
    const profile = snap.exists ? snap.data() : {};
    const role = String(profile?.role || 'student').toLowerCase();
    const isAdmin = String(decoded.email || '').toLowerCase() === 'katlearn.admin@gmail.com';

    if (!isAdmin && role !== 'teacher') {
      return Response.json({ role: 'student', error: 'STUDENT_ACCOUNT' }, { status: 403, headers: headers(origin) });
    }

    const customToken = await auth.createCustomToken(decoded.uid, {
      role: 'teacher',
      teacherAccess: true
    });

    return Response.json({ role: 'teacher', customToken }, { status: 200, headers: headers(origin) });
  } catch (error) {
    console.error('[KatLearn SSO]', error);
    return Response.json({ error: 'Invalid or expired session' }, { status: 401, headers: headers(origin) });
  }
};
