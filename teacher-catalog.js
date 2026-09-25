(function(){
  const FIREBASE_CONFIG={apiKey:'AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8',authDomain:'elp---katlearn.firebaseapp.com',projectId:'elp---katlearn',storageBucket:'elp---katlearn.firebasestorage.app',messagingSenderId:'344478447672',appId:'1:344478447672:web:4ed109a40303d0b41b0ecd',measurementId:'G-KTW11GD97T'};
  const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let db,api,schools=[];
  async function boot(){
    const [{initializeApp,getApps},{getFirestore,collection,getDocs,getDoc,doc,addDoc,setDoc,updateDoc,query,where}]=await Promise.all([import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js')]);
    const app=getApps().length?getApps()[0]:initializeApp(FIREBASE_CONFIG);db=getFirestore(app);api={collection,getDocs,getDoc,doc,addDoc,setDoc,updateDoc,query,where};
    decorateClassModal();decorateStudentModal();await refreshAdminUi();
  }
  async function loadSchools(){
    const snap=await api.getDocs(api.collection(db,'schools'));schools=snap.docs.map(d=>({id:d.id,...d.data()}));return schools;
  }
  function decorateClassModal(){
    const form=$('#classForm');if(!form)return;
    form.innerHTML='<label>Tỉnh/Thành phố công tác<select id="catalogProvince" required><option value="">Chọn tỉnh/thành</option></select></label><label>Xã/Phường<select id="catalogWard" required disabled><option value="">Chọn xã/phường</option></select></label><label>Trường<select id="catalogSchool" required disabled><option value="">Chọn trường</option></select></label><label>Lớp đang quản lý<select id="catalogClass" disabled><option value="">Chọn lớp có sẵn</option></select></label><label>Tạo lớp mới (nếu chưa có)<input id="catalogNewClass" placeholder="Ví dụ: 8B2"></label><label>Khối<input id="classGrade" placeholder="Ví dụ: 8"></label><label>Mô tả<textarea id="classDescription" placeholder="Mục tiêu hoặc ghi chú cho lớp..."></textarea></label><button class="primary-btn" type="submit">Tạo lớp</button>';
    form.onsubmit=async e=>{e.preventDefault();try{
      const p=$('#catalogProvince').value,w=$('#catalogWard').value,sid=$('#catalogSchool').value,newName=$('#catalogNewClass').value.trim();if(!sid)throw new Error('Hãy chọn trường.');let cid=$('#catalogClass').value;
      if(!cid&&newName){const ref=await api.addDoc(api.collection(db,'schools',sid,'classes'),{name:newName,createdBy:user.uid,createdAt:Date.now()});cid=ref.id}
      if(!cid)throw new Error('Hãy chọn lớp có sẵn hoặc tạo lớp mới.');
      const cSnap=await api.getDoc(api.doc(db,'schools',sid,'classes',cid));const c=cSnap.data();const school=schools.find(x=>x.id===sid);
      const code=(typeof makeJoinCode==='function'?makeJoinCode():Math.random().toString(36).slice(2,8).toUpperCase());
      const classRef=await api.addDoc(api.collection(db,'classes'),{name:c.name,grade:$('#classGrade').value.trim(),description:$('#classDescription').value.trim(),teacherUid:user.uid,teacherEmail:user.email||'',schoolId:sid,schoolName:school?.name||'',province:p,ward:w,catalogClassId:cid,studentCount:0,joinCode:code,createdAt:Date.now(),updatedAt:Date.now()});
      await api.setDoc(api.doc(db,'classInvites',code),{classId:classRef.id,className:c.name,teacherUid:user.uid,active:true,createdAt:Date.now(),updatedAt:Date.now()});const prof=await api.getDoc(api.doc(db,'users',user.uid));const oldIds=prof.exists()&&Array.isArray(prof.data()?.classIds)?prof.data().classIds:[];if(!oldIds.includes(cid))await api.updateDoc(api.doc(db,'users',user.uid),{classIds:[...oldIds,cid],updatedAt:Date.now()});
      closeModal('classModal');form.reset();toast('✓ Đã tạo lớp '+c.name);loadClasses();loadDashboard();renderPending();
    }catch(err){toast('Không thể tạo lớp: '+err.message)}
    };
    loadSchools().then(fillCatalog).catch(()=>{});
  }
  async function fillCatalog(){
    const ps=[...new Set(schools.map(s=>s.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));const p=$('#catalogProvince');if(!p)return;p.innerHTML='<option value="">Chọn tỉnh/thành</option>'+ps.map(x=>'<option>'+esc(x)+'</option>').join('');
    p.onchange=()=>{const ws=[...new Set(schools.filter(s=>s.province===p.value).map(s=>s.ward).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));$('#catalogWard').disabled=!p.value;$('#catalogWard').innerHTML='<option value="">Chọn xã/phường</option>'+ws.map(x=>'<option>'+esc(x)+'</option>').join('');$('#catalogSchool').disabled=true;$('#catalogClass').disabled=true};
    $('#catalogWard').onchange=()=>{const rows=schools.filter(s=>s.province===p.value&&s.ward===$('#catalogWard').value);$('#catalogSchool').disabled=!rows.length;$('#catalogSchool').innerHTML='<option value="">Chọn trường</option>'+rows.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');$('#catalogClass').disabled=true};
    $('#catalogSchool').onchange=async()=>{const sid=$('#catalogSchool').value;if(!sid)return;const snap=await api.getDocs(api.collection(db,'schools',sid,'classes'));$('#catalogClass').disabled=false;$('#catalogClass').innerHTML='<option value="">Chọn lớp có sẵn</option>'+snap.docs.map(d=>'<option value="'+d.id+'">'+esc(d.data().name)+'</option>').join('')};
  }
  function decorateStudentModal(){
    const form=$('#studentForm');if(!form)return;
    form.innerHTML='<label>Email học sinh<input id="studentEmail" type="email" required placeholder="student@example.com"></label><p style="font-size:11px;color:#7f8999;line-height:1.5">Tài khoản phải thuộc nhóm lớp hoặc đang chờ GV quản trị. Thêm vào đây sẽ cập nhật hồ sơ học sinh và cấp quyền thành viên.</p><button class="primary-btn" type="submit">Thêm vào lớp</button>';
    form.onsubmit=async e=>{e.preventDefault();if(!selectedClass)return toast('Chọn lớp trước.');const email=$('#studentEmail').value.trim().toLowerCase();try{
      if(typeof teacherAction!=='function')throw new Error('Chức năng quản lý lớp chưa sẵn sàng.');
      await teacherAction('invite',{classId:selectedClass.id,email});
      closeModal('studentModal');form.reset();toast('✓ Đã thêm học sinh vào lớp');renderStudents(selectedClass);loadDashboard();
    }catch(err){toast('Không thể thêm học sinh: '+err.message)}};
  }
  async function decorateAdmin(){
    if(typeof isAdminUser!=='function'||!isAdminUser())return;
    const dash=$('#dashboard');if(!dash)return;
    const box=document.createElement('section');box.className='teacher-card-panel';box.style.marginTop='18px';box.innerHTML='<h3>🛡️ Hồ sơ giáo viên chờ xác minh</h3><p>Chỉ admin mới có thể cấp quyền giáo viên.</p><div id="pendingTeachers"><div class="empty">Đang tải...</div></div>';dash.appendChild(box);await renderPending();
  }
  async function refreshAdminUi(){
    const existing=$('#pendingTeachers')?.closest('.teacher-card-panel');
    if(typeof isAdminUser!=='function'||!isAdminUser()){
      existing?.remove();
      return;
    }
    if(existing){await renderPending();return;}
    await decorateAdmin();
  }
  async function renderPending(){
    const uid=String(user?.uid||'');if(typeof isAdminUser!=='function'||!isAdminUser()||!api||!uid)return;const box=$('#pendingTeachers');if(!box)return;
    const snap=await api.getDocs(api.query(api.collection(db,'users'),api.where('role','==','pending_teacher_verification')));if(String(user?.uid||'')!==uid||!isAdminUser())return;const rows=snap.docs.map(d=>({id:d.id,...d.data()}));
    box.innerHTML=rows.length?rows.map(t=>'<div class="student-row"><div><strong>'+esc(t.displayName||'Giáo viên')+'</strong><small>'+esc(t.email||'')+' · '+esc(t.schoolName||t.schoolId||'Chưa có trường')+'</small></div><div class="student-score"><small>'+esc(t.province||'')+' · '+esc(t.ward||'')+'</small></div><button class="teacher-btn secondary" data-verify-teacher="'+t.id+'">✓ Xác minh</button></div>').join(''):'<div class="empty">Không có hồ sơ chờ xác minh.</div>';
    box.querySelectorAll('[data-verify-teacher]').forEach(b=>b.onclick=()=>verifyTeacher(b.dataset.verifyTeacher));
  }
  async function verifyTeacher(uid){try{const teacherSnap=await api.getDoc(api.doc(db,'users',uid));if(!teacherSnap.exists())throw new Error('Không tìm thấy hồ sơ giáo viên.');const profile=teacherSnap.data()||{},requested=profile.teacherVerification||{};let schoolId=String(profile.schoolId||'').trim(),classIds=Array.isArray(profile.classIds)?profile.classIds.filter(Boolean).slice(0,20):[],schoolName=String(profile.schoolName||'').trim();const province=String(profile.province||'').trim(),ward=String(profile.ward||'').trim(),requestedSchoolName=String(requested.requestedSchoolName||'').trim(),requestedClassName=String(requested.requestedClassName||'').trim();if(schoolId){const schoolSnap=await api.getDoc(api.doc(db,'schools',schoolId));if(!schoolSnap.exists()||String(schoolSnap.data()?.province||'').trim()!==province||String(schoolSnap.data()?.ward||'').trim()!==ward)schoolId='';else schoolName=String(schoolSnap.data()?.name||schoolName).trim()}if(!schoolId&&requestedSchoolName){const snap=await api.getDocs(api.query(api.collection(db,'schools'),api.where('name','==',requestedSchoolName)));const existing=snap.docs.map(d=>({id:d.id,...d.data()})).find(s=>String(s.province||'')===province&&String(s.ward||'')===ward);if(existing){schoolId=existing.id;schoolName=String(existing.name||requestedSchoolName)}else{const ref=await api.addDoc(api.collection(db,'schools'),{name:requestedSchoolName,province,ward,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()});schoolId=ref.id;schoolName=requestedSchoolName}}if(!schoolId)throw new Error('Hồ sơ chưa có trường hợp lệ.');const validClassIds=[];for(const classId of classIds){const snap=await api.getDoc(api.doc(db,'schools',schoolId,'classes',classId));if(snap.exists())validClassIds.push(classId)}classIds=validClassIds;if(!classIds.length&&requestedClassName){const snap=await api.getDocs(api.query(api.collection(db,'schools',schoolId,'classes'),api.where('name','==',requestedClassName)));const existing=snap.docs[0];if(existing)classIds=[existing.id];else{const ref=await api.addDoc(api.collection(db,'schools',schoolId,'classes'),{name:requestedClassName,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()});classIds=[ref.id]}}if(!classIds.length)throw new Error('Hồ sơ chưa có lớp hợp lệ.');const catalogClassId=String(profile.catalogClassId&&classIds.includes(profile.catalogClassId)?profile.catalogClassId:classIds[0]).trim();await api.updateDoc(api.doc(db,'users',uid),{role:'teacher',schoolId,schoolName,province,ward,classIds,catalogClassId,teacherVerification:{...requested,status:'verified',verifiedAt:Date.now(),verifiedBy:user.uid},updatedAt:Date.now()});toast('✓ Đã cấp quyền giáo viên');renderPending();}catch(e){toast('Không thể xác minh: '+e.message)}}
  window.addEventListener('katlearn-teacher-auth-change',()=>{void refreshAdminUi()});
  boot().catch(e=>console.warn('[KatLearn catalog]',e));
})();

