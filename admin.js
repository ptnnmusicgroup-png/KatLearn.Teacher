import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{getAuth,onAuthStateChanged,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const CONFIG={apiKey:"AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8",authDomain:"elp---katlearn.firebaseapp.com",projectId:"elp---katlearn",storageBucket:"elp---katlearn.firebasestorage.app",messagingSenderId:"344478447672",appId:"1:344478447672:web:4ed109a40303d0b41b0ecd",measurementId:"G-KTW11GD97T"};
const ADMIN="katlearn.admin@gmail.com";
const TOTAL_CATALOG=22850;
const CATALOG_CHUNK_SIZE=250;
const CATALOG=[["01","Thành phố Hà Nội",2828],["04","Tỉnh Cao Bằng",150],["08","Tỉnh Tuyên Quang",300],["11","Tỉnh Điện Biên",182],["12","Tỉnh Lai Châu",137],["14","Tỉnh Sơn La",278],["15","Tỉnh Lào Cai",216],["19","Tỉnh Thái Nguyên",261],["20","Tỉnh Lạng Sơn",200],["22","Tỉnh Quảng Ninh",266],["24","Tỉnh Bắc Ninh",1039],["25","Tỉnh Phú Thọ",759],["31","Thành phố Hải Phòng",1041],["33","Tỉnh Hưng Yên",548],["37","Tỉnh Ninh Bình",1178],["38","Tỉnh Thanh Hóa",2002],["40","Tỉnh Nghệ An",372],["42","Tỉnh Hà Tĩnh",444],["44","Tỉnh Quảng Trị",290],["46","Thành phố Huế",383],["48","Thành phố Đà Nẵng",550],["51","Tỉnh Quảng Ngãi",127],["52","Tỉnh Gia Lai",261],["56","Tỉnh Khánh Hòa",296],["66","Tỉnh Đắk Lắk",616],["68","Tỉnh Lâm Đồng",1021],["75","Tỉnh Đồng Nai",691],["79","Thành phố Hồ Chí Minh",2382],["80","Tỉnh Tây Ninh",406],["82","Tỉnh Đồng Tháp",275],["86","Tỉnh Vĩnh Long",723],["91","Tỉnh An Giang",1322],["92","Thành phố Cần Thơ",713],["96","Tỉnh Cà Mau",593]];
const app=getApps().length?getApps()[0]:initializeApp(CONFIG),auth=getAuth(app);
const $=s=>document.querySelector(s),qsa=s=>Array.from(document.querySelectorAll(s)||[]),each=(value,fn)=>{if(value==null)return;if(typeof value.forEach==="function")value.forEach(fn)};
const titles={overview:"Tổng quan",teachers:"Giáo viên",users:"Tài khoản",classes:"Lớp học",packs:"Bộ từ công khai",schools:"Trường học",catalog:"Danh mục toàn quốc",activity:"Hoạt động Admin"};
const state={user:null,page:"overview",data:{},catalog:null,syncing:false};
const syncKey="katlearn.admin.catalog.v2";

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
async function apiGet(section){
 const t=await token();
 let response;
 try{response=await fetch("/api/admin-hub?section="+encodeURIComponent(section),{method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+t,Accept:"application/json"}})}
 catch(e){throw Object.assign(new Error("Không kết nối được Admin Hub."),{code:"admin_fetch_failed",cause:e})}
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
 $("#refresh").onclick=()=>loadPage(state.page,true).then(()=>toast("✓ Đã làm mới","good")).catch(e=>{pageError(e);toast(e,"bad")});
 each(["teacherSearch","userSearch","classSearch","packSearch","schoolSearch"],id=>$("#"+id)?.addEventListener("input",()=>render(state.page)));
 $("#teacherFilter")?.addEventListener("change",()=>render("teachers"));
 $("#userFilter")?.addEventListener("change",()=>render("users"));
 $("#catalogSync")?.addEventListener("click",syncCatalog);
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
 if(section==="packs")return renderPacks(rows,d.limited);
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
  return '<tr><td><strong>'+esc(u.displayName||u.name||"KatLearn User")+'</strong><small>'+esc(u.email||"")+(u.accountCode?" · "+esc(u.accountCode):"")+'</small></td><td><span class="badge '+roleClass(u.role)+'">'+esc(roleLabel(u.role))+'</span>'+ (locked?'<small class="bad-text">🔒 Đang khóa</small>':'') +'</td><td>'+esc([u.schoolName,u.className].filter(Boolean).join(" · ")||"—")+'<small>'+esc([u.province,u.ward].filter(Boolean).join(" · ")||"—")+'</small></td><td>🪙 '+fmt(u.coins)+' · ⚡ '+fmt(u.energy)+'<small>🔥 streak '+fmt(u.streak)+'</small></td><td>'+date(u.createdAt)+'</td><td><div class="row-actions">'+
   (protectedUser?'':'<button class="btn" data-rename-user="'+esc(u.id)+'">Sửa tên</button>'+
   '<button class="btn" data-reset-user="'+esc(u.id)+'">Reset</button>'+
   (locked?'<button class="btn good" data-enable-user="'+esc(u.id)+'">Mở khóa</button>':'<button class="btn" data-disable-user="'+esc(u.id)+'">Khóa</button>')+
   '<button class="btn bad" data-delete-user="'+esc(u.id)+'">Xóa</button>')+
   '</div></td></tr>'
 }).join("")||'<tr><td colspan="6"><div class="empty">Không tìm thấy tài khoản.</div></td></tr>';
 each(qsa("#userTable [data-rename-user]"),b=>b.onclick=()=>renameUser(b.dataset.renameUser,list.find(x=>x.id===b.dataset.renameUser)?.displayName||list.find(x=>x.id===b.dataset.renameUser)?.name||""));
 each(qsa("#userTable [data-reset-user]"),b=>b.onclick=()=>resetUserStats(b.dataset.resetUser));
 each(qsa("#userTable [data-disable-user]"),b=>b.onclick=()=>setUserDisabled(b.dataset.disableUser,true));
 each(qsa("#userTable [data-enable-user]"),b=>b.onclick=()=>setUserDisabled(b.dataset.enableUser,false));
 each(qsa("#userTable [data-delete-user]"),b=>b.onclick=()=>deleteUserAccount(b.dataset.deleteUser));
 $("#userLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"";
}
function renderClasses(rows,limited){
 const q=$("#classSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","grade","teacherEmail","teacherUid","schoolName","joinCode","province","ward"]));
 $("#classTable").innerHTML=list.map(cl=>'<tr><td><strong>'+esc(cl.name||"—")+'</strong><small>Khối '+esc(cl.grade||"—")+' · <span class="mono">'+esc(cl.id)+'</span></small></td><td>'+esc(cl.teacherEmail||cl.teacherUid||"—")+'</td><td>'+esc(cl.schoolName||"—")+'<small>'+esc([cl.province,cl.ward].filter(Boolean).join(" · "))+'</small></td><td><span class="badge teacher">'+esc(cl.joinCode||"—")+'</span></td><td>'+fmt(cl.studentCount)+'</td><td>'+date(cl.updatedAt||cl.createdAt)+'</td><td><div class="row-actions"><button class="btn" data-edit-class="'+esc(cl.id)+'">Sửa</button><button class="btn bad" data-delete-class="'+esc(cl.id)+'">Xóa</button></div></td></tr>').join("")||'<tr><td colspan="7"><div class="empty">Không có lớp học.</div></td></tr>';
 each(qsa("#classTable [data-edit-class]"),b=>b.onclick=()=>editClass(list.find(x=>x.id===b.dataset.editClass)));
 each(qsa("#classTable [data-delete-class]"),b=>b.onclick=()=>deleteClassAdmin(b.dataset.deleteClass));
 $("#classLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"";
}
function renderPacks(rows,limited){
 const q=$("#packSearch").value.trim().toLowerCase(),list=rows.filter(x=>match(x,q,["name","createdBy","createdByEmail","createdByUid"]));
 $("#packTable").innerHTML=list.map(p=>'<tr><td><strong>'+esc(p.name||"Bộ từ chưa đặt tên")+'</strong><small>ID <span class="mono">'+esc(p.id)+'</span></small></td><td>'+fmt(p.wordCount)+'</td><td>'+esc(p.createdByEmail||p.createdBy||p.createdByUid||"—")+'</td><td>'+date(p.createdAt)+'</td><td><button class="btn bad" data-delete-pack="'+esc(p.id)+'">Xóa</button></td></tr>').join("")||'<tr><td colspan="5"><div class="empty">Không có bộ từ công khai.</div></td></tr>';
 each(qsa("#packTable [data-delete-pack]"),b=>b.onclick=()=>deletePack(b.dataset.deletePack));$("#packLimit").textContent=limited?"Đang hiển thị tối đa dữ liệu an toàn từ Admin Hub.":"";
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
  toast("✓ Đã hoàn tất đồng bộ "+fmt(done)+" trường.","good");
 }catch(e){
  toast(e,"bad");
  pageError(e,"Đồng bộ catalog dừng lại");
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
$("#loginForm").onsubmit=async e=>{e.preventDefault();const b=$("#loginBtn"),m=$("#loginError");b.disabled=true;m.textContent="Đang xác thực…";try{const c=await signInWithEmailAndPassword(auth,ADMIN,$("#password").value);if(String(c.user.email||"").toLowerCase()!==ADMIN){await signOut(auth);throw new Error("Tài khoản không có quyền Admin.")}$("#password").value=""}catch(x){m.textContent=x?.code==="auth/invalid-credential"?"Email hoặc mật khẩu không đúng.":errText(x);b.disabled=false}};
onAuthStateChanged(auth,async u=>{state.user=u||null;if(!u){$("#loginGate").classList.remove("hidden");$("#app").classList.add("hidden");health("#healthAuth",false,"Chưa đăng nhập");setConnection(false,"Chưa kết nối");return}if(String(u.email||"").toLowerCase()!==ADMIN){$("#loginError").textContent="Tài khoản này không có quyền Admin.";await signOut(auth);return}$("#loginGate").classList.add("hidden");$("#app").classList.remove("hidden");health("#healthAuth",true,"Đã xác thực");try{await loadPage("overview",true)}catch(e){health("#healthAdmin",false,"Không phản hồi");health("#healthFs",false,"Không kiểm tra được");setConnection(false,"Lỗi Admin Hub");pageError(e,"Không tải được Admin Hub");toast(e,"bad")}});
bind();
renderOverview({stats:{},pending:[]});
