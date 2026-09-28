import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const STUDENT_AI_URL='https://lms-katlearn.vercel.app/api/ai-pack';

function admin(){
  if(!getApps().length){
    const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
    if(!raw)throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured'),{status:503,code:'firebase_credentials_missing'});
    let credentials;
    try{credentials=JSON.parse(raw)}catch(_){throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid'),{status:503,code:'firebase_credentials_invalid'})}
    initializeApp({credential:cert(credentials)});
  }
  return{auth:getAuth(),db:getFirestore()};
}

function headers(){
  return{'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
}

function json(body,status=200){
  return new Response(JSON.stringify(body),{status,headers:headers()});
}

export default async function handler(request){
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers()});
  if(request.method!=='POST')return json({error:'Method Not Allowed'},405);

  const authorization=request.headers.get('authorization')||'';
  if(!/^Bearer\s+.+/i.test(authorization))return json({error:'Bạn cần đăng nhập để dùng Kat AI.'},401);

  try{
    const token=authorization.replace(/^Bearer\s+/i,'');
    const {auth,db}=admin();
    const decoded=await auth.verifyIdToken(token,true);
    const email=String(decoded.email||'').toLowerCase();
    let teacher=decoded.teacherAccess===true||String(decoded.role||'').toLowerCase()==='teacher'||email==='katlearn.admin@gmail.com';
    if(!teacher){
      const profile=await db.collection('users').doc(decoded.uid).get();
      teacher=profile.exists&&String(profile.data()?.role||'').toLowerCase()==='teacher';
    }
    if(!teacher)return json({error:'Chỉ giáo viên được dùng tính năng này.'},403);

    const requestBody=await request.text();
    const response=await fetch(STUDENT_AI_URL,{
      method:'POST',
      headers:{'content-type':request.headers.get('content-type')||'application/json',authorization},
      body:requestBody
    });
    const text=await response.text();
    return new Response(text,{status:response.status,headers:{
      ...headers(),
      'content-type':response.headers.get('content-type')||'application/json; charset=utf-8'
    }});
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0);
    if(status===403)return json({error:'Chỉ giáo viên được dùng tính năng này.'},403);
    if(status===401)return json({error:'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.'},401);
    console.error('[KatLearn Teacher Kat AI]',error);
    return json({error:'Không kết nối được Kat AI: '+String(error?.message||error)},502);
  }
}
