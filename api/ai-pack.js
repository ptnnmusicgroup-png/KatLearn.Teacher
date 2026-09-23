import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const STUDENT_AI_URL='https://lms-katlearn.vercel.app/api/ai-pack';

function adminAuth(){
  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured'),{status:503});
    initializeApp({credential:cert(JSON.parse(raw))});
  }
  return getAuth();
}

export default async function handler(req,res){
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if(req.method==='OPTIONS')return res.status(204).set(headers).end();
  if(req.method!=='POST')return res.status(405).set(headers).json({error:'Method Not Allowed'});
  const auth=req.headers.authorization||'';
  if(!/^Bearer\s+.+/i.test(auth))return res.status(401).set(headers).json({error:'Bạn cần đăng nhập để dùng Kat AI.'});
  try{
    const token=auth.replace(/^Bearer\s+/i,'');
    const decoded=await adminAuth().verifyIdToken(token);
    if(decoded.teacherAccess!==true && String(decoded.role||'').toLowerCase()!=='teacher'){
      return res.status(403).set(headers).json({error:'Chỉ giáo viên được dùng tính năng này.'});
    }
    const response=await fetch(STUDENT_AI_URL,{method:'POST',headers:{'content-type':'application/json',authorization:auth},body:JSON.stringify(req.body||{})});
    const text=await response.text();
    res.status(response.status).set(headers);
    return res.send(text);
  }catch(error){
    const status=Number(error?.status||0);
    if(status===403)return res.status(403).set(headers).json({error:'Chỉ giáo viên được dùng tính năng này.'});
    if(status===401)return res.status(401).set(headers).json({error:'Phiên đăng nhập không hợp lệ. Hãy đăng nhập lại.'});
    return res.status(502).set(headers).json({error:'Không kết nối được Kat AI: '+String(error.message||error)});
  }
}
