/* KatLearn Teacher Home account UI: mirrors the Student Home session presentation. */
(function(){
  const css=`#teacherAccount{position:relative;display:flex;align-items:center;gap:8px;font-family:'Be Vietnam Pro',sans-serif}#teacherAccount .tha-btn{height:38px;padding:0 12px;border:1px solid #e6e8ef;border-radius:10px;background:#fff;color:#4b5b70;font:700 11px 'Be Vietnam Pro';cursor:pointer;box-shadow:0 2px 7px rgba(50,55,75,.06)}#teacherAccount .tha-user{display:flex;align-items:center;gap:7px;height:42px;padding:0 9px;border:1px solid #e6e8ef;border-radius:11px;background:#fff;color:#4b5b70;font:700 11px 'Be Vietnam Pro';cursor:pointer;box-shadow:0 2px 7px rgba(50,55,75,.06)}#teacherAccount .tha-avatar{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;color:#fff;background:linear-gradient(135deg,#ffad71,#f47691);font-size:11px}#teacherAccount .tha-panel{position:absolute;right:0;top:48px;width:285px;background:#fff;border:1px solid #ececf4;border-radius:14px;padding:15px;box-shadow:0 17px 35px rgba(48,55,87,.18);z-index:50;text-align:left}#teacherAccount .tha-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}#teacherAccount .tha-avatar.large{width:42px;height:42px;font-size:16px;flex:none}#teacherAccount .tha-head b{display:block;color:#27344a;font-size:13px}#teacherAccount .tha-head small{display:block;color:#8b95a7;font-size:10px;margin-top:3px;max-width:205px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#teacherAccount .tha-role{margin:0 0 11px;padding:7px 9px;background:#f7f8fb;border-radius:8px;color:#69778b;font-size:9px;font-weight:700}#teacherAccount .tha-menu{width:100%;border:0;background:#f7f8fb;border-radius:9px;padding:10px;text-align:left;color:#536177;font:700 10px 'Be Vietnam Pro';cursor:pointer;margin-top:5px}#teacherAccount .tha-menu:hover{background:#eef1f7}#teacherAccount .tha-menu.danger{color:#df625e;background:#fff1f0}`;
  function mount(){
    const root=document.getElementById('teacherAccount');
    const login=document.getElementById('loginBtn'),logout=document.getElementById('logoutBtn');
    const nameEl=document.getElementById('accountName'),emailEl=document.getElementById('accountEmail');
    if(!root||!login||!logout)return false;
    if(!document.getElementById('teacher-home-account-style')){const s=document.createElement('style');s.id='teacher-home-account-style';s.textContent=css;document.head.appendChild(s)}
    const loggedIn=logout.hidden===false;
    const name=(nameEl?.textContent||'Giáo viên').trim()||'Giáo viên';
    const email=(emailEl?.textContent||'').trim();
    root.innerHTML='';
    if(!loggedIn){
      const b=document.createElement('button');b.className='tha-btn';b.textContent='Đăng nhập';b.onclick=()=>login.click();const s=document.createElement('button');s.className='tha-btn';s.textContent='Đăng ký giáo viên';s.onclick=()=>location.href='teacher-signup.html';root.append(b,s);return true;
    }
    const initial=(name.replace(/^Chưa đăng nhập$/,'Giáo viên').trim()[0]||'K').toUpperCase();
    const trigger=document.createElement('button');trigger.className='tha-user';trigger.innerHTML=`<span class="tha-avatar">${initial}</span><span>${escapeHtml(name)}</span><span>⌄</span>`;
    const panel=document.createElement('div');panel.className='tha-panel';panel.hidden=true;
    panel.innerHTML=`<div class="tha-head"><span class="tha-avatar large">${initial}</span><div><b>${escapeHtml(name)}</b><small>${escapeHtml(email)}</small></div></div><div class="tha-role">🐾 Tài khoản giáo viên · Cổng quản lý KatLearn</div><button class="tha-menu" id="thaDashboard">⌂ Tổng quan</button><button class="tha-menu danger" id="thaLogout">↪ Đăng xuất</button>`;
    trigger.onclick=()=>panel.hidden=!panel.hidden;
    panel.querySelector('#thaDashboard').onclick=()=>{panel.hidden=true;document.querySelector('[data-page="dashboard"]')?.click()};
    panel.querySelector('#thaLogout').onclick=()=>logout.click();
    root.append(trigger,panel);return true;
  }
  function escapeHtml(v){return String(v||'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}
  function start(){
    if(!mount())return;
    const login=document.getElementById('loginBtn'),logout=document.getElementById('logoutBtn'),name=document.getElementById('accountName'),email=document.getElementById('accountEmail');
    const obs=new MutationObserver(()=>mount());
    [login,logout,name,email].forEach(x=>x&&obs.observe(x,{attributes:true,childList:true,characterData:true,subtree:true}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
