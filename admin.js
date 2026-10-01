import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{browserLocalPersistence,getAuth,onAuthStateChanged,setPersistence,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const CONFIG={apiKey:"AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8",authDomain:"elp---katlearn.firebaseapp.com",projectId:"elp---katlearn",storageBucket:"elp---katlearn.firebasestorage.app",messagingSenderId:"344478447672",appId:"1:344478447672:web:4ed109a40303d0b41b0ecd",measurementId:"G-KTW11GD97T"};
const ADMIN="katlearn.admin@gmail.com";
const TOTAL_CATALOG=22850;
const CATALOG_CHUNK_SIZE=50;
const CATALOG=[["01","Thành phố Hà Nội",2828],["04","Tỉnh Cao Bằng",150],["08","Tỉnh Tuyên Quang",300],["11","Tỉnh Điện Biên",182],["12","Tỉnh Lai Châu",137],["14","Tỉnh Sơn La",278],["15","Tỉnh Lào Cai",216],["19","Tỉnh Thái Nguyên",261],["20","Tỉnh Lạng Sơn",200],["22","Tỉnh Quảng Ninh",266],["24","Tỉnh Bắc Ninh",1039],["25","Tỉnh Phú Thọ",759],["31","Thành phố Hải Phòng",1041],["33","Tỉnh Hưng Yên",548],["37","Tỉnh Ninh Bình",1178],["38","Tỉnh Thanh Hóa",2002],["40","Tỉnh Nghệ An",372],["42","Tỉnh Hà Tĩnh",444],["44","Tỉnh Quảng Trị",290],["46","Thành phố Huế",383],["48","Thành phố Đà Nẵng",550],["51","Tỉnh Quảng Ngãi",127],["52","Tỉnh Gia Lai",261],["56","Tỉnh Khánh Hòa",296],["66","Tỉnh Đắk Lắk",616],["68","Tỉnh Lâm Đồng",1021],["75","Tỉnh Đồng Nai",691],["79","Thành phố Hồ Chí Minh",2382],["80","Tỉnh Tây Ninh",406],["82","Tỉnh Đồng Tháp",275],["86","Tỉnh Vĩnh Long",723],["91","Tỉnh An Giang",1322],["92","Thành phố Cần Thơ",713],["96","Tỉnh Cà Mau",593]];
const app=getApps().length?getApps()[0]:initializeApp(CONFIG),auth=getAuth(app);
let authBusy=false;
let authBooting=true;

function showLogin(message=""){
  $("#loginGate")?.classList.remove("hidden");
  $("#app")?.classList.add("hidden");
  const input=$("#password");
  const button=$("#loginBtn");
  const error=$("#loginError");
  if(error)error.textContent=message;
  if(button){button.disabled=false;button.textContent="Vào Control Center →";}
  if(input&&message)input.focus();
  health("#healthAuth",false,"Chưa đăng nhập");
  setConnection(false,"Chưa kết nối");
}

function setLoginBusy(busy,message="Đang xác thực…"){
  authBusy=busy;
  const button=$("#loginBtn");
  const input=$("#password");
  if(button){
    button.disabled=busy;
    button.textContent=busy?"Đang xác thực…":"Vào Control Center →";
  }
  if(input)input.disabled=busy;
  const error=$("#loginError");
  if(error)error.textContent=message;
}

async function verifyAdminIdentity(user){
  const email=String(user?.email||"").trim().toLowerCase();
  if(!user||email!==ADMIN){
    await signOut(auth).catch(()=>{});
    throw Object.assign(new Error("Tài khoản này không có quyền Admin."),{code:"admin_forbidden"});
  }
  return user;
}

async function openAdminSession(user){
  await verifyAdminIdentity(user);
  state.user=user;
  health("#healthAuth",true,"Đã xác thực");
  setConnection(true,"Đang kiểm tra Admin Hub…");

  // Do not reveal the Admin UI until the backend has accepted the Firebase token.
  const overview=await apiGet("overview");
  state.data.overview=overview;
  $("#loginGate")?.classList.add("hidden");
  $("#app")?.classList.remove("hidden");
  $("#password").value="";
  $("#loginError").textContent="";
  renderOverview(overview);
  setConnection(true,"Admin Hub online");
}

async function handleAdminLogin(){
  if(authBusy)return;
  const password=String($("#password")?.value||"");
  if(!password){
    showLogin("Vui lòng nhập mật khẩu.");
    return;
  }

  setLoginBusy(true);
  try{
    await setPersistence(auth,browserLocalPersistence);
    const credential=await signInWithEmailAndPassword(auth,ADMIN,password);
    await openAdminSession(credential.user);
  }catch(error){
    console.error("[KatLearn Admin] login failed",error);
    await signOut(auth).catch(()=>{});
    state.user=null;
    const code=String(error?.code||"");
    const message=
      code==="auth/invalid-credential"||code==="auth/wrong-password"||code==="auth/user-not-found"
        ?"Email hoặc mật khẩu không đúng."
        :code==="auth/too-many-requests"
          ?"Có quá nhiều lần đăng nhập thất bại. Hãy chờ một lúc rồi thử lại."
          :code==="admin_forbidden"
            ?"Tài khoản này không có quyền Admin."
            :code==="admin_http_401"||code==="admin_http_403"
              ?"Firebase đã đăng nhập nhưng Admin Hub không chấp nhận phiên này."
              :errText(error,"Không thể đăng nhập Admin.");
    showLogin(message);
  }finally{
    authBusy=false;
    if(authBooting===false){
      const input=$("#password");
      if(input)input.disabled=false;
    }
  }
}

async function restoreAdminSession(user){
  if(!user)return showLogin("");
  if(String(user.email||"").toLowerCase()!==ADMIN){
    await signOut(auth).catch(()=>{});
    return showLogin("Tài khoản hiện tại không có quyền Admin.");
  }
  if(authBusy)return;
  authBusy=true;
  try{
    await openAdminSession(user);
  }catch(error){
    console.error("[KatLearn Admin] session restore failed",error);
    state.user=null;
    await signOut(auth).catch(()=>{});
    showLogin(errText(error,"Phiên Admin đã hết hạn hoặc Admin Hub chưa xác nhận được phiên này."));
  }finally{
    authBusy=false;
  }
}

const $=s=>document.querySelector(s),qsa=s=>Array.from(document.querySelectorAll(s)||[]),each=(value,fn)=>{if(value==null)return;if(typeof value.forEach==="function")value.forEach(fn)};
const titles={overview:"Tổng quan",teachers:"Giáo viên",users:"Tài khoản",classes:"Lớp học",packs:"Bộ từ công khai","private-packs":"Bộ từ riêng",schools:"Trường học",catalog:"Danh mục toàn quốc",activity:"Hoạt động Admin"};
const state={user:null,page:"overview",data:{},catalog:null,syncing:false,syncingDirectory:{},packEditId:""};
const syncKey="katlearn.admin.catalog.v2";
const directorySyncKey="katlearn.admin.directory-sync.v1";
const DIRECTORY_SYNC_CONFIG={
  users:{label:"Tài khoản",limit:200,status:"#syncUsersStatus",button:"#syncUsers"},
  classes:{label:"Lớp học",limit:200,status:"#syncClassesStatus",button:"#syncClasses"},
  packs:{label:"Bộ từ công khai",limit:20,status:"#syncPacksStatus",button:"#syncPacks"},
  codePacks:{label:"Bộ từ từ code",limit:1,status:"#syncCodePacksStatus",button:"#syncCodePacks"}
};

function errText(e,fallback="Có lỗi xảy ra."){
 if(e==null)return fallback;
 if(typeof e==="string"&&e.trim())return e;
 if(typeof e?.message==="string"&&e.message)return e.message;
 if(typeof e?.error==="string"&&e.error)return e.error;
 if(typeof e?.error?.message==="string"&&e.error.message)return e.error.message;
 if(typeof e?.code==="string"&&e.code)return e.code;
 try{const j=JSON.stringify(e);if(j&&j!=="{}")return j}catch(_){}
 return fallback;
}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function fmt(v){return num(v).toLocaleString("vi-VN")}
function date(v){const n=num(v);if(!n)return"—";try{return new Date(n).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"})}catch(_){return"—"}}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function roleLabel(r){return({teacher:"Giáo viên",student:"Học sinh",pending_teacher_verification:"Chờ xác minh",teacher_rejected:"Từ chối",admin:"Admin"}[String(r||"").toLowerCase()]||String(r||"Chưa rõ"))}
function roleClass(r){r=String(r||"").toLowerCase();return r==="teacher"?"teacher":r==="student"?"student":r==="pending_teacher_verification"?"pending":r==="teacher_rejected"?"rejected":r==="admin"?"admin":""}

let toastTimer;
function toast(value,type=""){const x=$("#toast");x.textContent=errText(value);x.className="toast show "+type;clearTimeout(toastTimer);toastTimer=setTimeout(()=>x.className="toast",4300)}
function clearPageError(){$("#pageError").classList.add("hidden")}
function pageError(error,title="Không thể tải dữ liệu"){const x=$("#pageError");$("#pageErrorTitle").textContent=title;const value=error||{};$("#pageErrorText").textContent=errText(value);const code=value?.code?"Mã lỗi: "+value.code:"";const details=value?.details!=null?(() => {try{return typeof value.details==="string"?value.details:JSON.stringify(value.details)}catch(_){return String(value.details)}})():"";$("#pageErrorCode").textContent=[code,details].filter(Boolean).join("\n");x.classList.remove("hidden")}
function health(id,ok,text){const x=$(id);x.textContent=text;x.classList.toggle("good-text",ok===true);x.classList.toggle("bad-text",ok===false)}
function setConnection(ok,text){const x=$("#backendStatus");x.classList.toggle("good",ok===true);x.classList.toggle("bad",ok===false);$("#backendLabel").textContent=text}

async function token(){if(!state.user)throw new Error("Chưa đăng nhập Admin.");const t=await state.user.getIdToken(true);if(!t)throw new Error("Không lấy được phiên Admin.");return t}
async function apiGet(section,params={}){
 const t=await token();
 let response;
 const controller=new AbortController();
 const timeoutMs=section==="users"?45000:12000; const timeout=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const query=new URLSearchParams({section:String(section||"overview")});
  Object.entries(params||{}).forEach(([key,value])=>{if(value!==undefined&&value!==null&&String(value)!=="")query.set(key,String(value))});
  response=await fetch("/api/admin-hub?"+query.toString(),{method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+t,Accept:"application/json"},signal:controller.signal})
 }catch(e){
  if(e?.name==="AbortError"){const seconds=Math.round(timeoutMs/1000);throw Object.assign(new Error("Admin Hub phản hồi quá lâu ("+seconds+" giây)."),{code:"admin_fetch_timeout",cause:e});}
  throw Object.assign(new Error("Không kết nối được Admin Hub."),{code:"admin_fetch_failed",cause:e})
 }finally{clearTimeout(timeout)}
 const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch(_){throw Object.assign(new Error("Admin Hub trả dữ liệu không hợp lệ · HTTP "+response.status),{code:"admin_invalid_json",details:raw.slice(0,800)})}
 if(!response.ok||data.ok!==true)throw Object.assign(new Error(errText(data.error,"HTTP "+response.status+" · Admin Hub thất bại")),{code:data.code||"admin_http_"+response.status,details:data.details})
 return data
}
async function apiAction(action,payload={}){
 const t=await token();
 let response;
 try{response=await fetch("/api/admin-hub",{method:"POST",cache:"no-store",headers:{Authorization:"Bearer "+t,"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({action,...payload})})}
 catch(e){throw Object.assign(new Error("Không kết nối được Admin Hub."),{code:"admin_action_fetch_failed",cause:e})}
 const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch(_){throw Object.assign(new Error("Admin Hub trả dữ liệu không hợp lệ · HTTP "+response.status),{code:"admin_invalid_json",details:raw.slice(0,800)})}
 if(!response.ok||data.ok!==true)throw Object.assign(new Error(errText(data.error,"HTTP "+response.status+" · Admin Hub thất bại")),{code:data.code||"admin_action_"+response.status,details:data.details})
 return data
}

function showPage(name){
 state.page=name;clearPageError();
 each(qsa(".page"),x=>x.classList.toggle("active",x.id==="page-"+name));
 each(qsa(".nav button"),x=>x.classList.toggle("active",x.dataset.page===name));
 $("#pageTitle").textContent=titles[name]||"Tổng quan";
 $("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show");
 window.scrollTo({top:0,behavior:"smooth"});
 loadPage(name,true).catch(e=>{pageError(e);toast(e,"bad")});
}
function bind(){
 $(".brand")?.addEventListener("click",e=>{e.preventDefault();showPage("overview")});
 each(qsa(".nav button,[data-go]"),b=>b.addEventListener("click",e=>{if(b.matches("[data-go]"))e.preventDefault();showPage(b.dataset.page||b.dataset.go)}));
 $("#menuMobile").onclick=()=>{$("#sidebar").classList.add("open");$("#mobileOverlay").classList.add("show")};
 $("#mobileOverlay").onclick=()=>{$("#sidebar").classList.remove("open");$("#mobileOverlay").classList.remove("show")};
 async function leaveAdmin(){
  try{
    await signOut(auth);
  }finally{
    location.replace("https://lms-katlearn.vercel.app/login.html?logout=1");
  }
}
$("#logout").onclick=leaveAdmin;
$("#clearSession").onclick=leaveAdmin;

 $("#loginBtn")?.addEventListener("click",e=>{e.preventDefault();void handleAdminLogin()});
 $("#password")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();handleAdminLogin()}});
 $("#refresh").onclick=()=>loadPage(state.page,true).then(()=>toast("✓ Đã làm mới","good")).catch(e=>{pageError(e);toast(e,"bad")});
 each(["teacherSearch","userSearch","classSearch","packSearch","schoolSearch","privatePackSearch"],id=>$("#"+id)?.addEventListener("input",()=>render(state.page)));
 $("#teacherFilter")?.addEventListener("change",()=>render("teachers"));
 $("#userFilter")?.addEventListener("change",()=>render("users"));
  $("#catalogSync")?.addEventListener("click",syncCatalog);
 $("#syncAll")?.addEventListener("click",()=>runDirectorySyncAll());
 $("#syncUsers")?.addEventListener("click",()=>runDirectorySync("users"));
 $("#syncClasses")?.addEventListener("click",()=>runDirectorySync("classes"));
 $("#syncPacks")?.addEventListener("click",()=>runDirectorySync("packs"));
 $("#syncCodePacks")?.addEventListener("click",()=>runDirectorySync("codePacks"));
 $("#refreshPrivatePacks")?.addEventListener("click",()=>loadPage("private-packs",true).catch(e=>{pageError(e);toast(e,"bad")}));
 $("#packEditCancel")?.addEventListener("click",closePackEditor);
 $("#packEditSave")?.addEventListener("click",saveEditedPack);
 $("#packEditorBackdrop")?.addEventListener("click",e=>{if(e.target.id==="packEditorBackdrop")closePackEditor()});
}
async function loadPage(page,force=false){
 if(!force&&state.data[page]){render(page);return}
 if(page==="catalog"){
  state.catalog=await apiGet("catalog");state.data.catalog=state.catalog;renderCatalog();return;
 }
 state.data[page]=await apiGet(page);render(page);
}
function render(section){
 const d=state.data[section]||{};
 if(section==="overview")return renderOverview(d);
 const rows=Array.isArray(d.rows)?d.rows:[];
 if(section==="teachers")return renderTeachers(rows,d.limited);
 if(section==="users")return renderUsers(rows,d.limited);
 if(section==="classes")return renderClasses(rows,d.limited);
 if(section==="packs")return renderPacks(rows,d.limited,d);
 if(section==="private-packs")return renderPrivatePacks(rows,d.total,d.limited);
 if(section==="schools")return renderSchools(rows,d.limited);
 if(section==="activity")return renderActivity(rows);
}
function renderOverview(d){
 const s=d.stats||{};
 $("#mUsers").textContent=s.users==null?"—":fmt(s.users);$("#mPending").textContent=s.pending==null?"—":fmt(s.pending);$("#mTeachers").textContent=s.teachers==null?"—":fmt(s.teachers);$("#mStudents").textContent=s.students==null?"—":fmt(s.students);$("#mClasses").textContent=s.classes==null?"—":fmt(s.classes);$("#mSchools").textContent=s.schools==null?"—":fmt(s.schools);
 const p=Array.isArray(d.pending)?d.pending:[];
 $("#pendingList").innerHTML=p.length?p.slice(0,6).map(t=>{const v=t.teacherVerification||{};return '<div class="pending"><div class="pending-main"><div><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+' · '+esc(t.schoolName||v.requestedSchoolName||"Chưa có trường")+'</small></div><span class="badge pending">CHỜ DUYỆT</span></div><div class="row-actions"><button class="btn good" data-verify="'+esc(t.id)+'">✓ Duyệt</button><button class="btn bad" data-reject="'+esc(t.id)+'">Từ chối</button></div></div>'}).join(""):'<div class="empty">Không có hồ sơ giáo viên chờ duyệt. 🎉</div>';
 each(qsa("#pendingList [data-verify]"),b=>b.onclick=()=>teacherAction("verify",b.dataset.verify));each(qsa("#pendingList [data-reject]"),b=>b.onclick=()=>teacherAction("reject",b.dataset.reject));
 health("#healthAuth",true,"Đã xác thực");health("#healthAdmin",true,"Admin Hub đã xác thực");health("#healthFs",!(d.degraded),d.degraded?"Có cảnh báo": "Đang hoạt động");health("#healthCatalog",true,"Kế hoạch sẵn sàng");
 setConnection(true,"Admin Hub online");
 if(Array.isArray(d.warnings)&&d.warnings.length){pageError({message:"Một số thống kê đang ở chế độ suy giảm.",code:"admin_degraded",details:d.warnings});}
}
function match(row,q,fields){if(!q)return true;return fields.map(k=>k.split(".").reduce((v,p)=>v?.[p],row)||"").join(" ").toLowerCase().includes(q)}
function renderTeachers(rows,limited){
 const q=$("#teacherSearch").value.trim().toLowerCase(),f=$("#teacherFilter").value;
 const list=rows.filter(t=>(f==="all"||t._status===f)&&match(t,q,["displayName","name","email","schoolName","province","ward","teacherVerification.requestedSchoolName","teacherVerification.requestedClassName"]));
 $("#teacherTable").innerHTML=list.map(t=>'<tr><td><strong>'+esc(t.displayName||t.name||"Giáo viên")+'</strong><small>'+esc(t.email||"")+' · UID <span class="mono">'+esc(t.id)+'</span></small></td><td><span class="badge '+roleClass(t.role)+'">'+esc(t._status==="pending"?"CHỜ XÁC MINH":t._status==="rejected"?"ĐÃ TỪ CHỐI":"ĐÃ DUYỆT")+'</span></td><td>'+esc(t.schoolName||t.teacherVerification?.requestedSchoolName||"—")+'<small>'+esc([t.province,t.ward].filter(Boolean).join(" · ")||"—")+' · Lớp '+esc(t.teacherVerification?.requestedClassName||t.className||"—")+'</small></td><td>'+date(t.teacherVerification?.submittedAt||t.createdAt)+'</td><td><div class="row-actions">'+(t._status==="pending"?'<button class="btn good" data-verify="'+esc(t.id)+'">✓ Duyệt</button><button class="btn bad" data-reject="'+esc(t.id)+'">Từ chối</button>':'<button class="btn" data-inspect="'+esc(t.id)+'">Xem</button>')+'</div></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có giáo viên phù hợp.</div></td></tr>';
 each(qsa("#teacherTable [data-verify]"),b=>b.onclick=()=>teacherAction("verify",b.dataset.verify));each(qsa("#teacherTable [data-reject]"),b=>b.onclick=()=>teacherAction("reject",b.dataset.reject));each(qsa("#teacherTable [data-inspect]"),b=>b.onclick=()=>inspectTeacher(b.dataset.inspect));
 $("#teacherLimit").textContent=limited?"Đã chạm giới hạn dữ liệu trả về. Dùng tìm kiếm theo nhóm để thu hẹp kết quả.":"";
}
function renderUsers(rows,limited){
 const q=$("#userSearch").value.trim().toLowerCase(),f=$("#userFilter").value;
 const list=rows.filter(x=>(f==="all"||String(x.role||"")===f)&&match(x,q,["displayName","name","email","accountCode","schoolName","className"]));
 $("#userTable").innerHTML=list.map(u=>{
  const locked=Boolean(u.disabled);
  const protectedUser=String(u.email||"").toLowerCase()==="katlearn.admin@gmail.com";
  const profileMissing=u.profileExists===false;
  const roleText=profileMissing?"Chưa có hồ sơ":roleLabel(u.role);
  const roleBadge=profileMissing?"pending":roleClass(u.role);
  const actionHtml=protectedUser?"":profileMissing
    ?'<small class="bad-text">⚠️ Chưa có users/{uid} · chỉ quản lý sau khi hồ sơ được tạo</small>'
    :'<button class="btn" data-rename-user="'+esc(u.id)+'">Sửa tên</button>'+
      '<button class="btn" data-reset-user="'+esc(u.id)+'">Reset</button>'+
      (locked?'<button class="btn good" data-enable-user="'+esc(u.id)+'">Mở khóa</button>':'<button class="btn" data-disable-user="'+esc(u.id)+'">Khóa</button>')+
      '<button class="btn bad" data-delete-user="'+esc(u.id)+'">Xóa</button>';
  return '<tr><td><strong>'+esc(u.displayName||u.name||"KatLearn User")+'</strong><small>'+esc(u.email||"")+(u.accountCode?" · "+esc(u.accountCode):"")+'</small></td><td><span class="badge '+roleBadge+'">'+esc(roleText)+'</span>'+ (locked?'<small class="bad-text">🔒 Đang khóa</small>':'') +'</td><td>'+esc([u.schoolName,u.className].filter(Boolean).join(" · ")||"—")+'<small>'+esc([u.province,u.ward].filter(Boolean).join(" · ")||"—")+'</small></td><td>🪙 '+fmt(u.coins)+' · ⚡ '+fmt(u.energy)+'<small>🔥 streak '+fmt(u.streak)+'</small></td><td>'+date(u.createdAt)+'</td><td><div class="row-actions">'+actionHtml+
   '</div></td></tr>';
 }).join("")||'<tr><td colspan="6"><div class="empty">Không tìm thấy tài khoản.</div></td></tr>';
 each(qsa("#userTable [data-rename-user]"),b=>b.onclick=()=>renameUser(b.dataset.renameUser,list.find(x=>x.id===b.dataset.renameUser)?.displayName||list.find(x=>x.id===b.dataset.renameUser)?.name||""));
 each(qsa("#userTable [data-reset-user]"),b=>b.onclick=()=>resetUserStats(b.dataset.resetUser));
 each(qsa("#userTable [data-disable-user]"),b=>b.onclick=()=>setUserDisabled(b.dataset.disableUser,true));
 each(qsa("#userTable [data-enable-user]"),b=>b.onclick=()=>setUserDisabled(b.dataset.enableUser,false));
 each(qsa("#userTable [data-delete-user]"),b=>b.onclick=()=>deleteUserAccount(b.dataset.deleteUser));
 $("#userLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"Đã tải toàn bộ "+fmt(rows.length)+" tài khoản từ Firebase Auth."+(rows.some(x=>x.profileExists===false)?" Một số tài khoản chưa có hồ sơ Firestore.":"");
}
function renderClasses(rows,limited){
 const q=$("#classSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","grade","teacherEmail","teacherUid","schoolName","joinCode","province","ward"]));
 $("#classTable").innerHTML=list.map(cl=>'<tr><td><strong>'+esc(cl.name||"—")+'</strong><small>Khối '+esc(cl.grade||"—")+' · <span class="mono">'+esc(cl.id)+'</span></small></td><td>'+esc(cl.teacherEmail||cl.teacherUid||"—")+'</td><td>'+esc(cl.schoolName||"—")+'<small>'+esc([cl.province,cl.ward].filter(Boolean).join(" · "))+'</small></td><td><span class="badge teacher">'+esc(cl.joinCode||"—")+'</span></td><td>'+fmt(cl.studentCount)+'</td><td>'+date(cl.updatedAt||cl.createdAt)+'</td><td><div class="row-actions"><button class="btn" data-edit-class="'+esc(cl.id)+'">Sửa</button><button class="btn bad" data-delete-class="'+esc(cl.id)+'">Xóa</button></div></td></tr>').join("")||'<tr><td colspan="7"><div class="empty">Không có lớp học.</div></td></tr>';
 each(qsa("#classTable [data-edit-class]"),b=>b.onclick=()=>editClass(list.find(x=>x.id===b.dataset.editClass)));
 each(qsa("#classTable [data-delete-class]"),b=>b.onclick=()=>deleteClassAdmin(b.dataset.deleteClass));
 $("#classLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"";
}
function renderPacks(rows,limited,data={}){
 const q=$("#packSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","createdBy","createdByEmail","createdByUid"]));
 const codePacks=Array.isArray(data.codePacks)?data.codePacks:[];
 $("#codePackCount").textContent=fmt(Number(data.codePackCount)||codePacks.length);
 $("#codeWordCount").textContent=fmt(Number(data.codeWordCount)||codePacks.reduce((s,p)=>s+num(p.wordCount),0));
 $("#firebasePackCount").textContent=fmt(rows.length);
 const codeList=codePacks.filter(x=>match(x,q,["name","sourceId","sourceFile"]));
 $("#codePackTable").innerHTML=codeList.map(p=>'<tr><td><strong>'+esc(p.name||"Bộ từ code")+'</strong><small>ID <span class="mono">'+esc(p.sourceId||p.id)+'</span></small></td><td>'+fmt(p.wordCount)+'</td><td><span class="mono">'+esc(p.sourceFile||"data/vocabulary/*.json")+'</span></td><td><span class="badge teacher">SOURCE CODE</span></td></tr>').join("")||'<tr><td colspan="4"><div class="empty">Không có bộ từ trong source code.</div></td></tr>';
 $("#packTable").innerHTML=list.map(p=>'<tr><td><strong>'+esc(p.name||"Bộ từ chưa đặt tên")+'</strong><small>ID <span class="mono">'+esc(p.id)+'</span></small></td><td>'+fmt(p.wordCount)+'</td><td>'+esc(p.createdByEmail||p.createdBy||p.createdByUid||"—")+'</td><td>'+date(p.createdAt)+'</td><td><div class="row-actions"><button class="btn" data-edit-pack="'+esc(p.id)+'">Sửa</button><button class="btn bad" data-delete-pack="'+esc(p.id)+'">Xóa</button></div></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có pack công khai Firebase.</div></td></tr>';
 each(qsa("#packTable [data-edit-pack]"),b=>b.onclick=()=>openPackEditor(b.dataset.editPack));
 each(qsa("#packTable [data-delete-pack]"),b=>b.onclick=()=>deletePack(b.dataset.deletePack));
 $("#packLimit").textContent=limited?"Admin chỉ hiển thị tối đa 300 pack Firebase trong bảng; source code vẫn hiển thị đầy đủ.":"";
 const sync=directorySyncStatus("codePacks");
 setDirectorySyncStatus("codePacks",sync.done?("✓ "+fmt(Number(data.codePackCount)||codePacks.length)+" bộ / "+fmt(Number(data.codeWordCount)||codePacks.reduce((s,p)=>s+num(p.wordCount),0))+" từ đã sync"):"Chưa sync");
}
function renderPrivatePacks(rows,total,limited){
 const q=$("#privatePackSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","ownerUid","ownerEmail","ownerDisplayName","accountCode","ownerAccountCode","id"]));
 $("#privatePackTable").innerHTML=list.map(p=>{
   const code=p.accountCode||p.ownerAccountCode||"—";
   return '<tr><td><strong>'+esc(p.name||"Bộ từ riêng")+'</strong><small>ID <span class="mono">'+esc(p.id)+'</span></small></td><td>'+esc(p.ownerDisplayName||"—")+'<small>'+esc(p.ownerEmail||p.ownerUid||"—")+'</small><small>Mã tài khoản: <span class="mono">'+esc(code)+'</span></small></td><td>'+fmt(p.wordCount)+'</td><td>'+date(p.createdAt)+'</td><td><span class="badge">PERSONAL</span></td></tr>';
 }).join("")||'<tr><td colspan="5"><div class="empty">Không tìm thấy bộ từ riêng.</div></td></tr>';
 $("#privatePackLimit").textContent=Number(total)>list.length||limited?"Đang hiển thị "+fmt(list.length)+" bộ từ riêng trong giới hạn Admin Hub ("+fmt(total)+" tổng).":"";
}
function renderSchools(rows,limited){
 const q=$("#schoolSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","province","ward","schoolLevel","source"]));
 $("#schoolTable").innerHTML=list.map(s=>{
  const protectedSchool=String(s.source||"").startsWith("thanhtungct7")||String(s.sourceType||"").includes("national");
  return '<tr><td><strong>'+esc(s.name||"—")+'</strong><small>ID <span class="mono">'+esc(s.id)+'</span></small></td><td>'+esc(s.province||"—")+'</td><td>'+esc(s.ward||"—")+'</td><td>'+esc(s.schoolLevel||"—")+'</td><td>'+esc(s.source||"local")+'</td><td><div class="row-actions">'+(protectedSchool?'<span class="limit">Catalog-managed</span>':'<button class="btn" data-edit-school="'+esc(s.id)+'">Sửa</button><button class="btn bad" data-delete-school="'+esc(s.id)+'">Xóa</button>')+'</div></td></tr>'
 }).join("")||'<tr><td colspan="6"><div class="empty">Không tìm thấy trường.</div></td></tr>';
 each(qsa("#schoolTable [data-edit-school]"),b=>b.onclick=()=>editSchool(list.find(x=>x.id===b.dataset.editSchool)));
 each(qsa("#schoolTable [data-delete-school]"),b=>b.onclick=()=>deleteSchoolAdmin(b.dataset.deleteSchool));
 $("#schoolLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"";
}
function readDirectorySync(){
 try{const value=JSON.parse(localStorage.getItem(directorySyncKey)||"{}");return value&&typeof value==="object"?value:{}}catch(_){return{}}
}
function saveDirectorySync(value){try{localStorage.setItem(directorySyncKey,JSON.stringify(value))}catch(_){}}
function directorySyncStatus(entity){
 const value=readDirectorySync()?.[entity]||{};
 return{cursor:String(value.cursor||""),processed:num(value.processed),total:num(value.total),done:Boolean(value.done)}
}
function setDirectorySyncStatus(entity,textValue){
 const cfg=DIRECTORY_SYNC_CONFIG[entity];if(!cfg)return;
 const el=$(cfg.status);if(el)el.textContent=textValue;
}
function setDirectorySyncButton(entity,busy){
 const cfg=DIRECTORY_SYNC_CONFIG[entity];if(!cfg)return;
 const el=$(cfg.button);if(el){el.disabled=busy;el.textContent=busy?"⏳ Đang đồng bộ…":"☁️ Đồng bộ Firebase"}
}
function renderDirectorySyncSummary(){
 const all=readDirectorySync();
 for(const entity of Object.keys(DIRECTORY_SYNC_CONFIG)){
  const p=all?.[entity]||{};
  const total=num(p.total),processed=Math.min(total,num(p.processed));
  setDirectorySyncStatus(entity,p.done&&total?("✓ "+fmt(total)+" đã đồng bộ"):total?(fmt(processed)+" / "+fmt(total)):"Chưa đồng bộ");
 }
 const summary=$("#syncOverall");
 if(summary){
  const completed=Object.keys(DIRECTORY_SYNC_CONFIG).filter(e=>all?.[e]?.done).length;
  summary.textContent=completed===4?"✓ Tất cả dữ liệu Admin đã được đồng bộ vào Firebase.":completed+" / 4 nhóm dữ liệu đã hoàn tất đồng bộ.";
 }
}
async function runDirectorySync(entity){
 const cfg=DIRECTORY_SYNC_CONFIG[entity];if(!cfg||state.syncingDirectory[entity])return;
 state.syncingDirectory[entity]=true;
 setDirectorySyncButton(entity,true);
 try{
  if(entity==="codePacks"){
   setDirectorySyncStatus(entity,"⏳ Đang đọc toàn bộ data/vocabulary/*.json…");
   const result=await apiAction("sync-code-public-packs");
   const next={cursor:"",processed:num(result.processed),total:num(result.total),done:Boolean(result.done)};
   saveDirectorySync({...readDirectorySync(),[entity]:next});
   renderDirectorySyncSummary();
   setDirectorySyncStatus(entity,next.done?"✓ "+fmt(next.total)+" bộ / "+fmt(num(result.totalWords))+" từ đã đồng bộ":"⏳ "+fmt(next.processed)+" / "+fmt(next.total));
   if(!next.done)throw Object.assign(new Error("Đồng bộ kho từ code chưa hoàn tất."),{code:"code_pack_sync_incomplete"});
   state.data.packs=null;
   await loadPage("packs",true);
   toast("✓ Đã đưa toàn bộ bộ từ trong source code vào Firebase mirror.","good");
   return;
  }
  let saved=directorySyncStatus(entity);
  if(saved.done){saved={cursor:"",processed:0,total:0,done:false};}
  let cursor=saved.cursor,total=saved.total,processed=saved.processed;
  setDirectorySyncStatus(entity,total?("⏳ "+fmt(processed)+" / "+fmt(total)):"⏳ Đang chuẩn bị…");
  for(let guard=0;guard<1000;guard++){
   const before=cursor;
   const result=await apiAction("sync-directory-chunk",{entity,cursor,limit:cfg.limit});
   total=num(result.total)||total;
   processed=Math.min(total,processed+num(result.processed));
   cursor=String(result.nextCursor||"");
   const next={cursor,processed,total,done:Boolean(result.done)};
   saveDirectorySync({...readDirectorySync(),[entity]:next});
   renderDirectorySyncSummary();
   setDirectorySyncStatus(entity,next.done?"✓ "+fmt(total)+" đã đồng bộ":"⏳ "+fmt(processed)+" / "+fmt(total));
   if(next.done)break;
   if(!result.processed&&cursor===before)throw Object.assign(new Error("Đồng bộ "+cfg.label+" không tiến thêm được."),{code:"sync_stalled"});
  }
  const final=directorySyncStatus(entity);
  if(!final.done)throw Object.assign(new Error("Đồng bộ "+cfg.label+" vượt quá giới hạn an toàn của phiên."),{code:"sync_guard_limit"});
  toast("✓ Đã đồng bộ toàn bộ "+cfg.label+" vào Firebase.","good");
 }catch(e){
  setDirectorySyncStatus(entity,"❌ "+errText(e));
  toast(e,"bad");
 }finally{
  state.syncingDirectory[entity]=false;
  setDirectorySyncButton(entity,false);
  renderDirectorySyncSummary();
 }
}
async function runDirectorySyncAll(){
 if(Object.values(state.syncingDirectory).some(Boolean))return;
 const button=$("#syncAll");if(button){button.disabled=true;button.textContent="⏳ Đang đồng bộ tất cả…";}
 try{
  for(const entity of Object.keys(DIRECTORY_SYNC_CONFIG)){
   await runDirectorySync(entity);
   if(!directorySyncStatus(entity).done)break;
  }
  const done=Object.keys(DIRECTORY_SYNC_CONFIG).every(e=>directorySyncStatus(e).done);
  toast(done?"✓ Đã đồng bộ tài khoản, lớp học, bộ từ công khai và toàn bộ bộ từ từ code.":"Đã dừng ở nhóm chưa hoàn tất.",""+(done?"good":"bad"));
 }catch(e){toast(e,"bad")}
 finally{if(button){button.disabled=false;button.textContent="☁️ Đồng bộ tất cả"}renderDirectorySyncSummary()}
}

async function openPackEditor(packId){
 try{
  const data=await apiGet("pack",{id:packId}),pack=data.pack||{};
  state.packEditId=packId;
  $("#packEditName").value=String(pack.name||"");
  $("#packEditWords").value=JSON.stringify(Array.isArray(pack.words)?pack.words:[],null,2);
  $("#packEditError").textContent="";
  $("#packEditorTitle").textContent="Chỉnh sửa · "+String(pack.name||"Bộ từ");
  $("#packEditorBackdrop").classList.add("open");
  $("#packEditName").focus();
 }catch(e){toast(e,"bad");pageError(e,"Không thể mở bộ từ")}
}
function closePackEditor(){
 state.packEditId="";
 $("#packEditorBackdrop")?.classList.remove("open");
}
async function saveEditedPack(){
 const id=state.packEditId;if(!id)return;
 const name=String($("#packEditName")?.value||"").trim();
 const raw=String($("#packEditWords")?.value||"").trim();
 const errorEl=$("#packEditError");
 if(!name){if(errorEl)errorEl.textContent="Tên bộ từ không được để trống.";return}
 let words;
 try{words=raw?JSON.parse(raw):[]}catch(e){if(errorEl)errorEl.textContent="JSON không hợp lệ: "+String(e.message||"hãy kiểm tra lại dấu ngoặc/dấu phẩy.");return}
 if(!Array.isArray(words)){if(errorEl)errorEl.textContent="Danh sách từ phải là một mảng JSON.";return}
 const button=$("#packEditSave");if(button){button.disabled=true;button.textContent="⏳ Đang lưu…";}
 if(errorEl)errorEl.textContent="";
 try{
  await apiAction("update-pack",{packId:id,name,words});
  toast("✓ Đã cập nhật bộ từ và lưu vào Firebase.","good");
  closePackEditor();
  state.data.packs=null;
  await loadPage("packs",true);
 }catch(e){
  if(errorEl)errorEl.textContent=errText(e);
  toast(e,"bad");
 }finally{
  if(button){button.disabled=false;button.textContent="💾 Lưu vào Firebase";}
 }
}

function renderActivity(rows){
 $("#activityList").innerHTML=rows.length?rows.map(x=>'<div class="activity-row"><div><strong>'+esc(x.action||"admin.action")+'</strong><small>'+esc(x.target||"—")+(x.adminEmail?" · "+esc(x.adminEmail):"")+'</small></div><time>'+date(x.at)+'</time></div>').join(""):'<div class="empty">Chưa có audit log.</div>';
}
function readProgress(){
 try{const v=JSON.parse(localStorage.getItem(syncKey)||"{}");return v&&typeof v==="object"?v:{}}catch(_){return{}}
}
function saveProgress(p){try{localStorage.setItem(syncKey,JSON.stringify(p))}catch(_){}}
function progressFor(p,meta){
 const total=meta?.[2]||0,done=Math.min(total,num(p?.[meta?.[0]]||0));return{offset:done,total,pct:total?Math.floor(done*100/total):0}
}
function renderCatalog(){
 const data=state.catalog||{},provinces=Array.isArray(data.catalog?.provinces)?data.catalog.provinces:CATALOG.map(x=>({code:x[0],name:x[1],total:x[2]}));
 const p=readProgress(),done=CATALOG.reduce((sum,item)=>sum+Math.min(item[2],num(p[item[0]])),0),doneP=CATALOG.filter(item=>num(p[item[0]])>=item[2]).length;
 $("#cTotalP").textContent=fmt(provinces.length||34);$("#cTotalS").textContent=fmt(num(data.catalog?.totalSchools||TOTAL_CATALOG));$("#cDoneS").textContent=fmt(done);$("#cDoneP").textContent=fmt(doneP);$("#catalogHint").textContent=(provinces.length||34)+" tỉnh/thành · "+fmt(num(data.catalog?.totalSchools||TOTAL_CATALOG))+" trường kế hoạch · có thể tiếp tục từ offset đã lưu";
 $("#globalBar").style.width=Math.min(100,done*100/num(data.catalog?.totalSchools||TOTAL_CATALOG))+"%";
 $("#catalogGrid").innerHTML=provinces.map(x=>{const pr=progressFor(p,[x.code,x.name,x.total]);return '<div class="catalog-item"><div class="catalog-top"><div><b>'+esc(x.name)+'</b><div><span>Mã '+esc(x.code)+'</span></div></div><span>'+fmt(pr.total)+' trường</span></div><div class="mini-progress"><i style="width:'+pr.pct+'%"></i></div><div class="catalog-meta"><span>'+fmt(pr.offset)+' / '+fmt(pr.total)+'</span><span>'+pr.pct+'%</span></div></div>'}).join("");
}
async function syncCatalog(){
 if(state.syncing)return;
 if(!state.user)return toast("Phiên Admin không hợp lệ.","bad");
 state.syncing=true;
 const button=$("#catalogSync");
 button?.setAttribute("disabled","disabled");
 $("#quickSync")?.setAttribute("disabled","disabled");
 try{
  const data=state.catalog||await apiGet("catalog");
  state.catalog=data;
  const p=readProgress();
  let done=CATALOG.reduce((s,x)=>s+Math.min(x[2],num(p[x[0]])),0);
  for(const province of CATALOG){
   let offset=Math.min(province[2],num(p[province[0]]));
   while(offset<province[2]){
    const r=await apiAction("catalog-chunk",{provinceCode:province[0],offset,limit:CATALOG_CHUNK_SIZE});
    const serverTotal=num(r.provinceTotal);
    if(serverTotal>0&&serverTotal!==province[2]){
      throw Object.assign(
       new Error("Dữ liệu Catalog lệch kế hoạch tại "+province[1]+" · giao diện "+fmt(province[2])+" · backend "+fmt(serverTotal)+" trường."),
       {code:"catalog_plan_mismatch"}
      );
    }
    const next=num(r.nextOffset),processed=num(r.processed);
    if(next<=offset&&processed<=0){
      throw Object.assign(new Error("Catalog backend không trả thêm bản ghi cho "+province[1]+"."),{code:"catalog_stalled"});
    }
    done+=Math.max(0,Math.min(province[2],next)-offset);
    offset=next;
    p[province[0]]=offset;
    saveProgress(p);
    renderCatalog();
   }
  }
  toast("✓ Đã kiểm tra và hoàn tất đồng bộ "+fmt(done)+" trường.","good");
 }catch(e){
  toast(e,"bad");
  pageError(e,"Đồng bộ catalog dừng lại");
  if(button)button.textContent="▶ Tiếp tục đồng bộ";
 }finally{
  state.syncing=false;
  button?.removeAttribute("disabled");
  $("#quickSync")?.removeAttribute("disabled");
  if(button)button.textContent="🇻🇳 Đồng bộ toàn bộ";
  renderCatalog();
 }
}
async function teacherAction(action,uid){
 const ok=await dialog(action==="verify"?"Duyệt giáo viên":"Từ chối hồ sơ",action==="verify"?"Tài khoản sẽ chuyển sang role teacher và được gắn trường/lớp.":"Tài khoản sẽ chuyển sang teacher_rejected.","Xác nhận");if(!ok)return;
 try{await apiAction(action==="verify"?"verify-teacher":"reject-teacher",{uid});toast(action==="verify"?"✓ Đã duyệt giáo viên":"✓ Đã từ chối hồ sơ","good");state.data.teachers=null;state.data.overview=null;await loadPage("overview",true);state.page="overview";clearPageError();renderOverview(state.data.overview||{});each(qsa(".page"),x=>x.classList.toggle("active",x.id==="page-overview"));each(qsa(".nav button"),x=>x.classList.toggle("active",x.dataset.page==="overview"));$("#pageTitle").textContent="Tổng quan";window.scrollTo({top:0,behavior:"smooth"})}catch(e){toast(e,"bad");pageError(e,"Không thể cập nhật giáo viên")}}
async function inspectTeacher(uid){
 const t=(state.data.teachers?.rows||[]).find(x=>x.id===uid);if(!t)return;const v=t.teacherVerification||{};await dialog("Hồ sơ giáo viên","Tên: "+(t.displayName||t.name||"—")+"\nEmail: "+(t.email||"—")+"\nTrường: "+(t.schoolName||v.requestedSchoolName||"—")+"\nLớp: "+(v.requestedClassName||t.className||"—")+"\nKhu vực: "+([t.province,t.ward].filter(Boolean).join(" · ")||"—"),"Đóng","");}
async function renameUser(uid,currentName){
 const name=prompt("Tên hiển thị mới:",currentName);
 if(name===null)return;
 const clean=String(name).trim();
 if(!clean)return toast("Tên hiển thị không được để trống.","bad");
 try{await apiAction("rename-user",{uid,name:clean});toast("✓ Đã cập nhật tài khoản.","good");state.data.users=null;await loadPage("users",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể sửa tài khoản")}
}
async function setUserDisabled(uid,disabled){
 const ok=await dialog(disabled?"Khóa tài khoản?":"Mở khóa tài khoản?","Thao tác này sẽ áp dụng trực tiếp lên Firebase Authentication.","Xác nhận","Hủy");
 if(!ok)return;
 try{await apiAction(disabled?"disable-user":"enable-user",{uid});toast(disabled?"✓ Đã khóa tài khoản.":"✓ Đã mở khóa tài khoản.","good");state.data.users=null;await loadPage("users",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể cập nhật trạng thái tài khoản")}
}
async function resetUserStats(uid){
 const ok=await dialog("Reset chỉ số tài khoản?","Coins, energy, streak và các bộ đếm học tập sẽ được đưa về 0.","Reset","Hủy");
 if(!ok)return;
 try{await apiAction("reset-user-stats",{uid});toast("✓ Đã reset chỉ số.","good");state.data.users=null;await loadPage("users",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể reset tài khoản")}
}
async function deleteUserAccount(uid){
 const ok=await dialog("Xóa tài khoản vĩnh viễn?","Firebase Authentication và hồ sơ users sẽ bị xóa. Hành động này không thể hoàn tác.","Xóa vĩnh viễn","Hủy");
 if(!ok)return;
 try{await apiAction("delete-user",{uid});toast("✓ Đã xóa tài khoản.","good");state.data.users=null;state.data.overview=null;await loadPage("users",true);await loadPage("overview",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể xóa tài khoản")}
}
async function editClass(cl){
 if(!cl)return;
 const name=prompt("Tên lớp:",cl.name||"");
 if(name===null)return;
 const grade=prompt("Khối/lớp:",cl.grade||"");
 if(grade===null)return;
 const description=prompt("Mô tả:",cl.description||"");
 if(description===null)return;
 try{await apiAction("update-class",{classId:cl.id,name:name.trim(),grade:grade.trim(),description:description.trim()});toast("✓ Đã cập nhật lớp.","good");state.data.classes=null;await loadPage("classes",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể sửa lớp")}
}
async function deleteClassAdmin(classId){
 const ok=await dialog("Xóa lớp và dữ liệu liên quan?","Thành viên, lời mời và bài giao của lớp sẽ được dọn. Dữ liệu học tập trong hồ sơ học sinh không bị xóa.","Xóa lớp","Hủy");
 if(!ok)return;
 try{await apiAction("delete-class",{classId});toast("✓ Đã xóa lớp và dọn dữ liệu liên quan.","good");state.data.classes=null;state.data.overview=null;await loadPage("classes",true);await loadPage("overview",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể xóa lớp")}
}
async function editSchool(s){
 if(!s)return;
 const name=prompt("Tên trường:",s.name||"");
 if(name===null)return;
 const province=prompt("Tỉnh/thành:",s.province||"");
 if(province===null)return;
 const ward=prompt("Xã/phường:",s.ward||"");
 if(ward===null)return;
 const schoolLevel=prompt("Mức trường (primary/middle/high/combined):",s.schoolLevel||"");
 if(schoolLevel===null)return;
 try{await apiAction("update-school",{schoolId:s.id,name:name.trim(),province:province.trim(),ward:ward.trim(),schoolLevel:schoolLevel.trim()});toast("✓ Đã cập nhật trường.","good");state.data.schools=null;await loadPage("schools",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể sửa trường")}
}
async function deleteSchoolAdmin(schoolId){
 const ok=await dialog("Xóa trường?","Chỉ trường không thuộc National Catalog và không còn tài khoản/lớp liên kết mới được xóa.","Xóa trường","Hủy");
 if(!ok)return;
 try{await apiAction("delete-school",{schoolId});toast("✓ Đã xóa trường.","good");state.data.schools=null;state.data.overview=null;await loadPage("schools",true);await loadPage("overview",true)}
 catch(e){toast(e,"bad");pageError(e,"Không thể xóa trường")}
}

async function deletePack(id){
 const ok=await dialog("Xóa bộ từ?","Bộ từ sẽ bị xóa khỏi publicPacks và assignment liên quan sẽ được dọn bởi backend.","Xóa","Hủy");if(!ok)return;
 try{await apiAction("delete-pack",{packId:id});toast("✓ Đã xóa bộ từ","good");state.data.packs=null;await loadPage("packs",true)}catch(e){toast(e,"bad");pageError(e,"Không thể xóa bộ từ")}}
async function dialog(title,text,yes="Xác nhận",no="Hủy"){return new Promise(resolve=>{const b=$("#modalBackdrop");$("#modalTitle").textContent=title;$("#modalText").textContent=text;$("#modalOk").textContent=yes;$("#modalCancel").textContent=no;$("#modalCancel").classList.toggle("hidden",!no);b.classList.add("open");const finish=v=>{b.classList.remove("open");$("#modalOk").onclick=null;$("#modalCancel").onclick=null;b.onclick=null;resolve(v)};$("#modalOk").onclick=()=>finish(true);$("#modalCancel").onclick=()=>finish(false);b.onclick=e=>{if(e.target===b)finish(false)}})}
onAuthStateChanged(auth,async user=>{
  // This listener only restores an already-existing session.
  // It never competes with the explicit login button flow.
  if(authBooting){
    authBooting=false;
    await restoreAdminSession(user);
    return;
  }
  if(!user&&!authBusy){
    state.user=null;
    showLogin("");
  }
});

bind();
renderDirectorySyncSummary();
renderOverview({stats:{},pending:[]});
