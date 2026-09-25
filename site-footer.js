(function(){
  function mount(){
    const main=document.querySelector('.app-shell main');
    if(!main||document.getElementById('katlearnFooter'))return !!main;
    const style=document.createElement('style');
    style.id='katlearnFooterStyle';
    style.textContent=`
      #katlearnFooter{margin-top:46px;min-height:150px;background:linear-gradient(135deg,#fffaf2,#fff)!important;border-top:1px solid #eadfd0;padding:30px 38px 34px;color:#806f67;font:500 11px/1.85 'Be Vietnam Pro',sans-serif;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(250px,1fr);gap:42px;align-items:start;box-shadow:0 -10px 35px rgba(84,48,37,.035)}
#katlearnFooter .footer-left,#katlearnFooter .footer-right{min-width:0}
#katlearnFooter .footer-left{text-align:left}
#katlearnFooter .footer-right{text-align:right}
#katlearnFooter .footer-title{font:700 15px 'Fredoka','Be Vietnam Pro',sans-serif;color:#952336;margin:0 0 9px}
#katlearnFooter p{margin:4px 0}
#katlearnFooter .footer-right p{color:#705f58}
#katlearnFooter .footer-right p::before{content:'•';margin-right:8px;color:#d3a64a}
#katlearnFooter .dmca{font-style:italic;color:#9b8e87;margin-top:11px}
@media(max-width:700px){#katlearnFooter{grid-template-columns:1fr;gap:18px;padding:28px 20px 34px;min-height:210px;text-align:center}#katlearnFooter .footer-left,#katlearnFooter .footer-right{text-align:center}}
    `;
    document.head.appendChild(style);
    const footer=document.createElement('footer');
    footer.id='katlearnFooter';
    footer.innerHTML=`
      <div class="footer-left">
        <p class="footer-title">KatLearn - English Learning Platform (Teacher)</p>
        <p>Made by Nguyen Dang Phuong from 8B1 - Chu Van An Secondary School (Phuong Me Dev - Part Of PTNN - Dev grp)</p>
        <p>Copyright by Nguyen Dang Phuong (Phuong Me Dev) - all right reserved.</p>
        <p class="dmca">*protected by DMCA*</p>
      </div>
      <div class="footer-right">
        <p>Được lưu trữ bởi GitHub</p>
        <p>Dữ liệu người dùng, hệ thống đăng nhập bởi Google Firebase</p>
        <p>Deploy bởi Vercel</p>
        <p>Được bảo vệ bởi DMCA</p>
      </div>`;
    main.appendChild(footer);
    return true;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();