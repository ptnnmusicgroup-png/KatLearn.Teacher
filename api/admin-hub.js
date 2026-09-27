import{headers,forward,errorMessage}from"./_admin-proxy.js";
export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).set({...headers(req),"Content-Length":"0"}).end();
  if(req.method!=="GET"&&req.method!=="POST")return res.status(405).set(headers(req)).json({ok:false,error:"Method not allowed",code:"method_not_allowed"});
  try{
    return await forward(req,res,"/admin-hub",req.method);
  }catch(error){
    const message=errorMessage(error);
    console.error("[KatLearn Admin Hub proxy]",error);
    return res.status(502).set(headers(req)).json({
      ok:false,
      error:"Không kết nối được Admin backend: "+message,
      code:"admin_upstream_unreachable",
      details:{message}
    });
  }
}