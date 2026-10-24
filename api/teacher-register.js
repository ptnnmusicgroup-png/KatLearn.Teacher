import { createHash } from 'node:crypto';
import { admin } from './_firebase-admin.js';

const ORIGINS = new Set([
  'https://quanly-giaovien-katlearn.netlify.app',
  'https://teacher-katlearn1.netlify.app',
  ...String(process.env.KATLEARN_ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean),
  ...[process.env.KATLEARN_TEACHER_SITE_URL, process.env.URL, process.env.DEPLOY_PRIME_URL]
    .map(x => String(x || '').trim().replace(/\/+$/, ''))
    .filter(Boolean)
]);

const clean = (value, max = 180) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const lower = value => clean(value, 254).toLowerCase();

function response(body, status, origin) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  };
  if (ORIGINS.has(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-methods'] = 'POST, OPTIONS';
    headers['access-control-allow-headers'] = 'content-type, authorization';
    headers['access-control-max-age'] = '600';
    headers.vary = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(message, status = 400, code = 'invalid_teacher_registration') {
  return Object.assign(new Error(message), { status, code });
}

function normalizeLevel(value) {
  const level = clean(value, 24).toLowerCase();
  return ['primary', 'middle', 'high', 'combined'].includes(level) ? level : '';
}

function validateSchool(input, schoolId, province, ward) {
  if (!schoolId) return null;
  if (!/^sch_[a-f0-9]{28}$/.test(schoolId) || !input || typeof input !== 'object') {
    throw fail('Danh mục trường không hợp lệ. Hãy tải lại trang và chọn trường lần nữa.', 400, 'invalid_catalog_school');
  }
  const name = clean(input.name);
  const provinceId = clean(input.provinceId, 8);
  const wardId = clean(input.wardId, 32);
  const sourceSchoolId = clean(input.sourceSchoolId, 80);
  const sourceProvinceId = clean(input.sourceProvinceId, 80);
  const schoolLevel = normalizeLevel(input.schoolLevel);
  const provinceName = clean(input.provinceName);
  const wardName = clean(input.wardName);
  if (!name || !provinceId || !wardId || !sourceSchoolId || !schoolLevel || !provinceName || !wardName) {
    throw fail('Thiếu thông tin trường trong danh mục quốc gia. Hãy tải lại trang.', 400, 'incomplete_catalog_school');
  }
  const expectedId = 'sch_' + createHash('sha256')
    .update(provinceId + '|' + sourceSchoolId + '|' + name.toLowerCase())
    .digest('hex').slice(0, 28);
  if (expectedId !== schoolId || provinceName !== province || wardName !== ward) {
    throw fail('Thông tin trường không khớp danh mục LMS. Hãy chọn lại trường và địa bàn.', 400, 'catalog_school_mismatch');
  }
  return {
    schoolId, name, province: provinceName, provinceId, ward: wardName, wardId,
    sourceSchoolId, sourceProvinceId, schoolLevel,
    source: 'lms_national_catalog'
  };
}

function validateClass(classId, catalogSchool, requestedClassName) {
  if (!classId) return { classId: '', grade: '', name: clean(requestedClassName, 80) };
  if (!catalogSchool || !classId.startsWith(catalogSchool.schoolId + '-')) {
    throw fail('Lớp không thuộc trường đã chọn. Hãy chọn lại lớp.', 400, 'catalog_class_mismatch');
  }
  const grade = classId.slice(catalogSchool.schoolId.length + 1);
  const grades = {
    primary: ['1', '2', '3', '4', '5'],
    middle: ['6', '7', '8', '9'],
    high: ['10', '11', '12'],
    combined: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
  };
  if (!(grades[catalogSchool.schoolLevel] || []).includes(grade) || clean(requestedClassName, 80) !== 'Lớp ' + grade) {
    throw fail('Lớp không khớp cấp học của trường. Hãy chọn lại lớp.', 400, 'invalid_catalog_class');
  }
  return { classId, grade, name: 'Lớp ' + grade };
}

export default async request => {
  const origin = String(request.headers.get('origin') || '').replace(/\/+$/, '');
  if (request.method === 'OPTIONS') {
    if (origin && !ORIGINS.has(origin)) return response({ ok: false, error: 'Origin không được phép.' }, 403, origin);
    return response({ ok: true }, 200, origin);
  }
  if (request.method !== 'POST') return response({ ok: false, error: 'Phương thức không được hỗ trợ.' }, 405, origin);
  if (!ORIGINS.has(origin)) return response({ ok: false, error: 'Origin không được phép.' }, 403, origin);

  try {
    const body = await request.json();
    const bearer = clean(request.headers.get('authorization') || '', 4096).replace(/^Bearer\s+/i, '');
    if (!bearer) throw fail('Phiên đăng ký đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.', 401, 'missing_id_token');

    const { auth, db } = admin();
    const decoded = await auth.verifyIdToken(bearer, true);
    const uid = String(decoded.uid || '');
    const email = lower(decoded.email);
    const requestedEmail = lower(body?.email);
    if (!uid || !email || email !== requestedEmail) {
      throw fail('Email đăng ký không khớp tài khoản Firebase đang đăng nhập.', 403, 'identity_mismatch');
    }

    const displayName = clean(body?.displayName, 80);
    const province = clean(body?.province);
    const ward = clean(body?.ward);
    const newSchool = clean(body?.newSchool);
    const newClass = clean(body?.newClass, 80);
    const submittedSchoolId = newSchool ? '' : clean(body?.schoolId, 80);
    const school = validateSchool(body?.catalogSchool, submittedSchoolId, province, ward);
    if (school && (clean(body?.provinceId, 8) !== school.provinceId || clean(body?.wardId, 32) !== school.wardId)) {
      throw fail('Trường không thuộc xã/phường đang chọn. Hãy chọn lại danh mục.', 400, 'catalog_place_mismatch');
    }
    const schoolId = school?.schoolId || '';
    const schoolName = school?.name || newSchool;
    const requestedClassName = newClass || clean(body?.selectedClassName, 80);
    const selectedClass = validateClass(newClass ? '' : clean(body?.classId, 100), school, requestedClassName);
    const classIds = selectedClass.classId ? [selectedClass.classId] : [];

    if (!displayName) throw fail('Hãy nhập họ và tên.');
    if (!province || !ward) throw fail('Hãy chọn tỉnh/thành phố và xã/phường.');
    if (!schoolId && !newSchool) throw fail('Hãy chọn trường hoặc nhập tên trường mới.');
    if (!requestedClassName) throw fail('Hãy chọn lớp hoặc nhập tên lớp mới.');
    if (newSchool && newSchool.length < 3) throw fail('Tên trường mới cần ít nhất 3 ký tự.');
    if (newClass && newClass.length < 1) throw fail('Tên lớp mới không hợp lệ.');

    const userRef = db.collection('users').doc(uid);
    let wasExisting = false;
    await db.runTransaction(async tx => {
      const snap = await tx.get(userRef);
      const current = snap.exists ? snap.data() || {} : {};
      if (snap.exists) {
        wasExisting = true;
        const role = String(current.role || '').toLowerCase();
        if (lower(current.email || email) !== email) throw fail('Hồ sơ tài khoản không khớp email.', 409, 'profile_email_mismatch');
        if (role !== 'pending_teacher_verification') {
          throw fail('Tài khoản này đã có hồ sơ KatLearn. Hãy đăng nhập hoặc liên hệ Admin nếu cần điều chỉnh.', 409, 'profile_already_exists');
        }
      }
      const now = Date.now();
      const profile = {
        displayName, email, role: 'pending_teacher_verification',
        province, ward, schoolId, schoolName,
        catalogClassId: selectedClass.classId,
        classIds,
        coins: 0, energy: 0, streak: 0, lastStudyDay: '',
        dailyQuestions: 0, dailyCorrect: 0, questionsAnswered: 0, correctAnswers: 0,
        knownWords: 0, ownedThemes: [], joinedClassIds: [], teacherUid: '', teacherUids: [],
        teacherVerification: {
          status: 'pending', submittedAt: current.teacherVerification?.submittedAt || now,
          verifiedAt: null, verifiedBy: null,
          requestedSchoolName: newSchool,
          requestedClassName,
          catalogSchool: school,
          catalogClassId: selectedClass.classId,
          catalogClassName: selectedClass.name,
          catalogGrade: selectedClass.grade,
          requestedProvinceId: clean(body?.provinceId, 8),
          requestedWardId: clean(body?.wardId, 32),
          source: 'teacher-signup'
        },
        createdAt: current.createdAt || now,
        updatedAt: now
      };
      tx.set(userRef, profile, { merge: false });
    });
    return response({ ok: true, uid, status: 'pending_teacher_verification', existing: wasExisting }, 200, origin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    const messages = {
      'auth/id-token-revoked': 'Phiên đăng nhập đã bị thu hồi. Hãy đăng ký lại.',
      'auth/argument-error': 'Phiên đăng nhập không hợp lệ. Hãy tải lại trang và thử lại.',
      'auth/id-token-expired': 'Phiên đăng ký đã hết hạn. Hãy đăng nhập lại rồi thử tiếp.'
    };
    const message = messages[error?.code] || error?.message || 'Không thể lưu hồ sơ giáo viên.';
    console.error('[KatLearn teacher-register]', error?.code || '', message);
    return response({ ok: false, error: message, code: error?.code || 'teacher_registration_failed' }, status, origin);
  }
};
