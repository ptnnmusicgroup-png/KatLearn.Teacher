/* Classroom random picker adapted from the no-repeat draw flow in:
 * Sid Roberts, Random Name Picker (MIT)
 * https://github.com/SidRoberts/random-name-picker
 * The UI, wheel renderer, team shuffler and privacy handling are original KatLearn code.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const canvas=$('classroomWheel');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const state={classes:[],roster:[],remaining:[],history:[],rotation:0,spinning:false,loadedClassId:''};
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  function randomIndex(max){
    if(max<=1)return 0;
    if(window.crypto?.getRandomValues){
      const limit=Math.floor(0x100000000/max)*max;
      const buffer=new Uint32Array(1);
      do{window.crypto.getRandomValues(buffer)}while(buffer[0]>=limit);
      return buffer[0]%max;
    }
    return Math.floor(Math.random()*max);
  }
  function shuffle(items){
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){
      const j=randomIndex(i+1);
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }
  function setStatus(message,isError){
    $('gameRosterStatus').textContent=message;
    $('gameRosterStatus').classList.toggle('is-error',!!isError);
  }
  function renderWheel(){
    const names=state.remaining.length?state.remaining:state.roster;
    const width=canvas.width,height=canvas.height,cx=width/2,cy=height/2,radius=Math.min(cx,cy)-12;
    ctx.clearRect(0,0,width,height);
    ctx.save();
    ctx.translate(cx,cy);
    const count=Math.max(1,names.length),slice=Math.PI*2/count;
    const palette=['#8172ed','#38b7dc','#e88cac','#5bbd9b','#d5a45e','#667eea','#b07be0','#3e9ca9'];
    for(let i=0;i<count;i++){
      const start=-Math.PI/2+i*slice,end=start+slice;
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,radius,start,end);ctx.closePath();
      ctx.fillStyle=palette[i%palette.length];ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=3;ctx.stroke();
      if(names[i]){
        ctx.save();ctx.rotate(start+slice/2);ctx.translate(radius*.67,0);
        ctx.rotate(Math.PI/2);
        ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
        const fontSize=clamp(19-Math.max(0,count-12)*.65,9,19);
        ctx.font='700 '+fontSize+'px "Be Vietnam Pro", sans-serif';
        let label=names[i].name;
        const maxLength=count>20?9:count>12?13:18;
        if(label.length>maxLength)label=label.slice(0,maxLength-1)+'…';
        ctx.fillText(label,0,0,Math.min(radius*.58,180));
        ctx.restore();
      }
    }
    ctx.beginPath();ctx.arc(0,0,35,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    ctx.strokeStyle='rgba(12,10,28,.2)';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle='#17132a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 20px "Be Vietnam Pro",sans-serif';ctx.fillText('🐱',0,1);
    ctx.restore();
    $('wheelRemaining').textContent=state.remaining.length+' / '+state.roster.length+' lượt còn lại';
    $('spinStudentWheel').disabled=!state.remaining.length||state.spinning;
  }
  function renderHistory(){
    const list=$('gameHistory');
    list.innerHTML=state.history.length?state.history.map((name,index)=>'<li><span>'+String(state.history.length-index)+'.</span> '+escapeHtml(name)+'</li>').join(''):'<li class="empty">Chưa có lượt nào.</li>';
  }
  function addHistory(names){
    names.forEach(name=>state.history.unshift(name));
    renderHistory();
  }
  function showWinner(name){
    $('wheelWinner').textContent=name||'Chưa có kết quả';
    $('wheelMessage').textContent=name?'Đã chọn ngẫu nhiên từ lớp đang học. Bạn có thể tiếp tục lượt tiếp theo.':'Hãy chọn lớp để bắt đầu.';
  }
  function resetRound(){
    state.remaining=state.roster.slice();
    state.history=[];
    state.rotation=0;
    state.spinning=false;
    canvas.style.transition='none';
    canvas.style.transform='rotate(0deg)';
    showWinner('');
    $('quickDrawResults').innerHTML='<div class="empty">Kết quả sẽ xuất hiện tại đây.</div>';
    $('teamResults').innerHTML='<div class="empty">Chọn lớp và nhấn “Chia đội”.</div>';
    renderHistory();renderWheel();
  }
  async function loadRoster(){
    const classId=$('gameClassSelector').value;
    if(!classId){state.roster=[];state.remaining=[];state.loadedClassId='';resetRound();setStatus('Hãy chọn lớp học trước.',true);return}
    const api=window.katlearnTeacherGames;
    if(!api)throw new Error('Chức năng danh sách lớp chưa sẵn sàng.');
    $('gameReloadRoster').disabled=true;
    setStatus('Đang tải danh sách học sinh…');
    try{
      const roster=await api.getRoster(classId);
      state.roster=roster;state.loadedClassId=classId;resetRound();
      setStatus(roster.length?'Đã tải '+roster.length+' học sinh. Danh sách chỉ được giữ tạm trong phiên này.':'Lớp này chưa có học sinh.',!roster.length);
    }finally{$('gameReloadRoster').disabled=false}
  }
  async function loadClasses(){
    const api=window.katlearnTeacherGames;
    if(!api)return;
    try{
      const classes=await api.getClasses();
      state.classes=classes;
      const select=$('gameClassSelector');
      const previous=select.value;
      select.innerHTML='<option value="">Chọn lớp học…</option>'+classes.map(c=>'<option value="'+escapeHtml(c.id)+'">'+escapeHtml(c.name)+(c.grade?' · Khối '+escapeHtml(c.grade):'')+'</option>').join('');
      if(classes.some(c=>c.id===previous))select.value=previous;
      else if(classes.length===1)select.value=classes[0].id;
      if(select.value)await loadRoster();
      else setStatus(classes.length?'Đã tải '+classes.length+' lớp. Hãy chọn lớp.':'Chưa có lớp nào được tạo.',!classes.length);
    }catch(error){setStatus(error.message||'Không thể tải lớp học.',true)}
  }
  function spinWheel(){
    if(state.spinning||!state.remaining.length)return;
    const index=randomIndex(state.remaining.length);
    const slice=360/state.remaining.length;
    const desired=(360-(index+.5)*slice)%360;
    const current=state.rotation%360;
    const delta=((desired-current)+360)%360;
    const finalRotation=state.rotation+360*6+delta;
    state.spinning=true;renderWheel();
    canvas.style.transition='transform 4.2s cubic-bezier(.12,.72,.08,1)';
    canvas.style.transform='rotate('+finalRotation+'deg)';
    window.setTimeout(()=>{
      state.rotation=finalRotation%360;
      canvas.style.transition='none';canvas.style.transform='rotate('+state.rotation+'deg)';
      const winner=state.remaining.splice(index,1)[0];
      if(winner){addHistory([winner.name]);showWinner(winner.name)}
      state.spinning=false;renderWheel();
    },4300);
  }
  function quickDraw(){
    if(!state.remaining.length){$('quickDrawResults').innerHTML='<div class="empty">Đã gọi hết học sinh trong vòng này. Bấm “Vòng mới” để bắt đầu lại.</div>';return}
    const count=clamp(Number($('quickDrawCount').value)||1,1,5);
    const selected=[];
    for(let i=0;i<Math.min(count,state.remaining.length);i++){
      selected.push(state.remaining.splice(randomIndex(state.remaining.length),1)[0]);
    }
    addHistory(selected.map(x=>x.name));
    $('quickDrawResults').innerHTML=selected.map((s,i)=>'<article class="quick-draw-winner"><span>'+(i+1)+'</span><strong>'+escapeHtml(s.name)+'</strong><small>Đã được chọn</small></article>').join('');
    if(selected.length)showWinner(selected[0].name);
    renderWheel();
  }
  function makeTeams(){
    if(!state.roster.length){$('teamResults').innerHTML='<div class="empty">Chưa có danh sách học sinh.</div>';return}
    const count=clamp(Number($('teamCount').value)||2,2,8);
    const teams=Array.from({length:Math.min(count,state.roster.length)},(_,i)=>({name:'Đội '+(i+1),members:[]}));
    shuffle(state.roster).forEach((student,index)=>teams[index%teams.length].members.push(student));
    $('teamResults').innerHTML=teams.map(team=>'<article class="team-card"><h3>'+team.name+'</h3><ol>'+team.members.map(s=>'<li>'+escapeHtml(s.name)+'</li>').join('')+'</ol></article>').join('');
  }
  function setTab(name){
    document.querySelectorAll('[data-classroom-game-tab]').forEach(button=>{
      const active=button.dataset.classroomGameTab===name;
      button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));
    });
    document.querySelectorAll('[data-classroom-game-panel]').forEach(panel=>{
      const active=panel.dataset.classroomGamePanel===name;
      panel.hidden=!active;panel.classList.toggle('active',active);
    });
  }
  $('gameClassSelector').addEventListener('change',()=>loadRoster().catch(e=>setStatus(e.message,true)));
  $('gameReloadRoster').addEventListener('click',()=>loadRoster().catch(e=>setStatus(e.message,true)));
  $('gameResetRound').addEventListener('click',resetRound);
  $('spinStudentWheel').addEventListener('click',spinWheel);
  $('quickDrawButton').addEventListener('click',quickDraw);
  $('shuffleTeamsButton').addEventListener('click',makeTeams);
  document.querySelectorAll('[data-classroom-game-tab]').forEach(button=>button.addEventListener('click',()=>setTab(button.dataset.classroomGameTab)));
  window.addEventListener('katlearn-teacher-auth-change',event=>{
    if(event.detail?.teacherAccess)void loadClasses();
    else{state.roster=[];state.remaining=[];resetRound();setStatus('Cần đăng nhập bằng tài khoản có quyền giáo viên.',true)}
  });
  window.addEventListener('katlearn-teacher-page-change',event=>{
    if(event.detail?.page==='games'&&window.katlearnTeacherGames)void loadClasses();
  });
  window.addEventListener('beforeunload',()=>{state.roster=[];state.remaining=[];state.history=[]});
  renderWheel();
})();