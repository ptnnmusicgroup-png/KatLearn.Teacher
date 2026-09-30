import fs from "node:fs";
import crypto from "node:crypto";

function clean(value,max=200){
  return String(value??"").trim().slice(0,max);
}


function header(request,name){
  const key=String(name||"").toLowerCase();
  const headers=request?.headers;
  if(headers&&typeof headers.get==="function")return String(headers.get(key)||"");
  return String(headers?.[key]??"");
}
function queryParam(request,key){
  try{return new URL(String(request?.url||"/"),"https://teacher-katlearn.vercel.app").searchParams.get(key)||""}
  catch(_){return""}
}
async function readJson(request){
  if(request&&typeof request.json==="function"){
    try{
      const value=await request.json();
      return value&&typeof value==="object"&&!Array.isArray(value)?value:{};
    }catch(_){
      return{};
    }
  }
  if(request?.body!=null){
    if(typeof request.body==="string"){
      try{const value=JSON.parse(request.body);return value&&typeof value==="object"&&!Array.isArray(value)?value:{}}
      catch(_){return{}}
    }
    if(typeof request.body==="object"&&!request.body?.getReader){
      return request.body&&typeof request.body==="object"&&!Array.isArray(request.body)?request.body:{};
    }
  }
  return await new Promise(resolve=>{
    let chunks=[];
    request.on?.("data",chunk=>chunks.push(Buffer.isBuffer(chunk)?chunk:Buffer.from(String(chunk))));
    request.on?.("end",()=>{
      try{const value=JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}");resolve(value&&typeof value==="object"&&!Array.isArray(value)?value:{})}
      catch(_){resolve({})}
    });
    request.on?.("error",()=>resolve({}));
  });
}
function corsHeaders(origin){
  const h={"Content-Type":"application/json","Cache-Control":"no-store"};
  if(["https://teacher-katlearn.vercel.app","https://lms-katlearn.vercel.app","http://localhost:3000","http://localhost:5173"].includes(origin)){
    h["Access-Control-Allow-Origin"]=origin;
    h["Access-Control-Allow-Methods"]="GET,POST,OPTIONS";
    h["Access-Control-Allow-Headers"]="authorization,content-type,accept";
    h["Vary"]="Origin";
  }
  return h;
}
function writeJson(status,body,origin=""){
  return new Response(JSON.stringify(body),{status:Number(status)||200,headers:corsHeaders(origin)});
}
async function requireAdmin(request){
  const match=/^Bearer\s+(.+)$/i.exec(header(request,"authorization").trim());
  if(!match)throw Object.assign(new Error("Bạn cần đăng nhập Admin."),{status:401,code:"missing_admin_token"});
  const {admin}=await import("./_firebase-admin.js");
  const {auth,db}=admin();
  let decoded;
  try{
    decoded=await auth.verifyIdToken(match[1],true);
  }catch(error){
    const code=String(error?.code||"auth_error");
    const message=code==="auth/id-token-expired"||code==="auth/id-token-revoked"
      ?"Phiên Admin đã hết hạn. Hãy tải lại trang và đăng nhập lại."
      :"Không xác thực được phiên Admin trên máy chủ: "+String(error?.message||code);
    throw Object.assign(new Error(message),{status:401,code});
  }
  if(String(decoded.email||"").toLowerCase()!=="katlearn.admin@gmail.com"){
    throw Object.assign(new Error("Tài khoản không có quyền Admin."),{status:403,code:"admin_forbidden"});
  }
  return{auth,db,decoded};
}

const LIMITS={users:300,teachers:300,classes:300,packs:300,schools:300,pending:100,activity:100};
const DATA_DIR=new URL("../data/national-catalog/",import.meta.url);
const CATALOG_FILE=new URL("full-school-tree.json",DATA_DIR);
const CATALOG_CHUNK_MAX=250;
let catalogTreeCache=null;
const TOTAL_SCHOOLS=22850;
const PROVINCES=[
  ["01","Thành phố Hà Nội",2828],["04","Tỉnh Cao Bằng",150],["08","Tỉnh Tuyên Quang",300],
  ["11","Tỉnh Điện Biên",182],["12","Tỉnh Lai Châu",137],["14","Tỉnh Sơn La",278],
  ["15","Tỉnh Lào Cai",216],["19","Tỉnh Thái Nguyên",261],["20","Tỉnh Lạng Sơn",200],
  ["22","Tỉnh Quảng Ninh",266],["24","Tỉnh Bắc Ninh",1039],["25","Tỉnh Phú Thọ",759],
  ["31","Thành phố Hải Phòng",1041],["33","Tỉnh Hưng Yên",548],["37","Tỉnh Ninh Bình",1178],
  ["38","Tỉnh Thanh Hóa",2002],["40","Tỉnh Nghệ An",372],["42","Tỉnh Hà Tĩnh",444],
  ["44","Tỉnh Quảng Trị",290],["46","Thành phố Huế",383],["48","Thành phố Đà Nẵng",550],
  ["51","Tỉnh Quảng Ngãi",127],["52","Tỉnh Gia Lai",261],["56","Tỉnh Khánh Hòa",296],
  ["66","Tỉnh Đắk Lắk",616],["68","Tỉnh Lâm Đồng",1021],["75","Tỉnh Đồng Nai",691],
  ["79","Thành phố Hồ Chí Minh",2382],["80","Tỉnh Tây Ninh",406],["82","Tỉnh Đồng Tháp",275],
  ["86","Tỉnh Vĩnh Long",723],["91","Tỉnh An Giang",1322],["92","Thành phố Cần Thơ",713],
  ["96","Tỉnh Cà Mau",593]
];
const PROVINCE_MAP=new Map(PROVINCES.map(([code,name,total])=>[code,{code,name,total}]));
const USER_FIELDS=["displayName","name","email","role","schoolName","className","accountCode","coins","energy","streak","province","ward","teacherVerification","createdAt","updatedAt","disabled","schoolId","classIds","catalogClassId","studentAccountType"];
const CLASS_FIELDS=["name","grade","description","teacherEmail","teacherUid","schoolName","schoolId","joinCode","studentCount","createdAt","updatedAt","province","ward","catalogClassId","deletingAt"];
const PACK_FIELDS=["name","createdBy","createdByEmail","createdByUid","createdAt","updatedAt","wordCount"];
const SCHOOL_FIELDS=["name","province","ward","schoolId","schoolLevel","createdAt","updatedAt","source","provinceId","wardId"];

function messageOf(error,fallback="Lỗi Admin"){
  if(error==null)return fallback;
  if(typeof error==="string")return error;
  if(error instanceof Error&&error.message)return error.message;
  if(typeof error?.message==="string"&&error.message)return error.message;
  if(typeof error?.error==="string")return error.error;
  if(typeof error?.error?.message==="string")return error.error.message;
  try{
    const value=JSON.stringify(error);
    if(value&&value!=="{}")return value;
  }catch(_){}
  return String(error);
}
function serialize(value){
  if(value&&typeof value.toMillis==="function")return value.toMillis();
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==="object"){
    const out={};
    for(const[k,v]of Object.entries(value))out[k]=serialize(v);
    return out;
  }
  return value;
}
function rows(snapshot){return snapshot.docs.map(doc=>({id:doc.id,...serialize(doc.data()||{})}))}

async function activeClassProfile(db,ids){
 let active=null;const teacherUids=[];
 for(const id of Array.isArray(ids)?ids.slice(0,50):[]){
  const classId=clean(id,160);
  if(!classId)continue;
  const classSnap=await db.collection("classes").doc(classId).get();
  if(!classSnap.exists)continue;
  const cls=classSnap.data()||{},teacherUid=clean(cls.teacherUid,160);
  if(teacherUid&&!teacherUids.includes(teacherUid))teacherUids.push(teacherUid);
  if(active)continue;
  let teacher={};
  if(teacherUid){
   const teacherSnap=await db.collection("users").doc(teacherUid).get();
   teacher=teacherSnap.exists?teacherSnap.data()||{}:{};
  }
  active={
   classId,
   className:clean(cls.name),
   schoolId:clean(cls.schoolId),
   schoolName:clean(cls.schoolName)||clean(teacher.schoolName),
   province:clean(cls.province)||clean(teacher.province),
   ward:clean(cls.ward)||clean(teacher.ward),
   teacherUid,
   teacherName:clean(teacher.displayName)||clean(cls.teacherName),
   teacherEmail:clean(teacher.email,320).toLowerCase()||clean(cls.teacherEmail,320).toLowerCase()
  };
 }
 return active?{...active,teacherUids}:{classId:"",className:"",schoolId:"",schoolName:"",province:"",ward:"",teacherUid:"",teacherName:"",teacherEmail:"",teacherUids:[]};
}
function fail(error,status=502,code="admin_backend_error"){
  const out=new Error(messageOf(error));
  out.status=Number(error?.status||error?.statusCode)||status;
  out.code=error?.code||code;
  out.details=typeof error==="object"&&error!==null?serialize(error):undefined;
  return out;
}
async function count(label,query){
  try{return Number((await query.count().get()).data()?.count||0)}
  catch(error){const e=fail(error,502,"count_failed");e.label=label;throw e}
}
async function list(label,query){
  try{return rows(await query.get())}
  catch(error){const e=fail(error,502,"query_failed");e.label=label;throw e}
}
async function safeCount(label,query,warnings){
  try{return await count(label,query)}
  catch(error){warnings.push({type:"count",label,message:messageOf(error)});return null}
}
async function safeList(label,query,warnings){
  try{return await list(label,query)}
  catch(error){warnings.push({type:"query",label,message:messageOf(error)});return []}
}
function plan(){
  return{
    provinces:PROVINCES.map(([code,name,total])=>({code,name,total})),
    totalSchools:TOTAL_SCHOOLS,
    totalProvinces:PROVINCES.length,
    version:"2026-09-27"
  };
}
function normalizeCatalogText(value){
  return String(value??"").normalize("NFC").replace(/\s+/g," ").trim();
}
function detectSchoolLevel(name){
  const value=normalizeCatalogText(name).toLowerCase();
  const primary=/\btiểu học\b/.test(value)||/\bth[-,\s&/]*thcs?\b/.test(value)&&!/(thpt|trung học phổ thông)/.test(value);
  const middle=/\bthcs\b|trung học cơ sở/.test(value);
  const high=/\bthpt\b|trung học phổ thông/.test(value);
  const levels=[primary,middle,high].filter(Boolean).length;
  if(levels>1)return"combined";
  if(high)return"high";
  if(middle)return"middle";
  if(primary)return"primary";
  return"combined";
}
function readCatalogTree(){
  if(catalogTreeCache)return catalogTreeCache;
  try{
    const value=JSON.parse(fs.readFileSync(CATALOG_FILE,"utf8"));
    if(!Array.isArray(value))throw new Error("Tệp full-school-tree.json không phải mảng.");
    catalogTreeCache=value;
    return value;
  }catch(error){
    throw fail(
      new Error("Không đọc được nguồn catalog quốc gia: "+messageOf(error)),
      500,
      "catalog_read_failed"
    );
  }
}
function readProvince(code){
  const meta=PROVINCE_MAP.get(String(code));
  if(!meta)throw fail(new Error("Mã tỉnh/thành không hợp lệ."),400,"bad_province");
  const tree=readCatalogTree();
  const province=tree.find(item=>
    normalizeCatalogText(item?.name).toLowerCase()===normalizeCatalogText(meta.name).toLowerCase()
  );
  if(!province)throw fail(
    new Error("Không tìm thấy tỉnh/thành trong nguồn catalog: "+meta.name),
    404,
    "catalog_province_not_found"
  );
  const rows=[];
  for(const ward of Array.isArray(province.wards)?province.wards:[]){
    const wardName=normalizeCatalogText(ward?.name);
    const wardId=normalizeCatalogText(ward?.id);
    for(const school of Array.isArray(ward?.schools)?ward.schools:[]){
      const schoolId=normalizeCatalogText(school?.id);
      const name=normalizeCatalogText(school?.name);
      if(!schoolId||!name)continue;
      rows.push({
        provinceCode:meta.code,
        provinceName:meta.name,
        wardName,
        wardId,
        sourceSchoolId:schoolId,
        name,
        level:detectSchoolLevel(name)
      });
    }
  }
  if(rows.length!==meta.total){
    throw fail(
      new Error("Dữ liệu catalog lệch kế hoạch tại "+meta.name+" · kế hoạch "+meta.total+" · nguồn "+rows.length+" trường."),
      409,
      "catalog_plan_mismatch"
    );
  }
  return rows;
}
function catalogSchoolId(value){
  return "sch_"+crypto.createHash("sha256").update(String(value)).digest("hex").slice(0,28);
}
async function readExistingCatalogRefs(db,rows){
  const checks=[];
  for(const row of rows){
    const id=catalogSchoolId(row.provinceCode+"|"+row.sourceSchoolId+"|"+String(row.name||"").trim().toLowerCase());
    checks.push({row,id,type:"catalog",ref:db.collection("KatLearn_TRUONGHOC_1").doc(id)});
    checks.push({row,id,type:"school",ref:db.collection("schools").doc(id)});
  }
  const snapshots=[];
  const batchSize=100;
  for(let i=0;i<checks.length;i+=batchSize){
    const batch=checks.slice(i,i+batchSize);
    const values=await db.getAll(...batch.map(x=>x.ref));
    for(let j=0;j<values.length;j++)snapshots.push({check:batch[j],snapshot:values[j]});
  }
  const existing=new Map();
  for(const item of snapshots){
    if(!item.snapshot.exists)continue;
    const key=item.check.id;
    const value=existing.get(key)||{catalog:false,school:false};
    value[item.check.type]=true;
    existing.set(key,value);
  }
  return existing;
}
async function writeCatalogChunk(db,items,{writeProvince=false}={}){
  if(!items.length)return{writes:0,schools:0,added:0,skipped:0};
  const existing=await readExistingCatalogRefs(db,items);
  const writer=db.bulkWriter();
  let writes=0,added=0,skipped=0;
  writer.onWriteResult(()=>{writes++});
  writer.onWriteError(error=>{
    console.error("[KatLearn admin catalog]",error);
    return error.failedAttempts<3;
  });
  const meta=PROVINCE_MAP.get(String(items[0].provinceCode));
  if(writeProvince&&meta)writer.set(db.collection("KatLearn_TINHTHANH_1").doc(meta.code),{
    provinceId:meta.code,code:meta.code,name:meta.name,schoolCount:meta.total,
    source:"national_catalog_2026",updatedAt:Date.now()
  },{merge:true});
  const now=Date.now();
  for(const row of items){
    const id=catalogSchoolId(row.provinceCode+"|"+row.sourceSchoolId+"|"+String(row.name||"").trim().toLowerCase());
    const found=existing.get(id)||{catalog:false,school:false};
    if(found.catalog&&found.school){
      skipped++;
      continue;
    }
    added++;
    const school={
      name:row.name,schoolId:id,province:row.provinceName,provinceId:row.provinceCode,
      ward:row.wardName,wardId:row.wardId,sourceSchoolId:row.sourceSchoolId,
      schoolLevel:row.level,source:"national_catalog_2026",
      sourceType:"national_catalog",catalogManaged:true,updatedAt:now
    };
    if(!found.catalog)writer.set(db.collection("KatLearn_TRUONGHOC_1").doc(id),school,{merge:true});
    if(!found.school)writer.set(db.collection("schools").doc(id),school,{merge:true});
  }
  try{await writer.close()}
  catch(error){throw fail(error,502,"catalog_write_failed")}
  return{writes,schools:items.length,added,skipped};
}
async function audit(db,decoded,action,target,extra={}){
  try{
    const id=Date.now()+"_"+crypto.randomBytes(5).toString("hex");
    await db.collection("adminAudit").doc(id).set({
      action,target,adminUid:decoded.uid,adminEmail:String(decoded.email||"").toLowerCase(),
      at:Date.now(),...serialize(extra)
    });
  }catch(error){console.error("[KatLearn admin audit]",messageOf(error))}
}
async function teacherChange(db,decoded,uid,mode){
 uid=clean(uid,160);
 if(!uid)throw fail(new Error("Thiếu UID giáo viên."),400,"missing_uid");
 const ref=db.collection("users").doc(uid);
 const snapshot=await ref.get();
 if(!snapshot.exists)throw fail(new Error("Không tìm thấy hồ sơ giáo viên."),404,"teacher_not_found");
 const profile=snapshot.data()||{};
 const verification=profile.teacherVerification||{};
 if(String(profile.role||"")!=="pending_teacher_verification"){
  throw fail(new Error("Chỉ hồ sơ đang chờ xác minh mới có thể được duyệt hoặc từ chối."),409,"teacher_not_pending");
 }
 if(mode==="reject"){
  if(String(profile.role||"")!=="pending_teacher_verification"){
    throw fail(new Error("Chỉ hồ sơ đang chờ xác minh mới có thể bị từ chối."),409,"teacher_not_pending");
  }
  await ref.set({
   role:"teacher_rejected",
   teacherVerification:{...verification,status:"rejected",rejectedAt:Date.now(),rejectedBy:decoded.uid},
   updatedAt:Date.now()
  },{merge:true});
  await audit(db,decoded,"teacher.reject",uid);
  return{uid,status:"rejected"};
 }

 let schoolId=clean(profile.schoolId),schoolName=clean(profile.schoolName);
 const province=clean(profile.province),ward=clean(profile.ward);
 const requestedSchoolName=clean(verification.requestedSchoolName);
 const requestedClassName=clean(verification.requestedClassName);

 if(schoolId){
  const school=await db.collection("schools").doc(schoolId).get();
  if(!school.exists||clean(school.data()?.province)!==province||clean(school.data()?.ward)!==ward){
   schoolId="";
  }else{
   schoolName=clean(school.data()?.name)||schoolName;
  }
 }
 if(!schoolId&&requestedSchoolName){
  const same=await db.collection("schools").where("name","==",requestedSchoolName).limit(20).get();
  const existing=same.docs.map(d=>({id:d.id,...d.data()})).find(x=>clean(x.province)===province&&clean(x.ward)===ward);
  if(existing){
   schoolId=existing.id;
   schoolName=clean(existing.name)||requestedSchoolName;
  }else{
   const created=await db.collection("schools").add({
    name:requestedSchoolName,province,ward,createdBy:uid,createdAt:Date.now(),updatedAt:Date.now()
   });
   schoolId=created.id;
   schoolName=requestedSchoolName;
  }
 }
 if(!schoolId)throw fail(new Error("Hồ sơ chưa có trường hợp lệ."),400,"teacher_school_missing");

 await db.collection("KatLearn_Teacher_Schools").doc(schoolId).set({
  name:schoolName,schoolId,province,ward,source:"teacher_verification",updatedAt:Date.now()
 },{merge:true});

 const classIds=Array.isArray(profile.classIds)
  ?[...new Set(profile.classIds.map(x=>clean(x,160)).filter(Boolean))].slice(0,20)
  :[];
 const valid=[];
 const classData=new Map();

 for(const classId of classIds){
  const topRef=db.collection("classes").doc(classId);
  const top=await topRef.get();
  if(top.exists){
   const data=top.data()||{};
   if(clean(data.schoolId)===schoolId){
    const owner=clean(data.teacherUid,160);
    if(owner&&owner!==uid)throw fail(new Error("Một lớp trong hồ sơ này đã thuộc giáo viên khác."),409,"teacher_class_conflict");
    valid.push(classId);
    classData.set(classId,{...data});
   }else{
    const nestedRef=db.collection("schools").doc(schoolId).collection("classes").doc(classId);
    const nested=await nestedRef.get();
    if(nested.exists&&clean(nested.data()?.schoolId||schoolId)===schoolId){
     const nestedData=nested.data()||{},owner=clean(nestedData.teacherUid,160);
     if(owner&&owner!==uid)throw fail(new Error("Một lớp trong hồ sơ này đã thuộc giáo viên khác."),409,"teacher_class_conflict");
     valid.push(classId);
     classData.set(classId,{...nestedData});
    }
   }
   continue;
  }
  const nestedRef=db.collection("schools").doc(schoolId).collection("classes").doc(classId);
  const nested=await nestedRef.get();
  if(nested.exists&&clean(nested.data()?.schoolId||schoolId)===schoolId){
   const nestedData=nested.data()||{},owner=clean(nestedData.teacherUid,160);
   if(owner&&owner!==uid)throw fail(new Error("Một lớp trong hồ sơ này đã thuộc giáo viên khác."),409,"teacher_class_conflict");
   valid.push(classId);
   classData.set(classId,{...nestedData});
  }
 }

 if(!valid.length&&requestedClassName){
  const topMatches=await db.collection("classes").where("name","==",requestedClassName).limit(20).get();
  const topExisting=topMatches.docs.map(d=>({id:d.id,...d.data()}))
   .find(x=>clean(x.schoolId)===schoolId);
  if(topExisting){
   const owner=clean(topExisting.teacherUid,160);
   if(owner&&owner!==uid)throw fail(new Error("Lớp này đã thuộc một giáo viên khác."),409,"teacher_class_conflict");
   valid.push(topExisting.id);
   classData.set(topExisting.id,{...topExisting});
  }else{
   const sameClass=await db.collection("schools").doc(schoolId).collection("classes")
    .where("name","==",requestedClassName).limit(5).get();
   if(sameClass.docs[0]){
    const d=sameClass.docs[0],data=d.data()||{},owner=clean(data.teacherUid,160);
    if(owner&&owner!==uid)throw fail(new Error("Lớp này đã thuộc một giáo viên khác."),409,"teacher_class_conflict");
    valid.push(d.id);
    classData.set(d.id,{...data});
   }else{
    const created=await db.collection("schools").doc(schoolId).collection("classes").add({
     name:requestedClassName,
     createdBy:uid,
     teacherUid:uid,
     schoolId,
     schoolName,
     province,
     ward,
     createdAt:Date.now(),
     updatedAt:Date.now()
    });
    valid.push(created.id);
    classData.set(created.id,{
     name:requestedClassName,createdBy:uid,teacherUid:uid,schoolId,schoolName,province,ward,
     createdAt:Date.now(),updatedAt:Date.now()
    });
   }
  }
 }

 if(!valid.length)throw fail(new Error("Hồ sơ chưa có lớp hợp lệ."),400,"teacher_class_missing");

 const catalogClassId=clean(
  valid.includes(profile.catalogClassId)?profile.catalogClassId:valid[0]
 );

 for(const classId of valid){
  const now=Date.now();
  const base=classData.get(classId)||{};
  const classRecord={
   ...base,
   classId,
   schoolId,
   schoolName,
   province,
   ward,
   teacherUid:uid,
   teacherEmail:clean(profile.email,320),
   updatedAt:now
  };
  await db.collection("schools").doc(schoolId).collection("classes").doc(classId)
   .set(classRecord,{merge:true});
  await db.collection("classes").doc(classId).set(classRecord,{merge:true});
 }

 await ref.set({
  role:"teacher",
  schoolId,
  schoolName,
  province,
  ward,
  classIds:valid,
  catalogClassId,
  teacherVerification:{
   ...verification,
   status:"verified",
   verifiedAt:Date.now(),
   verifiedBy:decoded.uid
  },
  updatedAt:Date.now()
 },{merge:true});

 await audit(db,decoded,"teacher.verify",uid,{schoolId,classIds:valid});
 return{uid,status:"verified",schoolId,schoolName,province,ward,classIds:valid,catalogClassId};
}
async function deletePack(db,decoded,packId){
 packId=clean(packId,160);
 if(!packId)throw fail(new Error("Thiếu ID bộ từ."),400,"missing_pack_id");
 const ref=db.collection("publicPacks").doc(packId);
 const snap=await ref.get();
 if(!snap.exists)throw fail(new Error("Không tìm thấy bộ từ."),404,"pack_not_found");

 let deletedAssignments=0;
 for(let pass=0;pass<10000;pass++){
  const assignments=await db.collection("packAssignments")
   .where("packId","==",packId)
   .limit(400)
   .get();
  if(assignments.empty)break;
  const batch=db.batch();
  for(const doc of assignments.docs)batch.delete(doc.ref);
  await batch.commit();
  deletedAssignments+=assignments.size;
  if(assignments.size<400)break;
  if(pass===9999)throw fail(new Error("Không thể dọn hết assignment của bộ từ trong giới hạn an toàn."),504,"pack_assignment_cleanup_limit");
 }

 await db.recursiveDelete(ref);
 await audit(db,decoded,"pack.delete",packId,{
  name:snap.data()?.name||"",
  deletedAssignments
 });
 return{packId,deletedAssignments};
}

async function renameUser(db,auth,decoded,uid,name){
  uid=clean(uid,160);
  name=clean(name,120);
  if(!uid)throw fail(new Error("Thiếu UID tài khoản."),400,"missing_uid");
  if(!name)throw fail(new Error("Tên hiển thị không được để trống."),400,"invalid_display_name");
  const ref=db.collection("users").doc(uid),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy tài khoản."),404,"user_not_found");
  const profile=snap.data()||{};
  if(String(profile.email||"").toLowerCase()==="katlearn.admin@gmail.com")throw fail(new Error("Không thể sửa tài khoản Admin hệ thống bằng thao tác này."),403,"admin_protected");
  let authUser;
  try{authUser=await auth.getUser(uid)}
  catch(error){throw fail(error,502,"auth_lookup_failed")}
  const previousAuthName=authUser.displayName||"";
  try{
   await auth.updateUser(uid,{displayName:name});
   await ref.set({displayName:name,name,updatedAt:Date.now()},{merge:true});
  }catch(error){
   try{await auth.updateUser(uid,{displayName:previousAuthName||null})}catch(_){}
   throw fail(error,502,"user_rename_failed");
  }
  let syncedMembers=0;
  try{
   const memberDocs=await db.collectionGroup("members").where("uid","==",uid).get();
   for(let i=0;i<memberDocs.docs.length;i+=400){
    const batch=db.batch();
    memberDocs.docs.slice(i,i+400).forEach(doc=>batch.set(doc.ref,{displayName:name,updatedAt:Date.now()},{merge:true}));
    const chunkSize=memberDocs.docs.slice(i,i+400).length;
    if(chunkSize){await batch.commit();syncedMembers+=chunkSize}
   }
  }catch(error){
   console.warn("[KatLearn admin rename-user member sync]",messageOf(error));
  }
  await audit(db,decoded,"user.rename",uid,{displayName:name,syncedMembers});
  return{uid,displayName:name,syncedMembers};
}

async function setUserDisabled(db,auth,decoded,uid,disabled){
  uid=clean(uid,160);
  if(!uid)throw fail(new Error("Thiếu UID tài khoản."),400,"missing_uid");
  const ref=db.collection("users").doc(uid),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy tài khoản."),404,"user_not_found");
  const profile=snap.data()||{},email=String(profile.email||"").toLowerCase();
  if(email==="katlearn.admin@gmail.com")throw fail(new Error("Không thể khóa tài khoản Admin hệ thống."),403,"admin_protected");
  const nextDisabled=Boolean(disabled);
  let authUser;
  try{authUser=await auth.getUser(uid)}
  catch(error){throw fail(error,502,"auth_lookup_failed")}
  const previousDisabled=Boolean(authUser.disabled);
  try{await auth.updateUser(uid,{disabled:nextDisabled})}
  catch(error){throw fail(error,502,"auth_update_failed")}
  try{
   await ref.set({disabled:nextDisabled,updatedAt:Date.now()},{merge:true});
  }catch(error){
   try{await auth.updateUser(uid,{disabled:previousDisabled})}catch(_){}
   throw fail(error,502,"user_status_sync_failed");
  }
  await audit(db,decoded,nextDisabled?"user.disable":"user.enable",uid,{email});
  return{uid,disabled:nextDisabled};
}

async function resetUserStats(db,decoded,uid){
  uid=clean(uid,160);
  if(!uid)throw fail(new Error("Thiếu UID tài khoản."),400,"missing_uid");
  const ref=db.collection("users").doc(uid),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy tài khoản."),404,"user_not_found");
  const email=String(snap.data()?.email||"").toLowerCase();
  if(email==="katlearn.admin@gmail.com")throw fail(new Error("Không thể reset tài khoản Admin hệ thống."),403,"admin_protected");
  await ref.set({
    coins:0,energy:0,streak:0,lastStudyDay:"",
    dailyQuestions:0,dailyCorrect:0,questionsAnswered:0,correctAnswers:0,
    updatedAt:Date.now()
  },{merge:true});
  await audit(db,decoded,"user.reset_stats",uid);
  return{uid};
}

async function deleteUser(db,auth,decoded,uid){
  uid=clean(uid,160);
  if(!uid)throw fail(new Error("Thiếu UID tài khoản."),400,"missing_uid");
  const ref=db.collection("users").doc(uid),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy hồ sơ tài khoản."),404,"user_not_found");
  const profile=snap.data()||{},email=String(profile.email||"").toLowerCase();
  if(uid===decoded.uid||email==="katlearn.admin@gmail.com")throw fail(new Error("Không thể xóa tài khoản Admin hiện tại."),403,"admin_protected");
  if(String(profile.role||"").toLowerCase()==="teacher"){
   const [ownedClasses,ownedPacks,ownedNestedClasses]=await Promise.all([
    db.collection("classes").where("teacherUid","==",uid).limit(1).get(),
    db.collection("publicPacks").where("createdByUid","==",uid).limit(1).get(),
    db.collectionGroup("classes").where("teacherUid","==",uid).limit(1).get()
   ]);
   if(!ownedClasses.empty||!ownedPacks.empty||!ownedNestedClasses.empty){
    throw fail(new Error("Không thể xóa giáo viên khi tài khoản vẫn còn lớp học hoặc bộ từ do tài khoản này quản lý. Hãy xử lý các tài nguyên đó trước."),409,"teacher_owns_resources");
   }
  }
  const classIds=Array.isArray(profile.joinedClassIds)?[...new Set(profile.joinedClassIds.map(x=>clean(x,160)).filter(Boolean))]:[];
  for(let i=0;i<classIds.length;i+=150){
    const batch=db.batch();
    for(const classId of classIds.slice(i,i+150)){
      batch.delete(db.collection("classes").doc(classId).collection("members").doc(uid));
    }
    await batch.commit();
  }
  const memberDocs=[];
  try{
   const group=await db.collectionGroup("members").where("uid","==",uid).get();
   for(const doc of group.docs)memberDocs.push(doc);
  }catch(error){
   console.warn("[KatLearn admin delete-user member lookup]",messageOf(error));
  }
  const memberPaths=new Set(memberDocs.map(doc=>doc.ref.path));
  for(const classId of classIds){
   const refPath=db.collection("classes").doc(classId).collection("members").doc(uid);
   if(!memberPaths.has(refPath.path))memberDocs.push({ref:refPath,id:uid,__fallback:true});
  }
  const memberClassIds=[...new Set(memberDocs.map(doc=>doc.ref.parent.parent?.id).filter(Boolean))];
  for(let i=0;i<memberDocs.length;i+=400){
   const batch=db.batch();
   memberDocs.slice(i,i+400).forEach(doc=>batch.delete(doc.ref));
   if(memberDocs.slice(i,i+400).length)await batch.commit();
  }
  for(const memberClassId of memberClassIds){
   const classRef=db.collection("classes").doc(memberClassId);
   const classSnap=await classRef.get();
   if(!classSnap.exists)continue;
   const countSnap=await classRef.collection("members").count().get();
   await classRef.set({studentCount:Number(countSnap.data()?.count||0),updatedAt:Date.now()},{merge:true});
  }

  let updatedAssignments=0;
  for(let pass=0;pass<10000;pass++){
   const assignmentSnap=await db.collection("packAssignments").where("studentUids","array-contains",uid).limit(400).get();
   if(assignmentSnap.empty)break;
   const batch=db.batch();
   for(const doc of assignmentSnap.docs){
    const data=doc.data()||{};
    const studentUids=Array.isArray(data.studentUids)?data.studentUids.filter(x=>x!==uid):[];
    batch.set(doc.ref,{studentUids,studentCount:studentUids.length,updatedAt:Date.now()},{merge:true});
   }
   await batch.commit();
   updatedAssignments+=assignmentSnap.size;
   if(assignmentSnap.size<400)break;
   if(pass===9999)throw fail(new Error("Không thể dọn hết assignment của tài khoản trong giới hạn an toàn."),504,"user_assignment_cleanup_limit");
  }
  try{await auth.deleteUser(uid)}
  catch(error){
    const code=String(error?.code||"");
    if(code!=="auth/user-not-found")throw fail(error,502,"auth_delete_failed");
  }
  await db.recursiveDelete(ref);
  let deletedAccounts=0;
  for(let pass=0;pass<10000;pass++){
   const accountSnap=await db.collection("accounts").where("uid","==",uid).limit(400).get();
   if(accountSnap.empty)break;
   const batch=db.batch();
   for(const doc of accountSnap.docs)batch.delete(doc.ref);
   await batch.commit();
   deletedAccounts+=accountSnap.size;
   if(accountSnap.size<400)break;
   if(pass===9999)throw fail(new Error("Không thể dọn hết account liên kết trong giới hạn an toàn."),504,"account_cleanup_limit");
  }
  await audit(db,decoded,"user.delete",uid,{email,removedClassMemberships:memberDocs.length,updatedAssignments,deletedAccounts});
  return{uid,removedClassMemberships:memberDocs.length,updatedAssignments,deletedAccounts};
}

async function renameClass(db,decoded,classId,name,grade,description){
  classId=clean(classId,160);
  name=clean(name,160);
  grade=clean(grade,30);
  description=clean(description,500);
  if(!classId)throw fail(new Error("Thiếu ID lớp."),400,"missing_class_id");
  if(!name)throw fail(new Error("Tên lớp không được để trống."),400,"invalid_class_name");
  const ref=db.collection("classes").doc(classId),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy lớp."),404,"class_not_found");
  const current=snap.data()||{};
  if(current.deletingAt)throw fail(new Error("Lớp đang được xóa, không thể chỉnh sửa."),409,"class_deleting");
  const patch={name,grade,description,updatedAt:Date.now()};
  await ref.set(patch,{merge:true});
  if(current.schoolId){
    await db.collection("schools").doc(String(current.schoolId)).collection("classes").doc(classId).set(patch,{merge:true});
  }
  const catalogRef=db.collection("KatLearn_LOPHOC_1").doc(classId),catalogSnap=await catalogRef.get();
  if(catalogSnap.exists&&catalogSnap.data()?.isTemplate!==true)await catalogRef.set(patch,{merge:true});

  const members=await ref.collection("members").get();
  for(let offset=0;offset<members.docs.length;offset+=150){
   const chunk=members.docs.slice(offset,offset+150);
   const profiles=await Promise.all(chunk.map(async member=>{
    const studentRef=db.collection("users").doc(member.id);
    const studentSnap=await studentRef.get();
    return{member,studentRef,student:studentSnap.exists?studentSnap.data()||{}:null};
   }));
   const batch=db.batch();
   for(const x of profiles){
    batch.set(x.member.ref,{className:name,grade,schoolName:clean(current.schoolName),province:clean(current.province),ward:clean(current.ward),updatedAt:Date.now()},{merge:true});
    if(x.student&&clean(x.student.classId)===classId){
     batch.set(x.studentRef,{className:name,updatedAt:Date.now()},{merge:true});
    }
   }
   if(profiles.length)await batch.commit();
  }
  await audit(db,decoded,"class.update",classId,{name,grade});
  return{classId,name,grade,description};
}

async function deleteClass(db,decoded,classId){
  classId=clean(classId,160);
  if(!classId)throw fail(new Error("Thiếu ID lớp."),400,"missing_class_id");
  const ref=db.collection("classes").doc(classId),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy lớp."),404,"class_not_found");
  const current=snap.data()||{};
  const schoolId=clean(current.schoolId,160),teacherUid=clean(current.teacherUid,160);
  const members=await ref.collection("members").get();
  for(let offset=0;offset<members.docs.length;offset+=150){
    const chunk=members.docs.slice(offset,offset+150),batch=db.batch();
    const profiles=await Promise.all(chunk.map(async member=>{
      const studentRef=db.collection("users").doc(member.id);
      const s=await studentRef.get();
      return{ref:member.ref,studentRef,data:s.exists?s.data()||{}:null};
    }));
    for(const x of profiles){
      batch.delete(x.ref);
      if(x.data){
       const ids=Array.isArray(x.data.joinedClassIds)?x.data.joinedClassIds.filter(id=>id!==classId):[];
       const active=await activeClassProfile(db,ids);
       batch.set(x.studentRef,{joinedClassIds:ids,studentAccountType:ids.length?"class":"free",...active,updatedAt:Date.now()},{merge:true});
      }
    }
    await batch.commit();
  }
  const invites=await db.collection("classInvites").where("classId","==",classId).get();
  const assignments=await db.collection("packAssignments").where("classId","==",classId).get();
  for(let i=0;i<Math.max(invites.size,assignments.size);i+=200){
    const batch=db.batch();
    invites.docs.slice(i,i+200).forEach(x=>batch.delete(x.ref));
    assignments.docs.slice(i,i+200).forEach(x=>batch.delete(x.ref));
    if(i===0){
      batch.delete(ref);
      if(schoolId)batch.delete(db.collection("schools").doc(schoolId).collection("classes").doc(classId));
      const catalogRef=db.collection("KatLearn_LOPHOC_1").doc(classId);
      if((await catalogRef.get()).data()?.isTemplate!==true)batch.delete(catalogRef);
      if(teacherUid){
        const teacherRef=db.collection("users").doc(teacherUid),teacherSnap=await teacherRef.get();
        if(teacherSnap.exists){
          const teacher=teacherSnap.data()||{},ids=Array.isArray(teacher.classIds)?teacher.classIds.filter(id=>id!==classId):[];
          const nextCatalog=clean(teacher.catalogClassId,160)===classId?(ids[0]||""):clean(teacher.catalogClassId,160);
          batch.set(teacherRef,{classIds:ids,catalogClassId:nextCatalog,updatedAt:Date.now()},{merge:true});
        }
      }
    }
    await batch.commit();
  }
  if(invites.empty&&assignments.empty){
    const batch=db.batch();
    batch.delete(ref);
    if(schoolId)batch.delete(db.collection("schools").doc(schoolId).collection("classes").doc(classId));
    const catalogRef=db.collection("KatLearn_LOPHOC_1").doc(classId);
    if((await catalogRef.get()).data()?.isTemplate!==true)batch.delete(catalogRef);
    if(teacherUid){
      const teacherRef=db.collection("users").doc(teacherUid),teacherSnap=await teacherRef.get();
      if(teacherSnap.exists){
        const ids=Array.isArray(teacherSnap.data()?.classIds)?teacherSnap.data().classIds.filter(id=>id!==classId):[];
        batch.set(teacherRef,{classIds:ids,updatedAt:Date.now()},{merge:true});
      }
    }
    await batch.commit();
  }
  await audit(db,decoded,"class.delete",classId,{schoolId,teacherUid,members:members.size,assignments:assignments.size});
  return{classId,deletedMembers:members.size,deletedAssignments:assignments.size};
}

async function updateSchool(db,decoded,schoolId,name,province,ward,schoolLevel){
  schoolId=clean(schoolId,160);name=clean(name,200);province=clean(province,160);ward=clean(ward,160);schoolLevel=clean(schoolLevel,40);
  if(!schoolId)throw fail(new Error("Thiếu ID trường."),400,"missing_school_id");
  if(!name)throw fail(new Error("Tên trường không được để trống."),400,"invalid_school_name");
  const ref=db.collection("schools").doc(schoolId),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy trường."),404,"school_not_found");
  const current=snap.data()||{};
  if(String(current.source||"").startsWith("thanhtungct7")||String(current.sourceType||"").includes("national")){
    throw fail(new Error("Không sửa trực tiếp trường thuộc National Catalog. Hãy cập nhật từ Catalog."),409,"catalog_school_protected");
  }
  const patch={name,province,ward,schoolLevel,updatedAt:Date.now()};
  await ref.set(patch,{merge:true});
  await db.collection("KatLearn_Teacher_Schools").doc(schoolId).set({name,province,ward,schoolLevel,updatedAt:Date.now()},{merge:true});

  const relatedUsers=await db.collection("users").where("schoolId","==",schoolId).get();
  for(let i=0;i<relatedUsers.docs.length;i+=400){
   const batch=db.batch();
   relatedUsers.docs.slice(i,i+400).forEach(doc=>batch.set(doc.ref,{schoolName:name,province,ward,updatedAt:Date.now()},{merge:true}));
   if(relatedUsers.docs.slice(i,i+400).length)await batch.commit();
  }
  const relatedClasses=await db.collection("classes").where("schoolId","==",schoolId).get();
  for(let i=0;i<relatedClasses.docs.length;i+=400){
   const batch=db.batch();
   relatedClasses.docs.slice(i,i+400).forEach(doc=>batch.set(doc.ref,{schoolName:name,province,ward,updatedAt:Date.now()},{merge:true}));
   if(relatedClasses.docs.slice(i,i+400).length)await batch.commit();
  }
  const nestedClasses=await ref.collection("classes").get();
  for(let i=0;i<nestedClasses.docs.length;i+=400){
   const batch=db.batch();
   nestedClasses.docs.slice(i,i+400).forEach(doc=>batch.set(doc.ref,{schoolName:name,province,ward,updatedAt:Date.now()},{merge:true}));
   if(nestedClasses.docs.slice(i,i+400).length)await batch.commit();
  }

  let syncedMembers=0;
  const schoolMemberDocs=await db.collectionGroup("members").where("schoolId","==",schoolId).get();
  for(let i=0;i<schoolMemberDocs.docs.length;i+=400){
   const batch=db.batch();
   const chunk=schoolMemberDocs.docs.slice(i,i+400);
   chunk.forEach(doc=>batch.set(doc.ref,{schoolName:name,province,ward,updatedAt:Date.now()},{merge:true}));
   if(chunk.length){await batch.commit();syncedMembers+=chunk.length}
  }
  for(const classDoc of relatedClasses.docs){
   const memberDocs=await classDoc.ref.collection("members").get();
   for(let i=0;i<memberDocs.docs.length;i+=400){
    const batch=db.batch();
    const chunk=memberDocs.docs.slice(i,i+400);
    chunk.forEach(doc=>batch.set(doc.ref,{schoolName:name,province,ward,updatedAt:Date.now()},{merge:true}));
    if(chunk.length){await batch.commit();syncedMembers+=chunk.length}
   }
  }
  await audit(db,decoded,"school.update",schoolId,{name,province,ward,schoolLevel,updatedUsers:relatedUsers.size,updatedClasses:relatedClasses.size,syncedMembers});
  return{schoolId,...patch};
}

async function deleteSchool(db,decoded,schoolId){
  schoolId=clean(schoolId,160);
  if(!schoolId)throw fail(new Error("Thiếu ID trường."),400,"missing_school_id");
  const ref=db.collection("schools").doc(schoolId),snap=await ref.get();
  if(!snap.exists)throw fail(new Error("Không tìm thấy trường."),404,"school_not_found");
  const school=snap.data()||{};
  if(String(school.source||"").startsWith("thanhtungct7")||String(school.sourceType||"").includes("national")){
    throw fail(new Error("Không xóa trực tiếp trường thuộc National Catalog. Hãy xử lý từ Catalog."),409,"catalog_school_protected");
  }
  const [usersSnap,classesSnap,nestedClassesSnap]=await Promise.all([
    db.collection("users").where("schoolId","==",schoolId).limit(1).get(),
    db.collection("classes").where("schoolId","==",schoolId).limit(1).get(),
    db.collectionGroup("classes").where("schoolId","==",schoolId).limit(1).get()
  ]);
  if(!usersSnap.empty||!classesSnap.empty||!nestedClassesSnap.empty)throw fail(new Error("Không thể xóa trường đang có tài khoản hoặc lớp liên kết."),409,"school_in_use");
  const batch=db.batch();
  batch.delete(ref);
  batch.delete(db.collection("KatLearn_Teacher_Schools").doc(schoolId));
  await batch.commit();
  await audit(db,decoded,"school.delete",schoolId,{name:school.name||""});
  return{schoolId};
}

async function overview(db){
  const users=db.collection("users"),classes=db.collection("classes"),packs=db.collection("publicPacks"),schools=db.collection("schools");
  const warnings=[];
  const [
    userCount,teacherCount,studentCount,pendingCount,classCount,packCount,schoolCount,
    syncedSchoolCount,syncedProvinceCount
  ]=await Promise.all([
    safeCount("tài khoản",users,warnings),
    safeCount("giáo viên",users.where("role","==","teacher"),warnings),
    safeCount("học sinh",users.where("role","==","student"),warnings),
    safeCount("giáo viên chờ xác minh",users.where("role","==","pending_teacher_verification"),warnings),
    safeCount("lớp học",classes,warnings),
    safeCount("bộ từ công khai",packs,warnings),
    safeCount("trường ứng dụng",schools,warnings),
    safeCount("trường đã đồng bộ",db.collection("KatLearn_TRUONGHOC_1"),warnings),
    safeCount("tỉnh/thành đã đồng bộ",db.collection("KatLearn_TINHTHANH_1"),warnings)
  ]);
  const pending=await safeList(
    "hồ sơ giáo viên chờ xác minh",
    users.where("role","==","pending_teacher_verification").select(...USER_FIELDS).limit(LIMITS.pending),
    warnings
  );
  return{
    stats:{
      users:userCount,teachers:teacherCount,students:studentCount,pending:pendingCount,
      classes:classCount,packs:packCount,schools:schoolCount,
      syncedSchools:syncedSchoolCount,syncedProvinces:syncedProvinceCount
    },
    pending:pending.sort((a,b)=>Number(a.teacherVerification?.submittedAt||a.createdAt||0)-Number(b.teacherVerification?.submittedAt||b.createdAt||0)),
    catalog:plan(),
    warnings,
    degraded:warnings.length>0
  };
}
async function section(db,key){
  key=String(key||"overview");
  if(key==="overview")return overview(db);
  if(key==="catalog")return{catalog:plan()};
  if(key==="teachers"){
    const [pending,verified,rejected]=await Promise.all([
      list("giáo viên chờ xác minh",db.collection("users").where("role","==","pending_teacher_verification").select(...USER_FIELDS).limit(LIMITS.pending)),
      list("giáo viên",db.collection("users").where("role","==","teacher").select(...USER_FIELDS).limit(LIMITS.teachers)),
      list("giáo viên bị từ chối",db.collection("users").where("role","==","teacher_rejected").select(...USER_FIELDS).limit(LIMITS.pending))
    ]);
    return{
      rows:[
        ...pending.map(x=>({...x,_status:"pending"})),
        ...verified.map(x=>({...x,_status:"verified"})),
        ...rejected.map(x=>({...x,_status:"rejected"}))
      ],
      limited:pending.length>=LIMITS.pending||verified.length>=LIMITS.teachers||rejected.length>=LIMITS.pending
    };
  }
  if(key==="activity"){
    return{rows:await list("nhật ký Admin",db.collection("adminAudit").orderBy("at","desc").limit(LIMITS.activity))};
  }
  const defs={
    users:["tài khoản",db.collection("users").select(...USER_FIELDS).limit(LIMITS.users)],
    classes:["lớp học",db.collection("classes").select(...CLASS_FIELDS).limit(LIMITS.classes)],
    packs:["bộ từ công khai",db.collection("publicPacks").select(...PACK_FIELDS).limit(LIMITS.packs)],
    schools:["trường học",db.collection("schools").select(...SCHOOL_FIELDS).limit(LIMITS.schools)]
  };
  if(!defs[key])throw fail(new Error("Khu vực Admin không hợp lệ."),400,"bad_section");
  const[label,query]=defs[key];
  const data=await list(label,query);
  return{rows:data,limited:data.length>=LIMITS[key]};
}
export const runtime="nodejs";

export default async function handler(request){
    const origin=header(request,"origin");
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(origin)});
    try{
      if(request.method==="GET"){
        const{db}=await requireAdmin(request);
        const value=await section(db,queryParam(request,"section")||"overview");
        return writeJson(200,{ok:true,...value,limits:LIMITS},origin);
      }
      if(request.method!=="POST")return writeJson(405,{ok:false,error:"Method not allowed",code:"method_not_allowed"},origin);
      const{db,auth,decoded}=await requireAdmin(request);
      const body=await readJson(request);
      const action=clean(body.action,50);
      if(action==="rename-user")return writeJson(200,{ok:true,...await renameUser(db,auth,decoded,body.uid,body.name)},origin);
      if(action==="disable-user")return writeJson(200,{ok:true,...await setUserDisabled(db,auth,decoded,body.uid,true)},origin);
      if(action==="enable-user")return writeJson(200,{ok:true,...await setUserDisabled(db,auth,decoded,body.uid,false)},origin);
      if(action==="reset-user-stats")return writeJson(200,{ok:true,...await resetUserStats(db,decoded,body.uid)},origin);
      if(action==="delete-user")return writeJson(200,{ok:true,...await deleteUser(db,auth,decoded,body.uid)},origin);
      if(action==="update-class")return writeJson(200,{ok:true,...await renameClass(db,decoded,body.classId,body.name,body.grade,body.description)},origin);
      if(action==="delete-class")return writeJson(200,{ok:true,...await deleteClass(db,decoded,body.classId)},origin);
      if(action==="update-school")return writeJson(200,{ok:true,...await updateSchool(db,decoded,body.schoolId,body.name,body.province,body.ward,body.schoolLevel)},origin);
      if(action==="delete-school")return writeJson(200,{ok:true,...await deleteSchool(db,decoded,body.schoolId)},origin);
      if(action==="verify-teacher")return writeJson(200,{ok:true,...await teacherChange(db,decoded,body.uid,"verify")},origin);
      if(action==="reject-teacher")return writeJson(200,{ok:true,...await teacherChange(db,decoded,body.uid,"reject")},origin);
      if(action==="delete-pack")return writeJson(200,{ok:true,...await deletePack(db,decoded,body.packId)},origin);
      if(action==="catalog-plan")return writeJson(200,{ok:true,...plan()},origin);
      if(action==="catalog-chunk"){
        const provinceCode=clean(body.provinceCode,10);
        const data=readProvince(provinceCode);
        const offset=Math.max(0,Number(body.offset)||0);
        const limit=Math.max(1,Math.min(CATALOG_CHUNK_MAX,Number(body.limit)||CATALOG_CHUNK_MAX));
        const chunk=data.slice(offset,offset+limit);
        const result=await writeCatalogChunk(db,chunk,{writeProvince:offset===0});
        const nextOffset=offset+chunk.length;
        if(offset===0||nextOffset>=data.length){
          await audit(db,decoded,nextOffset>=data.length?"catalog.complete":"catalog.start",provinceCode,{
            offset,nextOffset,processed:chunk.length,provinceTotal:data.length
          });
        }
        return writeJson(200,{
          ok:true,provinceCode,provinceTotal:data.length,offset,nextOffset,
          done:nextOffset>=data.length,processed:chunk.length,writes:result.writes
        },origin);
      }
      return writeJson(400,{ok:false,error:"Action Admin không hợp lệ.",code:"bad_action"},origin);
    }catch(error){
      const status=Math.min(599,Math.max(400,Number(error?.status||error?.statusCode)||500));
      const code=typeof error?.code==="string"?error.code:"admin_hub_error";
      const details={
        ...(error?.label?{label:error.label}:{}),
        ...(error?.credentialEnv?{credentialEnv:error.credentialEnv}:{}),
        ...(error?.details&&typeof error.details==="object"?{details:error.details}:{})
      };
      console.error("[KatLearn admin hub]",{status,code,error:messageOf(error),details});
      return writeJson(status,{ok:false,error:messageOf(error,"Không thể xử lý Admin."),code,details},origin);
    }
  }
