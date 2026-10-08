/* coming back to what you missed: the Leitner boxes, the queue order,
   and the daily four that now mixes lessons, review and fresh puzzles */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
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
const ev=(d,s)=>d.window.eval(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
/* ---------- the boxes ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('R','club'); repaintForPlayer();");
  const F='6k1/8/8/8/8/8/8/R5K1 w - - 0 1';

  ev(d,`recordReview(${JSON.stringify(F)}, false)`);
  ok('a puzzle you got wrong starts in the first box', ev(d,`SAVE.review[${JSON.stringify(F)}].box`)===0);
  ok('and comes back tomorrow',
     ev(d,`SAVE.review[${JSON.stringify(F)}].due - today()`)===1);

  ev(d,`recordReview(${JSON.stringify(F)}, true)`);
  ok('solving it moves it up a box', ev(d,`SAVE.review[${JSON.stringify(F)}].box`)===1);
  ok('and pushes it three days out',
     ev(d,`SAVE.review[${JSON.stringify(F)}].due - today()`)===3);
  ev(d,`recordReview(${JSON.stringify(F)}, true); recordReview(${JSON.stringify(F)}, true);`);
  ok('three clean solves put it three weeks out',
     ev(d,`SAVE.review[${JSON.stringify(F)}].due - today()`)===21);
  ev(d,`recordReview(${JSON.stringify(F)}, false)`);
  ok('getting it wrong drops it all the way back',
     ev(d,`SAVE.review[${JSON.stringify(F)}].box`)===0 &&
     ev(d,`SAVE.review[${JSON.stringify(F)}].due - today()`)===1);
  ok('the boxes never run past the last one',
     ev(d,"(()=>{const f='x'; for(let i=0;i<20;i++) recordReview(f,true); return SAVE.review[f].box===BOX_DAYS.length-1;})()"));

  /* nothing is due until its day comes */
  ok('nothing is due today', ev(d,'dueFens().length')===0, ev(d,'JSON.stringify(dueFens())'));
  ev(d,`SAVE.review[${JSON.stringify(F)}].due = today() - 1`);
  ok('once its day passes it is due', ev(d,'dueFens().length')===1);

  /* the store cannot grow without limit */
  ev(d,"(()=>{ for (let i=0;i<1000;i++) recordReview('fen'+i, i%2===0); })()");
  ok('the review list is kept to a sensible size', ev(d,'Object.keys(SAVE.review).length')<=900,
     ev(d,'Object.keys(SAVE.review).length'));
  ok('and it keeps the ones coming back soonest', ev(d,`(()=>{
     const m=SAVE.review; const days=Object.values(m).map(v=>v.due-today());
     return Math.max.apply(null, days) <= 60;})()`));
}

/* ---------- solving a puzzle files it, and skipping files it too ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('R','club'); repaintForPlayer(); tacStart(false,false,'','');");
  const fen1=ev(d,'T.p.fen');
  ok('a puzzle is on the board', typeof fen1==='string' && fen1.length>10);
  ok('it is not filed yet', ev(d,'!(SAVE.review||{})[T.p.fen]'));
  ev(d,"document.getElementById('tacSkip').click()");
  ok('skipping files it for tomorrow',
     ev(d,`SAVE.review[${JSON.stringify(fen1)}] && SAVE.review[${JSON.stringify(fen1)}].box`)===0);

  /* solve one cleanly by playing the whole stored solution */
  const fen2=ev(d,'T.p.fen');
  for (let step=0; step<4; step++){
    const moved=ev(d,`(()=>{
       if (T.done) return false;
       const g=T.game, want=T.p.line[T.at||0];
       if (!want) return false;
       const mv=g.movesSan().find(x=>x.san.replace(/[+#]/g,'')===String(want).replace(/[+#]/g,''));
       if (!mv) return false;
       T.sel=null; tacTap(sqToAlg(mv.from)); tacTap(sqToAlg(mv.to));
       return true;})()`);
    if (!moved) break;
    await wait(700);
  }
  ok('a clean solve is filed one box up',
     ev(d,`(SAVE.review[${JSON.stringify(fen2)}]||{}).box`)===1,
     ev(d,'JSON.stringify(SAVE.review)').slice(0,200));
  ok('and pushed three days out',
     ev(d,`(SAVE.review[${JSON.stringify(fen2)}]||{}).due - today()`)===3);
}

/* ---------- due puzzles come to the front of the queue ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('R','club'); repaintForPlayer();");
  const picked=JSON.parse(ev(d,`(()=>{
     const idx=[];
     for (let i=0;i<TACTICS.length && idx.length<3;i+=311) if (allowedForLevel(TACTICS[i])) idx.push(i);
     for (const i of idx) SAVE.review[TACTICS[i].fen]={box:0, due: today()-1};
     return JSON.stringify(idx);})()`));
  ok('three puzzles were marked due', picked.length===3);
  ok('they are recognised as due', ev(d,'dueIndices().length')===3, ev(d,'dueIndices().length'));
  ev(d,"tacStart(false,false,'','')");
  const head=JSON.parse(ev(d,'JSON.stringify(T.order.slice(0,3))'));
  ok('and the queue starts with exactly those',
     head.slice().sort((a,b)=>a-b).join(',')===picked.slice().sort((a,b)=>a-b).join(','),
     {head, picked});
  ok('the rest of the queue is still there', ev(d,'T.order.length')>100);
  ok('nothing is listed twice',
     ev(d,'new Set(T.order).size')===ev(d,'T.order.length'));
}

/* ---------- the daily four ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); paintDaily();");
  ok('four things to do', ev(d,"document.querySelectorAll('#dailyItems [data-day]').length")===4);
  ok('one of them is a named pattern', ev(d,'dailyPlan().plan.lessons.length')===1);
  ok('two are puzzles', ev(d,'dailyPlan().plan.puzzles.length')===2);
  ok('and one is an endgame', !!ev(d,'dailyPlan().plan.endgame'));
  ok('every item has its own slot',
     ev(d,"new Set(Array.from(document.querySelectorAll('#dailyItems [data-day]')).map(b=>b.dataset.day)).size")===4);
  ok('the pattern lesson opens the tactics list, not the beginner one', ev(d,`(()=>{
     document.querySelector('#dailyItems [data-day="p0"]').click();
     return BEGMODE==='pat' && L.world && L.world.pat===true;})()`));

  /* a due puzzle is offered back, and labelled as a second go */
  const d2=boot(null); await wait(900);
  ev(d2,"addPlayer('F','club'); repaintForPlayer();");
  ev(d2,`(()=>{ const idx=[];
     for (let i=0;i<TACTICS.length && idx.length<2;i+=907) if (allowedForLevel(TACTICS[i])) idx.push(i);
     for (const i of idx) SAVE.review[TACTICS[i].fen]={box:0, due: today()-1};
     SAVE.daily=null; save(); })()`);
  ev(d2,"paintDaily()");
  ok('the puzzles due for review are the ones offered',
     ev(d2,'dailyPlan().plan.puzzles.every(i=>dueIndices().includes(i))'),
     ev(d2,'JSON.stringify(dailyPlan().plan.puzzles)'));
  ok('and they are labelled as another go',
     ev(d2,"Array.from(document.querySelectorAll('#dailyItems .nm')).some(e=>/Have another go/.test(e.textContent))"));
  ok('with a repeat mark rather than the lightning bolt',
     ev(d2,"Array.from(document.querySelectorAll('#dailyItems .em')).some(e=>e.textContent==='\\u{1F501}')"));

  /* a beginner is unaffected */
  const d3=boot(null); await wait(900);
  ev(d3,"addPlayer('B','new'); repaintForPlayer(); paintDaily();");
  ok('a beginner still gets three lessons', ev(d3,'dailyPlan().plan.lessons.length')===3);
  ok('and no puzzles', ev(d3,'dailyPlan().plan.puzzles.length')===0);
  ok('all from the beginner worlds',
     ev(d3,"dailyPlan().plan.lessons.every(l=>WORLDS.find(w=>w.id===l[0]).beg)"));
  ok('still four things', ev(d3,"document.querySelectorAll('#dailyItems [data-day]').length")===4);
}

/* ---------- it survives a reload ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); recordReview('abc', false); save();");
  const saved=d.window.localStorage.getItem('knightschool:players');
  ok('the review list is written to storage', saved.indexOf('"review"')>=0);
  const d2=boot({'knightschool:players':saved}); await wait(900);
  ok('and comes back', ev(d2,"!!(SAVE.review && SAVE.review.abc)"));
  ok('with its box intact', ev(d2,"SAVE.review.abc.box")===0);
  ok('each player has their own review list', ev(d2,`(()=>{
     addPlayer('Other','club');
     return !(SAVE.review && SAVE.review.abc);})()`));
}

/* ---------- the child can see and reach the review ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); paintDaily();");
  ok('nothing to review, nothing said',
     !/try again/.test(ev(d,"document.getElementById('dailyNote').textContent")));
  ev(d,"tacStart(false,false,'','')");
  ok('and no review button', ev(d,"document.getElementById('tacReviewBtn').style.display")==='none');

  ev(d,`(()=>{ let n=0;
     for (let i=0;i<TACTICS.length && n<4;i+=677) if (allowedForLevel(TACTICS[i])){
       SAVE.review[TACTICS[i].fen]={box:0, due: today()-1}; n++; }
     SAVE.daily=null; save(); })()`);
  ev(d,"paintDaily()");
  ok('the home card says how many are waiting',
     /4 to try again/.test(ev(d,"document.getElementById('dailyNote').textContent")),
     ev(d,"document.getElementById('dailyNote').textContent"));
  ev(d,"tacStart(false,false,'','')");
  ok('the review button appears', ev(d,"document.getElementById('tacReviewBtn').style.display")!=='none');
  ok('and says how many', /4 you missed/.test(ev(d,"document.getElementById('tacReviewBtn').textContent")),
     ev(d,"document.getElementById('tacReviewBtn').textContent"));
  ev(d,"document.getElementById('tacReviewBtn').click()");
  ok('tapping it plays only those four', ev(d,'T.order.length')===4);
  ok('all of them are due', ev(d,'T.order.every(i=>dueIndices().includes(i))'));
  ok('and the screen says what it is',
     /^Another go/.test(ev(d,"document.getElementById('tacTitle').textContent")),
     ev(d,"document.getElementById('tacTitle').textContent"));
  ok('leaving review and starting normal puzzles clears the label',
     ev(d,"(()=>{tacStart(false,false,'',''); return document.getElementById('tacTitle').textContent;})()").indexOf('Another go')<0);
  ok('it is a puzzle screen', ev(d,"document.getElementById('s-tac').classList.contains('on')"));
}

/* ---------- a different checkmate is still a checkmate ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  const found=ev(d,`(()=>{
    // find a mate-in-one puzzle that has a second mating move
    for (let i=0;i<TACTICS.length;i++){
      const p=TACTICS[i];
      if (!p.line || p.line.length!==1) continue;
      const g=new Chess(p.fen);
      const mates=[];
      for (const m of g.moves()){ const gg=new Chess(p.fen);
        const made=gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')});
        if (gg.isCheckmate()) mates.push({san:made.san, from:sqToAlg(m.from), to:sqToAlg(m.to)}); }
      if (mates.length>1){
        const want=String(p.line[0]).replace(/[+#]/g,'');
        const other=mates.find(x=>x.san.replace(/[+#]/g,'')!==want);
        if (other) return JSON.stringify({i, want, other});
      }
    }
    return '';
  })()`);
  if (!found){
    ok('no mate-in-one puzzle has two solutions, so nothing to accept', true);
  } else {
    const f=JSON.parse(found);
    ev(d,`(()=>{ T.order=[${f.i}]; T.i=0; T.score=0; T.streak=0; T.review=false; tacLoad(); })()`);
    ok('a second mating move exists for this puzzle', !!f.other.san);
    ev(d,`(()=>{ T.sel=null; tacTap(${JSON.stringify(f.other.from)}); tacTap(${JSON.stringify(f.other.to)}); })()`);
    await wait(400);
    ok('playing the other mate is accepted, not marked wrong', ev(d,'T.done')===true,
       {played:f.other.san, book:f.want, tries:ev(d,'T.tries')});
    ok('and it counts as a clean solve', ev(d,'T.tries')===0);
  }

  /* a move that is not mate and not the book move is still refused */
  ev(d,"tacStart(false,false,'','')");
  const refused=ev(d,`(()=>{
     const g=T.game, want=String(T.p.line[0]).replace(/[+#]/g,'');
     const other=g.movesSan().find(m=>m.san.replace(/[+#]/g,'')!==want && !m.san.includes('#'));
     if (!other) return 'none';
     T.sel=null; tacTap(sqToAlg(other.from)); tacTap(sqToAlg(other.to));
     return JSON.stringify({played:other.san, done:T.done, tries:T.tries});})()`);
  if (refused!=='none'){
    const r=JSON.parse(refused);
    ok('a wrong move that is not mate is still refused', r.done===false && r.tries>=1, r);
  }
}

/* ---------- openings come back too ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ok('no opening is due yet', ev(d,'dueOpenings(3).length')===0);

  /* learn one cleanly: it should be filed, and not due today */
  ev(d,"L.mode='openings'; openWorld('w13',0); finish(3,'done');");
  ok('following an opening files it', !!ev(d,"SAVE.review['open:w13:0']"));
  ok('a clean run pushes it a few days out',
     ev(d,"SAVE.review['open:w13:0'].due - today()")===3);
  ok('so it is not due today', ev(d,'dueOpenings(3).length')===0);

  /* a scrappy run comes back tomorrow */
  ev(d,"L.mode='openings'; openWorld('w13',1); finish(1,'done');");
  ok('a scrappy run comes back tomorrow',
     ev(d,"SAVE.review['open:w13:1'].due - today()")===1);

  /* when the day comes it is offered */
  ev(d,"SAVE.review['open:w13:1'].due = today(); SAVE.daily=null; save();");
  ok('it is due', ev(d,'dueOpenings(3).length')===1);
  ok('and it takes the lesson slot in the daily four',
     ev(d,"JSON.stringify(dailyPlan().plan.lessons)")==='[["w13",1]]',
     ev(d,"JSON.stringify(dailyPlan().plan.lessons)"));
  ev(d,"paintDaily()");
  ok('still four things', ev(d,"document.querySelectorAll('#dailyItems [data-day]').length")===4);
  ev(d,"document.querySelector('#dailyItems [data-day=\"p0\"]').click()");
  ok('tapping it opens the opening, from the openings list',
     ev(d,"L.world.id")==='w13' && ev(d,'L.mode')==='openings');

  /* and the openings list marks it */
  ev(d,"paintOpeningPicker()");
  ok('the openings list shows which one is due',
     ev(d,"document.querySelectorAll('#worldList .world.pickon').length")>=1);
  ok('and says why',
     /still know it/.test(ev(d,"document.getElementById('worldList').textContent")));
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
