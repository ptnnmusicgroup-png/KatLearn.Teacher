const{headers,forward}=require("./_admin-proxy");

export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).set({...headers(req),"Content-Length":"0"}).end();
  if(req.method!=="POST")return res.status(405).set(headers(req)).json({ok:false,error:"Method not allowed"});
  try{return await forward(req,res,"/admin-verify-teacher","POST")}catch(error){
    console.error("[KatLearn teacher verification proxy]",error);
    return res.status(502).set(headers(req)).json({ok:false,error:"Không kết nối được backend Admin: "+String(error?.message||error)});
  }
}
