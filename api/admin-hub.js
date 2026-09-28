const UPSTREAM="https://lms-katlearn.vercel.app/api/admin-hub";
const TIMEOUT_MS=55000;
const ALLOWED_ORIGIN="https://teacher-katlearn.vercel.app";

function errorMessage(error){
  if(error==null)return"Lỗi kết nối Admin backend.";
  if(typeof error==="string"&&error.trim())return error.trim();
  if(typeof error?.message==="string"&&error.message.trim())return error.message.trim();
  if(typeof error?.error==="string"&&error.error.trim())return error.error.trim();
  if(typeof error?.error?.message==="string"&&error.error.message.trim())return error.error.message.trim();
  try{const value=JSON.stringify(error);if(value&&value!=="{}")return value}catch(_){}
  return String(error)||"Lỗi kết nối Admin backend.";
}

function responseHeaders(origin,contentType="application/json; charset=utf-8"){
  const h={"Content-Type":contentType,"Cache-Control":"no-store","X-KatLearn-Admin-Proxy":"1"};
  if(origin===ALLOWED_ORIGIN){
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Headers"]="authorization,content-type,accept";
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
    h["Vary"]="Origin";
  }
  return h;
}

function writeJson(res,status,body,origin=""){
  const payload=JSON.stringify(body);
  const headers=responseHeaders(origin);
  if(res&&typeof res.setHeader==="function"){
    for(const[key,value]of Object.entries(headers))res.setHeader(key,value);
    res.statusCode=Number(status)||200;
    if(typeof res.end==="function")return res.end(payload);
  }
  return new Response(payload,{status:Number(status)||200,headers});
}

async function readBody(req){
  if(req?.body!=null){
    if(typeof req.body==="string")return req.body;
    if(Buffer.isBuffer(req.body))return req.body.toString("utf8");
    if(typeof req.body==="object")return JSON.stringify(req.body);
  }
  return await new Promise((resolve,reject)=>{
    let chunks=[];
    req.on("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk))));
    req.on("end",()=>resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error",reject);
  });
}

function header(req,name){
  const key=String(name||"").toLowerCase();
  const headers=req?.headers;
  if(headers&&typeof headers.get==="function")return String(headers.get(key)||"");
  return String(headers?.[key]??"");
}

function requestQuery(req){
  try{return new URL(String(req?.url||"/"),"https://teacher-katlearn.vercel.app").search}
  catch(_){return""}
}

module.exports=undefined;
export default async function handler(req,res){
  const origin=header(req,"origin");
  if(req.method==="OPTIONS"){
    const headers=responseHeaders(origin);
    if(res&&typeof res.setHeader==="function"){
      for(const[key,value]of Object.entries(headers))res.setHeader(key,value);
      res.statusCode=204;
      return typeof res.end==="function"?res.end():new Response(null,{status:204,headers});
    }
    return new Response(null,{status:204,headers});
  }

  const authorization=header(req,"authorization").trim();
  if(!authorization||!/^Bearer\s+.+$/i.test(authorization)){
    return writeJson(res,401,{ok:false,error:"Bạn cần đăng nhập Admin.",code:"missing_admin_token"},origin);
  }
  if(req.method!=="GET"&&req.method!=="POST"){
    return writeJson(res,405,{ok:false,error:"Method not allowed",code:"method_not_allowed"},origin);
  }

  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),TIMEOUT_MS);
  try{
    const headers={authorization,accept:"application/json"};
    let body;
    if(req.method==="POST"){
      headers["content-type"]=header(req,"content-type")||"application/json";
      body=await readBody(req);
    }
    const response=await fetch(UPSTREAM+requestQuery(req),{
      method:req.method,
      headers,
      ...(req.method==="POST"?{body}:{}),
      signal:controller.signal
    });
    const text=await response.text();
    return writeJson(res,response.status,JSON.parse(text||"{}"),origin);
  }catch(error){
    const message=error?.name==="AbortError"?"Admin backend phản hồi quá lâu.":errorMessage(error);
    console.error("[KatLearn Admin Hub proxy]",message);
    return writeJson(res,502,{
      ok:false,
      error:"Không kết nối được Admin backend: "+message,
      code:error?.name==="AbortError"?"admin_upstream_timeout":"admin_upstream_unreachable",
      details:{message}
    },origin);
  }finally{
    clearTimeout(timer);
  }
}
