const SOURCES=[
  {level:'primary',url:'https://shopacgame.vn/posts/danh-sach-cac-truong-tieu-hoc-o-viet-nam'},
  {level:'secondary',url:'https://shopacgame.vn/posts/danh-sach-cac-truong-trung-hoc-co-so-tren-ca-nuoc'}
];
const TOKEN='kl-harvest-20260927';
const PROVINCE_ALIASES=new Map([
 ['Hà Nội','Thành phố Hà Nội'],['Cao Bằng','Tỉnh Cao Bằng'],['Tuyên Quang','Tỉnh Tuyên Quang'],['Hà Giang','Tỉnh Tuyên Quang'],
 ['Điện Biên','Tỉnh Điện Biên'],['Lai Châu','Tỉnh Lai Châu'],['Sơn La','Tỉnh Sơn La'],['Lào Cai','Tỉnh Lào Cai'],['Yên Bái','Tỉnh Lào Cai'],
 ['Thái Nguyên','Tỉnh Thái Nguyên'],['Bắc Kạn','Tỉnh Thái Nguyên'],['Lạng Sơn','Tỉnh Lạng Sơn'],['Quảng Ninh','Tỉnh Quảng Ninh'],
 ['Bắc Ninh','Tỉnh Bắc Ninh'],['Bắc Giang','Tỉnh Bắc Ninh'],['Phú Thọ','Tỉnh Phú Thọ'],['Vĩnh Phúc','Tỉnh Phú Thọ'],['Hòa Bình','Tỉnh Phú Thọ'],
 ['Hải Phòng','Thành phố Hải Phòng'],['Hải Dương','Thành phố Hải Phòng'],['Hưng Yên','Tỉnh Hưng Yên'],['Thái Bình','Tỉnh Hưng Yên'],
 ['Ninh Bình','Tỉnh Ninh Bình'],['Nam Định','Tỉnh Ninh Bình'],['Hà Nam','Tỉnh Ninh Bình'],['Thanh Hóa','Tỉnh Thanh Hóa'],
 ['Nghệ An','Tỉnh Nghệ An'],['Hà Tĩnh','Tỉnh Hà Tĩnh'],['Quảng Trị','Tỉnh Quảng Trị'],['Quảng Bình','Tỉnh Quảng Trị'],
 ['Huế','Thành phố Huế'],['Thừa Thiên Huế','Thành phố Huế'],['Đà Nẵng','Thành phố Đà Nẵng'],['Quảng Nam','Thành phố Đà Nẵng'],
 ['Quảng Ngãi','Tỉnh Quảng Ngãi'],['Kon Tum','Tỉnh Quảng Ngãi'],['Gia Lai','Tỉnh Gia Lai'],['Bình Định','Tỉnh Gia Lai'],
 ['Khánh Hòa','Tỉnh Khánh Hòa'],['Ninh Thuận','Tỉnh Khánh Hòa'],['Đắk Lắk','Tỉnh Đắk Lắk'],['Phú Yên','Tỉnh Đắk Lắk'],
 ['Lâm Đồng','Tỉnh Lâm Đồng'],['Đắk Nông','Tỉnh Lâm Đồng'],['Bình Thuận','Tỉnh Lâm Đồng'],['Đồng Nai','Tỉnh Đồng Nai'],
 ['Bình Phước','Tỉnh Đồng Nai'],['Thành phố Hồ Chí Minh','Thành phố Hồ Chí Minh'],['Hồ Chí Minh','Thành phố Hồ Chí Minh'],
 ['TP.HCM','Thành phố Hồ Chí Minh'],['Bình Dương','Thành phố Hồ Chí Minh'],['Bà Rịa - Vũng Tàu','Thành phố Hồ Chí Minh'],
 ['Tây Ninh','Tỉnh Tây Ninh'],['Long An','Tỉnh Tây Ninh'],['Đồng Tháp','Tỉnh Đồng Tháp'],['Tiền Giang','Tỉnh Đồng Tháp'],
 ['Vĩnh Long','Tỉnh Vĩnh Long'],['Bến Tre','Tỉnh Vĩnh Long'],['Trà Vinh','Tỉnh Vĩnh Long'],['An Giang','Tỉnh An Giang'],
 ['Kiên Giang','Tỉnh An Giang'],['Cần Thơ','Thành phố Cần Thơ'],['Hậu Giang','Thành phố Cần Thơ'],['Sóc Trăng','Thành phố Cần Thơ'],
 ['Cà Mau','Tỉnh Cà Mau'],['Bạc Liêu','Tỉnh Cà Mau']
]);
const CURRENT=new Set([
'Tỉnh An Giang','Tỉnh Bắc Ninh','Tỉnh Cao Bằng','Tỉnh Cà Mau','Tỉnh Gia Lai','Tỉnh Hà Tĩnh','Tỉnh Hưng Yên','Tỉnh Khánh Hòa','Tỉnh Lai Châu','Tỉnh Lào Cai','Tỉnh Lâm Đồng','Tỉnh Lạng Sơn','Tỉnh Nghệ An','Tỉnh Ninh Bình','Tỉnh Phú Thọ','Tỉnh Quảng Ngãi','Tỉnh Quảng Ninh','Tỉnh Quảng Trị','Tỉnh Sơn La','Tỉnh Thanh Hóa','Tỉnh Thái Nguyên','Tỉnh Tuyên Quang','Tỉnh Tây Ninh','Tỉnh Vĩnh Long','Thành phố Cần Thơ','Thành phố Đà Nẵng','Thành phố Hải Phòng','Thành phố Hà Nội','Thành phố Hồ Chí Minh','Thành phố Huế','Tỉnh Điện Biên','Tỉnh Đắk Lắk','Tỉnh Đồng Nai','Tỉnh Đồng Tháp'
]);
function htmlText(v){return String(v??'').replace(/<br\s*\/?\s*>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&#x27;/gi,"'").replace(/\s+/g,' ').trim();}
function norm(v){return htmlText(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function currentProvince(v){const x=htmlText(v); const k=x.replace(/^Tỉnh\s+/i,'').replace(/^Thành phố\s+/i,'').trim(); return PROVINCE_ALIASES.get(k)||PROVINCE_ALIASES.get(x)||null;}
function parsePage(html,level,url){
  const clean=String(html).replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'');
  const heads=[]; const hRe=/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi; let h;
  while((h=hRe.exec(clean))) heads.push({start:h.index,end:hRe.lastIndex,text:htmlText(h[1])});
  const rows=[]; const trRe=/<tr[^>]*>([\s\S]*?)<\/tr>/gi; let tr;
  while((tr=trRe.exec(clean))){
    const section=heads.filter(x=>x.start<tr.index).at(-1)?.text||'';
    let province=currentProvince(section.replace(/^.*(?:ở|tai|tại)\s+/i,''))||currentProvince(section);
    const cells=[]; const tdRe=/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi; let td;
    while((td=tdRe.exec(tr[1]))) cells.push(htmlText(td[1]));
    if(cells.length<2) continue;
    const cp=cells.find(currentProvince); if(cp) province=currentProvince(cp);
    if(!province || !CURRENT.has(province)) continue;
    let name='',address='';
    if(cells.length>=4){name=cells[1]; address=cells.slice(3).join(' ');}
    else if(cells.length===3){name=/^\d+$/.test(cells[0])?cells[1]:cells[0];address=cells[2];}
    else {name=/^\d+$/.test(cells[0])?cells[1]:cells[0];address=cells[1];}
    if(!name || /^(tt|stt|tên trường|tỉnh thành|địa chỉ)$/i.test(name)) continue;
    const nn=norm(name);
    if(level==='primary' && !/(ti[eế]u hoc|^th\b|pdt|ph[oổ] th[oô]ng)/i.test(nn)) continue;
    if(level==='secondary' && !/(thcs|trung hoc co so|pdt|thcs.*thpt|thpt|trung hoc)/i.test(nn)) continue;
    rows.push({province,name:name.trim(),address:address.trim(),level,source:url});
  }
  return rows;
}
export default async function handler(req,res){
  if(req.method!=='GET'||req.query?.token!==TOKEN) return res.status(404).json({ok:false});
  try{
    const pages=await Promise.all(SOURCES.map(async s=>{
      const r=await fetch(s.url,{headers:{'user-agent':'KatLearn-catalog-harvest/1.0'}});
      if(!r.ok) throw new Error(s.url+' '+r.status);
      return parsePage(await r.text(),s.level,s.url);
    }));
    const map=new Map();
    for(const r of pages.flat()){
      const k=norm(r.province)+'|'+norm(r.name);
      if(!map.has(k)) map.set(k,r);
    }
    const rows=[...map.values()];
    return res.status(200).json({ok:true,rows,count:rows.length,sources:SOURCES.map(s=>s.url),fetchedAt:new Date().toISOString()});
  }catch(e){return res.status(500).json({ok:false,error:e?.message||String(e)});}
}

// trigger one-shot enrichment

// trigger official 2026 THPT enrichment run

// rerun with corrected 2026 THPT source
