"use strict";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

const ROOT=path.resolve(process.cwd());
const HOST=String(process.env.HOST||"127.0.0.1").trim()||"127.0.0.1";
const PORT=Number.parseInt(process.env.PORT||"3100",10);
const MAX_BODY_BYTES=10*1024*1024;
const API_ENDPOINTS=new Set(["admin-hub","ai-pack","auth-exchange","teacher-manage","teacher-register"]);
const BLOCKED_SEGMENTS=new Set([".git",".github","api","dist","netlify","node_modules","scripts"]);
const BLOCKED_FILES=new Set(["server.js","package.json","package-lock.json","pnpm-lock.yaml","yarn.lock","firestore.rules"]);
const MIME_TYPES=Object.freeze({
 ".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".mjs":"text/javascript; charset=utf-8",
 ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml",
 ".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",
 ".ico":"image/x-icon",".woff":"font/woff",".woff2":"font/woff2",".ttf":"font/ttf",".otf":"font/otf",
 ".txt":"text/plain; charset=utf-8",".xml":"application/xml; charset=utf-8",".webmanifest":"application/manifest+json; charset=utf-8"
});

function securityHeaders(){return{"x-content-type-options":"nosniff","referrer-policy":"strict-origin-when-cross-origin","x-frame-options":"SAMEORIGIN"}}
function sendJson(res,status,value,extra={}){res.writeHead(status,{...securityHeaders(),"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra});res.end(JSON.stringify(value))}
function readBody(req){
 return new Promise((resolve,reject)=>{
  const chunks=[];let size=0,tooLarge=false;
  req.on("data",chunk=>{size+=chunk.length;if(size>MAX_BODY_BYTES){tooLarge=true;chunks.length=0}else if(!tooLarge)chunks.push(chunk)});
  req.on("end",()=>{if(tooLarge){reject(Object.assign(new Error("Request body too large"),{status:413}));return}resolve(size?Buffer.concat(chunks):null)});
  req.on("error",reject);
 });
}
function deploymentConfigScript(){
 const clean=value=>{try{const url=new URL(String(value||"").trim());return url.protocol==="http:"||url.protocol==="https:"?url.origin:""}catch(_){return""}};
 return"window.KATLEARN_DEPLOYMENT_CONFIG = Object.freeze("+JSON.stringify({
  lmsUrl:clean(process.env.KATLEARN_LMS_SITE_URL),
  teacherUrl:clean(process.env.KATLEARN_TEACHER_SITE_URL)
 })+");\n";
}
function injectRuntimeConfig(html){
 if(/src=["']\/?deployment-config\.js(?:\?[^"']*)?["']/i.test(html))return html;
 const script='<script src="/deployment-config.js"></script>';
 return /<head\b[^>]*>/i.test(html)?html.replace(/<head\b[^>]*>/i,head=>head+"\n  "+script):script+"\n"+html;
}
async function handleApi(req,res,url,endpoint){
 if(!API_ENDPOINTS.has(endpoint)){sendJson(res,404,{ok:false,error:"API endpoint not found."});return}
 const method=String(req.method||"GET").toUpperCase();
 if(!["GET","POST","OPTIONS"].includes(method)){sendJson(res,405,{ok:false,error:"Method not allowed."},{allow:"GET, POST, OPTIONS"});return}
 let body=null;
 try{if(method!=="GET"&&method!=="OPTIONS"){const raw=await readBody(req);body=raw?raw.toString("utf8"):null}}
 catch(error){sendJson(res,Number(error.status)||400,{ok:false,error:error.status===413?"Request body quá lớn.":"Request body không hợp lệ."});return}
 const headers=new Headers();
 for(const[key,value]of Object.entries(req.headers||{})){
  if(value===undefined)continue;
  headers.set(key,Array.isArray(value)?value.join(", "):String(value));
 }
 const request=new Request("http://"+String(req.headers.host||"localhost")+url.pathname+url.search,{
  method,headers,...(body!==null?{body}:{})
 });
 try{
  const modulePath=pathToFileURL(path.join(ROOT,"api",endpoint+".js")).href;
  const loaded=await import(modulePath);
  const handler=loaded.default;
  const response=typeof handler==="function"?await handler(request):
   (handler&&typeof handler.fetch==="function"?await handler.fetch(request):null);
  if(!(response instanceof Response)){sendJson(res,500,{ok:false,error:"API handler không trả về Response hợp lệ."});return}
  const responseHeaders={...securityHeaders()};
  response.headers.forEach((value,key)=>{responseHeaders[key]=value});
  const payload=Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status,responseHeaders);
  if(response.status===204||response.status===304||method==="HEAD")res.end();else res.end(payload);
 }catch(error){
  console.error("[KatLearn Teacher API]",endpoint,error?.code||"handler_error",Number(error?.status)||500,String(error?.message||error));
  sendJson(res,Number(error?.status||error?.statusCode)||500,{ok:false,error:Number(error?.status||error?.statusCode)>=500?"Server gặp lỗi khi xử lý yêu cầu. Hãy thử lại sau.":String(error?.message||"Yêu cầu không hợp lệ.")});
 }
}
async function serveStatic(req,res,url){
 const method=String(req.method||"GET").toUpperCase();
 if(method!=="GET"&&method!=="HEAD"){sendJson(res,405,{ok:false,error:"Method not allowed."},{allow:"GET, HEAD"});return}
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch(_){sendJson(res,400,{ok:false,error:"Bad request."});return}
 if(pathname==="/favicon.ico")pathname="/favicon.svg";
 const relative=(pathname==="/"? "index.html":pathname).replace(/^[/\\]+/,"");
 const parts=relative.split(/[/\\]+/).filter(Boolean);
 const leaf=(parts[parts.length-1]||"").toLowerCase();
 const looksLikeServiceAccount=leaf.endsWith(".json")&&/(service.?account|firebase.*adminsdk|adminsdk)/i.test(leaf);
 if(!relative||looksLikeServiceAccount||parts.some(part=>part.startsWith(".")||BLOCKED_SEGMENTS.has(part.toLowerCase()))||BLOCKED_FILES.has(leaf)){
  sendJson(res,404,{ok:false,error:"Not found."});return
 }
 const file=path.resolve(ROOT,relative);
 if(!file.startsWith(ROOT+path.sep)){sendJson(res,404,{ok:false,error:"Not found."});return}
 let content;try{const stat=await fs.promises.stat(file);if(!stat.isFile()){sendJson(res,404,{ok:false,error:"Not found."});return}content=await fs.promises.readFile(file)}catch(_){sendJson(res,404,{ok:false,error:"Not found."});return}
 const ext=path.extname(file).toLowerCase(),headers={...securityHeaders(),"content-type":MIME_TYPES[ext]||"application/octet-stream","cache-control":"no-store"};
 if(ext===".html")content=Buffer.from(injectRuntimeConfig(content.toString("utf8")),"utf8");
 res.writeHead(200,headers);res.end(method==="HEAD"?undefined:content);
}
export function createServer(){
 return http.createServer(async(req,res)=>{
  let url;try{url=new URL(req.url||"/","http://localhost")}catch(_){sendJson(res,400,{ok:false,error:"Bad request."});return}
  if(url.pathname==="/healthz"){sendJson(res,200,{ok:true,service:"katlearn-teacher-standalone"});return}
  if(url.pathname==="/deployment-config.js"){res.writeHead(200,{...securityHeaders(),"content-type":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(deploymentConfigScript());return}
  if(url.pathname==="/api"||url.pathname.startsWith("/api/")){const endpoint=url.pathname.slice("/api/".length).replace(/\/+$/,"");await handleApi(req,res,url,endpoint);return}
  await serveStatic(req,res,url);
 });
}
if(import.meta.url===pathToFileURL(process.argv[1]||"").href){
 if(!Number.isInteger(PORT)||PORT<1||PORT>65535)throw new Error("PORT must be an integer between 1 and 65535.");
 const server=createServer();server.on("error",error=>{console.error("[KatLearn Teacher] Server startup failed:",error.code||"server_error");process.exitCode=1});
 server.listen(PORT,HOST,()=>{console.log("--------------------------------------");console.log(" KatLearn Teacher Standalone Node.js Server");console.log(" URL: http://localhost:"+PORT);console.log(" API: "+API_ENDPOINTS.size+" direct Node.js endpoints");console.log(" Bind: "+HOST);console.log("--------------------------------------")});
}
