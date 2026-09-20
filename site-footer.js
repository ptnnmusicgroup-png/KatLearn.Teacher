(function(){
  function mount(){
    const main=document.querySelector('.app-shell main');
    if(!main||document.getElementById('katlearnFooter'))return !!main;
    const style=document.createElement('style');
    style.id='katlearnFooterStyle';
    style.textContent=`
      #katlearnFooter{margin-top:34px;background:#fff;border-top:1px solid #edf0f5;padding:22px 30px 24px;color:#8290a3;font:500 10px/1.7 'Be Vietnam Pro',sans-serif;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(230px,1fr);gap:28px;align-items:start}
      #katlearnFooter .footer-left,#katlearnFooter .footer-right{min-width:0}
      #katlearnFooter .footer-left{text-align:left}
      #katlearnFooter .footer-right{text-align:right}
      #katlearnFooter .footer-title{font:700 13px 'Fredoka','Be Vietnam Pro',sans-serif;color:#536178;margin:0 0 5px}
      #katlearnFooter p{margin:2px 0}
      #katlearnFooter .footer-right p{color:#69778b}
      #katlearnFooter .footer-right p::before{content:'•';margin-right:7px;color:#f08a9b}
      #katlearnFooter .dmca{font-style:italic;color:#9aa5b4;margin-top:7px}
      @media(max-width:700px){#katlearnFooter{grid-template-columns:1fr;gap:14px;padding:20px 16px;text-align:center}#katlearnFooter .footer-left,#katlearnFooter .footer-right{text-align:center}}
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