import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAIL='katlearn.admin@gmail.com';

function admin(){
  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured'),{status:503});
    let serviceAccount;
    try{serviceAccount=JSON.parse(raw)}catch(_){throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid'),{status:503})}
    initializeApp({credential:cert(serviceAccount)});
  }
  return {auth:getAuth(),db:getFirestore()};
}

function tokenFrom(req){
  const match=/^Bearer\s+(.+)$/i.exec(String(req.headers?.authorization||''));
  if(!match)throw Object.assign(new Error('Bạn cần đăng nhập Admin.'),{status:401});
  return match[1];
}

function clean(value,max=200){
  return String(value??'').trim().slice(0,max);
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  try{
    const {auth,db}=admin();
    const token=await auth.verifyIdToken(tokenFrom(req),true);
    if(String(token.email||'').toLowerCase()!==ADMIN_EMAIL){
      return res.status(403).json({error:'Tài khoản không có quyền Admin.'});
    }

    const body=req.body||{};
    const uid=clean(body.uid,160);
    if(!uid)throw Object.assign(new Error('Thiếu tài khoản giáo viên.'),{status:400});

    const ref=db.collection('users').doc(uid);
    const snap=await ref.get();
    if(!snap.exists)throw Object.assign(new Error('Không tìm thấy hồ sơ giáo viên.'),{status:404});

    const profile=snap.data()||{};
    const requested=profile.teacherVerification||{};
    let schoolId=clean(profile.schoolId);
    let schoolName=clean(profile.schoolName);
    const classIds=Array.isArray(profile.classIds)?profile.classIds.filter(Boolean).slice(0,20):[];
    const province=clean(profile.province);
    const ward=clean(profile.ward);
    const requestedSchoolName=clean(requested.requestedSchoolName);
    const requestedClassName=clean(requested.requestedClassName);

    if(schoolId){
      const schoolSnap=await db.collection('schools').doc(schoolId).get();
      if(!schoolSnap.exists||clean(schoolSnap.data()?.province)!==province||clean(schoolSnap.data()?.ward)!==ward){
        schoolId='';
      }else{
        schoolName=clean(schoolSnap.data()?.name)||schoolName;
      }
    }

    if(!schoolId&&requestedSchoolName){
      const sameName=await db.collection('schools').where('name','==',requestedSchoolName).get();
      const existing=sameName.docs
        .map(d=>({id:d.id,...d.data()}))
        .find(s=>clean(s.province)===province&&clean(s.ward)===ward);
      if(existing){
        schoolId=existing.id;
        schoolName=clean(existing.name)||requestedSchoolName;
      }else{
        const newSchool=await db.collection('schools').add({
          name:requestedSchoolName,
          province,
          ward,
          createdBy:uid,
          createdAt:Date.now(),
          updatedAt:Date.now()
        });
        schoolId=newSchool.id;
        schoolName=requestedSchoolName;
      }
    }

    if(!schoolId)throw Object.assign(new Error('Hồ sơ chưa có trường hợp lệ.'),{status:400});

    const schoolCatalogRef=db.collection('KatLearn_Teacher_Schools').doc(schoolId);
    await schoolCatalogRef.set({
      name:schoolName,
      schoolId,
      province,
      ward,
      source:'teacher_verification',
      updatedAt:Date.now()
    },{merge:true});

    const validClassIds=[];
    for(const classId of classIds){
      const cs=await db.collection('schools').doc(schoolId).collection('classes').doc(classId).get();
      if(cs.exists)validClassIds.push(classId);
    }

    if(!validClassIds.length&&requestedClassName){
      const sameClass=await db.collection('schools').doc(schoolId).collection('classes').where('name','==',requestedClassName).get();
      const existing=sameClass.docs[0];
      if(existing){
        validClassIds.push(existing.id);
      }else{
        const newClass=await db.collection('schools').doc(schoolId).collection('classes').add({
          name:requestedClassName,
          createdBy:uid,
          createdAt:Date.now(),
          updatedAt:Date.now()
        });
        validClassIds.push(newClass.id);
      }
    }

    if(!validClassIds.length)throw Object.assign(new Error('Hồ sơ chưa có lớp hợp lệ.'),{status:400});

    const catalogClassId=clean(profile.catalogClassId&&validClassIds.includes(profile.catalogClassId)?profile.catalogClassId:validClassIds[0]);
    await ref.set({
      role:'teacher',
      schoolId,
      schoolName,
      province,
      ward,
      classIds:validClassIds,
      catalogClassId,
      teacherVerification:{
        ...requested,
        status:'verified',
        verifiedAt:Date.now(),
        verifiedBy:token.uid
      },
      updatedAt:Date.now()
    },{merge:true});

    return res.status(200).json({
      ok:true,
      uid,
      schoolId,
      schoolName,
      province,
      ward,
      classIds:validClassIds,
      catalogClassId
    });
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0)||500;
    console.error('[KatLearn admin verify teacher]',error);
    return res.status(status).json({ok:false,error:error?.message||'Không thể xác minh giáo viên.'});
  }
}
