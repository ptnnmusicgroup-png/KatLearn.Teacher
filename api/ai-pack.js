const STUDENT_AI_URL='https://lms-katlearn.vercel.app/api/ai-pack';

export default async function handler(req,res){
  const origin=req.headers.origin||'';
  const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
  if(req.method==='OPTIONS')return res.status(204).set(headers).end();
  if(req.method!=='POST')return res.status(405).set(headers).json({error:'Method Not Allowed'});
  const auth=req.headers.authorization||'';
  if(!/^Bearer\\s+.+/i.test(auth))return res.status(401).set(headers).json({error:'Bạn cần đăng nhập để dùng Kat AI.'});
  try{
    const response=await fetch(STUDENT_AI_URL,{method:'POST',headers:{'content-type':'application/json',authorization:auth},body:JSON.stringify(req.body||{})});
    const text=await response.text();
    res.status(response.status).set(headers);
    return res.send(text);
  }catch(error){
    return res.status(502).set(headers).json({error:'Không kết nối được Kat AI: '+String(error.message||error)});
  }
}
