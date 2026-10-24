(function(){
  const FIREBASE_CONFIG={apiKey:'AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8',authDomain:'elp---katlearn.firebaseapp.com',projectId:'elp---katlearn',storageBucket:'elp---katlearn.firebasestorage.app',messagingSenderId:'344478447672',appId:'1:344478447672:web:4ed109a40303d0b41b0ecd',measurementId:'G-KTW11GD97T'};
  const normalizePlace=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  let officialWardsByProvince=new Map();
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
    const p=$('#catalogProvince');if(!p)return;
    let officialProvinces=[];
    try{
      const response=await fetch('./data/national-catalog/official-ward-list.json',{cache:'force-cache'});
      if(!response.ok)throw new Error('Không tải được danh sách xã/phường quốc gia.');
      const catalog=await response.json();
      if(!catalog||!Array.isArray(catalog.provinces)||catalog.provinceCount!==34||catalog.totalUnitCount!==3321)throw new Error('Danh sách xã/phường quốc gia không hợp lệ.');
      officialProvinces=catalog.provinces.filter(x=>x?.code&&x?.name);
      officialWardsByProvince=new Map(officialProvinces.map(x=>[String(x.code).trim(),(x.wards||[]).map(w=>String(w.name||'').replace(/\s+/g,' ').trim()).filter(Boolean)]));
      p.innerHTML='<option value="">Chọn tỉnh/thành</option>'+officialProvinces.map(x=>'<option value="'+esc(x.name)+'">'+esc(x.name)+'</option>').join('');
    }catch(error){
      const ps=[...new Set(schools.map(s=>s.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi'));
      p.innerHTML='<option value="">Chọn tỉnh/thành</option>'+ps.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
      officialWardsByProvince=new Map();
      toast('Không tải được danh sách xã/phường chuẩn: '+(error.message||'Lỗi không xác định'));
    }
    const findProvinceCode=name=>{
      const hit=officialProvinces.find(x=>normalizePlace(x.name)===normalizePlace(name));
      return String(hit?.code||'').trim();
    };
    const renderWards=()=>{
      const code=findProvinceCode(p.value);
      const ws=officialWardsByProvince.get(code)||[];
      $('#catalogWard').disabled=!ws.length;
      $('#catalogWard').innerHTML='<option value="">Chọn xã/phường</option>'+ws.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
      $('#catalogSchool').disabled=true;$('#catalogSchool').innerHTML='<option value="">Chọn trường</option>';
      $('#catalogClass').disabled=true;$('#catalogClass').innerHTML='<option value="">Chọn lớp có sẵn</option>';
    };
    p.onchange=renderWards;
    $('#catalogWard').onchange=()=>{
      const pv=p.value,wv=$('#catalogWard').value;
      const rows=schools.filter(s=>normalizePlace(s.province)===normalizePlace(pv)&&normalizePlace(s.ward)===normalizePlace(wv));
      $('#catalogSchool').disabled=!rows.length;
      $('#catalogSchool').innerHTML='<option value="">Chọn trường</option>'+rows.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join('');
      $('#catalogClass').disabled=true;$('#catalogClass').innerHTML='<option value="">Chọn lớp có sẵn</option>';
    };
    $('#catalogSchool').onchange=async()=>{
      const sid=$('#catalogSchool').value;if(!sid)return;
      const snap=await api.getDocs(api.collection(db,'schools',sid,'classes'));
      $('#catalogClass').disabled=false;
      $('#catalogClass').innerHTML='<option value="">Chọn lớp có sẵn</option>'+snap.docs.map(d=>'<option value="'+d.id+'">'+esc(d.data().name)+'</option>').join('');
    };
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
  async function canonicalSchoolId(school){
    if(!school||!school.provinceId||!school.sourceSchoolId||!school.name)return '';
    const input=String(school.provinceId)+'|'+String(school.sourceSchoolId)+'|'+String(school.name).trim().toLowerCase();
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(input));
    return 'sch_'+[...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,28);
  }
  async function verifyTeacher(uid){
    try{
      const teacherSnap=await api.getDoc(api.doc(db,'users',uid));
      if(!teacherSnap.exists())throw new Error('Không tìm thấy hồ sơ giáo viên.');
      const profile=teacherSnap.data()||{},requested=profile.teacherVerification||{};
      const catalogSchool=requested.catalogSchool&&typeof requested.catalogSchool==='object'?requested.catalogSchool:null;
      let schoolId=String(profile.schoolId||'').trim();
      let classIds=Array.isArray(profile.classIds)?profile.classIds.filter(Boolean).slice(0,20):[];
      let schoolName=String(profile.schoolName||'').trim();
      const province=String(profile.province||'').trim(),ward=String(profile.ward||'').trim();
      const requestedSchoolName=String(requested.requestedSchoolName||'').trim();
      const requestedClassName=String(requested.requestedClassName||'').trim();

      if(schoolId){
        const schoolSnap=await api.getDoc(api.doc(db,'schools',schoolId));
        if(schoolSnap.exists()&&String(schoolSnap.data()?.province||'').trim()===province&&String(schoolSnap.data()?.ward||'').trim()===ward){
          schoolName=String(schoolSnap.data()?.name||schoolName).trim();
        }else if(catalogSchool&&catalogSchool.schoolId===schoolId&&catalogSchool.name===schoolName&&catalogSchool.province===province&&catalogSchool.ward===ward&&await canonicalSchoolId(catalogSchool)===schoolId){
          const now=Date.now();
          const record={
            name:String(catalogSchool.name||'').trim(),schoolId,
            province:String(catalogSchool.province||province).trim(),provinceId:String(catalogSchool.provinceId||requested.requestedProvinceId||'').trim(),
            ward:String(catalogSchool.ward||ward).trim(),wardId:String(catalogSchool.wardId||requested.requestedWardId||'').trim(),
            sourceSchoolId:String(catalogSchool.sourceSchoolId||''),sourceProvinceId:String(catalogSchool.sourceProvinceId||''),
            schoolLevel:String(catalogSchool.schoolLevel||'combined'),source:'lms_national_catalog',
            createdAt:now,updatedAt:now
          };
          if(!record.name||!record.provinceId||!record.wardId||!record.sourceSchoolId)throw new Error('Thông tin trường LMS chưa đầy đủ. Hãy kiểm tra hồ sơ trước khi xác minh.');
          await api.setDoc(api.doc(db,'schools',schoolId),record,{merge:true});
          await api.setDoc(api.doc(db,'KatLearn_TRUONGHOC_1',schoolId),record,{merge:true});
          schoolName=record.name;
        }else{
          schoolId='';
        }
      }

      if(!schoolId&&requestedSchoolName){
        const snap=await api.getDocs(api.query(api.collection(db,'schools'),api.where('name','==',requestedSchoolName)));
        const existing=snap.docs.map(d=>({id:d.id,...d.data()})).find(s=>String(s.province||'')===province&&String(s.ward||'')===ward);
        if(existing){schoolId=existing.id;schoolName=String(existing.name||requestedSchoolName)}
        else{
          const ref=await api.addDoc(api.collection(db,'schools'),{name:requestedSchoolName,province,ward,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()});
          schoolId=ref.id;schoolName=requestedSchoolName;
        }
      }
      if(!schoolId)throw new Error('Hồ sơ chưa có trường hợp lệ.');

      const schoolDoc=await api.getDoc(api.doc(db,'schools',schoolId));
      const schoolData=schoolDoc.exists()?schoolDoc.data()||{}:{};
      const approvedSchool={
        name:schoolName,schoolId,province,ward,
        provinceId:String(catalogSchool?.provinceId||schoolData.provinceId||requested.requestedProvinceId||'').trim(),
        wardId:String(catalogSchool?.wardId||schoolData.wardId||requested.requestedWardId||'').trim(),
        sourceSchoolId:String(catalogSchool?.sourceSchoolId||schoolData.sourceSchoolId||''),
        sourceProvinceId:String(catalogSchool?.sourceProvinceId||schoolData.sourceProvinceId||''),
        schoolLevel:String(catalogSchool?.schoolLevel||schoolData.schoolLevel||'combined'),
        source:String(catalogSchool?'lms_national_catalog':'teacher_verification'),
        updatedAt:Date.now()
      };
      const isVerifiedCatalogSchool=Boolean(catalogSchool&&catalogSchool.schoolId===schoolId&&catalogSchool.name===schoolName&&catalogSchool.province===province&&catalogSchool.ward===ward&&await canonicalSchoolId(catalogSchool)===schoolId);
      if(isVerifiedCatalogSchool){
        const canonicalRecord={
          ...catalogSchool,
          schoolId,name:schoolName,province,ward,
          createdAt:schoolData.createdAt||Date.now(),
          updatedAt:Date.now(),
          source:'lms_national_catalog'
        };
        // Keep the legacy school path and both shared LMS catalogs aligned.
        await Promise.all([
          api.setDoc(api.doc(db,'schools',schoolId),canonicalRecord,{merge:true}),
          api.setDoc(api.doc(db,'KatLearn_TRUONGHOC_1',schoolId),canonicalRecord,{merge:true}),
          api.setDoc(api.doc(db,'KatLearn_Teacher_Schools',schoolId),canonicalRecord,{merge:true})
        ]);
      }else{
        await api.setDoc(api.doc(db,'KatLearn_Teacher_Schools',schoolId),{...approvedSchool,updatedAt:Date.now()},{merge:true});
      }

      // Provision canonical grade IDs from the LMS catalog so the teacher dashboard and LMS use the same classes.
      const templates={primary:['1','2','3','4','5'],middle:['6','7','8','9'],high:['10','11','12'],combined:['1','2','3','4','5','6','7','8','9','10','11','12']};
      if(isVerifiedCatalogSchool){
        const grades=templates[String(catalogSchool.schoolLevel||'combined')]||templates.combined;
        const now=Date.now();
        await Promise.all(grades.map(async grade=>{
          const classId=schoolId+'-'+grade;
          const cls={classId,name:'Lớp '+grade,grade:String(grade),schoolId,schoolName,province,ward,provinceId:approvedSchool.provinceId,wardId:approvedSchool.wardId,schoolLevel:approvedSchool.schoolLevel,isTemplate:true,source:'lms_national_catalog',updatedAt:now};
          await Promise.all([
            api.setDoc(api.doc(db,'schools',schoolId,'classes',classId),cls,{merge:true}),
            api.setDoc(api.doc(db,'KatLearn_LOPHOC_1',classId),cls,{merge:true})
          ]);
        }));
      }

      const validClassIds=[];
      for(const classId of classIds){
        const snap=await api.getDoc(api.doc(db,'schools',schoolId,'classes',classId));
        if(snap.exists())validClassIds.push(classId);
      }
      classIds=validClassIds;
      if(!classIds.length&&requestedClassName){
        const canonicalId=String(requested.catalogClassId||profile.catalogClassId||'').trim();
        const canonicalGrade=canonicalId.startsWith(schoolId+'-')?canonicalId.slice(schoolId.length+1):'';
        const canonicalIsAllowed=isVerifiedCatalogSchool&&/^(?:[1-9]|1[0-2])$/.test(canonicalGrade)&&requestedClassName==='Lớp '+canonicalGrade;
        if(canonicalIsAllowed){
          classIds=[canonicalId];
        }else{
          const snap=await api.getDocs(api.query(api.collection(db,'schools',schoolId,'classes'),api.where('name','==',requestedClassName)));
          const existing=snap.docs[0];
          if(existing)classIds=[existing.id];
          else{
            const ref=await api.addDoc(api.collection(db,'schools',schoolId,'classes'),{name:requestedClassName,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()});
            classIds=[ref.id];
          }
        }
      }
      if(!classIds.length)throw new Error('Hồ sơ chưa có lớp hợp lệ.');
      const catalogClassId=String(profile.catalogClassId&&classIds.includes(profile.catalogClassId)?profile.catalogClassId:classIds[0]).trim();
      await api.updateDoc(api.doc(db,'users',uid),{
        role:'teacher',schoolId,schoolName,province,ward,classIds,catalogClassId,
        teacherVerification:{...requested,status:'verified',verifiedAt:Date.now(),verifiedBy:user.uid},
        updatedAt:Date.now()
      });
      toast('✓ Đã cấp quyền giáo viên');renderPending();
    }catch(e){toast('Không thể xác minh: '+e.message)}
  }
  window.addEventListener('katlearn-teacher-auth-change',()=>{void refreshAdminUi()});
  boot().catch(e=>console.warn('[KatLearn catalog]',e));
})();

