/* tests for the multi-player layer, the levels and the beginner worlds */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
function ok(label, cond, detail){
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: '+label+(detail!==undefined?('  -> '+JSON.stringify(detail)):'')); }
}

const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });

function boot(store){
  let html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  if (store){
    const seed='<script>'+Object.keys(store).map(k=>
      'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(store[k])+');').join('')+'<\/script>';
    html=html.replace('</head>', seed+'</head>');
  }
  return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
}
const ev=(d,src)=>d.window.eval(src);

(async ()=>{
/* ---------- 1. a brand new device asks once, then remembers ---------- */
{
  const d=boot(null);
  await new Promise(r=>setTimeout(r,900));
  ok('fresh device shows the who-is-playing screen',
     ev(d,"document.getElementById('s-add').classList.contains('on')"));
  ok('fresh device has no players yet', ev(d,'players().length')===0);
  ok('the back arrow is hidden on the first run',
     ev(d,"document.getElementById('addCancel').style.display")==='none');
  ok('three levels are offered', ev(d,"document.querySelectorAll('#addLevels [data-lv]').length")===3);
  // choose "brand new" and go
  ev(d,"document.querySelector('#addLevels [data-lv=\"new\"]').click()");
  ok('the chosen level is ticked', ev(d,'ADD.level')==='new');
  ev(d,"document.getElementById('addName').value='Amara'");
  ev(d,"document.getElementById('addSave').click()");
  ok('the player was created', ev(d,'players().length')===1);
  ok('the name was kept', ev(d,'activePlayer().name')==='Amara');
  ok('the level was kept', ev(d,'playerLevel()')==='new');
  ok('it lands on the home screen',
     ev(d,"document.getElementById('s-home').classList.contains('on')"));
  ok('a beginner starts at the beginner rating', ev(d,'myRating()')===600);
  ok('the beginner button is visible',
     ev(d,"document.getElementById('begBtn').style.display")!=='none');
  ok('openings are hidden from a beginner',
     ev(d,"document.getElementById('playBtn').style.display")==='none');
  ok('the hardest ladder is hidden from a beginner',
     ev(d,"document.getElementById('tacHardBtn').style.display")==='none');
  const saved = d.window.localStorage.getItem('knightschool:players');
  ok('the choice was written to storage', !!saved && saved.includes('Amara'));

  /* the same device, opened again */
  const d2=boot({'knightschool:players':saved});
  await new Promise(r=>setTimeout(r,900));
  ok('a returning device does not ask again',
     ev(d2,"document.getElementById('s-home').classList.contains('on')"));
  ok('the player came back', ev(d2,'activePlayer().name')==='Amara');
}

/* ---------- 2. an old single-player save becomes Faye, untouched ---------- */
{
  const old = JSON.stringify({ stars:{'w13:0':3,'w13:1':2}, badges:['c2','c3'],
                               rating:1455, ratingPlays:60, solvedFens:['x'], streak:5 });
  const d=boot({'knightschool:progress':old});
  await new Promise(r=>setTimeout(r,900));
  ok('the old save is not thrown away', ev(d,'players().length')===1);
  ok('it is treated as a tournament player', ev(d,'playerLevel()')==='club');
  ok('the rating survived', ev(d,'myRating()')===1455);
  ok('the badges survived', ev(d,'(SAVE.badges||[]).length')===2);
  ok('the stars survived', ev(d,'totalStars()')===5);
  ok('the streak survived', ev(d,'SAVE.streak')===5);
  ok('no beginner button for a club player',
     ev(d,"document.getElementById('begBtn').style.display")==='none');
  ok('the hardest ladder is offered',
     ev(d,"document.getElementById('tacHardBtn').style.display")!=='none');

  /* add a second, stronger friend and check nothing bleeds across */
  ev(d,"addPlayer('Rafi','club'); repaintForPlayer();");
  ok('two players now', ev(d,'players().length')===2);
  ok('the new player is the active one', ev(d,'activePlayer().name')==='Rafi');
  ok('the new player starts with no stars', ev(d,'totalStars()')===0);
  ok('the new player starts with no badges', ev(d,'(SAVE.badges||[]).length')===0);
  ev(d,"SAVE.stars['w1:0']=3; save();");
  ok("the new player's star is theirs", ev(d,'totalStars()')===3);
  ev(d,"switchTo(players()[0].id)");
  ok('switching back restores the first player', ev(d,'activePlayer().name')==='Faye');
  ok("the first player's stars are unchanged", ev(d,'totalStars()')===5);
  ok("the first player's rating is unchanged", ev(d,'myRating()')===1455);
  ev(d,"switchTo(players()[1].id)");
  ok("the second player's star is still there", ev(d,'totalStars()')===3);

  /* the switcher is on screen */
  ok('a chip per player plus an add button',
     ev(d,"document.querySelectorAll('#playerBar button').length")===3);
  ok('the active chip is marked',
     ev(d,"document.querySelectorAll('#playerBar .pchip.on').length")===1);
  ev(d,"document.querySelector('#playerBar [data-p=\"p1\"]').click()");
  ok('tapping a chip switches player', ev(d,'activePlayer().id')==='p1');

  /* editing and removing a player, from the grown-ups panel */
  ev(d,"paintParentPlayers()");
  ok('the grown-ups panel lists both',
     ev(d,"document.querySelectorAll('#parentPlayers [data-edit]').length")===2);
  ev(d,"document.querySelector('#parentPlayers [data-edit=\"p2\"]').click()");
  ok('tapping a player opens the editor',
     ev(d,"document.getElementById('s-add').classList.contains('on')"));
  ok('the editor is prefilled with the name',
     ev(d,"document.getElementById('addName').value")==='Rafi');
  ok('the editor is prefilled with the level', ev(d,'ADD.level')==='club');
  ev(d,"document.querySelector('#addLevels [data-lv=\"some\"]').click()");
  ev(d,"document.getElementById('addName').value='Rafiq'");
  ev(d,"document.getElementById('addSave').click()");
  ok('editing renames without adding a player', ev(d,'players().length')===2);
  ok('the new name stuck', ev(d,"players().find(p=>p.id==='p2').name")==='Rafiq');
  ok('the new level stuck', ev(d,"players().find(p=>p.id==='p2').level")==='some');
  ok('the edited stars are untouched',
     ev(d,"Object.values(players().find(p=>p.id==='p2').data.stars).reduce((a,b)=>a+b,0)")===3);
  ok('it goes back to the grown-ups panel',
     ev(d,"document.getElementById('s-parent').classList.contains('on')"));

  ev(d,"showEditPlayer('p2')");
  ok('the remove button is offered when there are two players',
     ev(d,"document.getElementById('addRemove').style.display")!=='none');
  ev(d,"document.getElementById('addRemove').click()");
  ok('one tap only asks', ev(d,'players().length')===2);
  ev(d,"document.getElementById('addRemove').click()");
  ok('two taps removes', ev(d,'players().length')===1);
  ok('the survivor is still Faye', ev(d,'activePlayer().name')==='Faye');
  ok('her stars survived the removal', ev(d,'totalStars()')===5);
  ev(d,"showEditPlayer(activePlayer().id)");
  ok('the last player offers no remove button',
     ev(d,"document.getElementById('addRemove').style.display")==='none');
  ok('the last player cannot be removed even from code',
     ev(d,"(()=>{removePlayer(activePlayer().id); return players().length;})()")===1);
}

/* ---------- 3. levels really do change what is offered ---------- */
{
  const d=boot(null);
  await new Promise(r=>setTimeout(r,900));
  ev(d,"addPlayer('B','new'); addPlayer('S','some'); addPlayer('C','club');");
  const byName = n => ev(d,`players().find(p=>p.name===${JSON.stringify(n)}).id`);

  ev(d,`switchTo(${JSON.stringify(byName('B'))})`);
  ok('a beginner is capped at 1000', ev(d,'levelInfo().max')===1000);
  ok('a beginner is never shown the hardest puzzles',
     ev(d,'TACTICS.filter(t=>t.lvl===6).every(t=>!allowedForLevel(t))'));
  ok('a beginner is never shown a puzzle above the cap',
     ev(d,'TACTICS.filter(t=>allowedForLevel(t)).every(t=>t.rating && t.rating<=1000)'));
  ok('a beginner still has plenty to solve',
     ev(d,'TACTICS.filter(t=>allowedForLevel(t)).length')>150,
     ev(d,'TACTICS.filter(t=>allowedForLevel(t)).length'));
  ev(d,"tacStart(false,false,'','')");
  ok('the beginner puzzle queue is all within reach',
     ev(d,'T.order.every(i=>TACTICS[i].rating && TACTICS[i].rating<=1000)'));
  ok('the beginner queue is not empty', ev(d,'T.order.length')>100);
  ev(d,"paintArena()");
  ok('a beginner sees only the gentle champions',
     ev(d,"Array.from(document.querySelectorAll('#arenaList [data-c]')).every(b=>BEG_CHARS.includes(b.dataset.c))"));
  ok('a beginner sees no hard tier',
     ev(d,"document.getElementById('arenaList').innerHTML.indexOf('Harder endgames')")===-1);
  ok("the beginner's daily endgame is a gentle one",
     ev(d,'BEG_CHARS.includes(weakestEndgame().id)'));
  ev(d,"dailyPlan()");
  ok("the beginner's daily puzzles are all within reach",
     ev(d,'SAVE.daily.plan.puzzles.every(i=>TACTICS[i].rating && TACTICS[i].rating<=1000)'));

  ev(d,`switchTo(${JSON.stringify(byName('S'))})`);
  ok('a middling player is capped at 1600', ev(d,'levelInfo().max')===1600);
  ev(d,"tacStart(false,false,'','')");
  ok('no puzzle above 1600 for a middling player',
     ev(d,'T.order.every(i=>!TACTICS[i].rating || TACTICS[i].rating<=1600)'));
  ev(d,"paintArena()");
  ok('a middling player sees the whole gentle set',
     ev(d,"document.querySelectorAll('#arenaList [data-c]').length")>BEGN(d));
  ok('a middling player still gets no hard tier',
     ev(d,"document.getElementById('arenaList').innerHTML.indexOf('Harder endgames')")===-1);

  ev(d,`switchTo(${JSON.stringify(byName('C'))})`);
  ok('a club player has no cap', ev(d,'TACTICS.every(t=>allowedForLevel(t))'));
  ok('a club player starts at 1200', ev(d,'myRating()')===1200);
  ev(d,"paintArena()");
  ok('a club player gets the hard tier',
     ev(d,"document.getElementById('arenaList').innerHTML.indexOf('Harder endgames')")>=0);
  ok('a club player sees every champion',
     ev(d,"document.querySelectorAll('#arenaList [data-c]').length")===ev(d,'CHARS.length'));
}
function BEGN(d){ return ev(d,'BEG_CHARS.length'); }

/* ---------- 4. the beginner worlds, played through ---------- */
{
  const d=boot(null);
  await new Promise(r=>setTimeout(r,900));
  ev(d,"addPlayer('B','new'); repaintForPlayer();");
  const begIds = ev(d,"JSON.stringify(WORLDS.filter(w=>w.beg).map(w=>w.id))");
  const ids = JSON.parse(begIds);
  ok('eleven beginner worlds', ids.length===11, ids);
  ok('the openings world is not among them', !ids.includes('w13'));
  ev(d,"document.getElementById('begBtn').click()");
  ok('the beginner list opens',
     ev(d,"document.getElementById('s-beg').classList.contains('on')"));
  ok('every beginner world is listed',
     ev(d,"document.querySelectorAll('#begList [data-bw]').length")===11);
  ok('the pattern worlds are not mixed into the beginner list',
     ev(d,"Array.from(document.querySelectorAll('#begList [data-bw]')).every(b=>WORLDS.find(w=>w.id===b.dataset.bw).beg)"));

  /* every star task: the claimed gold is the true shortest solution */
  const starCheck = ev(d,`(()=>{
    const out=[];
    for (const w of WORLDS.filter(x=>x.beg))
      for (const t of w.tasks)
        if (t.kind==='stars'){
          const opt = starOptimal(t.from, t.piece.toLowerCase(), t.stars);
          out.push({w:w.id, from:t.from, pc:t.piece, opt, gold:t.gold, silver:t.silver,
                    onStart:t.stars.includes(t.from), dup:new Set(t.stars).size!==t.stars.length});
        }
    return JSON.stringify(out);
  })()`);
  const stars=JSON.parse(starCheck);
  ok('ten star tasks', stars.length===10, stars.length);
  for (const t of stars){
    ok(t.w+' '+t.pc+t.from+' gold is the true shortest', t.opt===t.gold, t);
    ok(t.w+' '+t.pc+t.from+' silver is slacker than gold', t.silver>t.gold, t);
    ok(t.w+' '+t.pc+t.from+' no star sits on the start square', !t.onStart, t);
    ok(t.w+' '+t.pc+t.from+' no duplicate stars', !t.dup, t);
  }

  /* play the first rook task with the optimal route and check it scores three */
  ev(d,"L.mode='beg'; openWorld('w1',0);");
  ok('the rook task loaded', ev(d,"L.task.kind")==='stars');
  ok('the piece is drawn on its square',
     ev(d,"!!L.cells['a1'].querySelector('.pc')"));
  ok('both stars are marked',
     ev(d,"document.querySelectorAll('#board .sq.star').length")===2);
  ok('the legal squares are dotted',
     ev(d,"document.querySelectorAll('#board .sq.hint').length")===14);
  ok('no hint button on a star task',
     ev(d,"document.getElementById('showBtn').style.display")==='none');
  ok('an illegal square is refused',
     ev(d,"(()=>{tapStars('b2'); return L.spos;})()")==='a1');
  ev(d,"tapStars('a4')");
  ok('a legal move moves the piece', ev(d,'L.spos')==='a4');
  ok('one star left', ev(d,'L.sleft.length')===1);
  ev(d,"tapStars('d4')");
  ok('collecting the last star finishes', ev(d,'L.done')===true);
  ok('the optimal route earns three stars', ev(d,"SAVE.stars['w1:0']")===3);

  /* the pawn task teaches the double step */
  ev(d,"openWorld('w6',0);");
  ok('a pawn on its home square may go two',
     ev(d,"JSON.stringify(freeMoves('e2','p'))")==='["e3","e4"]');
  ok('a pawn further up may only go one',
     ev(d,"JSON.stringify(freeMoves('e4','p'))")==='["e5"]');
  ev(d,"tapStars('e4'); tapStars('e5');");
  ok('the pawn task can be finished', ev(d,"SAVE.stars['w6:0']")===3);

  /* the knight cannot step sideways */
  ok('a knight on g1 has two moves',
     ev(d,"freeMoves('g1','n').sort().join(',')")==='e2,f3,h3',
     ev(d,"freeMoves('g1','n').sort().join(',')"));
  ok('a bishop never leaves its colour',
     ev(d,"freeMoves('c1','b').every(sq=>((FL.indexOf(sq[0])+ +sq[1])%2)===((FL.indexOf('c')+1)%2))"));
  ok('a king has exactly three moves in the corner',
     ev(d,"freeMoves('a1','k').length")===3);
  ok('a queen in the corner has 21 moves',
     ev(d,"freeMoves('a1','q').length")===21);
  ok('a rook always has 14 moves',
     ev(d,"['a1','d4','h8','e2'].every(sq=>freeMoves(sq,'r').length===14)"));

  /* the chess tasks in the beginner worlds are all sound */
  const pos = ev(d,`(()=>{
    const out=[];
    for (const w of WORLDS.filter(x=>x.beg)) for (const t of w.tasks){
      if (t.kind==='stars') continue;
      const r={w:w.id,kind:t.kind,hidden:!!t.hidden};
      let g; try{ g=new Chess(t.fen); }catch(e){ r.err='bad fen'; out.push(r); continue; }
      const legal=g.moves();
      r.turn=g.turn; r.legal=legal.length;
      r.kings = (()=>{let n=0;for(let sq=0;sq<128;sq++){if(sq&0x88){sq+=7;continue;}
        const p=g.board[sq]; if(p&&p.toLowerCase()==='k')n++;} return n;})();
      if (t.kind==='grab'){
        const caps=legal.filter(m=>g.get(sqToAlg(m.to)));
        r.capsToTarget=caps.filter(m=>sqToAlg(m.to)===t.target).length;
        r.otherCaps=caps.filter(m=>sqToAlg(m.to)!==t.target).length;
      }
      if (t.kind==='escape'){ r.inCheck=g.inCheck(); }
      if (t.kind==='check'){ let n=0; for(const m of legal){const gg=new Chess(t.fen);
        gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')}); if(gg.inCheck())n++;} r.checks=n; }
      if (t.kind==='mate'){ let n=0; for(const m of legal){const gg=new Chess(t.fen);
        gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')}); if(gg.isCheckmate())n++;} r.mates=n; }
      if (t.kind==='safe'){
        r.attacked=attacked(g,t.piece,false);
        const froms=legal.filter(m=>sqToAlg(m.from)===t.piece);
        let n=0; for(const m of froms){const gg=new Chess(t.fen);
          gg.move({from:t.piece,to:sqToAlg(m.to),promotion:(m.promotion||'q')});
          if(!attacked(gg,sqToAlg(m.to),false)) n++;}
        r.safeSquares=n; r.unsafeSquares=froms.length-n;
      }
      out.push(r);
    }
    return JSON.stringify(out);
  })()`);
  const rows=JSON.parse(pos);
  ok('every beginner position parsed', rows.every(r=>!r.err), rows.filter(r=>r.err));
  ok('every beginner position has two kings', rows.every(r=>r.kings===2), rows.filter(r=>r.kings!==2));
  ok('it is the child’s move, except where the lesson opens with the opponent’s',
     rows.every(r=>r.turn==='w' || r.kind==='follow'), rows.filter(r=>r.turn!=='w' && r.kind!=='follow'));
  ok('every beginner position has a legal move', rows.every(r=>r.legal>0));
  for (const r of rows.filter(r=>r.kind==='grab')){
    ok(r.w+' grab: the target can be captured', r.capsToTarget===1, r);
    if (!r.hidden) ok(r.w+' grab: no other capture to confuse', r.otherCaps===0, r);
    else ok(r.w+' hidden grab: there is a decoy to reject', r.otherCaps>=1, r);
  }
  for (const r of rows.filter(r=>r.kind==='escape'))
    ok(r.w+' escape: the king really is in check', r.inCheck===true, r);
  for (const r of rows.filter(r=>r.kind==='check'))
    ok(r.w+' check: a check is available', r.checks>0, r);
  for (const r of rows.filter(r=>r.kind==='mate'))
    ok(r.w+' mate: a mate in one exists', r.mates>0, r);
  for (const r of rows.filter(r=>r.kind==='safe')){
    ok(r.w+' safe: the piece really is attacked', r.attacked===true, r);
    ok(r.w+' safe: there is a safe square', r.safeSquares>0, r);
    ok(r.w+' safe: and a wrong one, so it is a puzzle', r.unsafeSquares>0, r);
  }

  /* navigation: the last task of the last beginner world goes back to the list */
  ev(d,"L.mode='beg'; openWorld('w1',2); L.ti=2; document.getElementById('nextBtn').click();");
  ok('finishing a beginner world moves to the next one', ev(d,'L.world.id')==='w2');
  ev(d,"(()=>{const begs=WORLDS.filter(w=>w.beg); const last=begs[begs.length-1]; L.mode='beg'; openWorld(last.id,0); L.ti=last.tasks.length-1; document.getElementById('nextBtn').click();})()");
  ok('finishing the last beginner world returns to the beginner list',
     ev(d,"document.getElementById('s-beg').classList.contains('on')"));
  ev(d,"L.mode='beg'; openWorld('w2',0); document.getElementById('playBack').click();");
  ok('back from a beginner lesson goes to the beginner list',
     ev(d,"document.getElementById('s-beg').classList.contains('on')"));

  /* and the openings path is untouched */
  ev(d,"switchTo(players()[0].id); document.getElementById('playBtn').click();");
  ok('the openings picker lists every opening lesson',
     ev(d,"document.querySelectorAll('#worldList [data-task]').length")===
     ev(d,"WORLDS.find(w=>w.id==='w13').tasks.length"));
  ok('there are fifteen opening lessons now',
     ev(d,"WORLDS.find(w=>w.id==='w13').tasks.length")===15,
     ev(d,"WORLDS.find(w=>w.id==='w13').tasks.length"));
  ok('every opening lesson has a name of its own',
     ev(d,"WORLDS.find(w=>w.id==='w13').tasks.every((_,i)=>!!OPENING_NAMES[i])"));
  ev(d,"openWorld('w13',0)");
  ok('an opening lesson still shows its opening name',
     ev(d,"document.getElementById('lessonName').textContent")==='Italian');
  ev(d,"document.getElementById('playBack').click()");
  ok('back from an opening goes to the openings picker',
     ev(d,"document.getElementById('s-map').classList.contains('on')"));
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
