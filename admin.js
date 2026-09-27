import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const FIREBASE_CONFIG={apiKey:"AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8",authDomain:"elp---katlearn.firebaseapp.com",projectId:"elp---katlearn",storageBucket:"elp---katlearn.firebasestorage.app",messagingSenderId:"344478447672",appId:"1:344478447672:web:4ed109a40303d0b41b0ecd",measurementId:"G-KTW11GD97T"};
const ADMIN_EMAIL="katlearn.admin@gmail.com";
const app=getApps().length?getApps()[0]:initializeApp(FIREBASE_CONFIG);
const auth=getAuth(app);
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const pageTitles={overview:"Tổng quan",teachers:"Giáo viên",users:"Tài khoản",classes:"Lớp học",packs:"Bộ từ công khai",schools:"Trường học",catalog:"Danh mục toàn quốc",activity:"Hoạt động Admin"};
const state={user:null,page:"overview",cache:{},sync:{active:false,done:0,total:0,province:""},modalResolve:null};

function textOf(value,fallback="Lỗi không xác định"){
  if(value==null||value==="")return fallback;
  if(typeof value==="string")return value;
  if(value instanceof Error&&value.message)return value.message;
  if(typeof value.message==="string"&&value.message)return value.message;
  if(typeof value.error==="string")return value.error;
  if(value.error&&typeof value.error.message==="string")return value.error.message;
  try{const json=JSON.stringify(value,null,2);if(json&&json!=="{}")return json}catch(_){}
  return String(value);
}
function esc(value){
  return textOf(value,"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function num(value){const n=Number(value);return Number.isFinite(n)?n:0}
function displayNum(value,unknown="—"){return value==null?unknown:num(value).toLocaleString("vi-VN")}
function dateOf(value){const n=Number(value||0);if(!n)return"—";try{return new Date(n).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}catch(_){return"—"}}
function roleLabel(role){return({teacher:"Giáo viên",student:"Học sinh",pending_teacher_verification:"Chờ xác minh",teacher_rejected:"Từ chối",admin:"Admin"}[String(role||"").toLowerCase()]||String(role||"Chưa rõ"))}
function roleClass(role){const r=String(role||"").toLowerCase();return r==="teacher"?"teacher":r==="student"?"student":r==="pending_teacher_verification"?"pending":r==="teacher_rejected"?"rejected":r==="admin"?"admin":""}

let toastTimer;
function toast(message,type=""){
  const box=$("#toast");box.textContent=textOf(message);box.className="toast show "+type;
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.className="toast",4200);
}
function setBackendStatus(kind,label){$("#backendStatus").className="backend-status "+kind;$("#backendLabel").textContent=label}
function showError(message,code="",status="",details=""){
  $("#pageError").classList.remove("hidden");
  $("#pageErrorText").textContent=textOf(message);
  $("#pageErrorCode").textContent=[status?"HTTP "+status:"",code?String(code):""].filter(Boolean).join(" · ");
  $("#pageErrorDetails").textContent=details?textOf(details):"";
  $("#pageErrorDetails").classList.toggle("hidden",!details);
}
function clearError(){$("#pageError").classList.add("hidden");$("#pageErrorText").textContent="";$("#pageErrorCode").textContent="";$("#pageErrorDetails").textContent="";$("#pageErrorDetails").classList.add("hidden")}

async function getToken(){
  if(!state.user)throw new Error("Phiên Admin không còn hoạt động. Hãy đăng nhập lại.");
  const token=await state.user.getIdToken();
  if(!token)throw new Error("Không lấy được token Firebase Admin.");
  return token;
}
async function api(path="",options={}){
  const headers={Accept:"application/json"};
  if(options.auth!==false)headers.Authorization="Bearer "+await getToken();
  if(options.body!==undefined)headers["Content-Type"]="application/json";
  let response;
  try{
    response=await fetch("/api/admin-hub"+path,{method:options.method||"GET",headers,body:options.body===undefined?undefined:JSON.stringify(options.body),cache:"no-store"});
  }catch(error){
    const err=new Error("Không kết nối được Admin Hub. Kiểm tra deployment/proxy của teacher-katlearn.");
    err.cause=textOf(error);throw err;
  }
  const raw=await response.text();
  let data={};
  if(raw){
    try{data=JSON.parse(raw)}catch(_){
      const err=new Error("Admin backend trả về dữ liệu không hợp lệ (HTTP "+response.status+").");
      err.status=response.status;err.raw=raw.slice(0,1600);throw err;
    }
  }
  if(response.status===401){
    await signOut(auth);
    const err=new Error("Phiên Admin đã hết hạn. Vui lòng đăng nhập lại.");
    err.status=401;err.code="admin_session_expired";throw err;
  }
  if(!response.ok||data.ok===false){
    const err=new Error(textOf(data.error||data.message||raw,"HTTP "+response.status+" từ Admin Hub"));
    err.status=response.status;err.code=data.code||"admin_request_failed";err.details=data.details||null;throw err;
  }
  setBackendStatus("good","Backend sẵn sàng");
  return data;
}

function handleError(error,fallback){
  const message=textOf(error?.message||error,fallback);
  const details=error?.raw||error?.details||error?.cause||"";
  setBackendStatus("bad","Có lỗi");showError(message,error?.code||"",error?.status||"",details);toast(message,"bad");
}
function safeLoad(task,fallback){Promise.resolve(task).catch(error=>handleError(error,fallback))}

function setPage(name){
  state.page=name;
  $$(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+name));
  $$(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
  $$(".mobile-bottom button").forEach(x=>x.classList.toggle("active",x.dataset.go===name));
  $("#pageTitle").textContent=pageTitles[name]||"Tổng quan";
  $("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show");
  window.scrollTo({top:0,behavior:"smooth"});
  if(name==="overview")safeLoad(loadOverview(),"Không thể tải tổng quan.");
  else if(name==="catalog")safeLoad(loadCatalog(),"Không thể tải danh mục quốc gia.");
  else safeLoad(loadSection(name),"Không thể tải khu vực Admin.");
}
function bindNavigation(){
  $$(".nav button,[data-go]").forEach(button=>button.addEventListener("click",()=>setPage(button.dataset.page||button.dataset.go)));
  $("#menuMobile").addEventListener("click",()=>{$("#sidebar").classList.add("open");$("#mobileOverlay").classList.add("show")});
  $("#mobileOverlay").addEventListener("click",()=>{$("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show")});
  $("#logout").addEventListener("click",()=>signOut(auth));
  $("#clearSession").addEventListener("click",()=>signOut(auth));
  $("#refresh").addEventListener("click",refreshCurrent);
  $("#modalCancel").addEventListener("click",()=>closeModal(false));
  $("#modalOk").addEventListener("click",()=>closeModal(true));
  $("#quickSync").addEventListener("click",runCatalogSync);
  $("#catalogSync").addEventListener("click",runCatalogSync);
  ["teacherSearch","userSearch","classSearch","packSearch","schoolSearch"].forEach(id=>$("#"+id).addEventListener("input",()=>renderSection(state.page)));
  ["teacherFilter","userFilter"].forEach(id=>$("#"+id).addEventListener("change",()=>renderSection(state.page)));
}
async function refreshCurrent(){
  clearError();setBackendStatus("","Đang tải…");state.cache={};
  try{
    if(state.page==="overview")await loadOverview(true);
    else if(state.page==="catalog")await loadCatalog(true);
    else await loadSection(state.page,true);
    toast("✓ Đã làm mới","good");
  }catch(error){handleError(error,"Không thể làm mới Admin Hub.")}
}

async function loadOverview(force=false){
  if(state.cache.overview&&!force){renderOverview();return}
  setBackendStatus("","Đang tải…");
  const data=await api("?section=overview");
  state.cache.overview=data;state.cache.catalog=data.catalog||null;renderOverview();
}
function renderOverview(){
  const d=state.cache.overview||{},s=d.stats||{};
  $("#mUsers").textContent=displayNum(s.users);$("#mPending").textContent=displayNum(s.pending);$("#mTeachers").textContent=displayNum(s.teachers);$("#mStudents").textContent=displayNum(s.students);$("#mClasses").textContent=displayNum(s.classes);$("#mSchools").textContent=displayNum(s.schools);
  const pending=Array.isArray(d.pending)?d.pending:[];
  $("#pendingList").innerHTML=pending.length?pending.slice(0,6).map(t=>'<div class="list-item"><div class="list-main"><div><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+" · "+esc(t.schoolName||t.teacherVerification?.requestedSchoolName||"Chưa có trường")+'</small></div><span class="badge pending">CHỜ DUYỆT</span></div><div class="list-actions"><button class="btn good" data-action="verify" data-id="'+esc(t.id)+'">✓ Duyệt</button><button class="btn" data-action="inspect" data-id="'+esc(t.id)+'">Xem hồ sơ</button></div></div>').join(""):'<div class="empty">Không có hồ sơ giáo viên đang chờ. 🎉</div>';
  $$("#pendingList [data-action='verify']").forEach(b=>b.onclick=()=>teacherAction("verify",b.dataset.id));
  $$("#pendingList [data-action='inspect']").forEach(b=>b.onclick=()=>inspectTeacher(b.dataset.id));
  const catalog=d.catalog||{};$("#syncText").textContent=displayNum(catalog.totalProvinces,34)+" tỉnh/thành · "+displayNum(catalog.totalSchools,22850)+" trường kế hoạch · đã ghi "+displayNum(s.syncedSchools,0);
  const warnings=Array.isArray(d.warnings)?d.warnings:[];
  $("#warningBox").classList.toggle("hidden",warnings.length===0);
  if(warnings.length)$("#warningBox").textContent="Một số thống kê phụ chưa tải được; Admin Hub vẫn hoạt động. "+warnings.map(x=>textOf(x.label)+": "+textOf(x.message)).join(" | ");
  renderHealth(d);
}
function renderHealth(d){
  const s=d.stats||{},checks=[
    ["Phiên Admin",state.user?"Đã xác thực":"Chưa xác thực",!!state.user],
    ["Backend",d.degraded?"Có cảnh báo":"Sẵn sàng",!d.degraded],
    ["Catalog nguồn",d.catalog?displayNum(d.catalog.totalSchools,22850)+" trường":"Chưa tải",!!d.catalog],
    ["Firestore",typeof s.users==="number"?"Đã đọc dữ liệu":"Chưa đủ dữ liệu",typeof s.users==="number"]
  ];
  $("#healthList").innerHTML=checks.map(x=>'<div class="health-row"><span>'+esc(x[0])+'</span><b class="'+(x[2]?"dot-good":"dot-warn")+'">● '+esc(x[1])+'</b></div>').join("");
}

async function loadSection(section,force=false){
  if(state.cache[section]&&!force){renderSection(section);return}
  const data=await api("?section="+encodeURIComponent(section));state.cache[section]=data;renderSection(section);
}
function getPath(row,path){return path.split(".").reduce((value,key)=>value?.[key],row)||""}
function has(row,q,fields){if(!q)return true;return fields.map(path=>getPath(row,path)).join(" ").toLowerCase().includes(q)}
function renderSection(section){
  const d=state.cache[section]||{},rows=Array.isArray(d.rows)?d.rows:[];
  if(section==="teachers")renderTeachers(rows);
  if(section==="users")renderUsers(rows);
  if(section==="classes")renderClasses(rows);
  if(section==="packs")renderPacks(rows);
  if(section==="schools")renderSchools(rows);
  if(section==="activity")renderActivity(rows);
}
function renderTeachers(rows){
  const q=$("#teacherSearch").value.trim().toLowerCase(),f=$("#teacherFilter").value;
  const list=rows.filter(t=>(f==="all"||(f==="pending"&&t._status==="pending")||(f==="verified"&&t._status==="verified")||(f==="rejected"&&t._status==="rejected"))&&has(t,q,["displayName","name","email","schoolName","province","ward","teacherVerification.requestedSchoolName","teacherVerification.requestedClassName"]));
  $("#teacherTable").innerHTML=list.map(t=>{
    const pending=t._status==="pending",rejected=t._status==="rejected";
    return'<tr><td><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+" · UID "+esc(t.id)+'</small></td><td><span class="badge '+(pending?"pending":rejected?"rejected":"teacher")+'">'+(pending?"CHỜ XÁC MINH":rejected?"ĐÃ TỪ CHỐI":"ĐÃ DUYỆT")+'</span></td><td>'+esc(t.schoolName||t.teacherVerification?.requestedSchoolName||"—")+'<small>'+esc([t.province,t.ward].filter(Boolean).join(" · ")||"Chưa có khu vực")+' · Lớp '+esc(t.teacherVerification?.requestedClassName||t.className||"—")+'</small></td><td>'+dateOf(t.teacherVerification?.submittedAt||t.createdAt)+'</td><td><div class="list-actions">'+(pending?'<button class="btn good" data-action="verify" data-id="'+esc(t.id)+'">✓ Duyệt</button><button class="btn bad" data-action="reject" data-id="'+esc(t.id)+'">Từ chối</button>':'<button class="btn" data-action="inspect" data-id="'+esc(t.id)+'">Xem hồ sơ</button>')+'</div></td></tr>';
  }).join("")||'<tr><td colspan="5"><div class="empty">Không có giáo viên phù hợp.</div></td></tr>';
  $$("#teacherTable [data-action]").forEach(b=>b.onclick=()=>b.dataset.action==="inspect"?inspectTeacher(b.dataset.id):teacherAction(b.dataset.action,b.dataset.id));
}
function renderUsers(rows){
  const q=$("#userSearch").value.trim().toLowerCase(),f=$("#userFilter").value;
  const list=rows.filter(u=>(f==="all"||String(u.role||"")===f)&&has(u,q,["displayName","name","email","accountCode","schoolName","className"]));
  $("#userTable").innerHTML=list.map(u=>'<tr><td><strong>'+esc(u.displayName||u.name||"KatLearn User")+'</strong><small>'+esc(u.email||"")+(u.accountCode?" · Mã "+esc(u.accountCode):"")+'</small></td><td><span class="badge '+roleClass(u.role)+'">'+esc(roleLabel(u.role))+'</span></td><td>'+esc([u.schoolName,u.className].filter(Boolean).join(" · ")||"—")+'<small>'+esc([u.province,u.ward].filter(Boolean).join(" · "))+'</small></td><td>🪙 '+displayNum(u.coins,0)+' · ⚡ '+displayNum(u.energy,0)+'<small>🔥 streak '+displayNum(u.streak,0)+'</small></td><td>'+dateOf(u.createdAt)+'</td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không tìm thấy tài khoản.</div></td></tr>';
  $("#userLimit").textContent=state.cache.users?.limited?"Đang hiển thị tối đa 300 tài khoản.":"";
}
function renderClasses(rows){
  const q=$("#classSearch").value.trim().toLowerCase(),list=rows.filter(c=>has(c,q,["name","grade","teacherEmail","teacherUid","schoolName","joinCode","province","ward"]));
  $("#classTable").innerHTML=list.map(c=>'<tr><td><strong>'+esc(c.name||"—")+'</strong><small>Khối '+esc(c.grade||"—")+" · ID "+esc(c.id)+'</small></td><td>'+esc(c.teacherEmail||c.teacherUid||"—")+'</td><td>'+esc(c.schoolName||"—")+'<small>'+esc([c.province,c.ward].filter(Boolean).join(" · "))+'</small></td><td><span class="badge teacher mono">'+esc(c.joinCode||"—")+'</span></td><td>'+displayNum(c.studentCount,0)+'</td><td>'+dateOf(c.updatedAt||c.createdAt)+'</td></tr>').join("")||'<tr><td colspan="6"><div class="empty">Không có lớp học.</div></td></tr>';
  $("#classLimit").textContent=state.cache.classes?.limited?"Đang hiển thị tối đa 300 lớp.":"";
}
function renderPacks(rows){
  const q=$("#packSearch").value.trim().toLowerCase(),list=rows.filter(p=>has(p,q,["name","createdBy","createdByEmail","createdByUid"]));
  $("#packTable").innerHTML=list.map(p=>'<tr><td><strong>'+esc(p.name||"Bộ từ chưa đặt tên")+'</strong><small>ID '+esc(p.id)+'</small></td><td>'+displayNum(p.wordCount,0)+'</td><td>'+esc(p.createdByEmail||p.createdBy||p.createdByUid||"—")+'</td><td>'+dateOf(p.createdAt)+'</td><td><button class="btn bad" data-delete-pack="'+esc(p.id)+'">Xóa</button></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có bộ từ công khai.</div></td></tr>';
  $$("#packTable [data-delete-pack]").forEach(b=>b.onclick=()=>deletePack(b.dataset.deletePack));
  $("#packLimit").textContent=state.cache.packs?.limited?"Đang hiển thị tối đa 300 bộ từ.":"";
}
function renderSchools(rows){
  const q=$("#schoolSearch").value.trim().toLowerCase(),list=rows.filter(s=>has(s,q,["name","province","ward","schoolLevel","source"]));
  $("#schoolTable").innerHTML=list.map(s=>'<tr><td><strong>'+esc(s.name||"—")+'</strong><small>ID '+esc(s.id)+'</small></td><td>'+esc(s.province||"—")+'</td><td>'+esc(s.ward||"—")+'</td><td>'+esc(s.schoolLevel||"—")+'</td><td>'+esc(s.source||"local")+'</td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không tìm thấy trường.</div></td></tr>';
  $("#schoolLimit").textContent=state.cache.schools?.limited?"Đang hiển thị tối đa 300 trường.":"";
}
function renderActivity(rows){
  $("#activityList").innerHTML=rows.map(x=>'<div class="activity-row"><div><b>'+esc(x.action||"Admin action")+'</b><small>'+esc(x.target||"—")+" · "+esc(x.adminEmail||"")+'</small></div><time>'+dateOf(x.at)+'</time></div>').join("")||'<div class="empty">Chưa có hoạt động Admin.</div>';
}

function openModal(title,message,ok="Đóng",cancel="Hủy"){
  $("#modalTitle").textContent=textOf(title);$("#modalText").textContent=textOf(message);$("#modalOk").textContent=textOf(ok);$("#modalCancel").textContent=textOf(cancel);
  $("#modalCancel").classList.toggle("hidden",cancel==="");$("#modalBackdrop").classList.add("open");document.body.classList.add("lock-scroll");
  return new Promise(resolve=>{state.modalResolve=resolve});
}
function closeModal(value){
  $("#modalBackdrop").classList.remove("open");document.body.classList.remove("lock-scroll");
  const resolve=state.modalResolve;state.modalResolve=null;resolve?.(value);
}
async function inspectTeacher(uid){
  const list=[...(state.cache.teachers?.rows||[]),...(state.cache.overview?.pending||[])],t=list.find(x=>x.id===uid);if(!t)return;
  const v=t.teacherVerification||{};
  await openModal("Hồ sơ giáo viên","Email: "+(t.email||"—")+"
Tên: "+(t.displayName||t.name||"—")+"
Trường: "+(t.schoolName||v.requestedSchoolName||"—")+"
Lớp đăng ký: "+(v.requestedClassName||t.className||"—")+"
Khu vực: "+([t.province,t.ward].filter(Boolean).join(" · ")||"—")+"
Gửi lúc: "+dateOf(v.submittedAt||t.createdAt)+"
Role: "+roleLabel(t.role),"Đóng","");
}
async function teacherAction(action,uid){
  const verify=action==="verify";
  if(!(await openModal(verify?"Duyệt giáo viên":"Từ chối hồ sơ",verify?"Tài khoản sẽ chuyển sang role teacher sau khi backend kiểm tra trường/lớp.":"Tài khoản sẽ chuyển sang teacher_rejected.",verify?"Duyệt":"Từ chối")))return;
  try{
    await api("",{method:"POST",body:{action:verify?"verify-teacher":"reject-teacher",uid}});
    toast(verify?"✓ Đã duyệt giáo viên":"✓ Đã từ chối hồ sơ","good");state.cache.teachers=null;state.cache.overview=null;
    await loadOverview(true);if(state.page==="teachers")await loadSection("teachers",true);
  }catch(error){handleError(error,"Không thể cập nhật hồ sơ giáo viên.")}
}
async function deletePack(id){
  if(!(await openModal("Xóa bộ từ?","Bộ từ và các bài giao liên quan sẽ bị xóa. Thao tác này không thể hoàn tác.","Xóa bộ từ")))return;
  try{await api("",{method:"POST",body:{action:"delete-pack",packId:id}});toast("✓ Đã xóa bộ từ","good");state.cache.packs=null;await loadSection("packs",true)}catch(error){handleError(error,"Không thể xóa bộ từ.")}
}

async function loadCatalog(force=false){
  if(state.cache.catalog&&state.cache.overview&&!force){renderCatalog();return}
  const data=state.cache.overview||await api("?section=overview");state.cache.overview=data;state.cache.catalog=data.catalog||null;renderCatalog();
}
function renderCatalog(){
  const c=state.cache.catalog||{provinces:[],totalProvinces:34,totalSchools:22850},s=state.cache.overview?.stats||{};
  $("#cTotalP").textContent=displayNum(c.totalProvinces,34);$("#cTotalS").textContent=displayNum(c.totalSchools,22850);$("#cSyncedP").textContent=displayNum(s.syncedProvinces,0);$("#cSyncedS").textContent=displayNum(s.syncedSchools,0);
  const saved=state.sync.active?state.sync.done:num(s.syncedSchools),ratio=num(c.totalSchools)?Math.min(100,Math.round(saved*100/num(c.totalSchools))):0;
  $("#catalogGrid").innerHTML=(c.provinces||[]).map(p=>'<div class="province"><div class="province-head"><div><b>'+esc(p.name)+'</b><small> · '+esc(p.code)+'</small></div><em>'+displayNum(p.total,0)+' trường</em></div><div class="progress"><i style="width:'+ratio+'%"></i></div><div class="province-status"><span>'+((state.sync.active&&state.sync.province===p.name)?"Đang xử lý":"Kế hoạch")+'</span><span>'+ratio+"% tổng hệ thống</span></div></div>").join("");
}
function setSyncProgress(done,total,label){
  state.sync.done=done;state.sync.total=total;state.sync.province=label||"";
  const p=total?Math.min(100,Math.round(done*100/total)):0;$("#syncBar").style.width=p+"%";$("#syncText").textContent="⏳ "+displayNum(done,0)+" / "+displayNum(total,0)+" · "+(label||"đang đồng bộ");renderCatalog();
}
async function runCatalogSync(){
  if(state.sync.active)return;
  state.sync.active=true;state.sync.done=0;$("#quickSync").disabled=true;$("#catalogSync").disabled=true;setBackendStatus("","Đang đồng bộ…");
  try{
    if(!state.cache.catalog){
      const overview=await api("?section=overview");state.cache.overview=overview;state.cache.catalog=overview.catalog||null;
    }
    const plan=state.cache.catalog||{},provinces=Array.isArray(plan.provinces)?plan.provinces:[];
    if(!provinces.length)throw new Error("Backend không trả về danh sách tỉnh/thành.");
    const total=num(plan.totalSchools);setSyncProgress(0,total,"bắt đầu");
    for(const province of provinces){
      state.sync.province=province.name;let offset=0,guard=0;
      while(offset<num(province.total)){
        if(++guard>1000)throw new Error("Luồng sync bị kẹt ở "+province.name);
        let data=null,last=null;
        for(let attempt=1;attempt<=3;attempt++){
          try{data=await api("",{method:"POST",body:{action:"catalog-chunk",provinceCode:province.code,offset,limit:150}});break}catch(error){last=error;if(attempt<3)await new Promise(r=>setTimeout(r,700*attempt))}
        }
        if(!data)throw new Error(textOf(last?.message||last)+" · "+province.name+" · offset "+offset);
        const next=num(data.nextOffset);if(next<=offset&&num(data.processed)===0)throw new Error("Backend không trả về bản ghi mới ở "+province.name);
        offset=next;state.sync.done+=num(data.processed);setSyncProgress(state.sync.done,total,province.name);
      }
    }
    toast("✓ Đã đồng bộ toàn bộ danh mục quốc gia","good");state.cache.overview=null;state.cache.catalog=null;await loadOverview(true);await loadCatalog(true);
  }catch(error){handleError(error,"Đồng bộ danh mục thất bại.");$("#syncText").textContent="✕ "+textOf(error?.message||error)}
  finally{state.sync.active=false;state.sync.province="";$("#quickSync").disabled=false;$("#catalogSync").disabled=false}
}

$("#loginForm").addEventListener("submit",async event=>{
  event.preventDefault();const button=$("#loginBtn"),errorBox=$("#loginError");button.disabled=true;errorBox.textContent="Đang xác thực…";
  try{
    const credential=await signInWithEmailAndPassword(auth,ADMIN_EMAIL,$("#password").value);
    if(String(credential.user.email||"").toLowerCase()!==ADMIN_EMAIL){await signOut(auth);throw new Error("Tài khoản này không có quyền Admin.")}
    $("#password").value="";
  }catch(error){errorBox.textContent=error?.code==="auth/invalid-credential"?"Email hoặc mật khẩu không đúng.":textOf(error,"Không thể đăng nhập.");button.disabled=false}
});

bindNavigation();
onAuthStateChanged(auth,async user=>{
  state.user=user||null;
  if(!user){$("#loginGate").classList.remove("hidden");$("#app").classList.add("hidden");$("#password").value="";$("#loginBtn").disabled=false;setBackendStatus("","Chưa kết nối");return}
  if(String(user.email||"").toLowerCase()!==ADMIN_EMAIL){$("#loginError").textContent="Tài khoản này không có quyền Admin.";await signOut(auth);return}
  $("#loginGate").classList.add("hidden");$("#app").classList.remove("hidden");setBackendStatus("","Đang tải…");
  safeLoad(loadOverview(true),"Không tải được Admin Hub.");
});