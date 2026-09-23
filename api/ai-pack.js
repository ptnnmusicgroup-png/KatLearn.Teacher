import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const STUDENT_AI_URL='https://lms-katlearn.vercel.app/api/ai-pack';

function admin(){
  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured'),{status:503});
    initializeApp({credential:cert(JSON.parse(raw))});
  }
  return{auth:getAuth(),db:getFirestore()};
}

export default async function handler(req,res){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if(req.method==='OPTIONS')return res.status(204).set(headers).end();
  if(req.method!=='POST')return res.status(405).set(headers).json({error:'Method Not Allowed'});
  const authorization=req.headers.authorization||'';
  if(!/^Bearer\s+.+/i.test(authorization))return res.status(401).set(headers).json({error:'Bạn cần đăng nhập để dùng Kat AI.'});
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
    if(!teacher)return res.status(403).set(headers).json({error:'Chỉ giáo viên được dùng tính năng này.'});

    const response=await fetch(STUDENT_AI_URL,{
      method:'POST',
      headers:{'content-type':'application/json',authorization},
      body:JSON.stringify(req.body||{})
    });
    const text=await response.text();
    res.status(response.status).set(headers);
    return res.send(text);
  }catch(error){
    const status=Number(error?.status||error?.statusCode||0);
    if(status===403)return res.status(403).set(headers).json({error:'Chỉ giáo viên được dùng tính năng này.'});
    if(status===401)return res.status(401).set(headers).json({error:'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.'});
    return res.status(502).set(headers).json({error:'Không kết nối được Kat AI: '+String(error.message||error)});
  }
}
