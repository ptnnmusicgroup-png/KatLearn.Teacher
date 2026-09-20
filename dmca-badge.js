/* DMCA protection badge for KatLearn. */
(function(){
  const BADGE_URL='https://images.dmca.com/Badges/dmca_protected_16_120.png?ID=755dcf1e-2d8c-4315-8cd3-9f29b4ca890e';
  const STATUS_URL='https://www.dmca.com/Protection/Status.aspx?id=755dcf1e-2d8c-4315-8cd3-9f29b4ca890e&refurl=https%3A%2F%2Flms-katlearn.netlify.app%2F&rlo=true';
  function mount(){
    const footer=document.getElementById('katlearnFooter');
    const right=footer?.querySelector('.footer-right');
    if(!footer||!right||right.querySelector('.dmca-badge'))return false;
    if(!document.getElementById('dmcaBadgeStyle')){
      const style=document.createElement('style');
      style.id='dmcaBadgeStyle';
      style.textContent=`
        #katlearnFooter .dmca-badge-wrap{margin-top:8px;display:flex;justify-content:flex-end;align-items:center}
        #katlearnFooter .dmca-badge{display:inline-flex;line-height:0}
        #katlearnFooter .dmca-badge img{width:120px;height:auto;display:block}
        @media(max-width:700px){#katlearnFooter .dmca-badge-wrap{justify-content:center}}
      `;
      document.head.appendChild(style);
    }
    const wrap=document.createElement('div');
    wrap.className='dmca-badge-wrap';
    wrap.innerHTML=`<a href="${STATUS_URL}" title="DMCA.com Protection Status" class="dmca-badge"><img src="${BADGE_URL}" alt="DMCA.com Protection Status"></a>`;
    right.appendChild(wrap);
    if(!document.querySelector('script[data-dmca-helper]')){
      const s=document.createElement('script');
      s.src='https://images.dmca.com/Badges/DMCABadgeHelper.min.js';
      s.async=true;
      s.dataset.dmcaHelper='1';
      document.body.appendChild(s);
    }
    return true;
  }
  function start(){
    if(mount())return;
    const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();