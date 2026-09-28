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

function responseHeaders(origin,contentType="application/json; charset=utf-8"){
  const h=new Headers();
  h.set("Content-Type",contentType);
  h.set("Cache-Control","no-store");
  h.set("X-KatLearn-Admin-Proxy","1");
  if(origin===ALLOWED_ORIGIN){
    h.set("Access-Control-Allow-Origin",origin);
    h.set("Access-Control-Allow-Headers","authorization,content-type,accept");
    h.set("Access-Control-Allow-Methods","GET,POST,OPTIONS");
    h.set("Vary","Origin");
  }
  return h;
}

function search(request){
  try{return new URL(request.url).search}catch(_){return""}
}

export default async function handler(request){
  const origin=String(request.headers.get("origin")||"");
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:responseHeaders(origin)});
  if(request.method!=="GET"&&request.method!=="POST"){
    return Response.json({ok:false,error:"Method not allowed",code:"method_not_allowed"},{status:405,headers:responseHeaders(origin)});
  }

  const auth=String(request.headers.get("authorization")||"").trim();
  if(!auth){
    return Response.json({ok:false,error:"Bạn cần đăng nhập Admin.",code:"missing_admin_token"},{status:401,headers:responseHeaders(origin)});
  }

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const headers={authorization:auth,accept:"application/json"};
    let body;
    if(request.method==="POST"){
      headers["content-type"]=String(request.headers.get("content-type")||"application/json");
      body=await request.text();
    }
    const response=await fetch(UPSTREAM+search(request),{
      method:request.method,
      headers,
      ...(request.method==="POST"?{body}:{}),
      signal:controller.signal
    });
    const text=await response.text();
    const contentType=response.headers.get("content-type")||"application/json; charset=utf-8";
    return new Response(text,{status:response.status,headers:responseHeaders(origin,contentType)});
  }catch(error){
    const message=error?.name==="AbortError"?"Admin backend phản hồi quá lâu.":errorMessage(error);
    console.error("[KatLearn Admin Hub proxy]",message);
    return Response.json({
      ok:false,
      error:"Không kết nối được Admin backend: "+message,
      code:error?.name==="AbortError"?"admin_upstream_timeout":"admin_upstream_unreachable",
      details:{message}
    },{status:502,headers:responseHeaders(origin)});
  }finally{
    clearTimeout(timer);
  }
}
