const ADMIN_EMAILS=['katlearn.admin@gmail.com'];
const FIREBASE_CONFIG={apiKey:'AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8',authDomain:'elp---katlearn.firebaseapp.com',projectId:'elp---katlearn',storageBucket:'elp---katlearn.firebasestorage.app',messagingSenderId:'344478447672',appId:'1:344478447672:web:4ed109a40303d0b41b0ecd',measurementId:'G-KTW11GD97T'};
const LMS_HOME='https://lms-katlearn.vercel.app';
const TEACHER_HOME='https://teacher-katlearn.vercel.app';
const SSO_EXCHANGE=TEACHER_HOME+'/api/auth-exchange';
let db,auth,user,fb={},classes=[],selectedClass=null,teacherAccess=false,accountRole='';
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isTeacher=()=>teacherAccess;
const isAdminUser=()=>ADMIN_EMAILS.includes((user?.email||'').toLowerCase());
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function makeJoinCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}
async function copyText(value){const text=String(value??'');if(!text)return;try{await navigator.clipboard.writeText(text);toast('✓ Đã sao chép mã lớp')}catch(_){const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();try{document.execCommand('copy');toast('✓ Đã sao chép mã lớp')}catch(e){toast('Không thể sao chép mã lớp.')}finally{area.remove()}}}
function showPage(id){$$('.page').forEach(x=>x.classList.remove('active-page'));$('#'+id)?.classList.add('active-page');$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===id));if(id==='dashboard')loadDashboard();if(id==='classes')loadClasses();if(id==='students')loadStudents();if(id==='packs')loadPacks();if(id==='progress')loadProgress();window.scrollTo({top:0,behavior:'smooth'})}
$$('.nav-item').forEach(b=>b.onclick=()=>showPage(b.dataset.page));$('.menu-toggle').onclick=()=>$('.sidebar').classList.toggle('open');
function openModal(id){$('#'+id).classList.add('show')}function closeModal(id){$('#'+id).classList.remove('show')}$$('.modal-close').forEach(b=>b.onclick=()=>closeModal(b.dataset.modal));
if(!$('#classAnalytics'))$('#dashboard')?.insertAdjacentHTML('beforeend','<section class="teacher-card-panel class-analytics"><h3>Thống kê theo lớp / nhóm</h3><p>Hiệu quả trung bình và top 3 của từng lớp được tính từ kết quả học tập thực tế.</p><div id="classAnalytics" class="class-analytics-list"><div class="empty">Đang tải...</div></div></section>');

function clearSsoHash(){if(location.hash.includes('katlearn_id_token'))history.replaceState(null,document.title,location.pathname+location.search)}
function showBlocked(message='Bạn hiện là học sinh, chúng tôi xin phép khóa cổng để bạn không chạy lung tung'){
  document.body.classList.add('locked');
  const box=document.createElement('div');box.id='katlearnRoleLock';box.innerHTML=`<div class="kat-role-lock-card"><div class="kat-role-lock-icon">🚫</div><div class="kat-role-lock-error">ERROR!</div><h1>${esc(message)}</h1><p>Cổng giáo viên chỉ dành cho tài khoản giáo viên.</p><button id="katBackStudent">Quay về trang học sinh của bạn</button></div>`;
  const style=document.createElement('style');style.textContent='#katlearnRoleLock{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:linear-gradient(135deg,#fff7f8,#f7f5ff);padding:24px}.kat-role-lock-card{width:min(560px,100%);padding:42px 34px;text-align:center;background:#fff;border:1px solid #eee6f0;border-radius:28px;box-shadow:0 24px 80px #3c31501c}.kat-role-lock-icon{font-size:54px;margin-bottom:10px}.kat-role-lock-error{font:800 14px "Be Vietnam Pro",system-ui;color:#d94c68;letter-spacing:.12em}.kat-role-lock-card h1{margin:12px auto 8px;max-width:480px;font:700 24px/1.35 Fredoka,"Be Vietnam Pro",system-ui;color:#3e3549}.kat-role-lock-card p{color:#8b8295;font:500 13px/1.6 "Be Vietnam Pro",system-ui}.kat-role-lock-card button{margin-top:18px;border:0;border-radius:13px;padding:13px 20px;background:#f47c93;color:#fff;font:700 13px "Be Vietnam Pro",system-ui;cursor:pointer}.kat-role-lock-card button:hover{filter:brightness(.97);transform:translateY(-1px)}';document.head.appendChild(style);document.body.appendChild(box);$('#katBackStudent').onclick=()=>location.replace(LMS_HOME);}
async function exchangeSsoToken(idToken){
  const response=await fetch(SSO_EXCHANGE,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({idToken})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){const err=new Error(data.error||'Không thể đồng bộ tài khoản');err.role=data.role;throw err}
  return data;
}
async function consumeIncomingSso(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,'')||'');
  const token=hash.get('katlearn_id_token');
  if(!token)return false;
  clearSsoHash();
  try{
    const data=await exchangeSsoToken(token);
    if(data.role!=='teacher')throw Object.assign(new Error('STUDENT_ACCOUNT'),{role:'student'});
    sessionStorage.setItem('katlearn-teacher-access','1');
    const {signInWithCustomToken}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    await signInWithCustomToken(auth,data.customToken);
    return true;
  }catch(e){
    if(e.role==='student'||e.message==='STUDENT_ACCOUNT'){showBlocked();return true}
    console.error('[KatLearn SSO]',e);
    return false;
  }
}
let ssoAttempted=sessionStorage.getItem('katlearn-sso-teacher-attempt')==='1';
async function startCrossAppCheck(){
  if(ssoAttempted||new URLSearchParams(location.search).has('sso'))return;
  ssoAttempted=true;sessionStorage.setItem('katlearn-sso-teacher-attempt','1');
  location.replace(LMS_HOME+'/sso-bridge.html?return=teacher');
}
async function initFirebase(){
  const [{initializeApp,getApps},{getFirestore,collection,doc,getDoc,getDocs,addDoc,setDoc,updateDoc,deleteDoc,query,orderBy,where,limit}]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')
  ]);
  const {getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,signOut}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
  const app=getApps().length?getApps()[0]:initializeApp(FIREBASE_CONFIG);
  db=getFirestore(app);auth=getAuth(app);
  fb={collection,doc,getDoc,getDocs,addDoc,setDoc,updateDoc,deleteDoc,query,orderBy,where,limit,GoogleAuthProvider,signInWithPopup,signOut};
  let resolveReady;
  authStateReady=new Promise(resolve=>{resolveReady=resolve});
  let firstAuthEvent=true;
  onAuthStateChanged(auth,async u=>{
    user=u;teacherAccess=false;accountRole='';
    const authUid=u?.uid||null;
    if(u){
      if(ADMIN_EMAILS.includes((u.email||'').toLowerCase())){teacherAccess=true;accountRole='teacher';}
      else{
        const tokenResult=await u.getIdTokenResult().catch(()=>null);
        if((user?.uid||null)!==authUid)return;
        teacherAccess=tokenResult?.claims?.teacherAccess===true;
        if(teacherAccess)accountRole='teacher';
        if(!teacherAccess){
          const profile=await fb.getDoc(fb.doc(db,'users',u.uid)).catch(()=>null);
          if((user?.uid||null)!==authUid)return;
          const role=String(profile?.exists()?profile.data()?.role:'').toLowerCase();
          accountRole=role;
          teacherAccess=role==='teacher';
        }
      }
      if((user?.uid||null)!==authUid)return;
      if(teacherAccess)sessionStorage.setItem('katlearn-teacher-access','1');
      else sessionStorage.removeItem('katlearn-teacher-access');
    }else sessionStorage.removeItem('katlearn-teacher-access');
    if((user?.uid||null)!==authUid)return;
    renderAuth();
    window.dispatchEvent(new CustomEvent('katlearn-teacher-auth-change',{detail:{user:u,teacherAccess,role:accountRole}}));
    if(firstAuthEvent){firstAuthEvent=false;resolveReady(u)}
    if(u&&isTeacher()){
      document.body.classList.remove('locked');
      void loadDashboard().catch(error=>console.warn('[KatLearn] Dashboard load failed:',error));
    }else{
      document.body.classList.add('locked');
      showPage('dashboard');
    }
  });
}
function renderAuth(){const name=user?.displayName||user?.email?.split('@')[0]||'Giáo viên';$('#accountName').textContent=user?name:'Chưa đăng nhập';$('#accountEmail').textContent=user?.email||'';$('#loginBtn').hidden=!!user;$('#logoutBtn').hidden=!user;$('.auth-message').textContent=user&&!isTeacher()?'Tài khoản này chưa được cấp quyền giáo viên. Hãy đăng ký/đăng nhập bằng tài khoản có vai trò giáo viên.':user?'Đã đăng nhập và có quyền quản lý.':'Đăng nhập bằng tài khoản giáo viên để tiếp tục.'}
$('#loginBtn').onclick=()=>location.replace('login.html');$('#logoutBtn').onclick=async()=>{await fb.signOut(auth)};
async function loadDashboard(){const uid=String(user?.uid||'');if(!uid||!isTeacher())return;const classQuery=isAdminUser()?fb.collection(db,'classes'):fb.query(fb.collection(db,'classes'),fb.where('teacherUid','==',uid));const [cs,ps]=await Promise.all([fb.getDocs(classQuery),fb.getDocs(fb.collection(db,'publicPacks'))]);if(String(user?.uid||'')!==uid||!isTeacher())return;const nextClasses=cs.docs.map(d=>({id:d.id,...d.data()}));const stats=await Promise.all(nextClasses.map(classStats));if(String(user?.uid||'')!==uid||!isTeacher())return;classes=nextClasses;const students=stats.flatMap(s=>s.rows);$('#metricClasses').textContent=classes.length;$('#metricStudents').textContent=students.length;$('#metricPacks').textContent=ps.size;$('#metricActive').textContent=students.filter(s=>Number(s.energy||0)>0).length;$('#recentClasses').innerHTML=stats.slice(0,5).map(s=>`<div class="class-item"><strong>${esc(s.cls.name)}</strong><small>${esc(s.cls.grade||'')} · ${s.rows.length} học sinh · ${s.average}% hiệu quả</small></div>`).join('')||'<div class="empty">Chưa có lớp nào. Tạo lớp đầu tiên nhé.</div>';const analytics=$('#classAnalytics');if(analytics)analytics.innerHTML=stats.length?stats.map(s=>`<article class="class-stat"><div><strong>${esc(s.cls.name)}</strong><small>Sĩ số ${s.rows.length} · Hiệu quả TB ${s.average}%</small></div><ol>${s.rows.slice(0,3).map((x,i)=>`<li><b>${['🥇','🥈','🥉'][i]} ${esc(x.displayName||x.email||'Học sinh')}</b><span>${Number(x.correctAnswers||0)} đúng · ${accuracy(x)}%</span></li>`).join('')||'<li>Chưa có học sinh</li>'}</ol></article>`).join(''):'<div class="empty">Tạo lớp để xem thống kê.</div>'}
async function loadClasses(){const uid=String(user?.uid||'');if(!uid||!isTeacher())return;let snap;if(isAdminUser())snap=await fb.getDocs(fb.query(fb.collection(db,'classes'),fb.orderBy('createdAt','desc'))).catch(()=>fb.getDocs(fb.collection(db,'classes')));else snap=await fb.getDocs(fb.query(fb.collection(db,'classes'),fb.where('teacherUid','==',uid),fb.orderBy('createdAt','desc'))).catch(async()=>fb.getDocs(fb.query(fb.collection(db,'classes'),fb.where('teacherUid','==',uid))));if(String(user?.uid||'')!==uid||!isTeacher())return;const nextClasses=snap.docs.map(d=>({id:d.id,...d.data()}));classes=nextClasses;$('#classTable').innerHTML=classes.map(c=>`<tr><td><strong>${esc(c.name)}</strong><br><small>${esc(c.description||'')}</small></td><td>${esc(c.grade||'—')}</td><td>${Number(c.studentCount||0)}</td><td><span class="status-pill">Đang hoạt động</span></td><td><div class="actions"><button class="teacher-btn secondary" data-select-class="${c.id}">Mở</button><button class="teacher-btn danger" data-delete-class="${c.id}">Xóa</button></div></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Chưa có lớp.</div></td></tr>';$$('[data-select-class]').forEach(b=>b.onclick=()=>{selectedClass=classes.find(c=>c.id===b.dataset.selectClass);$('#selectedClassName').textContent=selectedClass?.name||'Chưa chọn lớp';showPage('students')});$$('[data-delete-class]').forEach(b=>b.onclick=()=>deleteClass(b.dataset.deleteClass));const search=$('#classSearch');if(search)search.oninput=()=>{const q=search.value.trim().toLowerCase();$$('#classTable tr').forEach(row=>row.style.display=!q||row.textContent.toLowerCase().includes(q)?'':'none')}}
$('#classForm').onsubmit=async e=>{e.preventDefault();if(!isTeacher())return;const data={name:$('#className').value.trim(),grade:$('#classGrade').value.trim(),description:$('#classDescription').value.trim(),teacherUid:user.uid,teacherEmail:user.email,studentCount:0,joinCode:makeJoinCode(),createdAt:Date.now(),updatedAt:Date.now()};if(!data.name)return;try{const classRef=await fb.addDoc(fb.collection(db,'classes'),data);await fb.setDoc(fb.doc(db,'classInvites',data.joinCode),{classId:classRef.id,className:data.name,teacherUid:user.uid,active:true,createdAt:Date.now(),updatedAt:Date.now()});closeModal('classModal');e.target.reset();toast('✓ Đã tạo lớp mới');loadClasses();loadDashboard()}catch(err){toast('Không thể tạo lớp: '+err.message)}};
async function deleteClass(id){if(!confirm('Xóa lớp này? Dữ liệu thành viên, lời mời và bài giao của lớp cũng sẽ được dọn.'))return;try{await teacherAction('delete-class',{classId:id});if(selectedClass?.id===id)selectedClass=null;toast('Đã xóa lớp');await loadClasses();await loadDashboard()}catch(e){toast('Không thể xóa lớp: '+e.message)}}
async function getMembers(cls){const snap=await fb.getDocs(fb.collection(db,'classes',cls.id,'members'));return snap.docs.map(d=>({id:d.id,...d.data(),uid:String(d.data()?.uid||d.id)}))}
function accuracy(s){const total=Number(s.questionsAnswered||0),correct=Number(s.correctAnswers||0);return total?Math.round(correct*100/total):0}
function rankStudents(rows){return rows.sort((a,b)=>Number(b.correctAnswers||0)-Number(a.correctAnswers||0)||accuracy(b)-accuracy(a)||Number(b.energy||0)-Number(a.energy||0))}
async function classStats(cls){const members=await getMembers(cls);const rows=await Promise.all(members.map(async m=>{try{const s=await fb.getDoc(fb.doc(db,'users',m.uid));return s.exists()?{id:s.id,...s.data(),member:m}:{...m}}catch{return m}}));rankStudents(rows);return{cls,rows,average:rows.length?Math.round(rows.reduce((sum,s)=>sum+accuracy(s),0)/rows.length):0}}
async function teacherAction(action,payload){const token=await user?.getIdToken();if(!token)throw new Error('Bạn cần đăng nhập lại.');const response=await fetch('/api/teacher-manage',{method:'POST',headers:{'content-type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action,...payload})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Không thể thực hiện thao tác.');return data}
async function loadStudents(){const uid=String(user?.uid||'');if(!uid||!isTeacher())return;const myClasses=classes.slice();$('#classSelector').innerHTML=myClasses.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(!selectedClass&&myClasses[0])selectedClass=myClasses[0];if(String(user?.uid||'')!==uid||!isTeacher())return;if(selectedClass){$('#classSelector').value=selectedClass.id;await renderStudents(selectedClass)}else $('#studentList').innerHTML='<div class="empty">Hãy tạo lớp trước.</div>'}
$('#classSelector').onchange=()=>{selectedClass=classes.find(c=>c.id===$('#classSelector').value);renderStudents(selectedClass)};const copyClassCodeBtn=$('#copyClassCodeBtn');if(copyClassCodeBtn)copyClassCodeBtn.onclick=()=>{if(!selectedClass)return toast('Chọn lớp trước.');copyText(selectedClass.joinCode||'Chưa có mã lớp')};const studentSearch=$('#studentSearch');if(studentSearch)studentSearch.oninput=()=>{const q=studentSearch.value.trim().toLowerCase();$('#studentList .student-row').forEach(row=>{row.style.display=!q||row.textContent.toLowerCase().includes(q)?'':'none'})};
async function renderStudents(cls){const uid=String(user?.uid||'');if(!uid||!isTeacher()||!cls)return;$('#selectedClassName').textContent=cls.name;const stat=await classStats(cls);if(String(user?.uid||'')!==uid||!isTeacher()||selectedClass?.id!==cls.id)return;const rows=stat.rows;if(!rows.length){$('#studentList').innerHTML='<div class="empty">Lớp chưa có học sinh. Bấm “Thêm học sinh”.</div>';return}$('#studentList').innerHTML=rows.map(s=>`<div class="student-row"><span class="student-avatar">${esc((s.displayName||s.email||'K')[0]).toUpperCase()}</span><div><strong>${esc(s.displayName||'KatLearn Student')}</strong><small>${esc(s.email||s.member?.email||'')} · ${accuracy(s)}% chính xác</small></div><div class="student-score"><b>⚡ ${Number(s.energy||0).toLocaleString()}</b><small>${Number(s.correctAnswers||0)} câu đúng · 🪙 ${Number(s.coins||0).toLocaleString()}</small></div><button class="teacher-btn secondary" data-manage-student="${s.uid||s.member?.uid}">Sửa</button><button class="teacher-btn danger" data-remove-student="${s.uid||s.member?.uid}">×</button></div>`).join('');$$('[data-remove-student]').forEach(b=>b.onclick=()=>removeStudent(cls,b.dataset.removeStudent));$$('[data-manage-student]').forEach(b=>b.onclick=()=>manageStudent(cls,rows.find(s=>(s.uid||s.member?.uid)===b.dataset.manageStudent)))}
$('#studentForm').onsubmit=async e=>{e.preventDefault();if(!selectedClass)return toast('Chọn lớp trước.');const email=$('#studentEmail').value.trim().toLowerCase();if(!email)return;try{await teacherAction('invite',{classId:selectedClass.id,email});closeModal('studentModal');e.target.reset();toast('✓ Đã thêm học sinh vào lớp');renderStudents(selectedClass);loadDashboard()}catch(err){toast('Không thể thêm học sinh: '+err.message)}};
async function manageStudent(cls,student){if(!student)return;const displayName=prompt('Tên hiển thị của học sinh:',student.displayName||'') ;if(displayName===null)return;const password=prompt('Mật khẩu mới (để trống nếu không đổi):','');if(password===null)return;try{await teacherAction('update-student',{classId:cls.id,studentUid:student.uid||student.member?.uid,displayName:displayName.trim(),password:password.trim()});toast('✓ Đã cập nhật tài khoản học sinh');renderStudents(cls);loadDashboard()}catch(e){toast('Không thể cập nhật: '+e.message)}}
async function removeStudent(cls,uid){if(!confirm('Xóa học sinh khỏi lớp?'))return;try{await teacherAction('remove',{classId:cls.id,studentUid:uid});toast('Đã xóa học sinh khỏi lớp');renderStudents(cls);loadDashboard()}catch(e){toast('Không thể xóa học sinh: '+e.message)}}
async function loadPacks(){const uid=String(user?.uid||'');if(!uid||!isTeacher())return;const snap=await fb.getDocs(fb.collection(db,'publicPacks'));if(String(user?.uid||'')!==uid||!isTeacher())return;const packs=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||b.createdAt||0)-(a.createdAt?.seconds||a.createdAt||0));$('#packTable').innerHTML=packs.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${Array.isArray(p.words)?p.words.length:0}</td><td>${esc(p.createdBy||'')}</td><td><button type="button" class="pack-more-btn" data-pack-menu="${p.id}" aria-label="Tùy chọn">⋮</button></td></tr>`).join('')||'<tr><td colspan="4"><div class="empty">Chưa có bộ từ công khai.</div></td></tr>';$$('[data-pack-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();openPackMenu(b,packs.find(p=>p.id===b.dataset.packMenu))})}
function closePackMenu(){document.querySelector('.pack-action-menu')?.remove()}
function openPackMenu(anchor,p){
  closePackMenu();if(!p)return;
  const menu=document.createElement('div');menu.className='pack-action-menu';
  menu.innerHTML=`<button data-pack-action="assign">📨 Giao bài cho học sinh</button><button data-pack-action="achievement">📊 Xem thành tích của bộ từ này</button><button data-pack-action="rename">✏️ Đổi tên bộ từ</button><button class="danger" data-pack-action="delete">🗑️ Xóa</button>`;
  document.body.appendChild(menu);const r=anchor.getBoundingClientRect();
  menu.style.position='fixed';menu.style.top=Math.min(window.innerHeight-menu.offsetHeight-8,r.bottom+6)+'px';menu.style.left=Math.min(window.innerWidth-menu.offsetWidth-8,Math.max(8,r.right-menu.offsetWidth))+'px';
  menu.onclick=async e=>{const action=e.target.closest('[data-pack-action]')?.dataset.packAction;if(!action)return;closePackMenu();if(action==='assign')return assignPack(p);if(action==='achievement')return showPackAchievements(p);if(action==='rename')return renamePack(p);if(action==='delete')return deletePack(p.id)};
}
document.addEventListener('click',e=>{if(!e.target.closest('.pack-action-menu')&&!e.target.closest('[data-pack-menu]'))closePackMenu()});
async function renamePack(p){const name=prompt('Tên mới cho bộ từ:',p.name||'');if(name===null)return;const cleanName=name.trim();if(!cleanName)return toast('Tên bộ từ không được để trống.');if(cleanName===p.name)return;try{await fb.updateDoc(fb.doc(db,'publicPacks',p.id),{name:cleanName,updatedAt:Date.now()});toast('✓ Đã đổi tên bộ từ');loadPacks();loadDashboard()}catch(e){toast('Không thể đổi tên: '+e.message)}}
async function packActionRequest(action,payload){const token=await user?.getIdToken();if(!token)throw new Error('Bạn cần đăng nhập lại.');const res=await fetch('/api/teacher-manage',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({action,...payload})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||'Không thể thực hiện thao tác.');return data}
async function assignPack(p){if(!classes.length)await loadClasses();if(!classes.length)return toast('Bạn chưa có lớp nào để giao bài.');const choices=classes.map((c,i)=>(i+1)+'. '+c.name).join('\n');const answer=prompt('Giao “'+p.name+'” cho lớp nào?\n\n'+choices+'\n\nNhập số lớp:');if(answer===null)return;const cls=classes[Number(answer)-1];if(!cls)return toast('Số lớp không hợp lệ.');try{const data=await packActionRequest('assign-pack',{classId:cls.id,packId:p.id});toast('✓ Đã giao bài cho lớp '+cls.name+' ('+Number(data.studentCount||0)+' học sinh)')}catch(e){toast('Không thể giao bài: '+e.message)}}
async function showPackAchievements(p){if(!classes.length)await loadClasses();if(!classes.length)return toast('Bạn chưa có lớp nào để xem thành tích.');const choices=classes.map((c,i)=>(i+1)+'. '+c.name).join('\n');const answer=prompt('Xem thành tích “'+p.name+'” của lớp nào?\n\n'+choices+'\n\nNhập số lớp:');if(answer===null)return;const cls=classes[Number(answer)-1];if(!cls)return toast('Số lớp không hợp lệ.');try{const data=await packActionRequest('pack-achievements',{classId:cls.id,packId:p.id});const rows=Array.isArray(data.rows)?data.rows:[];$('#packDetail').innerHTML=`<h3>${esc(p.name)}</h3><p>${rows.length} học sinh · Lớp ${esc(cls.name)}</p><div class="word-table-card"><div class="word-table-head"><span>Học sinh</span><span>Câu trả lời</span><span>Đúng</span><span>Độ chính xác</span></div>${rows.map(s=>`<div class="word-table-row"><span><b>${esc(s.displayName||'Học sinh')}</b><small>${esc(s.email||'')}</small></span><span>${s.attempts}</span><span>${s.correct}</span><span>${s.accuracy}%</span></div>`).join('')||'<div class="empty">Chưa có dữ liệu học bộ từ này.</div>'}</div>`;openModal('packModal')}catch(e){toast('Không thể xem thành tích: '+e.message)}}

function viewPack(p){if(!p)return;$('#packDetail').innerHTML=`<h3>${esc(p.name)}</h3><p>${Array.isArray(p.words)?p.words.length:0} từ vựng</p><div class="word-table-card"><div class="word-table-head"><span>Từ</span><span>Nghĩa</span><span>Phiên âm</span><span></span></div>${(p.words||[]).map(w=>`<div class="word-table-row"><span><b>${esc(w.word)}</b></span><span>${esc(w.mean)}</span><span>${esc(w.pron||'—')}</span><span>📚</span></div>`).join('')}</div>`;openModal('packModal')}
async function deletePack(id){if(!confirm('Xóa bộ từ công khai này? Các bài đã giao liên quan cũng sẽ bị hủy.'))return;try{await packActionRequest('delete-pack',{packId:id});toast('Đã xóa pack và các bài giao liên quan');await loadPacks();await loadDashboard()}catch(e){toast('Không thể xóa pack: '+e.message)}}
async function loadPackChoices(){const select=$('#packSelect');if(!select||!db||!user)return;try{const snap=await fb.getDocs(fb.collection(db,'publicPacks'));const email=(user.email||'').toLowerCase();const packs=snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>String(p.createdByUid||p.ownerUid||p.teacherUid||'')===String(user.uid)||String(p.createdBy||p.createdByEmail||p.ownerEmail||p.teacherEmail||'').toLowerCase()===email).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));select.innerHTML='<option value="">Chọn bộ từ của bạn...</option>'+packs.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name||'Bộ từ chưa đặt tên')+'</option>').join('');if(!packs.length)select.innerHTML='<option value="">Bạn chưa có bộ từ nào</option>';}catch(e){console.warn('Không tải được bộ từ của người dùng:',e);select.innerHTML='<option value="">Không tải được bộ từ</option>'}}
async function generateTeacherQuickPack(){
  const prompt=$('#quickPackPrompt')?.value.trim();
  const btn=$('#quickPackAiBtn');
  const status=$('#quickPackStatus');
  if(!prompt)return toast('Nhập topic từ vựng trước nhé! ✨');
  if(!user||!isTeacher())return toast('Hãy đăng nhập bằng tài khoản giáo viên.');
  btn.disabled=true;btn.textContent='🤖 Đang tìm từ...';
  if(status)status.textContent='Gemini đang cố gắng tìm thật đầy đủ từ vựng liên quan đến topic...';
  try{
    const token=await user.getIdToken();
    const res=await fetch('/api/ai-pack',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({
      prompt:'Hãy xây dựng một bộ từ vựng thật đầy đủ và có hệ thống về topic sau: '+prompt+'. Cố gắng bao quát các từ vựng quan trọng, phổ biến và các khía cạnh liên quan của topic, không lặp từ, ưu tiên từ phù hợp học sinh Việt Nam. Trả về càng nhiều từ hữu ích càng tốt trong giới hạn cho phép.',
      wordCount:100,difficulty:'intermediate',purpose:'comprehensive topic vocabulary',wordTypes:'mixed'
    })});
    const data=await res.json();
    if(!res.ok)throw new Error(data.error||'Kat AI chưa sẵn sàng.');
    const words=Array.isArray(data.words)?data.words:[];
    if(!words.length)throw new Error('Gemini không tìm thấy từ vựng phù hợp.');
    const rows=$('#packWordRows');rows.innerHTML='';
    words.forEach(w=>{const row=document.createElement('div');row.className='pack-word-row';row.innerHTML='<span class="row-number"></span><input class="pack-word" placeholder="TỪ VỰNG" required><input class="pack-pron" placeholder="PHIÊN ÂM"><input class="pack-mean" placeholder="NGHĨA*" required><select class="pack-type"><option value="">LOẠI TỪ</option><option>noun</option><option>verb</option><option>adjective</option><option>adverb</option><option>phrase</option><option>other</option></select><input class="pack-example" placeholder="VÍ DỤ"><input class="pack-note" placeholder="GHI CHÚ"><button type="button" class="remove-pack-row" title="Xóa dòng">×</button>';rows.appendChild(row);row.querySelector('.pack-word').value=w.word||'';row.querySelector('.pack-pron').value=w.ipa||'';row.querySelector('.pack-mean').value=w.meaning_vi||'';row.querySelector('.pack-type').value=w.part_of_speech||'';row.querySelector('.pack-example').value=w.example||'';row.querySelector('.pack-note').value=w.notes||''});
    refreshPackRowNumbers();
    if(status)status.textContent='✓ Đã thêm '+words.length+' từ vựng theo topic. Kiểm tra lại rồi bấm “Lưu”.';
    toast('✨ Gemini đã tạo '+words.length+' từ vựng!');
  }catch(e){
    if(status)status.textContent='Chưa tạo được bộ từ bằng AI.';
    toast('Không tạo được từ vựng bằng AI: '+(e.message||'Lỗi không xác định'));
  }finally{btn.disabled=false;btn.textContent='✨ Thêm từ vựng của bạn'}
}
$('#quickPackAiBtn')?.addEventListener('click',generateTeacherQuickPack);

function refreshPackRowNumbers(){const rows=[...document.querySelectorAll('.pack-word-row')];rows.forEach((r,i)=>{const n=r.querySelector('.row-number');if(n)n.textContent='# '+(i+1)});const c=$('#packWordCount');if(c)c.textContent=rows.filter(r=>(r.querySelector('.pack-word')?.value||'').trim()&&(r.querySelector('.pack-mean')?.value||'').trim()).length}
function addPackRow(){const wrap=$('#packWordRows');if(!wrap)return;const row=document.createElement('div');row.className='pack-word-row';row.innerHTML='<span class="row-number"></span><input class="pack-word" placeholder="TỪ VỰNG" required><input class="pack-pron" placeholder="PHIÊN ÂM"><input class="pack-mean" placeholder="NGHĨA*" required><select class="pack-type"><option value="">LOẠI TỪ</option><option>noun</option><option>verb</option><option>adjective</option><option>adverb</option><option>phrase</option><option>other</option></select><input class="pack-example" placeholder="VÍ DỤ"><input class="pack-note" placeholder="GHI CHÚ"><button type="button" class="remove-pack-row" title="Xóa dòng">×</button>';wrap.appendChild(row);refreshPackRowNumbers();row.querySelector('.pack-word')?.focus()}
document.addEventListener('click',e=>{if(e.target.closest('#addPackRow'))addPackRow();if(e.target.closest('#quickAddBtn')){$('#quickPackPanel')?.removeAttribute('hidden');$('#quickPackPrompt')?.focus();}if(e.target.closest('.remove-pack-row')){const rows=document.querySelectorAll('.pack-word-row');if(rows.length>1)e.target.closest('.pack-word-row').remove();refreshPackRowNumbers()}if(e.target.closest('#cancelPackBtn'))closeModal('packCreateModal');if(e.target.closest('#newPackBtn')){const name=prompt('Tên bộ từ mới:');if(name?.trim())createNewPack(name.trim());}if(e.target.closest('.pack-help'))toast('Điền Từ vựng, Nghĩa và các thông tin bổ sung nếu cần.')});
document.addEventListener('input',e=>{if(e.target.closest('#packWordRows'))refreshPackRowNumbers()});
async function createNewPack(name){if(!isTeacher()||!user)return;try{const ref=await fb.addDoc(fb.collection(db,'publicPacks'),{name,words:[],createdBy:user.email||'',createdByUid:user.uid,createdAt:Date.now(),updatedAt:Date.now()});await loadPackChoices();$('#packSelect').value=ref.id;toast('✓ Đã tạo bộ từ mới')}catch(e){toast('Không thể tạo bộ từ: '+e.message)}}
$('#packForm').onsubmit=async e=>{e.preventDefault();const selectedId=$('#packSelect')?.value?.trim();const selectedOption=$('#packSelect option:checked');const name=selectedOption?.textContent?.trim()||'';const rows=[...document.querySelectorAll('.pack-word-row')];try{const words=rows.map(r=>({word:r.querySelector('.pack-word')?.value.trim(),pron:r.querySelector('.pack-pron')?.value.trim()||'',mean:r.querySelector('.pack-mean')?.value.trim(),type:r.querySelector('.pack-type')?.value||'',example:r.querySelector('.pack-example')?.value.trim()||'',note:r.querySelector('.pack-note')?.value.trim()||'',emoji:'📚'})).filter(x=>x.word&&x.mean);if(!selectedId)return toast('Hãy chọn một bộ từ của bạn.');if(!words.length)return toast('Nhập ít nhất một từ và nghĩa.');const ref=fb.doc(db,'publicPacks',selectedId);const existing=await fb.getDoc(ref);const oldWords=existing.exists()&&Array.isArray(existing.data()?.words)?existing.data().words:[];await fb.updateDoc(ref,{words:[...oldWords,...words],updatedAt:Date.now()});closeModal('packCreateModal');e.target.reset();$('#packWordRows').innerHTML='';addPackRow();toast('✓ Đã xuất bản pack');loadPacks();loadDashboard()}catch(err){toast('Không thể tạo pack: '+err.message)}};
async function loadProgress(){const uid=String(user?.uid||'');if(!uid||!isTeacher())return;if(!selectedClass&&classes[0])selectedClass=classes[0];const cls=selectedClass;if(!cls){$('#progressTable').innerHTML='<div class="empty">Chọn một lớp có học sinh để xem tiến độ.</div>';return}const stat=await classStats(cls);if(String(user?.uid||'')!==uid||!isTeacher()||selectedClass?.id!==cls.id)return;if(!stat||!stat.rows.length){$('#progressTable').innerHTML='<div class="empty">Chọn một lớp có học sinh để xem tiến độ.</div>';return}$('#progressTable').innerHTML=`<p class="progress-note">${esc(cls.name)} · xếp hạng theo số câu đúng, sau đó đến độ chính xác và XP.</p>`+stat.rows.map((s,i)=>`<div class="student-row"><b>#${i+1}</b><span class="student-avatar">${esc((s.displayName||'K')[0]).toUpperCase()}</span><div><strong>${esc(s.displayName||'KatLearn Student')}</strong><small>${esc(s.email||'')} · ${accuracy(s)}% chính xác</small></div><div class="student-score"><b>${Number(s.correctAnswers||0)} câu đúng</b><small>⚡ ${Number(s.energy||0).toLocaleString()} XP · 📚 ${Number(s.totalWords||0)} từ</small></div></div>`).join('')}
$('#addStudentBtn').onclick=()=>openModal('studentModal');$('#createPackBtn').onclick=async()=>{await loadPackChoices();openModal('packCreateModal')};$('#createClassBtn').onclick=()=>openModal('classModal');$('#viewProgressBtn').onclick=()=>showPage('progress');$('#goClasses').onclick=()=>showPage('classes');$('#goStudents').onclick=()=>showPage('students');$('#goPacks').onclick=()=>showPage('packs');$('#goProgress').onclick=()=>showPage('progress');$('#goProgressCard').onclick=()=>showPage('progress');

function parseCsvLine(line){const out=[];let cur='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted}else if(ch===','&&!quoted){out.push(cur.trim());cur=''}else cur+=ch}out.push(cur.trim());return out}
async function importPackCsv(file){
  if(!file)return;
  try{
    const text=await file.text();
    const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(!lines.length)throw new Error('File CSV trống.');
    const header=parseCsvLine(lines[0]).map(x=>x.toLowerCase());
    const find=(names,def)=>{const i=header.findIndex(h=>names.includes(h));return i>=0?i:def};
    const wi=find(['word','từ','từ vựng','english'],0), mi=find(['mean','meaning','nghĩa','vietnamese','tiếng việt'],2), pi=find(['pron','pronunciation','phiên âm'],1), ti=find(['type','loại từ'],3), ei=find(['example','ví dụ'],4), ni=find(['note','ghi chú'],5);
    const words=lines.slice(1).map(line=>{const a=parseCsvLine(line);return {word:a[wi]||'',pron:a[pi]||'',mean:a[mi]||'',type:a[ti]||'',example:a[ei]||'',note:a[ni]||'',emoji:'📚'}}).filter(w=>w.word&&w.mean);
    if(!words.length)throw new Error('Không tìm thấy dòng dữ liệu hợp lệ. CSV cần có ít nhất cột Từ vựng và Nghĩa.');
    const selectedId=$('#packSelect')?.value?.trim();
    if(!selectedId)throw new Error('Hãy chọn bộ từ trước khi nhập CSV.');
    const ref=fb.doc(db,'publicPacks',selectedId),snap=await fb.getDoc(ref),old=snap.exists()&&Array.isArray(snap.data()?.words)?snap.data().words:[];
    await fb.updateDoc(ref,{words:[...old,...words],updatedAt:Date.now()});
    toast('✓ Đã nhập '+words.length+' từ từ CSV');
    loadPacks();loadDashboard();$('#packFileInput').value='';
  }catch(e){toast('CSV: '+e.message)}
}
$('#importPackBtn').onclick=()=>{$('#packFileInput').click()};
$('#packFileInput').onchange=e=>importPackCsv(e.target.files?.[0]);

(async()=>{
  try{
    await initFirebase();
    await authStateReady;
    const handled=await consumeIncomingSso();
    if(!handled&&user&&!teacherAccess){
      if(accountRole==='pending_teacher_verification'){
        location.replace('teacher-pending.html');
        return;
      }
      await fb.signOut(auth).catch(()=>{});
      location.replace(LMS_HOME+'/login.html');
      return;
    }
    if(!handled&&!user&&!new URLSearchParams(location.search).has('sso'))await startCrossAppCheck();
  }catch(e){console.error(e);toast('Firebase chưa sẵn sàng: '+e.message)}
})();

