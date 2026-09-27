const UPSTREAM="https://lms-katlearn.vercel.app/api/admin-hub";
const TIMEOUT_MS=55000;
const ALLOWED_ORIGIN="https://teacher-katlearn.vercel.app";

function errorMessage(error){
  if(error==null)return"Lỗi kết nối Admin backend.";
  if(typeof error==="string"&&error.trim())return error.trim();
  if(typeof error?.message==="string"&&error.message.trim())return error.message.trim();
  if(typeof error?.error==="string"&&error.error.trim())return error.error.trim();
  if(typeof error?.error?.message==="string"&&error.error.message.trim())return error.error.message.trim();
  try{
    const value=JSON.stringify(error);
    if(value&&value!=="{}")return value;
  }catch(_){}
  return String(error)||"Lỗi kết nối Admin backend.";
}
function headers(req){
  const origin=String(req.headers?.origin||"");
  const h={
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-KatLearn-Admin-Proxy":"1"
  };
  if(origin===ALLOWED_ORIGIN){
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Headers"]="authorization,content-type,accept";
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
    h["Vary"]="Origin";
  }
  return h;
}
function search(req){
  try{return new URL(String(req.url||"/"),"http://teacher-katlearn.local").search}catch(_){
    const raw=String(req.url||"");const i=raw.indexOf("?");
    return i>=0?raw.slice(i):"";
  }
}
export default async function handler(req,res){
  const h=headers(req);
  if(req.method==="OPTIONS")return res.status(204).set({...h,"Content-Length":"0"}).end();
  if(req.method!=="GET"&&req.method!=="POST"){
    return res.status(405).set(h).json({ok:false,error:"Method not allowed",code:"method_not_allowed"});
  }

  const auth=String(req.headers?.authorization||"").trim();
  if(!auth)return res.status(401).set(h).json({ok:false,error:"Bạn cần đăng nhập Admin.",code:"missing_admin_token"});

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const requestHeaders={authorization:auth,accept:"application/json"};
    if(req.method==="POST")requestHeaders["content-type"]=String(req.headers?.["content-type"]||"application/json");
    const response=await fetch(UPSTREAM+search(req),{
      method:req.method,
      headers:requestHeaders,
      ...(req.method==="POST"?{body:JSON.stringify(req.body&&typeof req.body==="object"?req.body:{})}:{}),
      signal:controller.signal
    });
    const body=await response.text();
    const contentType=response.headers.get("content-type");
    if(contentType)h["Content-Type"]=contentType;
    return res.status(response.status).set(h).send(body);
  }catch(error){
    const message=errorMessage(error);
    console.error("[KatLearn Admin Hub proxy]",message);
    return res.status(502).set(h).json({
      ok:false,
      error:"Không kết nối được Admin backend: "+message,
      code:"admin_upstream_unreachable",
      details:{message}
    });
  }finally{
    clearTimeout(timer);
  }
}
