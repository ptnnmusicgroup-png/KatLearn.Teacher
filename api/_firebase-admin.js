import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function credentials(){
  const raw=String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON||'').trim();
  if(raw){
    try{return JSON.parse(raw)}
    catch(_){throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid'),{status:503,code:'firebase_credentials_invalid'})}
  }
  const projectId=String(process.env.FIREBASE_PROJECT_ID||process.env.FIREBASE_ADMIN_PROJECT_ID||'').trim();
  const clientEmail=String(process.env.FIREBASE_CLIENT_EMAIL||process.env.FIREBASE_ADMIN_CLIENT_EMAIL||'').trim();
  const privateKey=String(process.env.FIREBASE_PRIVATE_KEY||process.env.FIREBASE_ADMIN_PRIVATE_KEY||'').replace(/\\n/g,'\n').trim();
  if(projectId&&clientEmail&&privateKey)return{project_id:projectId,client_email:clientEmail,private_key:privateKey};
  throw Object.assign(new Error('Firebase Admin credentials are not configured'),{status:503,code:'firebase_credentials_missing'});
}

export function admin(){
  if(!getApps().length)initializeApp({credential:cert(credentials())});
  return{auth:getAuth(),db:getFirestore()};
}
