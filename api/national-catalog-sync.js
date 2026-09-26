import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

const ADMIN_EMAIL='katlearn.admin@gmail.com';

const PROVINCES=[
  ['01','Thành phố Hà Nội'],['04','Tỉnh Cao Bằng'],['08','Tỉnh Tuyên Quang'],['11','Tỉnh Điện Biên'],
  ['12','Tỉnh Lai Châu'],['14','Tỉnh Sơn La'],['15','Tỉnh Lào Cai'],['19','Tỉnh Thái Nguyên'],
  ['20','Tỉnh Lạng Sơn'],['22','Tỉnh Quảng Ninh'],['24','Tỉnh Bắc Ninh'],['25','Tỉnh Phú Thọ'],
  ['31','Thành phố Hải Phòng'],['33','Tỉnh Hưng Yên'],['37','Tỉnh Ninh Bình'],['38','Tỉnh Thanh Hóa'],
  ['40','Tỉnh Nghệ An'],['42','Tỉnh Hà Tĩnh'],['44','Tỉnh Quảng Trị'],['46','Thành phố Huế'],
  ['48','Thành phố Đà Nẵng'],['51','Tỉnh Quảng Ngãi'],['52','Tỉnh Gia Lai'],['56','Tỉnh Khánh Hòa'],
  ['66','Tỉnh Đắk Lắk'],['68','Tỉnh Lâm Đồng'],['75','Tỉnh Đồng Nai'],['79','Thành phố Hồ Chí Minh'],
  ['80','Tỉnh Tây Ninh'],['82','Tỉnh Đồng Tháp'],['86','Tỉnh Vĩnh Long'],['91','Tỉnh An Giang'],
  ['92','Thành phố Cần Thơ'],['96','Tỉnh Cà Mau']
].map(([code,name])=>({code,name}));

const PROVINCE_ALIASES=new Map([
 ['Hà Nội','Thành phố Hà Nội'],['Cao Bằng','Tỉnh Cao Bằng'],['Tuyên Quang','Tỉnh Tuyên Quang'],['Hà Giang','Tỉnh Tuyên Quang'],
 ['Điện Biên','Tỉnh Điện Biên'],['Lai Châu','Tỉnh Lai Châu'],['Sơn La','Tỉnh Sơn La'],
 ['Lào Cai','Tỉnh Lào Cai'],['Yên Bái','Tỉnh Lào Cai'],['Thái Nguyên','Tỉnh Thái Nguyên'],['Bắc Kạn','Tỉnh Thái Nguyên'],
 ['Lạng Sơn','Tỉnh Lạng Sơn'],['Quảng Ninh','Tỉnh Quảng Ninh'],['Bắc Ninh','Tỉnh Bắc Ninh'],['Bắc Giang','Tỉnh Bắc Ninh'],
 ['Phú Thọ','Tỉnh Phú Thọ'],['Vĩnh Phúc','Tỉnh Phú Thọ'],['Hòa Bình','Tỉnh Phú Thọ'],
 ['Hải Phòng','Thành phố Hải Phòng'],['Hải Dương','Thành phố Hải Phòng'],
 ['Hưng Yên','Tỉnh Hưng Yên'],['Thái Bình','Tỉnh Hưng Yên'],
 ['Ninh Bình','Tỉnh Ninh Bình'],['Nam Định','Tỉnh Ninh Bình'],['Hà Nam','Tỉnh Ninh Bình'],
 ['Thanh Hóa','Tỉnh Thanh Hóa'],['Nghệ An','Tỉnh Nghệ An'],['Hà Tĩnh','Tỉnh Hà Tĩnh'],
 ['Quảng Trị','Tỉnh Quảng Trị'],['Quảng Bình','Tỉnh Quảng Trị'],
 ['Huế','Thành phố Huế'],['Thừa Thiên Huế','Thành phố Huế'],
 ['Đà Nẵng','Thành phố Đà Nẵng'],['Quảng Nam','Thành phố Đà Nẵng'],
 ['Quảng Ngãi','Tỉnh Quảng Ngãi'],['Kon Tum','Tỉnh Quảng Ngãi'],
 ['Gia Lai','Tỉnh Gia Lai'],['Bình Định','Tỉnh Gia Lai'],
 ['Khánh Hòa','Tỉnh Khánh Hòa'],['Ninh Thuận','Tỉnh Khánh Hòa'],
 ['Đắk Lắk','Tỉnh Đắk Lắk'],['Phú Yên','Tỉnh Đắk Lắk'],
 ['Lâm Đồng','Tỉnh Lâm Đồng'],['Đắk Nông','Tỉnh Lâm Đồng'],['Bình Thuận','Tỉnh Lâm Đồng'],
 ['Đồng Nai','Tỉnh Đồng Nai'],['Bình Phước','Tỉnh Đồng Nai'],
 ['Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh'],['Hồ Chí Minh','Thành phố Hồ Chí Minh'],['TP.HCM','Thành phố Hồ Chí Minh'],['Bình Dương','Thành phố Hồ Chí Minh'],['Bà Rịa - Vũng Tàu','Thành phố Hồ Chí Minh'],
 ['Tây Ninh','Tỉnh Tây Ninh'],['Long An','Tỉnh Tây Ninh'],
 ['Đồng Tháp','Tỉnh Đồng Tháp'],['Tiền Giang','Tỉnh Đồng Tháp'],
 ['Vĩnh Long','Tỉnh Vĩnh Long'],['Bến Tre','Tỉnh Vĩnh Long'],['Trà Vinh','Tỉnh Vĩnh Long'],
 ['An Giang','Tỉnh An Giang'],['Kiên Giang','Tỉnh An Giang'],
 ['Cần Thơ','Thành phố Cần Thơ'],['Hậu Giang','Thành phố Cần Thơ'],['Sóc Trăng','Thành phố Cần Thơ'],
 ['Cà Mau','Tỉnh Cà Mau'],['Bạc Liêu','Tỉnh Cà Mau']
]);

const SCHOOL_TREE_URL='https://raw.githubusercontent.com/ptnnmusicgroup-png/KatLearn.Teacher/main/data/national-catalog/full-school-tree.json';

const OFFICIAL_PROVINCES=[
  ['01','Thành phố Hà Nội'],['04','Tỉnh Cao Bằng'],['08','Tỉnh Tuyên Quang'],['11','Tỉnh Điện Biên'],
  ['12','Tỉnh Lai Châu'],['14','Tỉnh Sơn La'],['15','Tỉnh Lào Cai'],['19','Tỉnh Thái Nguyên'],
  ['20','Tỉnh Lạng Sơn'],['22','Tỉnh Quảng Ninh'],['24','Tỉnh Bắc Ninh'],['25','Tỉnh Phú Thọ'],
  ['31','Thành phố Hải Phòng'],['33','Tỉnh Hưng Yên'],['37','Tỉnh Ninh Bình'],['38','Tỉnh Thanh Hóa'],
  ['40','Tỉnh Nghệ An'],['42','Tỉnh Hà Tĩnh'],['44','Tỉnh Quảng Trị'],['46','Thành phố Huế'],
  ['48','Thành phố Đà Nẵng'],['51','Tỉnh Quảng Ngãi'],['52','Tỉnh Gia Lai'],['56','Tỉnh Khánh Hòa'],
  ['66','Tỉnh Đắk Lắk'],['68','Tỉnh Lâm Đồng'],['75','Tỉnh Đồng Nai'],['79','Thành phố Hồ Chí Minh'],
  ['80','Tỉnh Tây Ninh'],['82','Tỉnh Đồng Tháp'],['86','Tỉnh Vĩnh Long'],['91','Tỉnh An Giang'],
  ['92','Thành phố Cần Thơ'],['96','Tỉnh Cà Mau']
].map(([code,name])=>({code,name}));

const provinceCodeByName=new Map(OFFICIAL_PROVINCES.flatMap(p=>[
  [norm(p.name),p.code],
  [norm(p.name.replace(/^(Tỉnh|Thành phố)\s+/i,'')),p.code]
]));
const gradeTemplates={
  primary:['1','2','3','4','5'],
  middle:['6','7','8','9'],
  high:['10','11','12'],
  combined:['1','2','3','4','5','6','7','8','9','10','11','12']
};
function inferLevel(name){
  const n=norm(name);
  if(n.includes('thcs&thpt')||n.includes('thcs thpt')||n.includes('th&thcs')||n.includes('th-thcs')||n.includes('th thcs'))return'combined';
  if(n.includes('thpt')||n.includes('trung hoc pho thong'))return'high';
  if(n.includes('thcs')||n.includes('trung hoc co so'))return'middle';
  if(n.includes('tieu hoc')||n.includes('th ' )||n.startsWith('th-'))return'primary';
  return'combined';
}
async function fetchSchoolTree(){
  const r=await fetch(SCHOOL_TREE_URL,{headers:{'user-agent':'KatLearn-National-Catalog/2.0'}});
  if(!r.ok)throw new Error('Không tải được school tree ('+r.status+')');
  const data=await r.json();
  if(!Array.isArray(data)||data.length!==34)throw new Error('School tree không hợp lệ: cần 34 tỉnh/thành.');
  return data;
}
function flattenSchools(tree){
  const result=[];
  for(const province of tree){
    const code=provinceCodeByName.get(norm(province.name));
    if(!code)continue;
    for(const ward of (province.wards||[])){
      for(const school of (ward.schools||[])){
        const name=htmlText(school.name);
        if(!name)continue;
        result.push({
          sourceProvinceId:province.id,
          sourceProvinceName:province.name,
          provinceCode:code,
          provinceName:OFFICIAL_PROVINCES.find(p=>p.code===code)?.name||province.name,
          wardId:ward.id,
          wardName:htmlText(ward.name),
          sourceSchoolId:String(school.id||''),
          name,
          level:inferLevel(name)
        });
      }
    }
  }
  return result;
}
function writeWithLimit(items,worker,limit=20){
  const queue=[...items];
  let active=0,done=0;
  return new Promise((resolve,reject)=>{
    const next=()=>{
      if(!queue.length&&active===0)return resolve(done);
      while(active<limit&&queue.length){
        const item=queue.shift();active++;
        Promise.resolve(worker(item)).then(()=>{active--;done++;next()}).catch(reject);
      }
    }; next();
  });
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'Method not allowed'});
  try{
    const {auth,db}=admin();
    const token=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
    if(!token)return res.status(401).json({ok:false,error:'Missing Firebase ID token'});
    const decoded=await auth.verifyIdToken(token);
    if(String(decoded.email||'').toLowerCase()!==ADMIN_EMAIL)return res.status(403).json({ok:false,error:'Admin only'});

    const now=Date.now();
    const tree=await fetchSchoolTree();
    const rows=flattenSchools(tree);
    const provinceWrites=OFFICIAL_PROVINCES.map(p=>({
      id:p.code,
      data:{
        code:p.code,
        name:p.name,
        nameShort:p.name.replace(/^(Tỉnh|Thành phố)\s+/,'').trim(),
        type:p.name.startsWith('Thành phố')?'city':'province',
        source:'QuyetDinh19/2025/QD-TTg',
        catalogSource:'thanhtungct7/data-school-in-ward',
        updatedAt:now
      }
    }));
    const stats={provinces:provinceWrites.length,schools:rows.length,classes:0,wards:tree.reduce((n,p)=>n+(p.wards||[]).length,0)};

    await writeWithLimit(provinceWrites,async item=>{
      await db.collection('KatLearn_TINHTHANH_1').doc(item.id).set(item.data,{merge:true});
    },20);

    await writeWithLimit(rows,async r=>{
      const schoolId=slugId(r.provinceCode+'|'+r.sourceSchoolId+'|'+norm(r.name));
      const schoolData={
        name:r.name,
        schoolId,
        province:r.provinceName,
        provinceId:r.provinceCode,
        ward:r.wardName,
        wardId:r.wardId,
        sourceSchoolId:r.sourceSchoolId,
        schoolLevel:r.level,
        source:'thanhtungct7/data-school-in-ward',
        sourceType:'community_national_school_tree',
        updatedAt:now
      };
      await db.collection('KatLearn_TRUONGHOC_1').doc(schoolId).set(schoolData,{merge:true});
      const legacyRef=db.collection('schools').doc(schoolId);
      await legacyRef.set({...schoolData,createdAt:now},{merge:true});
      for(const grade of gradeTemplates[r.level]){
        const classId=schoolId+'-'+grade;
        const classData={
          classId,
          name:'Lớp '+grade,
          grade:String(grade),
          schoolId,
          schoolName:r.name,
          province:r.provinceName,
          provinceId:r.provinceCode,
          ward:r.wardName,
          schoolLevel:r.level,
          isTemplate:true,
          source:'national_catalog_template',
          updatedAt:now
        };
        await db.collection('KatLearn_LOPHOC_1').doc(classId).set(classData,{merge:true});
        await legacyRef.collection('classes').doc(classId).set(classData,{merge:true});
        stats.classes++;
      }
    },18);

    return res.status(200).json({ok:true,stats,updatedAt:now,message:'Đã đồng bộ danh mục quốc gia.'});
  }catch(e){
    console.error('national-catalog-sync:',e);
    return res.status(500).json({ok:false,error:e?.message||'National catalog sync failed'});
  }
}
