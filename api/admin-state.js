const{headers,forward}=require("./_admin-proxy");

export default async function handler(req,res){
  if(req.method==="OPTIONS")return res.status(204).set({...headers(req),"Content-Length":"0"}).end();
  if(req.method!=="GET")return res.status(405).set(headers(req)).json({ok:false,error:"Method not allowed"});
  try{return await forward(req,res,"/admin-state","GET")}catch(error){
    console.error("[KatLearn admin state proxy]",error);
    return res.status(502).set(headers(req)).json({ok:false,error:"Không kết nối được backend Admin: "+String(error?.message||error)});
  }
}
