import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const allowedOrigins=new Set(['https://teacher-katlearn.vercel.app']);
function headers(origin){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};if(allowedOrigins.has(origin)){h['access-control-allow-origin']=origin;h['access-control-allow-methods']='POST, OPTIONS';h['access-control-allow-headers']='content-type';h.vary='Origin'}return h}
function admin(){if(!getApps().length){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');initializeApp({credential:cert(JSON.parse(raw))})}return{auth:getAuth(),db:getFirestore()}}
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
async function activeClassProfile(db,ids){
  for(const id of Array.isArray(ids)?ids.slice(0,20):[]){
    const snap=await db.collection('classes').doc(id).get();
    if(!snap.exists)continue;
    const cls=snap.data()||{},teacherUid=String(cls.teacherUid||'').trim();
    let teacher={};
    if(teacherUid){const ts=await db.collection('users').doc(teacherUid).get();teacher=ts.exists?ts.data()||{}:{}}
    return{
      classId:id,className:String(cls.name||'').trim(),schoolId:String(cls.schoolId||'').trim(),
      schoolName:String(cls.schoolName||teacher.schoolName||'').trim(),province:String(cls.province||teacher.province||'').trim(),
      ward:String(cls.ward||teacher.ward||'').trim(),teacherUid,
      teacherName:String(teacher.displayName||cls.teacherName||'').trim(),
      teacherEmail:String(teacher.email||cls.teacherEmail||'').toLowerCase().trim()
    };
  }
  return{classId:'',className:'',schoolId:'',schoolName:'',province:'',ward:'',teacherUid:'',teacherName:'',teacherEmail:''};
}
async function teacherContext(request){
  const token=clean(request.headers.get('authorization')||'',4000).replace(/^Bearer\s+/i,'');
  if(!token)throw Object.assign(new Error('Bạn cần đăng nhập.'),{status:401});
  const {auth,db}=admin(),decoded=await auth.verifyIdToken(token,true);
  const profileSnap=await db.collection('users').doc(decoded.uid).get(),profile=profileSnap.exists?profileSnap.data():{};
  const adminEmail=String(decoded.email||'').toLowerCase()==='katlearn.admin@gmail.com';
  if(!adminEmail&&String(profile.role||'').toLowerCase()!=='teacher')throw Object.assign(new Error('Chỉ giáo viên được dùng tính năng này.'),{status:403});
  return{auth,db,uid:decoded.uid,admin:adminEmail,email:decoded.email||'',displayName:decoded.name||''};
}
async function assertClass(ctx,classId){
  const snap=await ctx.db.collection('classes').doc(classId).get();
  if(!snap.exists)throw Object.assign(new Error('Không tìm thấy lớp.'),{status:404});
  if(!ctx.admin&&snap.data().teacherUid!==ctx.uid)throw Object.assign(new Error('Bạn không quản lý lớp này.'),{status:403});
  return snap;
}
async function batchDelete(refs,db){for(let i=0;i<refs.length;i+=400){const batch=db.batch();refs.slice(i,i+400).forEach(ref=>batch.delete(ref));await batch.commit()}}
async function batchSet(changes,db){for(let i=0;i<changes.length;i+=400){const batch=db.batch();changes.slice(i,i+400).forEach(x=>batch.set(x.ref,x.data,{merge:true}));await batch.commit()}}
export default async request=>{
  const origin=request.headers.get('origin')||'';
  if(request.method==='OPTIONS')return new Response('',{status:204,headers:headers(origin)});
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:headers(origin)});
  if(!allowedOrigins.has(origin))return Response.json({error:'Origin not allowed'},{status:403,headers:headers(origin)});
  try{
    const body=await request.json(),action=clean(body?.action,40),classId=clean(body?.classId,120),ctx=await teacherContext(request);
    if(action==='delete-pack'){
      const packId=clean(body?.packId,160);if(!packId)throw Object.assign(new Error('Thiếu bộ từ.'),{status:400});
      const packRef=ctx.db.collection('publicPacks').doc(packId),packSnap=await packRef.get();
      if(!packSnap.exists)throw Object.assign(new Error('Không tìm thấy bộ từ.'),{status:404});
      if(!ctx.admin&&String(packSnap.data()?.createdByUid||'')!==ctx.uid)throw Object.assign(new Error('Bạn không quản lý bộ từ này.'),{status:403});
      const assignmentsSnap=await ctx.db.collection('packAssignments').where('packId','==',packId).get();
      let batch=ctx.db.batch(),ops=0;
      for(const d of assignmentsSnap.docs){batch.delete(d.ref);ops++;if(ops>=450){await batch.commit();batch=ctx.db.batch();ops=0}}
      batch.delete(packRef);await batch.commit();
      return Response.json({ok:true,message:'Đã xóa bộ từ và các bài giao liên quan.'},{headers:headers(origin)});
    }

    if(!classId)throw Object.assign(new Error('Thiếu lớp.'),{status:400});
    const classSnap=await assertClass(ctx,classId),classData=classSnap.data(),students=ctx.db.collection('users');

    if(action==='delete-class'){
      const memberSnap=await ctx.db.collection('classes').doc(classId).collection('members').get();
      const inviteSnap=await ctx.db.collection('classInvites').where('classId','==',classId).get();
      const assignmentSnap=await ctx.db.collection('packAssignments').where('classId','==',classId).get();
      const memberDeletes=memberSnap.docs.map(d=>d.ref);
      const studentChanges=[];
      for(const member of memberSnap.docs){
        const studentRef=students.doc(member.id);
        const studentSnap=await studentRef.get();
        if(!studentSnap.exists)continue;
        const student=studentSnap.data()||{};
        const remainingIds=Array.isArray(student.joinedClassIds)?student.joinedClassIds.filter(id=>id!==classId):[];
        const active=remainingIds.length?await activeClassProfile(ctx.db,remainingIds):{classId:'',className:'',schoolId:'',schoolName:'',province:'',ward:'',teacherUid:'',teacherName:'',teacherEmail:''};
        studentChanges.push({ref:studentRef,data:{
          joinedClassIds:remainingIds,
          studentAccountType:remainingIds.length?'class':'free',
          ...active,
          updatedAt:FieldValue.serverTimestamp()
        }});
      }
      await batchDelete(memberDeletes,ctx.db);
      await batchSet(studentChanges,ctx.db);
      await batchDelete(inviteSnap.docs.map(d=>d.ref),ctx.db);
      await batchDelete(assignmentSnap.docs.map(d=>d.ref),ctx.db);
      const catalogClassId=String(classData.catalogClassId||'').trim(),ownerUid=String(classData.teacherUid||'').trim();
      if(catalogClassId&&ownerUid){
        const ownerRef=students.doc(ownerUid),ownerSnap=await ownerRef.get();
        if(ownerSnap.exists){
          const ids=Array.isArray(ownerSnap.data()?.classIds)?ownerSnap.data().classIds:[];
          if(ids.includes(catalogClassId))await ownerRef.set({classIds:ids.filter(id=>id!==catalogClassId),updatedAt:FieldValue.serverTimestamp()},{merge:true});
        }
      }
      await ctx.db.collection('classes').doc(classId).delete();
      return Response.json({ok:true,message:'Đã xóa lớp và dọn dữ liệu liên quan.'},{headers:headers(origin)});
    }

    if(action==='invite'){
      const email=clean(body?.email,254).toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(email))throw Object.assign(new Error('Email học sinh không hợp lệ.'),{status:400});
      const authUser=await ctx.auth.getUserByEmail(email).catch(()=>null);
      if(!authUser)throw Object.assign(new Error('Không tìm thấy tài khoản học sinh với email này.'),{status:404});
      const studentRef=students.doc(authUser.uid),studentSnap=await studentRef.get();
      if(!studentSnap.exists||String(studentSnap.data().role||'student').toLowerCase()!=='student')throw Object.assign(new Error('Tài khoản này không phải học sinh.'),{status:400});
      const student=studentSnap.data();
      const teacherSnap=await ctx.db.collection('users').doc(ctx.uid).get();
      const teacherProfile=teacherSnap.exists?teacherSnap.data():{};
      let schoolId=String(classData.schoolId||teacherProfile.schoolId||'').trim();
      let schoolName=String(classData.schoolName||teacherProfile.schoolName||'').trim();
      let province=String(classData.province||teacherProfile.province||'').trim();
      let ward=String(classData.ward||teacherProfile.ward||'').trim();
      if(schoolId){
        const schoolSnap=await ctx.db.collection('schools').doc(schoolId).get();
        if(schoolSnap.exists){
          const school=schoolSnap.data()||{};
          schoolName=schoolName||String(school.name||'').trim();
          province=province||String(school.province||'').trim();
          ward=ward||String(school.ward||'').trim();
        }
      }
      const className=String(classData.name||'').trim();
      const teacherName=String(teacherProfile.displayName||ctx.displayName||ctx.uid).trim();
      const profileSync={
        studentAccountType:'class',
        classId,
        className,
        schoolId,
        schoolName,
        province,
        ward,
        teacherUid:ctx.uid,
        teacherName,
        teacherEmail:String(ctx.email||'').toLowerCase(),
        updatedAt:FieldValue.serverTimestamp()
      };
      const memberSync={uid:authUser.uid,email,displayName:student.displayName||authUser.displayName||email.split('@')[0],addedAt:Date.now(),addedBy:ctx.uid,source:'teacher',schoolId,className,classId,schoolName,province,ward,teacherUid:ctx.uid,teacherName,teacherEmail:String(ctx.email||'').toLowerCase(),catalogClassId:classData.catalogClassId||''};
      await ctx.db.runTransaction(async transaction=>{
        const freshStudent=await transaction.get(studentRef);
        if(!freshStudent.exists)throw Object.assign(new Error('Hồ sơ học sinh không còn tồn tại.'),{status:404});
        const freshData=freshStudent.data()||{};
        const freshIds=Array.isArray(freshData.joinedClassIds)?freshData.joinedClassIds:[];
        const joinedClassIds=freshIds.includes(classId)?freshIds:[...freshIds,classId];
        const freshMemberSync={...memberSync,displayName:freshData.displayName||authUser.displayName||email.split('@')[0]};
        transaction.set(ctx.db.doc('classes/'+classId+'/members/'+authUser.uid),freshMemberSync,{merge:true});
        transaction.set(studentRef,{...profileSync,joinedClassIds},{merge:true});
        transaction.set(classSnap.ref,{updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      const existingAssignments=await ctx.db.collection('packAssignments').where('classId','==',classId).get();
      for(let i=0;i<existingAssignments.docs.length;i+=450){
        const batch=ctx.db.batch();
        existingAssignments.docs.slice(i,i+450).forEach(d=>batch.update(d.ref,{studentUids:FieldValue.arrayUnion(authUser.uid),updatedAt:FieldValue.serverTimestamp()}));
        await batch.commit();
      }
      const count=(await ctx.db.collection('classes').doc(classId).collection('members').count().get()).data().count;
      await classSnap.ref.set({studentCount:count,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return Response.json({ok:true,message:'Đã thêm học sinh vào lớp.'},{headers:headers(origin)});
    }

    if(action==='assign-pack'){
      const packId=clean(body?.packId,160);if(!packId)throw Object.assign(new Error('Thiếu bộ từ.'),{status:400});
      const packRef=ctx.db.collection('publicPacks').doc(packId),packSnap=await packRef.get();if(!packSnap.exists)throw Object.assign(new Error('Không tìm thấy bộ từ.'),{status:404});
      if(!ctx.admin&&packSnap.data().createdByUid!==ctx.uid)throw Object.assign(new Error('Bạn không quản lý bộ từ này.'),{status:403});
      const existingAssignments=await ctx.db.collection('packAssignments').where('classId','==',classId).get();
      const existing=existingAssignments.docs.find(d=>String(d.data()?.packId||'')===packId);
      if(existing)return Response.json({ok:true,assignmentId:existing.id,studentCount:Number(existing.data()?.studentCount||0),alreadyAssigned:true},{headers:headers(origin)});
      const membersSnap=await ctx.db.collection('classes').doc(classId).collection('members').get();
      const assignmentRef=ctx.db.collection('packAssignments').doc();
      await assignmentRef.set({packId,classId,packName:String(packSnap.data().name||''),teacherUid:ctx.uid,studentUids:membersSnap.docs.map(d=>d.id),studentCount:membersSnap.size,status:'assigned',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
      return Response.json({ok:true,assignmentId:assignmentRef.id,studentCount:membersSnap.size},{headers:headers(origin)});
    }
    if(action==='pack-achievements'){
      const packId=clean(body?.packId,160);if(!packId)throw Object.assign(new Error('Thiếu bộ từ.'),{status:400});
      const packSnap=await ctx.db.collection('publicPacks').doc(packId).get();if(!packSnap.exists)throw Object.assign(new Error('Không tìm thấy bộ từ.'),{status:404});
      if(!ctx.admin&&packSnap.data().createdByUid!==ctx.uid)throw Object.assign(new Error('Bạn không quản lý bộ từ này.'),{status:403});
      const words=new Set((Array.isArray(packSnap.data().words)?packSnap.data().words:[]).map(w=>String(w.word||'').trim().toLowerCase()).filter(Boolean));
      const membersSnap=await ctx.db.collection('classes').doc(classId).collection('members').get();
      const rows=await Promise.all(membersSnap.docs.map(async m=>{const uid=m.id,profileSnap=await students.doc(uid).get(),profile=profileSnap.exists?profileSnap.data():{},attemptsSnap=await students.doc(uid).collection('attempts').get();let attempts=0,correct=0;attemptsSnap.forEach(a=>{const d=a.data()||{},word=String(d.word||'').trim().toLowerCase(),sourceId=String(d.sourceId||'').trim();const exact=sourceId===packId;const legacy=!sourceId&&words.has(word);if(exact||legacy){attempts++;if(d.correct===true)correct++}});return{uid,displayName:String(profile.displayName||m.data().displayName||'KatLearn Student'),email:String(profile.email||m.data().email||''),attempts,correct,accuracy:attempts?Math.round(correct*100/attempts):0}}));
      rows.sort((a,b)=>b.correct-a.correct||b.accuracy-a.accuracy||a.displayName.localeCompare(b.displayName));
      return Response.json({ok:true,rows},{headers:headers(origin)});
    }
    const studentUid=clean(body?.studentUid,160);
    if(!studentUid)throw Object.assign(new Error('Thiếu học sinh.'),{status:400});
    const memberRef=ctx.db.doc('classes/'+classId+'/members/'+studentUid),memberSnap=await memberRef.get();
    if(!memberSnap.exists)throw Object.assign(new Error('Học sinh không thuộc lớp này.'),{status:404});

    if(action==='remove'){
      let remainingIds=[];
      await ctx.db.runTransaction(async transaction=>{
        const freshStudent=await transaction.get(students.doc(studentUid));
        if(!freshStudent.exists)throw Object.assign(new Error('Không tìm thấy hồ sơ học sinh.'),{status:404});
        const data=freshStudent.data()||{},ids=Array.isArray(data.joinedClassIds)?data.joinedClassIds:[];
        remainingIds=ids.filter(id=>id!==classId);
        transaction.delete(memberRef);
        transaction.set(students.doc(studentUid),{joinedClassIds:remainingIds,studentAccountType:remainingIds.length?'class':'free',updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      const active=await activeClassProfile(ctx.db,remainingIds);
      await students.doc(studentUid).set({...active,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      const assignments=await ctx.db.collection('packAssignments').where('classId','==',classId).get();
      for(let i=0;i<assignments.docs.length;i+=450){
        const batch=ctx.db.batch();
        assignments.docs.slice(i,i+450).forEach(d=>batch.update(d.ref,{studentUids:FieldValue.arrayRemove(studentUid),updatedAt:FieldValue.serverTimestamp()}));
        await batch.commit();
      }
      const count=(await ctx.db.collection('classes').doc(classId).collection('members').count().get()).data().count;
      await classSnap.ref.set({studentCount:count,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return Response.json({ok:true,message:'Đã xóa học sinh khỏi lớp.'},{headers:headers(origin)});
    }

    if(action==='update-student'){
      const displayName=clean(body?.displayName,80),password=String(body?.password||'');
      if(!displayName&&!password)throw Object.assign(new Error('Chưa có thay đổi nào.'),{status:400});
      if(password&&(password.length<6||password.length>256))throw Object.assign(new Error('Mật khẩu phải từ 6 đến 256 ký tự.'),{status:400});
      const authChanges={};if(displayName)authChanges.displayName=displayName;if(password)authChanges.password=password;
      if(Object.keys(authChanges).length)await ctx.auth.updateUser(studentUid,authChanges);
      if(displayName){await students.doc(studentUid).set({displayName,updatedAt:FieldValue.serverTimestamp()},{merge:true});await memberRef.set({displayName},{merge:true})}
      return Response.json({ok:true,message:'Đã cập nhật tài khoản học sinh.'},{headers:headers(origin)});
    }
    throw Object.assign(new Error('Thao tác không được hỗ trợ.'),{status:400});
  }catch(error){console.error('[KatLearn teacher manage]',error);return Response.json({error:error.message||'Server error'},{status:error.status||500,headers:headers(origin)})}
};