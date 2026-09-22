import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const allowedOrigins=new Set(['https://teacher-katlearn.vercel.app']);
function headers(origin){const h={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};if(allowedOrigins.has(origin)){h['access-control-allow-origin']=origin;h['access-control-allow-methods']='POST, OPTIONS';h['access-control-allow-headers']='content-type';h.vary='Origin'}return h}
function admin(){if(!getApps().length){const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');initializeApp({credential:cert(JSON.parse(raw))})}return{auth:getAuth(),db:getFirestore()}}
const clean=(value,max=120)=>String(value??'').trim().slice(0,max);
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
export default async request=>{
  const origin=request.headers.get('origin')||'';
  if(request.method==='OPTIONS')return new Response('',{status:204,headers:headers(origin)});
  if(request.method!=='POST')return Response.json({error:'Method not allowed'},{status:405,headers:headers(origin)});
  if(!allowedOrigins.has(origin))return Response.json({error:'Origin not allowed'},{status:403,headers:headers(origin)});
  try{
    const body=await request.json(),action=clean(body?.action,40),classId=clean(body?.classId,120),ctx=await teacherContext(request);
    if(!classId)throw Object.assign(new Error('Thiếu lớp.'),{status:400});
    const classSnap=await assertClass(ctx,classId),classData=classSnap.data(),students=ctx.db.collection('users');

    if(action==='invite'){
      const email=clean(body?.email,254).toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(email))throw Object.assign(new Error('Email học sinh không hợp lệ.'),{status:400});
      const authUser=await ctx.auth.getUserByEmail(email).catch(()=>null);
      if(!authUser)throw Object.assign(new Error('Không tìm thấy tài khoản học sinh với email này.'),{status:404});
      const studentRef=students.doc(authUser.uid),studentSnap=await studentRef.get();
      if(!studentSnap.exists||String(studentSnap.data().role||'student').toLowerCase()!=='student')throw Object.assign(new Error('Tài khoản này không phải học sinh.'),{status:400});
      const student=studentSnap.data(),oldIds=Array.isArray(student.joinedClassIds)?student.joinedClassIds:[];
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
        joinedClassIds:oldIds.includes(classId)?oldIds:[...oldIds,classId],
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
        transaction.set(ctx.db.doc('classes/'+classId+'/members/'+authUser.uid),memberSync,{merge:true});
        transaction.set(studentRef,profileSync,{merge:true});
        transaction.set(classSnap.ref,{updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
      const count=(await ctx.db.collection('classes').doc(classId).collection('members').count().get()).data().count;
      await classSnap.ref.set({studentCount:count,updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return Response.json({ok:true,message:'Đã thêm học sinh vào lớp.'},{headers:headers(origin)});
    }

    const studentUid=clean(body?.studentUid,160);
    if(!studentUid)throw Object.assign(new Error('Thiếu học sinh.'),{status:400});
    const memberRef=ctx.db.doc('classes/'+classId+'/members/'+studentUid),memberSnap=await memberRef.get();
    if(!memberSnap.exists)throw Object.assign(new Error('Học sinh không thuộc lớp này.'),{status:404});

    if(action==='remove'){
      await ctx.db.runTransaction(async transaction=>{
        const studentRef=students.doc(studentUid),studentSnap=await transaction.get(studentRef),oldIds=studentSnap.exists&&Array.isArray(studentSnap.data().joinedClassIds)?studentSnap.data().joinedClassIds:[];
        transaction.delete(memberRef);
        const remainingIds=oldIds.filter(id=>id!==classId);transaction.set(studentRef,{joinedClassIds:remainingIds,studentAccountType:remainingIds.length?'class':'free',updatedAt:FieldValue.serverTimestamp()},{merge:true});
      });
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