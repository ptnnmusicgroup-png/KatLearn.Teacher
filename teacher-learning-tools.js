/* KatLearn Teacher — original classroom learning tools.
 * Student roster access is delegated to the existing teacher-authorized API.
 * Tool content and student names remain in page memory; nothing is persisted.
 */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const root=$('learningToolLibrary');
  if(!root)return;
  const cards=[...document.querySelectorAll('[data-tool-card]')];
  const panels=[...document.querySelectorAll('[data-learning-panel]')];
  const filters=[...document.querySelectorAll('[data-tool-filter]')];
  const search=$('learningToolSearch');
  let flashcards=[],flashIndex=0,flashRevealed=false;
  let matchDeck=[],matchOpen=[],matchCount=0,matchLocked=false;
  let timerId=null,timerRemaining=300;
  let prompts=[],promptRemaining=[];
  let pairRound=[];
  let wordPool=[],activeWord='',scrambled='';
  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const shuffle=items=>{
    const copy=items.slice();
    for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]]}
    return copy;
  };
  const lines=value=>String(value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  function filterTools(){
    const term=(search?.value||'').trim().toLocaleLowerCase('vi');
    const active=filters.find(x=>x.classList.contains('active'))?.dataset.toolFilter||'all';
    let visible=0;
    cards.forEach(card=>{
      const category=card.dataset.toolCategory||'';
      const hay=(card.dataset.toolSearch||card.textContent).toLocaleLowerCase('vi');
      const show=(active==='all'||category===active)&&(!term||hay.includes(term));
      card.hidden=!show;if(show)visible++;
    });
    const empty=$('learningToolsEmpty');if(empty)empty.hidden=visible>0;
  }
  function openTool(id){
    if(['wheel','quick','teams'].includes(id)){
      panels.forEach(panel=>panel.hidden=true);
      const tab=document.querySelector('[data-classroom-game-tab="'+id+'"]');
      tab?.click();
      document.querySelector('[data-classroom-game-panel="'+id+'"]')?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    document.querySelectorAll('[data-classroom-game-panel]').forEach(panel=>panel.hidden=true);
    panels.forEach(panel=>panel.hidden=panel.dataset.learningPanel!==id);
    document.querySelectorAll('[data-classroom-game-tab]').forEach(tab=>{tab.classList.remove('active');tab.setAttribute('aria-selected','false')});
    $('tool-'+id)?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  filters.forEach(button=>button.addEventListener('click',()=>{
    filters.forEach(x=>x.classList.toggle('active',x===button));filterTools();
  }));
  search?.addEventListener('input',filterTools);
  cards.forEach(card=>card.addEventListener('click',()=>openTool(card.dataset.toolCard)));
  $('toolBackToLibrary')?.addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'}));
  document.querySelectorAll('[data-tool-back]').forEach(button=>button.addEventListener('click',()=>root.scrollIntoView({behavior:'smooth',block:'start'})));

  // Flashcards
  function renderFlashcard(){
    const card=$('flashcardFace'),counter=$('flashcardCounter');
    if(!card||!flashcards.length){if(card)card.innerHTML='<strong>Chưa có thẻ học</strong><small>Nhập nội dung ở trên rồi tạo bộ thẻ.</small>';if(counter)counter.textContent='0 / 0';return}
    const item=flashcards[flashIndex];
    card.innerHTML='<strong>'+escapeHtml(flashRevealed?item.back:item.front)+'</strong><small>'+(flashRevealed?'Mặt sau':'Mặt trước')+' · Chạm để lật</small>';
    counter.textContent=(flashIndex+1)+' / '+flashcards.length;
  }
  $('createFlashcards')?.addEventListener('click',()=>{
    const parsed=lines($('flashcardInput')?.value).map(line=>line.split('|')).filter(parts=>parts.length>=2).map(parts=>({front:parts[0].trim(),back:parts.slice(1).join('|').trim()})).filter(x=>x.front&&x.back);
    if(!parsed.length){$('flashcardStatus').textContent='Hãy nhập ít nhất một dòng theo dạng Mặt trước | Mặt sau.';return}
    flashcards=parsed;flashIndex=0;flashRevealed=false;renderFlashcard();$('flashcardStatus').textContent='Đã tạo '+parsed.length+' thẻ. Bộ thẻ chỉ nằm trong phiên hiện tại.';
  });
  $('flashcardFace')?.addEventListener('click',()=>{if(!flashcards.length)return;flashRevealed=!flashRevealed;renderFlashcard()});
  $('flashcardReveal')?.addEventListener('click',()=>{if(!flashcards.length)return;flashRevealed=!flashRevealed;renderFlashcard()});
  $('flashcardPrev')?.addEventListener('click',()=>{if(!flashcards.length)return;flashIndex=(flashIndex-1+flashcards.length)%flashcards.length;flashRevealed=false;renderFlashcard()});
  $('flashcardNext')?.addEventListener('click',()=>{if(!flashcards.length)return;flashIndex=(flashIndex+1)%flashcards.length;flashRevealed=false;renderFlashcard()});
  $('flashcardShuffle')?.addEventListener('click',()=>{if(!flashcards.length)return;flashcards=shuffle(flashcards);flashIndex=0;flashRevealed=false;renderFlashcard()});

  // Memory matching game
  function renderMatchDeck(){
    const board=$('matchingBoard');if(!board)return;
    board.innerHTML='';
    matchDeck.forEach((item,index)=>{
      const button=document.createElement('button');button.type='button';button.className='tool-match-card';
      button.textContent=item.open||item.matched?item.label:'?';
      button.disabled=!!item.matched;
      if(item.open)button.classList.add('is-open');
      if(item.matched)button.classList.add('is-matched');
      button.addEventListener('click',()=>flipMatch(index));board.appendChild(button);
    });
    $('matchingStatus').textContent=matchCount+' / '+(matchDeck.length/2)+' cặp đã ghép';
  }
  function createMatchDeck(){
    const pairs=lines($('matchingInput')?.value).map(line=>line.split('|')).filter(p=>p.length>=2).map(p=>[p[0].trim(),p.slice(1).join('|').trim()]).filter(p=>p[0]&&p[1]);
    if(pairs.length<2){$('matchingStatus').textContent='Nhập ít nhất 2 cặp theo dạng Từ | Nghĩa.';return}
    matchDeck=shuffle(pairs.flatMap((p,index)=>[{pair:index,label:p[0],open:false,matched:false},{pair:index,label:p[1],open:false,matched:false}]));
    matchOpen=[];matchCount=0;matchLocked=false;renderMatchDeck();
  }
  function flipMatch(index){
    const item=matchDeck[index];if(!item||item.open||item.matched||matchLocked)return;
    item.open=true;matchOpen.push(index);renderMatchDeck();
    if(matchOpen.length===2){
      const [a,b]=matchOpen;
      if(matchDeck[a].pair===matchDeck[b].pair){
        matchDeck[a].matched=true;matchDeck[b].matched=true;matchCount++;matchOpen=[];renderMatchDeck();
        if(matchCount===matchDeck.length/2)$('matchingStatus').textContent='Hoàn thành! Tất cả các cặp đã được ghép.';
      }else{
        matchLocked=true;window.setTimeout(()=>{matchDeck[a].open=false;matchDeck[b].open=false;matchOpen=[];matchLocked=false;renderMatchDeck()},750);
      }
    }
  }
  $('createMatchingGame')?.addEventListener('click',createMatchDeck);

  // Class timer
  function renderTimer(){
    const minutes=Math.floor(timerRemaining/60),seconds=timerRemaining%60;
    $('classTimerDisplay').textContent=String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0');
  }
  function stopTimer(){if(timerId!==null){window.clearInterval(timerId);timerId=null}}
  function resetTimer(){
    stopTimer();const mins=Math.max(1,Math.min(90,Number($('classTimerMinutes')?.value)||5));
    timerRemaining=mins*60;renderTimer();$('classTimerStatus').textContent='Sẵn sàng bắt đầu hoạt động.';
    $('classTimerStart').textContent='Bắt đầu';
  }
  $('classTimerStart')?.addEventListener('click',()=>{
    if(timerId!==null){stopTimer();$('classTimerStart').textContent='Tiếp tục';$('classTimerStatus').textContent='Đã tạm dừng.';return}
    if(timerRemaining<=0)resetTimer();
    $('classTimerStart').textContent='Tạm dừng';$('classTimerStatus').textContent='Đồng hồ đang chạy.';
    timerId=window.setInterval(()=>{
      timerRemaining=Math.max(0,timerRemaining-1);renderTimer();
      if(timerRemaining===0){stopTimer();$('classTimerStart').textContent='Bắt đầu lại';$('classTimerStatus').textContent='Hết giờ!';}
    },1000);
  });
  $('classTimerReset')?.addEventListener('click',resetTimer);
  $('classTimerMinutes')?.addEventListener('change',resetTimer);

  // Question prompt picker (no repeats until reset)
  function resetPrompts(){prompts=lines($('questionPool')?.value);promptRemaining=shuffle(prompts);$('questionDrawStatus').textContent=prompts.length?'Đã nạp '+prompts.length+' câu hỏi.':'Nhập câu hỏi, mỗi dòng một câu.'}
  $('loadQuestionPool')?.addEventListener('click',resetPrompts);
  $('drawQuestion')?.addEventListener('click',()=>{
    if(!promptRemaining.length)resetPrompts();
    if(!promptRemaining.length){$('questionDrawResult').textContent='Chưa có câu hỏi.';return}
    $('questionDrawResult').textContent=promptRemaining.pop();
    $('questionDrawStatus').textContent='Còn '+promptRemaining.length+' câu chưa được chọn trong lượt này.';
  });
  $('resetQuestionPool')?.addEventListener('click',()=>{resetPrompts();$('questionDrawResult').textContent='Sẵn sàng chọn câu hỏi.'});

  // Pair students from the currently selected authorized class
  $('makeRosterPairs')?.addEventListener('click',async()=>{
    const button=$('makeRosterPairs');button.disabled=true;
    try{
      const classId=$('gameClassSelector')?.value;
      const api=window.katlearnTeacherGames;
      if(!classId||!api)throw new Error('Hãy chọn lớp ở thanh phía trên.');
      const roster=await api.getRoster(classId);
      if(!roster.length)throw new Error('Lớp chưa có học sinh.');
      const students=shuffle(roster),groups=[];
      for(let i=0;i<students.length;i+=2)groups.push(students.slice(i,i+2));
      $('rosterPairResults').innerHTML=groups.map((group,index)=>'<article class="tool-roster-pair"><strong>'+(group.length===2?'CẶP '+(index+1):'NHÓM 3 · '+(index+1))+'</strong>'+group.map(s=>'<div>'+escapeHtml(s.name)+'</div>').join('')+'</article>').join('');
      $('rosterPairStatus').textContent='Đã ghép '+roster.length+' học sinh; danh sách chỉ được giữ trong bộ nhớ trang.';
    }catch(error){$('rosterPairStatus').textContent=error.message||'Không thể ghép cặp lúc này.'}
    finally{button.disabled=false}
  });

  // Simple classroom team scoreboard
  const scores=[0,0];
  function renderScores(){[0,1].forEach(i=>{ $('teamScore'+i).textContent=scores[i];$('teamScoreName'+i).textContent=$('teamScoreNameInput'+i).value.trim()||('Đội '+(i+1)); });}
  document.querySelectorAll('[data-score-change]').forEach(button=>button.addEventListener('click',()=>{
    const team=Number(button.dataset.scoreTeam),change=Number(button.dataset.scoreChange);
    scores[team]=Math.max(0,scores[team]+change);renderScores();
  }));
  ['teamScoreNameInput0','teamScoreNameInput1'].forEach(id=>$(id)?.addEventListener('input',renderScores));
  $('resetTeamScores')?.addEventListener('click',()=>{scores[0]=0;scores[1]=0;renderScores()});

  // Word scramble
  function loadWordPool(){wordPool=lines($('wordPoolInput')?.value);$('wordScrambleStatus').textContent=wordPool.length?'Đã nạp '+wordPool.length+' từ.':'Mỗi dòng nhập một từ hoặc cụm từ.';activeWord='';$('wordScrambleResult').textContent='Sẵn sàng xáo chữ.'}
  $('loadWordPool')?.addEventListener('click',loadWordPool);
  $('drawScrambledWord')?.addEventListener('click',()=>{
    if(!wordPool.length)loadWordPool();
    if(!wordPool.length){$('wordScrambleResult').textContent='Chưa có từ để xáo.';return}
    if(!wordPool.length)return;
    activeWord=wordPool.splice(Math.floor(Math.random()*wordPool.length),1)[0];
    const chars=Array.from(activeWord.replace(/\s+/g,''));
    scrambled=shuffle(chars).join(' · ');
    if(chars.length>1&&scrambled.replace(/ · /g,'')===chars.join(''))scrambled=shuffle(chars).join(' · ');
    $('wordScrambleResult').textContent=scrambled;
    $('wordScrambleAnswer').textContent='Đáp án sẽ hiện khi giáo viên chọn “Xem đáp án”.';
    $('wordScrambleStatus').textContent='Còn '+wordPool.length+' từ chưa được chọn.';
  });
  $('revealScrambledWord')?.addEventListener('click',()=>{$('wordScrambleAnswer').textContent=activeWord||'Chưa có từ nào được chọn.'});
  $('resetScrambledWords')?.addEventListener('click',loadWordPool);

  renderFlashcard();renderTimer();renderScores();filterTools();
  window.addEventListener('katlearn-teacher-page-change',event=>{if(event.detail?.page!=='games')stopTimer()});
  window.addEventListener('beforeunload',()=>{stopTimer();flashcards=[];matchDeck=[];pairRound=[];prompts=[];wordPool=[]});
})();
