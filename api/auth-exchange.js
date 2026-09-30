import { admin } from './_firebase-admin.js';

const allowedOrigins = new Set(['https://teacher-katlearn.vercel.app','https://lms-katlearn.vercel.app']);
function headers(origin){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};if(allowedOrigins.has(origin)){h['access-control-allow-origin']=origin;h['access-control-allow-methods']='POST, OPTIONS';h['access-control-allow-headers']='content-type';h['vary']='Origin'}return h}
const jsonResponse=(body,init={})=>new Response(JSON.stringify(body),init);

export default async request=>{
 const origin=request.headers.get('origin')||'';
 if(request.method==='OPTIONS')return new Response('',{status:204,headers:headers(origin)});
 if(request.method!=='POST')return jsonResponse({error:'Method not allowed'},{status:405,headers:headers(origin)});
 if(!allowedOrigins.has(origin))return jsonResponse({error:'Origin not allowed'},{status:403,headers:headers(origin)});
 try{
  const body=await request.json(),idToken=String(body?.idToken||''),target=String(body?.target||'teacher').toLowerCase();
  if(!idToken)return jsonResponse({error:'Missing ID token'},{status:400,headers:headers(origin)});
  const {auth,db}=admin();const decoded=await auth.verifyIdToken(idToken,true);const snap=await db.collection('users').doc(decoded.uid).get();const profile=snap.exists?snap.data():{};const role=String(profile?.role||'student').toLowerCase();const isAdmin=String(decoded.email||'').toLowerCase()==='katlearn.admin@gmail.com';
  if(target==='teacher'&&!isAdmin&&role!=='teacher')return jsonResponse({role:'student',error:'STUDENT_ACCOUNT'},{status:403,headers:headers(origin)});
  const customToken=await auth.createCustomToken(decoded.uid,{role:role==='teacher'||isAdmin?'teacher':'student',teacherAccess:role==='teacher'||isAdmin});
  return jsonResponse({role:role==='teacher'||isAdmin?'teacher':'student',customToken},{status:200,headers:headers(origin)});
 }catch(error){console.error('[KatLearn SSO]',error);return jsonResponse({error:'Invalid or expired session'},{status:401,headers:headers(origin)})}
};
