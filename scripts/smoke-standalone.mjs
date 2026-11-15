import assert from "node:assert/strict";
import {createServer} from "../server.js";

async function main(){
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  const base="http://127.0.0.1:"+server.address().port;
  try{
    const health=await fetch(base+"/healthz");
    assert.equal(health.status,200);
    assert.equal((await health.json()).service,"katlearn-teacher-standalone");

    const home=await fetch(base+"/");
    assert.equal(home.status,200);
    const html=await home.text();
    assert.match(html,/deployment-config\.js/);

    const config=await fetch(base+"/deployment-config.js");
    assert.equal(config.status,200);
    const configText=await config.text();
    assert.match(configText,/KATLEARN_DEPLOYMENT_CONFIG/);
    assert.doesNotMatch(configText,/netlify\.app/i);

    const admin=await fetch(base+"/api/admin-hub?section=overview");
    assert.equal(admin.status,503);
    assert.equal((await admin.json()).code,"lms_url_missing");

    assert.equal((await fetch(base+"/api/not-an-endpoint")).status,404);
    assert.equal((await fetch(base+"/api/_firebase-admin.js")).status,404);
    assert.equal((await fetch(base+"/server.js")).status,404);
    assert.equal((await fetch(base+"/.env.example")).status,404);
    console.log("Teacher standalone smoke test passed: health, runtime config, Admin proxy guard, API routing, and private-file protection.");
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error("Teacher standalone smoke test failed:",error);process.exitCode=1});
