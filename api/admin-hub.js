import{headers,forward}from"./_admin-proxy.js";
export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).set({...headers(req),"Content-Length":"0"}).end();
  try{
    const method=req.method==="POST"?"POST":"GET";
    return await forward(req,res,"/admin-hub",method);
  }catch(error){
    console.error("[KatLearn Admin Hub proxy]",error);
    return res.status(502).set(headers(req)).json({ok:false,error:"Không kết nối được Admin backend: "+String(error?.message||error)});
  }
}
