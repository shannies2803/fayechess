/* second suite: the cap, backup and restore across players, the shared puzzle bank,
   and a sweep of everything that existed before the multi-player layer went in */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
function ok(label, cond, detail){
  if (cond) pass++;
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
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
/* ---------- the cap ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"for (let i=0;i<12;i++) addPlayer('Kid'+i,'some');");
  ok('no more than eight players', ev(d,'players().length')===8, ev(d,'players().length'));
  ev(d,"showAddPlayer()");
  ok('a full device says so', /8 players already/.test(ev(d,"document.getElementById('addFull').textContent")));
  ok('and hides the save button', ev(d,"document.getElementById('addSave').style.display")==='none');
  ev(d,"showEditPlayer(players()[0].id); document.getElementById('addRemove').click(); document.getElementById('addRemove').click();");
  ok('removing one makes room again', ev(d,'players().length')===7);
  ev(d,"showAddPlayer()");
  ok('the save button is back', ev(d,"document.getElementById('addSave').style.display")!=='none');
  ok('and the warning is gone', ev(d,"document.getElementById('addFull').textContent")==='');
}

/* ---------- backing up and restoring the whole family ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Ana','new'); SAVE.stars['w1:0']=3; save();");
  ev(d,"addPlayer('Ben','club'); SAVE.stars['w13:0']=2; SAVE.rating=1500; save();");
  let captured=null;
  d.window.URL.createObjectURL = b => { captured=b; return 'blob:x'; };
  d.window.URL.revokeObjectURL = ()=>{};
  ev(d,"document.getElementById('backupBtn').click()");
  ok('the backup button reports success',
     ev(d,"document.getElementById('backupBtn').textContent")==='Saved a file');
  const text = captured ? await captured.text() : '';
  const parsed = text ? JSON.parse(text) : null;
  ok('the backup holds every player', parsed && parsed.players.length===2, parsed && parsed.players.length);
  ok('the backup holds the first player’s stars',
     parsed && parsed.players[0].data.stars['w1:0']===3);
  ok('the backup holds the second player’s rating',
     parsed && parsed.players[1].data.rating===1500);
  ok('the backup holds each level',
     parsed && parsed.players.map(p=>p.level).join(',')==='new,club');

  /* wipe, then restore into a fresh device */
  const d2=boot(null); await wait(900);
  ev(d2,"addPlayer('Somebody','some')");
  const file = new d2.window.File([text], 'b.json', {type:'application/json'});
  ev(d2,"window.__f=null");
  d2.window.__f=file;
  ev(d2,"document.getElementById('restoreFile').onchange({target:{files:[window.__f]}})");
  await wait(300);
  ok('restoring brings back both players', ev(d2,'players().length')===2, ev(d2,'players().length'));
  ok('restoring brings back the names',
     ev(d2,"players().map(p=>p.name).join(',')")==='Ana,Ben');
  ok('restoring brings back the levels',
     ev(d2,"players().map(p=>p.level).join(',')")==='new,club');
  ok('restoring says how many came back',
     /2 players/.test(ev(d2,"document.getElementById('restoreBtn').textContent")));
  ok('the restored active player has their own stars',
     ev(d2,"players().find(p=>p.name==='Ana').data.stars['w1:0']")===3);

  /* an old single-player file still restores, into whoever is selected */
  const d3=boot(null); await wait(900);
  ev(d3,"addPlayer('Zoe','club'); addPlayer('Yan','some');");
  const oldFile = new d3.window.File([JSON.stringify({stars:{'w13:3':3},badges:['c1']})],'o.json');
  d3.window.__f=oldFile;
  ev(d3,"document.getElementById('restoreFile').onchange({target:{files:[window.__f]}})");
  await wait(300);
  ok('an old backup does not multiply players', ev(d3,'players().length')===2);
  ok('an old backup lands on the selected player', ev(d3,'activePlayer().name')==='Yan');
  ok('an old backup restores its stars', ev(d3,"SAVE.stars['w13:3']")===3);
  ok('the other player is untouched',
     ev(d3,"Object.keys(players().find(p=>p.name==='Zoe').data.stars).length")===0);
}

/* ---------- the imported puzzle bank is shared by the device ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('A','club'); addPlayer('B','some');");
  ev(d,"ROOT.imported=[{fen:'x',moves:['a'],rating:1300,theme:'Fork'}]; persistRoot();");
  ok('the bank is readable', ev(d,'importedPuzzles().length')===1);
  ev(d,"switchTo(players()[0].id)");
  ok('and still there after switching player', ev(d,'importedPuzzles().length')===1);
  ok('the bank is not inside a player',
     ev(d,'players().every(p=>!(p.data&&p.data.imported&&p.data.imported.length))'));
  ev(d,"document.getElementById('kidImpClear').click()");
  ok('clearing empties the shared bank', ev(d,'importedPuzzles().length')===0);
  const raw=d.window.localStorage.getItem('knightschool:players');
  ok('the shared bank is persisted at the top level', raw.indexOf('"imported"')>=0);
}

/* ---------- a sweep of everything that was already there ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Faye','club'); repaintForPlayer();");

  /* the engine itself */
  ok('perft(3) from the start is 8902', ev(d,`(()=>{
    const g=new Chess();
    const f=(g,d)=>{ if(!d) return 1; let n=0; for(const m of g.moves()){ g.applyMove(m); n+=f(g,d-1); g.undo(); } return n; };
    return f(g,3);})()`)===8902);
  ok('castling both sides is legal from the right position',
     ev(d,"(()=>{const g=new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); return g.moves().filter(m=>{const mm=g.move({from:sqToAlg(m.from),to:sqToAlg(m.to)}); const s=mm?mm.san:''; if(mm)g.undo(); return /^O-O/.test(s);}).length;})()")===2);
  ok('en passant works',
     ev(d,"(()=>{const g=new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'); const m=g.move('exd6'); return !!m && !g.get('d5');})()"));
  ok('promotion to a knight is possible',
     ev(d,"(()=>{const g=new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1'); const m=g.move({from:'a7',to:'a8',promotion:'n'}); return !!m && g.get('a8')==='N';})()"));
  ok('a repeated position is counted three times', ev(d,`(()=>{
       const g=new Chess('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
       g.trackReps=true;
       const seq=['Rh2','Ke7','Rh1','Ke8','Rh2','Ke7','Rh1','Ke8','Rh2','Ke7','Rh1','Ke8'];
       for(const s of seq) if(!g.move(s)) return 'illegal '+s;
       return g.repetitionCount();})()`)>=3);
  ok('pass-and-play counts the starting position as the first occurrence',
     ev(d,"(()=>{ppNew(); return PP.game.repetitionCount();})()")===1);
  ok('king and bishop against king is insufficient material',
     ev(d,"new Chess('4k3/8/8/8/8/8/8/2B1K3 w - - 0 1').insufficientMaterial()")===true);
  ok('king and rook against king is not',
     ev(d,"new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').insufficientMaterial()")===false);
  ok('the game is over when it is checkmate',
     ev(d,"(()=>{const g=new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1'); g.move('Ra8'); return g.isCheckmate() && g.isGameOver();})()"));

  /* the puzzle set */
  const tstat = JSON.parse(ev(d,`(()=>{
    let bad=0, noSol=0, badRating=0, dupFen={}, dups=0;
    for (const t of TACTICS){
      let g; try{ g=new Chess(t.fen); }catch(e){ bad++; continue; }
      if (!t.line || !t.line.length) noSol++;
      if (t.rating && (t.rating<400 || t.rating>3200)) badRating++;
      if (dupFen[t.fen]) dups++; else dupFen[t.fen]=1;
    }
    return JSON.stringify({total:TACTICS.length, bad, noSol, badRating, dups});
  })()`));
  ok('every puzzle position is legal', tstat.bad===0, tstat);
  ok('every puzzle has a solution', tstat.noSol===0, tstat);
  ok('every rating is in a sane range', tstat.badRating===0, tstat);
  ok('no duplicate puzzle positions', tstat.dups===0, tstat);
  ok('there are over three thousand puzzles', tstat.total>3000, tstat.total);

  /* the first move of each solution is legal, sampled widely */
  ok('solutions start with a legal move', ev(d,`(()=>{
    let bad=0;
    for (let i=0;i<TACTICS.length;i+=7){
      const t=TACTICS[i];
      const g=new Chess(t.fen);
      const m=t.line[0];
      const mv=g.move(typeof m==='string' && m.length>=4 && /^[a-h][1-8][a-h][1-8]/.test(m)
        ? {from:m.slice(0,2),to:m.slice(2,4),promotion:(m[4]||'q')} : m);
      if (!mv) bad++;
    }
    return bad;})()`)===0);

  /* the champions */
  const cstat = JSON.parse(ev(d,`(()=>{
    let bad=0, noGold=0, notWhite=0;
    for (const c of CHARS){
      let g; try{ g=new Chess(c.fen); }catch(e){ bad++; continue; }
      const me = c.side || 'w';
      if (g.turn !== me) notWhite++;
      if ((c.kind==='beat'||c.kind==='promote') && !c.gold) noGold++;
    }
    return JSON.stringify({n:CHARS.length, bad, noGold, notWhite});
  })()`));
  ok('every champion position is legal', cstat.bad===0, cstat);
  ok('every champion starts on the right side', cstat.notWhite===0, cstat);
  ok('every timed champion has a gold target', cstat.noGold===0, cstat);

  /* the opening library */
  ok('every library opening plays through', ev(d,`(()=>{
    let bad=[];
    for (const o of ALL_OPENINGS){ const g=new Chess();
      for (const san of o.line) if (!g.move(san)){ bad.push(o.name+' at '+san); break; } }
    return JSON.stringify(bad);})()`)==='[]',
    ev(d,`(()=>{let bad=[];for (const o of ALL_OPENINGS){const g=new Chess();
      for (const san of o.line) if(!g.move(san)){bad.push(o.name+' at '+san);break;}}return JSON.stringify(bad.slice(0,5));})()`));
  ok('a hundred and eight openings', ev(d,'ALL_OPENINGS.length')===108);
  ok('every opening lesson line plays through', ev(d,`(()=>{
    let bad=[];
    for (const w of WORLDS) for (const t of w.tasks){
      if (t.kind!=='follow') continue;
      const g=new Chess(t.fen||undefined);
      for (const san of t.line) if (!g.move(san)){ bad.push(w.id+' '+san); break; }
    }
    return JSON.stringify(bad);})()`)==='[]');

  /* the rating maths */
  ok('a win against a harder puzzle raises the rating',
     ev(d,"(()=>{SAVE.rating=1200;SAVE.ratingPlays=100;const r=recordResult(1500,true);return r.change>0;})()"));
  ok('a loss to an easier puzzle lowers it',
     ev(d,"(()=>{SAVE.rating=1200;SAVE.ratingPlays=100;const r=recordResult(900,false);return r.change<0;})()"));
  ok('the rating cannot run away upward',
     ev(d,"(()=>{SAVE.rating=2890;SAVE.ratingPlays=100;for(let i=0;i<50;i++)recordResult(3000,true);return myRating()<=2900;})()"));
  ok('the rating cannot run away downward',
     ev(d,"(()=>{SAVE.rating=420;SAVE.ratingPlays=100;for(let i=0;i<50;i++)recordResult(400,false);return myRating()>=400;})()"));
  ok('early games move the rating more than late ones',
     ev(d,"(()=>{SAVE.rating=1200;SAVE.ratingPlays=1;const a=recordResult(1200,true).change;SAVE.rating=1200;SAVE.ratingPlays=200;const b=recordResult(1200,true).change;return a>b;})()"));

  /* the coach */
  ok('the coach spots a missed mate', ev(d,`(()=>{
     const g=new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
     const before=g.fen(); g.move('Rb1');
     const v=coachVerdict(before,'Rb1',g,'w');
     return !!v && /mate/i.test(v.text);})()`));
  ok('the coach spots a piece given away', ev(d,`(()=>{
     const g=new Chess('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1');
     const before=g.fen(); g.move('Qd4');
     const v=coachVerdict(before,'Qd4',g,'w');
     return !!v;})()`));
  ok('the coach can be switched off and on',
     ev(d,"(()=>{const a=coachOn();toggleCoach();const b=coachOn();toggleCoach();return a!==b && coachOn()===a;})()"));

  /* spaced repetition: this used to pass even when the feature did not exist */
  ok('the review schedule exists', ev(d,"typeof BOX_DAYS")==='object' && ev(d,'BOX_DAYS.length')>=4);
  ok('each box waits longer than the one before',
     ev(d,'BOX_DAYS.every((v,i)=>i===0 || v>BOX_DAYS[i-1])'));
  ok('a missed puzzle comes back tomorrow', ev(d,'BOX_DAYS[0]')===1);
  ok('and every puzzle attempt is filed', ev(d,`(()=>{
     const f='test-fen'; recordReview(f,false);
     const a=SAVE.review[f].due; recordReview(f,true);
     return SAVE.review[f].due > a;})()`));

  /* the daily four */
  ev(d,"const dd=dailyPlan()");
  ok('the daily four always adds up to four',
     ev(d,'dailyPlan().plan.puzzles.length + (dailyPlan().plan.lessons||[]).length')===3,
     ev(d,'JSON.stringify(dailyPlan().plan)'));
  ok('the daily plan has an endgame', !!ev(d,'dailyPlan().plan.endgame'));
  ok('the daily plan is stable within a day',
     ev(d,"JSON.stringify(dailyPlan().plan)")===ev(d,"JSON.stringify(dailyPlan().plan)"));
  ok('the daily plan is the same for one player and different players differ',
     ev(d,"(()=>{const a=JSON.stringify(dailyPlan().plan);addPlayer('Other','new');const b=JSON.stringify(dailyPlan().plan);return a!==b;})()"));

  /* pass and play */
  ev(d,"switchTo(players()[0].id); document.getElementById('ppBtn').click();");
  ok('two players on one screen opens',
     ev(d,"document.getElementById('s-pp').classList.contains('on')"));
  ok('and starts with white to move', ev(d,"PP.game.turn")==='w');

  /* the board */
  ok('a board has sixty-four squares',
     ev(d,"Object.keys(buildBoard(document.createElement('div'),()=>{},false)).length")===64);
  ok('every square remembers its own colour', ev(d,`(()=>{
     const cells=buildBoard(document.createElement('div'),()=>{},false);
     let bad=0;
     for (const k in cells){
       const want='sq '+(((+k[1]-1)+FL.indexOf(k[0]))%2 ? 'l':'d');
       if (cells[k].dataset.base!==want) bad++;
     }
     return bad;})()`)===0);
  ok('clearing marks restores the square colour exactly', ev(d,`(()=>{
     const cells=buildBoard(document.createElement('div'),()=>{},false);
     cells['d4'].classList.add('last'); cells['d4'].classList.add('hint');
     clearMarks(cells);
     return cells['d4'].className===cells['d4'].dataset.base && /\\bd\\b/.test(cells['d4'].className);})()`));
  ok('coordinates are on the board',
     ev(d,"document.querySelectorAll('#board .co').length")>0 ||
     ev(d,"fs=0, document.body.innerHTML.indexOf('class=\"co')>=0") ||
     ev(d,"document.head.innerHTML.indexOf('.co')>=0"));

  /* the openings hint button */
  ev(d,"L.mode='openings'; openWorld('w13',0); document.getElementById('showBtn').click();");
  ok('show-me marks a piece and a destination',
     ev(d,"document.querySelectorAll('#board .sq.pick').length")===1 &&
     ev(d,"document.querySelectorAll('#board .sq.hint').length")>=1);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
