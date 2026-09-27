const UPSTREAM="https://lms-katlearn.vercel.app/api";

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
  const response=await fetch(UPSTREAM+path,{
    method,
    headers:requestHeaders,
    ...(method==="POST"?{body:JSON.stringify(req.body||{})}: {})
  });
  const body=await response.text();
  const h=headers(req);
  const contentType=response.headers.get("content-type");
  if(contentType)h["Content-Type"]=contentType;
  return res.status(response.status).set(h).send(body);
}
