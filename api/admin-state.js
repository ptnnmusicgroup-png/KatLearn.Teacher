import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const ADMIN_EMAIL='katlearn.admin@gmail.com';
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};

function admin(){
  if(!getApps().length){
    const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
    if(!raw)throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured on the Admin deployment.'),{status:503});
    let serviceAccount;
    try{serviceAccount=JSON.parse(raw)}catch(_){throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid.'),{status:503})}
    if(!serviceAccount?.project_id||!serviceAccount?.client_email||!serviceAccount?.private_key){
      throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.'),{status:503});
    }
    initializeApp({credential:cert(serviceAccount)});
  }
  return{auth:getAuth(),db:getFirestore()};
}

function tokenFrom(req){
  const header=String(req.headers?.authorization||'');
  const match=/^Bearer\s+(.+)$/i.exec(header);
  if(!match)throw Object.assign(new Error('Bạn cần đăng nhập Admin.'),{status:401});
  return match[1];
}

function serialize(value){
  if(value&&typeof value.toMillis==='function')return value.toMillis();
  if(Array.isArray(value))return value.map(serialize);
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value))out[k]=serialize(v);
    return out;
  }
  return value;
}

function rows(snapshot){
  return snapshot.docs.map(d=>({id:d.id,...serialize(d.data()||{})}));
}

function send(res,status,body){
  return res.status(status).set(HEADERS).json(body);
}

export default async function handler(req,res){
  if(req.method!=='GET')return send(res,405,{ok:false,error:'Method not allowed'});
  try{
    const{auth,db}=admin();
    const decoded=await auth.verifyIdToken(tokenFrom(req),true);
    if(String(decoded.email||'').toLowerCase()!==ADMIN_EMAIL){
      return send(res,403,{ok:false,error:'Tài khoản không có quyền Admin.'});
    }

    const [usersSnap,classesSnap,packsSnap,schoolsSnap]=await Promise.all([
      db.collection('users').get(),
      db.collection('classes').get(),
      db.collection('publicPacks').get(),
      db.collection('schools').get()
    ]);

    const users=rows(usersSnap);
    const classes=rows(classesSnap);
    const packs=packsSnap.docs.map(d=>{
      const data=d.data()||{},safe=serialize(data);
      return{
        id:d.id,
        name:safe.name,
        createdBy:safe.createdBy,
        createdByEmail:safe.createdByEmail,
        createdByUid:safe.createdByUid,
        createdAt:safe.createdAt,
        wordCount:Number(safe.wordCount||0)||(Array.isArray(data.words)?data.words.length:0)
      };
    });
    const schools=rows(schoolsSnap);
    const pending=users
      .filter(u=>String(u.role||'').toLowerCase()==='pending_teacher_verification')
      .sort((a,b)=>Number(a.teacherVerification?.submittedAt||a.createdAt||0)-Number(b.teacherVerification?.submittedAt||b.createdAt||0));

    return send(res,200,{
      ok:true,
      stats:{
        users:users.length,
        teachers:users.filter(u=>String(u.role||'').toLowerCase()==='teacher').length,
        students:users.filter(u=>String(u.role||'').toLowerCase()==='student').length,
        pending:pending.length,
        classes:classes.length,
        packs:packs.length,
        schools:schools.length
      },
      users,classes,packs,schools,pending
    });
  }catch(error){
    const status=Number(error?.status||error?.statusCode)||500;
    console.error('[KatLearn admin state]',error);
    return send(res,status,{ok:false,error:String(error?.message||'Không thể tải dữ liệu quản trị.'),code:error?.code||null});
  }
}
