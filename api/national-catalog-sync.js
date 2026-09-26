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

const SOURCES=[
 {level:'primary',url:'https://shopacgame.vn/posts/danh-sach-cac-truong-tieu-hoc-o-viet-nam'},
 {level:'secondary',url:'https://shopacgame.vn/posts/danh-sach-cac-truong-trung-hoc-co-so-tren-ca-nuoc'}
];

function admin(){
  if(!getApps().length){
    const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if(!raw)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
    initializeApp({credential:cert(JSON.parse(raw))});
  }
  return {auth:getAuth(),db:getFirestore()};
}
function htmlText(v){
  return String(v??'')
    .replace(/<br\s*\/?>/gi,' ')
    .replace(/<[^>]*>/g,' ')
    .replace(/&nbsp;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/\s+/g,' ').trim();
}
function norm(v){
  return htmlText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
}
function slugId(value){
  const h=crypto.createHash('sha1').update(value).digest('hex').slice(0,20);
  return h;
}
function currentProvince(oldName){
  const clean=htmlText(oldName).replace(/^Tỉnh\s+/i,'').replace(/^Thành phố\s+/i,'').trim();
  const target=PROVINCE_ALIASES.get(clean)||PROVINCE_ALIASES.get(htmlText(oldName));
  if(!target)return null;
  return PROVINCES.find(p=>p.name===target)||null;
}
function parseSectionRows(sectionHtml, legacyProvince, level, source){
  const rows=[];
  const trRe=/<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let m;
  while((m=trRe.exec(sectionHtml))){
    const cells=[];
    const tdRe=/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi;
    let c; while((c=tdRe.exec(m[1])))cells.push(htmlText(c[1]));
    if(cells.length<2)continue;
    const provinceInRow=cells.find(v=>PROVINCE_ALIASES.has(v)||currentProvince(v));
    const p= currentProvince(provinceInRow||legacyProvince);
    if(!p)continue;
    let name='',address='';
    if(cells.length>=4){
      name=cells[1]||''; address=cells.slice(3).join(' ').trim();
    }else if(cells.length===3){
      name=cells[0]||''; address=cells[2]||'';
      if(/^\d+$/.test(cells[0]))name=cells[1]||'';
    }else{
      name=cells[0]||''; address=cells[1]||'';
      if(/^\d+$/.test(cells[0]))name=cells[1]||'';
    }
    if(!name||/^(stt|tt|tên trường|tỉnh thành|địa chỉ)$/i.test(name))continue;
    if(level==='primary' && !/(tiểu học|th|ptdt|phổ thông)/i.test(name))continue;
    if(level==='secondary' && !/(thcs|trung học cơ sở|ptdt|th&thcs|thcs&thpt|thpt|trung học)/i.test(name))continue;
    rows.push({name:name.replace(/^Trường\s*$/i,'').trim(),address,province:p,legacyProvince,level,source});
  }
  return rows;
}
function parseSchools(html,level,source){
  const clean=String(html).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
  const sections=[];
  const hRe=/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi;
  const hs=[]; let h;
  while((h=hRe.exec(clean)))hs.push({index:h.index,end:hRe.lastIndex,text:htmlText(h[1])});
  for(let i=0;i<hs.length;i++){
    const head=hs[i].text;
    const match=head.match(/(?:ở|tai|tại)\s+(.+)$/i);
    const province=match?.[1]?.replace(/^\d+[.)\s-]*/,'').trim();
    if(!province||!currentProvince(province))continue;
    const end=hs[i+1]?.index??clean.length;
    sections.push(...parseSectionRows(clean.slice(hs[i].end,end),province,level,source));
  }
  return sections;
}
function uniqueSchools(rows){
  const map=new Map();
  for(const r of rows){
    const key=r.province.code+'|'+norm(r.name);
    if(!map.has(key))map.set(key,r);
  }
  return [...map.values()];
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
    const provinceWrites=PROVINCES.map(p=>({
      id:p.code,
      data:{code:p.code,name:p.name,nameShort:p.name.replace(/^(Tỉnh|Thành phố)\s+/,'').trim(),type:p.name.startsWith('Thành phố')?'city':'province',source:'QuyetDinh19/2025/QD-TTg',updatedAt:now}
    }));

    const htmls=await Promise.all(SOURCES.map(async s=>{
      const r=await fetch(s.url,{headers:{'user-agent':'KatLearn-National-Catalog/1.0'}});
      if(!r.ok)throw new Error('Không tải được nguồn '+s.url+' ('+r.status+')');
      return {...s,html:await r.text()};
    }));
    const rows=uniqueSchools(htmls.flatMap(s=>parseSchools(s.html,s.level,s.url)));
    const stats={provinces:provinceWrites.length,schools:rows.length,classes:0};

    await writeWithLimit(provinceWrites,async item=>{
      await db.collection('KatLearn_TINHTHANH_1').doc(item.id).set(item.data,{merge:true});
    },20);

    const classTemplates={primary:[1,2,3,4,5],secondary:[6,7,8,9]};
    await writeWithLimit(rows,async r=>{
      const schoolId=slugId(r.province.code+'|'+norm(r.name));
      const schoolData={
        name:r.name,schoolId,province:r.province.name,provinceId:r.province.code,address:r.address||'',
        legacyProvince:r.legacyProvince,schoolLevel:r.level,source:r.source,
        sourceType:'public_national_list',updatedAt:now
      };
      await db.collection('KatLearn_TRUONGHOC_1').doc(schoolId).set(schoolData,{merge:true});
      const legacyRef=db.collection('schools').doc(schoolId);
      await legacyRef.set({...schoolData,createdAt:now},{merge:true});
      for(const grade of classTemplates[r.level]){
        const classId=schoolId+'-'+grade;
        const classData={name:'Lớp '+grade,grade:String(grade),schoolId,schoolName:r.name,province:r.province.name,provinceId:r.province.code,schoolLevel:r.level,isTemplate:true,source:'national_catalog_template',updatedAt:now};
        await db.collection('KatLearn_LOPHOC_1').doc(classId).set({classId,...classData},{merge:true});
        await legacyRef.collection('classes').doc(classId).set(classData,{merge:true});
        stats.classes++;
      }
    },12);

    return res.status(200).json({ok:true,stats,updatedAt:now,message:'Đã đồng bộ danh mục quốc gia.'});
  }catch(e){
    console.error('national-catalog-sync:',e);
    return res.status(500).json({ok:false,error:e?.message||'National catalog sync failed'});
  }
}
