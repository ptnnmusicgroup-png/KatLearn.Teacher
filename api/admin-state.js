import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAIL='katlearn.admin@gmail.com';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};

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

function authToken(request){
  const header=String(request.headers.get('authorization')||'');
  const match=/^Bearer\s+(.+)$/i.exec(header);
  if(!match)throw Object.assign(new Error('Bạn cần đăng nhập Admin.'),{status:401});
  return match[1];
}

function serialize(value){
  if(value&&typeof value.toMillis==='function')return value.toMillis();
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value))out[k]=serialize(v);
    return out;
  }
  return value;
}

function rows(snapshot){
  return snapshot.docs.map(d=>({id:d.id,...serialize(d.data()||{})}));
}

export default async function handler(request){
  if(request.method!=='GET')return Response.json({ok:false,error:'Method not allowed'},{status:405,headers:JSON_HEADERS});
  try{
    const {auth,db}=admin();
    const token=await auth.verifyIdToken(authToken(request),true);
    if(String(token.email||'').toLowerCase()!==ADMIN_EMAIL){
      return Response.json({ok:false,error:'Tài khoản không có quyền Admin.'},{status:403,headers:JSON_HEADERS});
    }

    const [usersSnap,classesSnap,packsSnap,schoolsSnap]=await Promise.all([
      db.collection('users').select(
        'displayName','name','email','role','schoolName','className','accountCode',
        'coins','energy','teacherVerification','createdAt'
      ).get(),
      db.collection('classes').select(
        'name','grade','teacherEmail','schoolName','joinCode','studentCount','schoolId'
      ).get(),
      db.collection('publicPacks').select(
        'name','createdBy','createdByEmail','createdByUid','createdAt','wordCount','words'
      ).get(),
      db.collection('schools').select('name','province','ward').get()
    ]);

    const users=rows(usersSnap);
    const classes=rows(classesSnap);
    const packs=packsSnap.docs.map(d=>{
      const data=d.data()||{},safe=serialize(data);
      return {
        id:d.id,
        name:safe.name,
        createdBy:safe.createdBy,
        createdByEmail:safe.createdByEmail,
        createdByUid:safe.createdByUid,
        createdAt:safe.createdAt,
        wordCount:Number(safe.wordCount||0)||(
          Array.isArray(data.words)?data.words.length:0
        )
      };
    });
    const schools=rows(schoolsSnap);
    const pending=users
      .filter(u=>String(u.role||'').toLowerCase()==='pending_teacher_verification')
      .sort((a,b)=>Number(a.teacherVerification?.submittedAt||a.createdAt||0)-Number(b.teacherVerification?.submittedAt||b.createdAt||0));

    return Response.json({
      ok:true,
      stats:{
        users:users.length,
        teachers:users.filter(u=>String(u.role||'').toLowerCase()==='teacher').length,
        students:users.filter(u=>String(u.role||'').toLowerCase()==='student').length,
        pending:pending.length,
        classes:classes.length,
        packs:packs.length,
        schools:schools.length
      },
      users,
      classes,
      packs,
      schools,
      pending
    },{status:200,headers:JSON_HEADERS});
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0)||500;
    console.error('[KatLearn admin state]',error);
    return Response.json({ok:false,error:error?.message||'Không thể tải dữ liệu quản trị.'},{status,headers:JSON_HEADERS});
  }
}
