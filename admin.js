import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import{getFirestore,collection,doc,query,where,limit,getDocs,getDoc,getCountFromServer,setDoc,addDoc,updateDoc,deleteDoc,writeBatch,orderBy}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const CONFIG={apiKey:"AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8",authDomain:"elp---katlearn.firebaseapp.com",projectId:"elp---katlearn",storageBucket:"elp---katlearn.firebasestorage.app",messagingSenderId:"344478447672",appId:"1:344478447672:web:4ed109a40303d0b41b0ecd",measurementId:"G-KTW11GD97T"};
const ADMIN="katlearn.admin@gmail.com",MAX=500,TOTAL_CATALOG=22850;
const CATALOG=[["01","Thành phố Hà Nội",2828],["04","Tỉnh Cao Bằng",150],["08","Tỉnh Tuyên Quang",300],["11","Tỉnh Điện Biên",182],["12","Tỉnh Lai Châu",137],["14","Tỉnh Sơn La",278],["15","Tỉnh Lào Cai",216],["19","Tỉnh Thái Nguyên",261],["20","Tỉnh Lạng Sơn",200],["22","Tỉnh Quảng Ninh",266],["24","Tỉnh Bắc Ninh",1039],["25","Tỉnh Phú Thọ",759],["31","Thành phố Hải Phòng",1041],["33","Tỉnh Hưng Yên",548],["37","Tỉnh Ninh Bình",1178],["38","Tỉnh Thanh Hóa",2002],["40","Tỉnh Nghệ An",372],["42","Tỉnh Hà Tĩnh",444],["44","Tỉnh Quảng Trị",290],["46","Thành phố Huế",383],["48","Thành phố Đà Nẵng",550],["51","Tỉnh Quảng Ngãi",127],["52","Tỉnh Gia Lai",261],["56","Tỉnh Khánh Hòa",296],["66","Tỉnh Đắk Lắk",616],["68","Tỉnh Lâm Đồng",1021],["75","Tỉnh Đồng Nai",691],["79","Thành phố Hồ Chí Minh",2382],["80","Tỉnh Tây Ninh",406],["82","Tỉnh Đồng Tháp",275],["86","Tỉnh Vĩnh Long",723],["91","Tỉnh An Giang",1322],["92","Thành phố Cần Thơ",713],["96","Tỉnh Cà Mau",593]];
const app=getApps().length?getApps()[0]:initializeApp(CONFIG),auth=getAuth(app),db=getFirestore(app);
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
const state={user:null,page:"overview",cache:{},sync:false};
const titles={overview:"Tổng quan",teachers:"Giáo viên",users:"Tài khoản",classes:"Lớp học",packs:"Bộ từ công khai",schools:"Trường học",catalog:"Danh mục toàn quốc",activity:"Nhật ký Admin"};

function errText(e,f="Có lỗi xảy ra."){
 if(e==null)return f;
 if(typeof e==="string"&&e.trim())return e;
 if(typeof e?.message==="string"&&e.message)return e.message;
 if(typeof e?.error==="string"&&e.error)return e.error;
 if(typeof e?.error?.message==="string"&&e.error.message)return e.error.message;
 if(typeof e?.code==="string"&&e.code)return e.code;
 try{const s=JSON.stringify(e);if(s&&s!=="{}")return s}catch(_){}
 return f;
}
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const fmt=v=>num(v).toLocaleString("vi-VN");
const date=v=>{const x=num(v);if(!x)return"—";try{return new Date(x).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}catch(_){return"—"}};
const roleLabel=r=>({teacher:"Giáo viên",student:"Học sinh",pending_teacher_verification:"Chờ xác minh",teacher_rejected:"Từ chối",admin:"Admin"}[String(r||"").toLowerCase()]||String(r||"Chưa rõ"));
const roleClass=r=>{r=String(r||"").toLowerCase();return r==="teacher"?"teacher":r==="student"?"student":r==="pending_teacher_verification"?"pending":r==="teacher_rejected"?"rejected":r==="admin"?"admin":""};

let toastTimer;
function toast(m,type=""){const x=$("#toast");x.textContent=errText(m);x.className="toast show "+type;clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.className="toast",4000)}
function notice(m){const x=$("#pageError");x.textContent=errText(m);x.classList.remove("hidden")}
function clearNotice(){$("#pageError").classList.add("hidden")}
const healthState={auth:null,fs:null,admin:null,catalog:{ok:true,text:"Tách riêng"}};
function health(id,ok,text){
 const map={"#healthAuth":"auth","#healthFs":"fs","#healthAdmin":"admin","#healthCatalog":"catalog"};const key=map[id];if(key)healthState[key]={ok,text};
 const list=$("#healthList");if(!list)return;
 list.innerHTML=Object.entries(healthState).map(([k,v])=>{const name={auth:"Firebase Auth",fs:"Firestore",admin:"Admin account",catalog:"Catalog backend"}[k];const value=v?.text||"Đang kiểm tra";const good=v?.ok!==false;return '<div class="health-row"><span>'+name+'</span><b style="color:'+(good?"var(--good)":"var(--bad)")+'">● '+esc(value)+'</b></div>'}).join("");
}
function rows(s){return s.docs.map(d=>({id:d.id,...(d.data()||{})}))}

async function countCollection(name,filters=[]){
 try{
  let q=collection(db,name);
  for(const f of filters)q=query(q,where(f[0],f[1],f[2]));
  return Number((await getCountFromServer(q)).data().count||0);
 }catch(e){console.warn("Admin count",name,e);return null}
}
async function readLimited(name,make){
 let q=collection(db,name);
 q=make?make(q):query(q,limit(MAX));
 return rows(await getDocs(q));
}
async function writeAudit(action,target,extra={}){
 try{await addDoc(collection(db,"adminAudit"),{action,target,adminUid:state.user?.uid||"",adminEmail:ADMIN,at:Date.now(),...extra})}catch(e){console.warn("audit",e)}
}

function showPage(name){
 state.page=name;
 $$(".page").forEach(x=>x.classList.toggle("active",x.id==="page-"+name));
 $$(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===name));
 $("#pageTitle").textContent=titles[name]||"Tổng quan";
 $("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show");clearNotice();window.scrollTo({top:0,behavior:"smooth"});
 loadPage(name,true).catch(e=>{notice(errText(e,"Không tải được dữ liệu."));toast(e,"bad")});
}
function bind(){
 $$(".nav button,[data-page-go]").forEach(b=>b.addEventListener("click",()=>showPage(b.dataset.page||b.dataset.pageGo)));
 $("#menuMobile").onclick=()=>{$("#sidebar").classList.add("open");$("#mobileOverlay").classList.add("show")};
 $("#mobileOverlay").onclick=()=>{$("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show")};
 $("#logout").onclick=()=>signOut(auth);$("#clearSession").onclick=()=>signOut(auth);
 $("#refresh")?.addEventListener("click",()=>loadPage(state.page,true).then(()=>toast("✓ Đã làm mới","good")).catch(e=>{notice(e);toast(e,"bad")}));
 $("#catalogSync")?.addEventListener("click",syncCatalog);$("#quickSync")?.addEventListener("click",syncCatalog);
 ["teacherSearch","userSearch","classSearch","packSearch","schoolSearch"].forEach(id=>$("#"+id)?.addEventListener("input",()=>render(state.page)));
 ["teacherFilter","userFilter"].forEach(id=>$("#"+id)?.addEventListener("change",()=>render("teachers"==state.page||"users"==state.page?state.page:"overview")));
}
async function loadPage(page,force=false){
 if(page==="overview")return loadOverview(force);
 if(page==="catalog")return loadCatalog(force);
 if(page==="activity")return loadActivity(force);
 if(state.cache[page]&&!force){render(page);return}
 state.cache[page]=await loadSection(page);render(page);
}
async function loadOverview(force=false){
 if(state.cache.overview&&!force){renderOverview();return}
 const [users,teachers,students,pending,classes,schools,packs,pendingRows]=await Promise.all([
  countCollection("users"),countCollection("users",[["role","==","teacher"]]),countCollection("users",[["role","==","student"]]),
  countCollection("users",[["role","==","pending_teacher_verification"]]),countCollection("classes"),countCollection("schools"),countCollection("publicPacks"),
  readLimited("users",q=>query(q,where("role","==","pending_teacher_verification"),limit(100)))
 ]);
 state.cache.overview={stats:{users,teachers,students,pending,classes,schools,packs},pending:pendingRows};renderOverview();health("#healthFs",true,"Firestore hoạt động");health("#healthAdmin",true,"Admin đã xác thực");health("#healthCatalog",true,"Tách riêng");
}
function renderOverview(){
 const s=state.cache.overview?.stats||{};
 $("#mUsers").textContent=s.users==null?"—":fmt(s.users);$("#mPending").textContent=s.pending==null?"—":fmt(s.pending);$("#mTeachers").textContent=s.teachers==null?"—":fmt(s.teachers);$("#mStudents").textContent=s.students==null?"—":fmt(s.students);$("#mClasses").textContent=s.classes==null?"—":fmt(s.classes);$("#mSchools").textContent=s.schools==null?"—":fmt(s.schools);
 const p=state.cache.overview?.pending||[];
 $("#pendingList").innerHTML=p.length?p.slice(0,6).map(t=>{const v=t.teacherVerification||{};return '<div class="pending-row"><div class="pending-main"><div><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+' · '+esc(t.schoolName||v.requestedSchoolName||"Chưa có trường")+'</small></div><span class="badge pending">CHỜ DUYỆT</span></div><div class="row-actions"><button class="btn good" data-verify="'+esc(t.id)+'">✓ Duyệt</button><button class="btn" data-reject="'+esc(t.id)+'">Từ chối</button></div></div>'}).join(""):'<div class="empty">Không có hồ sơ giáo viên chờ duyệt. 🎉</div>';
 $$("#pendingList [data-verify]").forEach(b=>b.onclick=()=>teacherAction("verify",b.dataset.verify));$$(".pending-row [data-reject]").forEach(b=>b.onclick=()=>teacherAction("reject",b.dataset.reject));
}
async function loadSection(section){
 if(section==="teachers"){
  const [p,v,r]=await Promise.all([
   readLimited("users",q=>query(q,where("role","==","pending_teacher_verification"),limit(MAX))),
   readLimited("users",q=>query(q,where("role","==","teacher"),limit(MAX))),
   readLimited("users",q=>query(q,where("role","==","teacher_rejected"),limit(MAX)))
  ]);
  return{rows:[...p.map(x=>({...x,_status:"pending"})),...v.map(x=>({...x,_status:"verified"})),...r.map(x=>({...x,_status:"rejected"}))]};
 }
 const makers={users:q=>query(q,limit(MAX)),classes:q=>query(q,limit(MAX)),packs:q=>query(q,limit(MAX)),schools:q=>query(q,limit(MAX))};
 if(!makers[section])throw new Error("Khu vực Admin không hợp lệ.");
 return{rows:await readLimited(section,makers[section])};
}
function match(o,q,fields){if(!q)return true;return fields.map(k=>k.split(".").reduce((v,p)=>v?.[p],o)||"").join(" ").toLowerCase().includes(q)}
function render(section){
 const data=state.cache[section]?.rows||[];
 if(section==="teachers"){
  const q=$("#teacherSearch").value.trim().toLowerCase(),f=$("#teacherFilter").value,list=data.filter(x=>(f==="all"||x._status===f)&&match(x,q,["displayName","name","email","schoolName","province","ward","teacherVerification.requestedSchoolName","teacherVerification.requestedClassName"]));
  $("#teacherTable").innerHTML=list.map(t=>'<tr><td><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+' · UID '+esc(t.id)+'</small></td><td><span class="badge '+roleClass(t.role)+'">'+(t._status==="pending"?"CHỜ XÁC MINH":t._status==="rejected"?"ĐÃ TỪ CHỐI":"ĐÃ DUYỆT")+'</span></td><td>'+esc(t.schoolName||t.teacherVerification?.requestedSchoolName||"—")+'<small>'+esc([t.province,t.ward].filter(Boolean).join(" · "))+' · Lớp '+esc(t.teacherVerification?.requestedClassName||t.className||"—")+'</small></td><td>'+date(t.teacherVerification?.submittedAt||t.createdAt)+'</td><td><div class="row-actions">'+(t._status==="pending"?'<button class="btn good" data-verify="'+esc(t.id)+'">✓ Duyệt</button><button class="btn bad" data-reject="'+esc(t.id)+'">Từ chối</button>':'<button class="btn" data-inspect="'+esc(t.id)+'">Xem</button>')+'</div></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có giáo viên phù hợp.</div></td></tr>';
  $$("#teacherTable [data-verify]").forEach(b=>b.onclick=()=>teacherAction("verify",b.dataset.verify));$$("#teacherTable [data-reject]").forEach(b=>b.onclick=()=>teacherAction("reject",b.dataset.reject));$$("#teacherTable [data-inspect]").forEach(b=>b.onclick=()=>inspectTeacher(b.dataset.inspect));return;
 }
 if(section==="users"){
  const q=$("#userSearch").value.trim().toLowerCase(),f=$("#userFilter").value,list=data.filter(x=>(f==="all"||String(x.role||"")===f)&&match(x,q,["displayName","name","email","accountCode","schoolName","className"]));
  $("#userTable").innerHTML=list.map(u=>'<tr><td><strong>'+esc(u.displayName||u.name||"KatLearn User")+'</strong><small>'+esc(u.email||"")+(u.accountCode?" · "+esc(u.accountCode):"")+'</small></td><td><span class="badge '+roleClass(u.role)+'">'+esc(roleLabel(u.role))+'</span></td><td>'+esc([u.schoolName,u.className].filter(Boolean).join(" · ")||"—")+'<small>'+esc([u.province,u.ward].filter(Boolean).join(" · "))+'</small></td><td>🪙 '+fmt(u.coins)+' · ⚡ '+fmt(u.energy)+'<small>🔥 streak '+fmt(u.streak)+'</small></td><td>'+date(u.createdAt)+'</td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không tìm thấy tài khoản.</div></td></tr>';$("#userLimit").textContent=data.length>=MAX?"Đang hiển thị tối đa "+MAX+" hồ sơ.":"";return;
 }
 if(section==="classes"){
  const q=$("#classSearch").value.trim().toLowerCase(),list=data.filter(x=>match(x,q,["name","grade","teacherEmail","teacherUid","schoolName","joinCode","province","ward"]));
  $("#classTable").innerHTML=list.map(c=>'<tr><td><strong>'+esc(c.name||"—")+'</strong><small>Khối '+esc(c.grade||"—")+' · ID '+esc(c.id)+'</small></td><td>'+esc(c.teacherEmail||c.teacherUid||"—")+'</td><td>'+esc(c.schoolName||"—")+'<small>'+esc([c.province,c.ward].filter(Boolean).join(" · "))+'</small></td><td><span class="badge teacher">'+esc(c.joinCode||"—")+'</span></td><td>'+fmt(c.studentCount)+'</td><td>'+date(c.updatedAt||c.createdAt)+'</td></tr>').join("")||'<tr><td colspan="6"><div class="empty">Không có lớp học.</div></td></tr>';$("#classLimit").textContent=data.length>=MAX?"Đang hiển thị tối đa "+MAX+" lớp.":"";return;
 }
 if(section==="packs"){
  const q=$("#packSearch").value.trim().toLowerCase(),list=data.filter(x=>match(x,q,["name","createdBy","createdByEmail","createdByUid"]));
  $("#packTable").innerHTML=list.map(p=>'<tr><td><strong>'+esc(p.name||"Bộ từ chưa đặt tên")+'</strong><small>ID '+esc(p.id)+'</small></td><td>'+fmt(p.wordCount)+'</td><td>'+esc(p.createdByEmail||p.createdBy||p.createdByUid||"—")+'</td><td>'+date(p.createdAt)+'</td><td><button class="btn bad" data-delete-pack="'+esc(p.id)+'">Xóa</button></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có bộ từ công khai.</div></td></tr>';$$("#packTable [data-delete-pack]").forEach(b=>b.onclick=()=>deletePack(b.dataset.deletePack));$("#packLimit").textContent=data.length>=MAX?"Đang hiển thị tối đa "+MAX+" bộ từ.":"";return;
 }
 if(section==="schools"){
  const q=$("#schoolSearch").value.trim().toLowerCase(),list=data.filter(x=>match(x,q,["name","province","ward","schoolLevel","source"]));
  $("#schoolTable").innerHTML=list.map(s=>'<tr><td><strong>'+esc(s.name||"—")+'</strong><small>ID '+esc(s.id)+'</small></td><td>'+esc(s.province||"—")+'</td><td>'+esc(s.ward||"—")+'</td><td>'+esc(s.schoolLevel||"—")+'</td><td>'+esc(s.source||"local")+'</td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không tìm thấy trường.</div></td></tr>';$("#schoolLimit").textContent=data.length>=MAX?"Đang hiển thị tối đa "+MAX+" trường.":"";return;
 }
}
async function inspectTeacher(uid){
 const t=(state.cache.teachers?.rows||[]).find(x=>x.id===uid);if(!t)return;const v=t.teacherVerification||{};
 await dialog("Hồ sơ giáo viên","Tên: "+(t.displayName||t.name||"—")+"\\nEmail: "+(t.email||"—")+"\\nTrường: "+(t.schoolName||v.requestedSchoolName||"—")+"\\nLớp: "+(v.requestedClassName||t.className||"—")+"\\nKhu vực: "+([t.province,t.ward].filter(Boolean).join(" · ")||"—")+"\\nRole: "+roleLabel(t.role),"Đóng","");
}
async function teacherAction(action,uid){
 if(!(await dialog(action==="verify"?"Duyệt giáo viên":"Từ chối hồ sơ",action==="verify"?"Tài khoản sẽ chuyển sang role teacher và được gắn trường/lớp.":"Tài khoản sẽ chuyển sang teacher_rejected.","Xác nhận")))return;
 try{
  const ref=doc(db,"users",uid),snap=await getDoc(ref);if(!snap.exists())throw new Error("Không tìm thấy hồ sơ giáo viên.");
  const p=snap.data()||{},v=p.teacherVerification||{};
  if(action==="reject"){await updateDoc(ref,{role:"teacher_rejected",teacherVerification:{...v,status:"rejected",rejectedAt:Date.now(),rejectedBy:state.user.uid},updatedAt:Date.now()});await writeAudit("teacher.reject",uid);toast("✓ Đã từ chối hồ sơ","good");state.cache.teachers=null;state.cache.overview=null;return showPage("overview")}
  let schoolId=String(p.schoolId||"").trim(),schoolName=String(p.schoolName||"").trim(),province=String(p.province||"").trim(),ward=String(p.ward||"").trim(),requestedSchool=String(v.requestedSchoolName||"").trim(),requestedClass=String(v.requestedClassName||"").trim();
  if(schoolId){const ss=await getDoc(doc(db,"schools",schoolId));if(!ss.exists()||String(ss.data()?.province||"").trim()!==province||String(ss.data()?.ward||"").trim()!==ward)schoolId="";else schoolName=String(ss.data()?.name||schoolName)}
  if(!schoolId&&requestedSchool){
   const same=await getDocs(query(collection(db,"schools"),where("name","==",requestedSchool),limit(20)));
   const found=same.docs.map(d=>({id:d.id,...d.data()})).find(x=>String(x.province||"").trim()===province&&String(x.ward||"").trim()===ward);
   if(found){schoolId=found.id;schoolName=String(found.name||requestedSchool)}else{const sref=await addDoc(collection(db,"schools"),{name:requestedSchool,province,ward,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()});schoolId=sref.id;schoolName=requestedSchool}
  }
  if(!schoolId)throw new Error("Hồ sơ chưa có trường hợp lệ.");
  await setDoc(doc(db,"KatLearn_Teacher_Schools",schoolId),{name:schoolName,schoolId,province,ward,source:"teacher_verification",updatedAt:Date.now()},{merge:true});
  const ids=Array.isArray(p.classIds)?p.classIds.filter(Boolean).slice(0,20):[],valid=[];
  for(const id of ids){const cs=await getDoc(doc(db,"schools",schoolId,"classes",id));if(cs.exists())valid.push(id)}
  if(!valid.length&&requestedClass){
   const same=await getDocs(query(collection(db,"schools",schoolId,"classes"),where("name","==",requestedClass),limit(5)));
   if(same.docs[0])valid.push(same.docs[0].id);else{
    const c=await addDoc(collection(db,"schools",schoolId,"classes"),{name:requestedClass,createdBy:uid,teacherUid:uid,schoolId,schoolName,province,ward,createdAt:Date.now(),updatedAt:Date.now()});
    valid.push(c.id);await setDoc(doc(db,"classes",c.id),{classId:c.id,name:requestedClass,teacherUid:uid,schoolId,schoolName,province,ward,createdAt:Date.now(),updatedAt:Date.now()},{merge:true});
   }
  }
  if(!valid.length)throw new Error("Hồ sơ chưa có lớp hợp lệ.");
  const chosen=valid.includes(String(p.catalogClassId||""))?String(p.catalogClassId):valid[0];
  await setDoc(ref,{role:"teacher",schoolId,schoolName,province,ward,classIds:valid,catalogClassId:chosen,teacherVerification:{...v,status:"verified",verifiedAt:Date.now(),verifiedBy:state.user.uid},updatedAt:Date.now()},{merge:true});
  for(const id of valid)await setDoc(doc(db,"schools",schoolId,"classes",id),{teacherUid:uid,schoolId,schoolName,province,ward,updatedAt:Date.now()},{merge:true});
  await writeAudit("teacher.verify",uid,{schoolId,classIds:valid});toast("✓ Đã duyệt giáo viên","good");state.cache.teachers=null;state.cache.overview=null;showPage("overview");
 }catch(e){toast(errText(e,"Không thể cập nhật hồ sơ."),"bad")}
}
async function deletePack(id){
 if(!(await dialog("Xóa bộ từ?","Bộ từ sẽ bị xóa khỏi publicPacks. Assignment liên quan sẽ được dọn theo khả năng Firestore.","Xóa bộ từ")))return;
 try{
  const a=await getDocs(query(collection(db,"packAssignments"),where("packId","==",id)));
  for(let i=0;i<a.docs.length;i+=400){const b=writeBatch(db);a.docs.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit()}
  await deleteDoc(doc(db,"publicPacks",id));await writeAudit("pack.delete",id);toast("✓ Đã xóa bộ từ","good");state.cache.packs=null;render("packs");
 }catch(e){toast(errText(e,"Không thể xóa bộ từ."),"bad")}
}

async function loadActivity(force=false){
 if(state.cache.activity&&!force)return renderActivity();
 const snap=await getDocs(query(collection(db,"adminAudit"),orderBy("at","desc"),limit(100)));state.cache.activity={rows:rows(snap)};renderActivity();
}
function renderActivity(){
 const a=state.cache.activity?.rows||[];$("#activityList").innerHTML=a.length?a.map(x=>'<div class="activity-row"><div><b>'+esc(x.action||"Admin action")+'</b><small>'+esc(x.target||"—")+' · '+esc(x.adminEmail||"")+'</small></div><time>'+date(x.at)+'</time></div>').join(""):'<div class="empty">Chưa có nhật ký Admin.</div>';
}
function renderCatalog(s={}){const sp=n(s.provinces),ss=n(s.schools);$("#catProvinces").textContent=fmt(34);$("#catSchools").textContent=fmt(TOTAL_CATALOG);$("#catSyncedP").textContent=fmt(sp);$("#catSyncedS").textContent=fmt(ss);$("#catalogGrid").innerHTML=CATALOG.map(p=>{const done=n(s[p[0]]),pct=Math.min(100,Math.round(done*100/p[2]));return'<div class="province"><div class="province-head"><div><b>'+esc(p[1])+'</b><small> · '+esc(p[0])+'</small></div><em>'+fmt(p[2])+' trường</em></div><div class="province-track"><i style="width:'+pct+'%"></i></div><div class="province-meta"><span>'+fmt(done)+' đã ghi</span><span>'+pct+'%</span></div></div>'}).join("")}
async function loadCatalog(force=false){
 if(state.cache.catalog&&!force)return renderCatalog(state.cache.catalog);
 const [p,s]=await Promise.all([countCollection("KatLearn_TINHTHANH_1"),countCollection("KatLearn_TRUONGHOC_1")]);state.cache.catalog={provinces:p||0,schools:s||0};renderCatalog(state.cache.catalog);
}
async function syncCatalog(){
 if(state.sync)return;
 if(!(await dialog("Đồng bộ danh mục toàn quốc","Tác vụ ghi theo từng tỉnh/thành. Trang Admin vẫn giữ nguyên sau khi đồng bộ xong.","Bắt đầu")))return;
 state.sync=true;$("#catalogSync").disabled=true;let done=0;const progress={provinces:0,schools:0};
 try{
  const token=await state.user.getIdToken(true),headers={Authorization:"Bearer "+token,"Content-Type":"application/json"};$("#syncText").textContent="⏳ Đang bắt đầu…";
  for(const p of CATALOG){
   let offset=0,guard=0;
   while(offset<p[2]){
    if(++guard>1000)throw new Error("Luồng sync bị kẹt tại "+p[1]);
    let response;
    try{response=await fetch("/api/national-catalog-sync",{method:"POST",headers,body:JSON.stringify({action:"catalog-chunk",provinceCode:p[0],offset,limit:150}),cache:"no-store"})}catch(e){throw new Error("Không kết nối catalog backend: "+errText(e))}
    const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch(_){throw new Error("Catalog backend trả dữ liệu không hợp lệ · HTTP "+response.status)}
    if(!response.ok||!data.ok)throw new Error(errText(data.error||data,"HTTP "+response.status+" · "+p[1]));
    const next=num(data.nextOffset),processed=num(data.processed);if(next<=offset&&processed===0)throw new Error("Backend không trả bản ghi mới · "+p[1]);
    offset=next;done+=processed;progress[p[0]]=offset;progress.schools=done;$("#syncBar").style.width=Math.min(100,Math.round(done*100/TOTAL_CATALOG))+"%";$("#syncText").textContent="⏳ "+fmt(done)+" / "+fmt(TOTAL_CATALOG)+" trường · "+p[1];renderCatalog(progress);
   }
   progress.provinces++;renderCatalog(progress);
  }
  state.cache.catalog={provinces:34,schools:done};toast("✓ Đã đồng bộ "+fmt(done)+" trường","good");$("#syncText").textContent="✓ Hoàn tất · "+fmt(done)+" trường";
 }catch(e){$("#syncText").textContent="✕ "+errText(e);toast(e,"bad")}finally{state.sync=false;$("#catalogSync").disabled=false}
}

let modalResolve=null;
function dialog(title,text,ok="Xác nhận",cancel="Hủy"){return new Promise(resolve=>{modalResolve=resolve;$("#modalTitle").textContent=title;$("#modalText").textContent=text;$("#modalOk").textContent=ok;$("#modalCancel").textContent=cancel;$("#modalCancel").classList.toggle("hidden",!cancel);$("#modalBackdrop").classList.remove("hidden")})}
function closeDialog(v){$("#modalBackdrop").classList.add("hidden");const r=modalResolve;modalResolve=null;r?.(v)}
$("#modalOk").onclick=()=>closeDialog(true);$("#modalCancel").onclick=()=>closeDialog(false);$("#modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")closeDialog(false)};

$("#loginForm").onsubmit=async e=>{e.preventDefault();const b=$("#loginBtn"),m=$("#loginError");b.disabled=true;m.textContent="Đang xác thực…";try{const c=await signInWithEmailAndPassword(auth,ADMIN,$("#password").value);if(String(c.user.email||"").toLowerCase()!==ADMIN){await signOut(auth);throw new Error("Tài khoản không có quyền Admin.")}$("#password").value=""}catch(x){m.textContent=x?.code==="auth/invalid-credential"?"Email hoặc mật khẩu không đúng.":errText(x);b.disabled=false}};
onAuthStateChanged(auth,async u=>{state.user=u||null;if(!u){$("#loginGate").classList.remove("hidden");$("#app").classList.add("hidden");health("#healthAuth",false,"Chưa đăng nhập");return}if(String(u.email||"").toLowerCase()!==ADMIN){$("#loginError").textContent="Tài khoản này không có quyền Admin.";await signOut(auth);return}$("#loginGate").classList.add("hidden");$("#app").classList.remove("hidden");health("#healthAuth",true,"Đã xác thực");loadOverview(true).catch(e=>{notice("Không thể tải tổng quan: "+errText(e));toast(e,"bad")})});
bind();renderCatalog({});
