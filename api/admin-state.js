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

function authToken(req){
  const header=String(req.headers?.authorization||'');
  const match=/^Bearer\\s+(.+)$/i.exec(header);
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

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  try{
    const {auth,db}=admin();
    const token=await auth.verifyIdToken(authToken(req),true);
    if(String(token.email||'').toLowerCase()!==ADMIN_EMAIL){
      return res.status(403).json({error:'Tài khoản không có quyền Admin.'});
    }

    const [usersSnap,classesSnap,packsSnap,schoolsSnap]=await Promise.all([
      db.collection('users').get(),
      db.collection('classes').get(),
      db.collection('publicPacks').get(),
      db.collection('schools').get()
    ]);

    const users=rows(usersSnap);
    const pending=users
      .filter(u=>String(u.role||'').toLowerCase()==='pending_teacher_verification')
      .sort((a,b)=>Number(a.teacherVerification?.submittedAt||a.createdAt||0)-Number(b.teacherVerification?.submittedAt||b.createdAt||0));

    return res.status(200).json({
      ok:true,
      users,
      classes:rows(classesSnap),
      packs:rows(packsSnap).sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)),
      schools:rows(schoolsSnap),
      pending
    });
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0)||500;
    console.error('[KatLearn admin state]',error);
    return res.status(status).json({ok:false,error:error?.message||'Không thể tải dữ liệu quản trị.'});
  }
}
