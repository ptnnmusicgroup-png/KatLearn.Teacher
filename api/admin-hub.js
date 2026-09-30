const LMS_ADMIN="https://lms-katlearn.vercel.app/api/admin-hub";
const ALLOWED_ORIGINS=new Set(["https://teacher-katlearn.vercel.app","https://lms-katlearn.vercel.app","http://localhost:3000","http://localhost:5173"]);

function corsHeaders(origin){
  const h={"Content-Type":"application/json","Cache-Control":"no-store"};
  if(ALLOWED_ORIGINS.has(origin)){
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
    h["Access-Control-Allow-Headers"]="authorization,content-type,accept";
    h["Vary"]="Origin";
  }
  return h;
}

export const runtime="nodejs";

export default async function handler(request){
  const origin=request.headers.get("origin")||"";
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
  if(request.method!=="GET"&&request.method!=="POST")return new Response(JSON.stringify({ok:false,error:"Method not allowed",code:"method_not_allowed"}),{status:405,headers:corsHeaders(origin)});

  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try{
    const url=new URL(LMS_ADMIN);
    for(const[key,value] of new URL(request.url).searchParams)url.searchParams.set(key,value);

    const headers={Accept:"application/json"};
    const authorization=request.headers.get("authorization");
    if(authorization)headers.Authorization=authorization;
    const contentType=request.headers.get("content-type");
    if(contentType)headers["Content-Type"]=contentType;

    let body;
    if(request.method==="POST"){
      body=await request.text();
      if(body)headers["Content-Type"]="application/json";
    }

    const upstream=await fetch(url,{method:request.method,headers,body,cache:"no-store",signal:controller.signal});
    const payload=await upstream.text();
    return new Response(payload,{status:upstream.status,headers:{"Content-Type":upstream.headers.get("content-type")||"application/json","Cache-Control":"no-store",...corsHeaders(origin)}});
  }catch(error){
    const message=error?.name==="AbortError"
      ?"Admin Hub upstream phản hồi quá lâu."
      :"Không kết nối được Admin Hub upstream.";
    return new Response(JSON.stringify({ok:false,error:message,code:error?.name==="AbortError"?"admin_upstream_timeout":"admin_proxy_failed"}),{status:error?.name==="AbortError"?504:502,headers:corsHeaders(origin)});
  }finally{
    clearTimeout(timeout);
  }
}
