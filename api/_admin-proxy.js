const UPSTREAM="https://lms-katlearn.vercel.app/api";
const UPSTREAM_TIMEOUT_MS=55000;
const ALLOWED_ORIGIN="https://teacher-katlearn.vercel.app";

function errorMessage(error,fallback="Lỗi kết nối Admin backend."){
  if(error==null)return fallback;
  if(typeof error==="string"&&error.trim())return error.trim();
  if(typeof error?.message==="string"&&error.message)return error.message;
  if(typeof error?.error==="string"&&error.error)return error.error;
  if(typeof error?.error?.message==="string"&&error.error.message)return error.error.message;
  try{
    const json=JSON.stringify(error);
    if(json&&json!=="{}")return json;
  }catch(_){}
  return String(error)||fallback;
}

export function headers(req){
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

function queryString(req){
  try{
    const url=new URL(String(req.url||"/"),"http://teacher-katlearn.local");
    return url.search;
  }catch(_){
    const raw=String(req.url||"");
    const i=raw.indexOf("?");
    return i>=0?raw.slice(i):"";
  }
}

export async function forward(req,res,path,method){
  const requestHeaders={accept:"application/json"};
  const auth=String(req.headers?.authorization||"").trim();
  if(auth)requestHeaders.authorization=auth;
  if(method==="POST")requestHeaders["content-type"]=String(req.headers?.["content-type"]||"application/json");

  const target=UPSTREAM+String(path||"")+queryString(req);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);

  try{
    const response=await fetch(target,{
      method,
      headers:requestHeaders,
      ...(method==="POST"?{body:JSON.stringify(req.body&&typeof req.body==="object"?req.body:{})}:{}),
      signal:controller.signal
    });
    const body=await response.text();
    const h=headers(req);
    const contentType=response.headers.get("content-type");
    if(contentType)h["Content-Type"]=contentType;
    return res.status(response.status).set(h).send(body);
  }catch(error){
    const wrapped=new Error("Admin backend request failed: "+errorMessage(error));
    wrapped.cause=error;
    throw wrapped;
  }finally{
    clearTimeout(timer);
  }
}

export{errorMessage};
