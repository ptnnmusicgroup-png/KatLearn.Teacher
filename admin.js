import{initializeApp,getApps}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import{browserLocalPersistence,getAuth,onAuthStateChanged,setPersistence,signInWithEmailAndPassword,signOut}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const CONFIG={apiKey:"AIzaSyCgMDdCP0R5fW3QjhYrd3Ab8AJH3xYGiz8",authDomain:"elp---katlearn.firebaseapp.com",projectId:"elp---katlearn",storageBucket:"elp---katlearn.firebasestorage.app",messagingSenderId:"344478447672",appId:"1:344478447672:web:4ed109a40303d0b41b0ecd",measurementId:"G-KTW11GD97T"};
const ADMIN="katlearn.admin@gmail.com";
const TOTAL_CATALOG=22850;
const CATALOG_CHUNK_SIZE=250;
const CATALOG=[["01","Thành phố Hà Nội",2828],["04","Tỉnh Cao Bằng",150],["08","Tỉnh Tuyên Quang",300],["11","Tỉnh Điện Biên",182],["12","Tỉnh Lai Châu",137],["14","Tỉnh Sơn La",278],["15","Tỉnh Lào Cai",216],["19","Tỉnh Thái Nguyên",261],["20","Tỉnh Lạng Sơn",200],["22","Tỉnh Quảng Ninh",266],["24","Tỉnh Bắc Ninh",1039],["25","Tỉnh Phú Thọ",759],["31","Thành phố Hải Phòng",1041],["33","Tỉnh Hưng Yên",548],["37","Tỉnh Ninh Bình",1178],["38","Tỉnh Thanh Hóa",2002],["40","Tỉnh Nghệ An",372],["42","Tỉnh Hà Tĩnh",444],["44","Tỉnh Quảng Trị",290],["46","Thành phố Huế",383],["48","Thành phố Đà Nẵng",550],["51","Tỉnh Quảng Ngãi",127],["52","Tỉnh Gia Lai",261],["56","Tỉnh Khánh Hòa",296],["66","Tỉnh Đắk Lắk",616],["68","Tỉnh Lâm Đồng",1021],["75","Tỉnh Đồng Nai",691],["79","Thành phố Hồ Chí Minh",2382],["80","Tỉnh Tây Ninh",406],["82","Tỉnh Đồng Tháp",275],["86","Tỉnh Vĩnh Long",723],["91","Tỉnh An Giang",1322],["92","Thành phố Cần Thơ",713],["96","Tỉnh Cà Mau",593]];
const app=getApps().length?getApps()[0]:initializeApp(CONFIG),auth=getAuth(app);
let loginInProgress=false;
async function enterAdminDashboard(u){
  state.user=u;
  $("#loginGate").classList.add("hidden");
  $("#app").classList.remove("hidden");
  health("#healthAuth",true,"Đã xác thực");
  setConnection(true,"Đang tải Admin Hub…");
  try{
    await loadPage("overview",true);
    setConnection(true,"Admin Hub online");
  }catch(error){
    health("#healthAdmin",false,"Không phản hồi");
    health("#healthFs",false,"Không kiểm tra được");
    setConnection(false,"Lỗi Admin Hub");
    pageError(error,"Không tải được Admin Hub");
    toast(error,"bad");
  }
}
async function handleAdminLogin(){
  const form=$("#loginForm"),button=$("#loginBtn"),message=$("#loginError"),passwordField=$("#password");
  if(!form||!button||!message||!passwordField)return;
  if(loginInProgress)return;
  loginInProgress=true;
  button.disabled=true;
  message.textContent="Đang xác thực…";
  try{
    const persistence=await setPersistence(auth,browserLocalPersistence).catch(error=>{
      console.warn("[KatLearn Admin] Local persistence failed:",error);
      return false;
    });
    const email=String($("#adminEmail")?.value||"").trim().toLowerCase()||ADMIN;
    const password=String(passwordField.value||"");
    if(!password)throw Object.assign(new Error("Vui lòng nhập mật khẩu."),{code:"missing_password"});
    const credential=await signInWithEmailAndPassword(auth,email,password);
    const signedInEmail=String(credential.user.email||"").toLowerCase();
    if(signedInEmail!==ADMIN){
      await signOut(auth).catch(()=>{});
      throw Object.assign(new Error("Tài khoản không có quyền Admin."),{code:"admin_forbidden"});
    }
    passwordField.value="";
    message.textContent="";
    await enterAdminDashboard(credential.user);
  }catch(error){
    message.textContent=error?.code==="auth/invalid-credential"?"Email hoặc mật khẩu không đúng.":errText(error);
    button.disabled=false;
  }finally{
    loginInProgress=false;
  }
}
const earlyLoginForm=document.querySelector("#loginForm");
const earlyLoginButton=document.querySelector("#loginBtn");
earlyLoginForm?.addEventListener("submit",event=>{event.preventDefault();void handleAdminLogin()});
earlyLoginButton?.addEventListener("click",event=>{event.preventDefault();void handleAdminLogin()});
earlyLoginForm?.querySelector("#password")?.addEventListener("keydown",event=>{
  if(event.key==="Enter"){event.preventDefault();void handleAdminLogin()}
});
onAuthStateChanged(auth,async u=>{
  if(loginInProgress&&!u)return;
  if(!u){
    state.user=null;
    $("#loginGate").classList.remove("hidden");
    $("#app").classList.add("hidden");
    health("#healthAuth",false,"Chưa đăng nhập");
    setConnection(false,"Chưa kết nối");
    return;
  }
  if(String(u.email||"").toLowerCase()!==ADMIN){
    if(loginInProgress)return;
    $("#loginError").textContent="Tài khoản này không có quyền Admin.";
    await signOut(auth).catch(()=>{});
    return;
  }
  if(state.user?.uid===u.uid&&!$("#app").classList.contains("hidden"))return;
  await enterAdminDashboard(u);
});
bind();
renderOverview({stats:{},pending:[]});
