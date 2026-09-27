const UPSTREAM="https://lms-katlearn.vercel.app/api";
const UPSTREAM_TIMEOUT_MS=55000;

function errorMessage(error,fallback="Lỗi kết nối Admin backend."){
  if(error==null)return fallback;
  if(typeof error==="string"&&error.trim())return error;
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
  const h={"Content-Type":"application/json","Cache-Control":"no-store"};
  if(origin==="https://teacher-katlearn.vercel.app"){
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Headers"]="authorization,content-type";
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
    h["Vary"]="Origin";
  }
  return h;
}

export async function forward(req,res,path,method){
  const requestHeaders={};
  const auth=req.headers?.authorization;
  if(auth)requestHeaders.authorization=auth;
  if(method==="POST")requestHeaders["content-type"]=req.headers?.["content-type"]||"application/json";
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
  try{
    const response=await fetch(UPSTREAM+path,{
      method,
      headers:requestHeaders,
      ...(method==="POST"?{body:JSON.stringify(req.body||{})}:{}),
      signal:controller.signal
    });
    const body=await response.text();
    const h=headers(req);
    const contentType=response.headers.get("content-type");
    if(contentType)h["Content-Type"]=contentType;
    return res.status(response.status).set(h).send(body);
  }finally{
    clearTimeout(timer);
  }
}

export{errorMessage};