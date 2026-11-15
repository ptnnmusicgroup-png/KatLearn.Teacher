import assert from "node:assert/strict";
import {createServer} from "../server.js";

async function main(){
  const server=createServer();
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve)});
  const base="http://127.0.0.1:"+server.address().port;
  const origin="http://127.0.0.1:3100";
  try{
    const health=await fetch(base+"/healthz");
    assert.equal(health.status,200);
    assert.equal((await health.json()).service,"katlearn-teacher-standalone");

    const home=await fetch(base+"/");
    assert.equal(home.status,200);
    assert.match(await home.text(),/deployment-config\.js/);

    const config=await fetch(base+"/deployment-config.js");
    assert.equal(config.status,200);
    const configText=await config.text();
    assert.match(configText,/KATLEARN_DEPLOYMENT_CONFIG/);
    assert.doesNotMatch(configText,/netlify\.app/i);

    const adminPreflight=await fetch(base+"/api/admin-hub",{method:"OPTIONS",headers:{Origin:origin}});
    assert.equal(adminPreflight.status,204);
    assert.equal(adminPreflight.headers.get("access-control-allow-origin"),origin);

    const ssoPreflight=await fetch(base+"/api/auth-exchange",{method:"OPTIONS",headers:{Origin:origin}});
    assert.equal(ssoPreflight.status,204);
    const managePreflight=await fetch(base+"/api/teacher-manage",{method:"OPTIONS",headers:{Origin:origin}});
    assert.equal(managePreflight.status,204);
    const registerPreflight=await fetch(base+"/api/teacher-register",{method:"OPTIONS",headers:{Origin:origin}});
    assert.equal(registerPreflight.status,200);

    const admin=await fetch(base+"/api/admin-hub?section=overview");
    assert.equal(admin.status,503);
    assert.equal((await admin.json()).code,"lms_url_missing");

    const authExchange=await fetch(base+"/api/auth-exchange",{
      method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({})
    });
    assert.equal(authExchange.status,400);

    const teacherRegister=await fetch(base+"/api/teacher-register",{
      method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({})
    });
    assert.equal(teacherRegister.status,401);

    const teacherManage=await fetch(base+"/api/teacher-manage",{
      method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({})
    });
    assert.equal(teacherManage.status,401);

    const ai=await fetch(base+"/api/ai-pack",{
      method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify({})
    });
    assert.equal(ai.status,401);

    assert.equal((await fetch(base+"/api/not-an-endpoint")).status,404);
    assert.equal((await fetch(base+"/api/_firebase-admin.js")).status,404);
    assert.equal((await fetch(base+"/server.js")).status,404);
    assert.equal((await fetch(base+"/.env.example")).status,404);
    console.log("Teacher standalone smoke test passed: health, runtime config, API auth gates, Admin proxy guard, CORS preflight, and private-file protection.");
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error("Teacher standalone smoke test failed:",error);process.exitCode=1});
