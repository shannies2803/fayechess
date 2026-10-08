/* the new worlds: castling, the pawn's two secrets, the stalemate trap,
   counting defenders, and the named patterns — played through by tapping */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const boot=()=>new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=(d,s)=>d.window.eval(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* tap a move on the lesson board the way a child would: piece, then square */
const play=(d,from,to)=>ev(d,`(()=>{ L.sel=null; tapChess(${JSON.stringify(from)}); tapChess(${JSON.stringify(to)}); })()`);
/* promote to a named piece, the way the chooser does */
const promote=(d,from,to,kind)=>ev(d,`(()=>{ L.sel=null; tapChess(${JSON.stringify(from)}); tapChess(${JSON.stringify(to)});
  const b=Array.from(document.querySelectorAll('#lessonPromo [data-lpromo]')).find(x=>x.dataset.lpromo===${JSON.stringify(kind)});
  if (b) b.click(); })()`);

(async ()=>{
/* ---------- the shape of the new content ---------- */
{
  const d=boot(); await wait(900);
  ok('four new rule worlds', ev(d,"WORLDS.filter(w=>w.beg).length")===11);
  ok('three pattern worlds', ev(d,"WORLDS.filter(w=>w.pat).length")===3);
  ok('every world belongs to exactly one group',
     ev(d,"WORLDS.every(w=>['beg','pat','op'].includes(worldGroup(w)))"));
  ok('the openings world is still its own group', ev(d,"worldGroup(WORLDS.find(w=>w.id==='w13'))")==='op');
  ok('sixty-one lessons in all', ev(d,"WORLDS.reduce((a,w)=>a+w.tasks.length,0)")===61,
     ev(d,"WORLDS.reduce((a,w)=>a+w.tasks.length,0)"));
  ok('every new world has an intro line',
     ev(d,"WORLDS.filter(w=>w.beg||w.pat).every(w=>!!w.intro && !!w.emoji && !!w.name)"));
  ok('every task says what to do',
     ev(d,"WORLDS.every(w=>w.tasks.every(t=>!!t.say && t.say.length>10))"));
}

/* ---------- who sees the patterns ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Tiny','new'); repaintForPlayer();");
  ok('a beginner is not shown the tactics list',
     ev(d,"document.getElementById('patBtn').style.display")==='none');
  ok('but is shown the pieces list',
     ev(d,"document.getElementById('begBtn').style.display")!=='none');
  ev(d,"addPlayer('Mid','some'); repaintForPlayer();");
  ok('a middling player is shown the tactics list',
     ev(d,"document.getElementById('patBtn').style.display")!=='none');
  ok('and not the pieces list',
     ev(d,"document.getElementById('begBtn').style.display")==='none');
  ev(d,"addPlayer('Champ','club'); repaintForPlayer();");
  ok('so is a club player',
     ev(d,"document.getElementById('patBtn').style.display")!=='none');

  ev(d,"document.getElementById('patBtn').click()");
  ok('the tactics list opens', ev(d,"document.getElementById('s-beg').classList.contains('on')"));
  ok('with its own title', ev(d,"document.getElementById('begTitle').textContent")==='Tactics to know');
  ok('showing only the pattern worlds',
     ev(d,"document.querySelectorAll('#begList [data-bw]').length")===3);
  ok('and they really are the pattern worlds',
     ev(d,"Array.from(document.querySelectorAll('#begList [data-bw]')).every(b=>WORLDS.find(w=>w.id===b.dataset.bw).pat)"));
  ok('and it counts them', ev(d,"document.getElementById('begCount').textContent")==='0/3');
  ev(d,"document.getElementById('begBack').click(); document.getElementById('begUnlockBtn') && 0;");
  ev(d,"switchTo(players().find(p=>p.name==='Tiny').id); document.getElementById('begBtn').click();");
  ok('the pieces list still has its own title',
     ev(d,"document.getElementById('begTitle').textContent")==='How the pieces move');
  ok('and its own worlds', ev(d,"document.querySelectorAll('#begList [data-bw]').length")===11);
}

/* ---------- castling ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('K','new'); L.mode='beg'; openWorld('w8',0);");
  ok('the castling lesson loads', ev(d,"L.task.kind")==='castle');
  play(d,'e1','g1');
  ok('castling short finishes it', ev(d,'L.done')===true);
  ok('doing it at once is worth three stars', ev(d,"SAVE.stars['w8:0']")===3);

  ev(d,"openWorld('w8',1);");
  play(d,'e1','g1');
  ok('the short side is refused when the bishop is in the way', ev(d,'L.done')===false);
  play(d,'e1','c1');
  ok('castling long finishes it', ev(d,'L.done')===true);
  ok('and scores three', ev(d,"SAVE.stars['w8:1']")===3);

  ev(d,"openWorld('w8',2);");
  ok('from the start nothing is castled yet', ev(d,'L.done')===false);
  play(d,'e1','g1');
  ok('you cannot castle through your own pieces', ev(d,'L.done')===false);
}

/* ---------- en passant and the knight promotion ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('K','new'); L.mode='beg'; openWorld('w9',0);");
  ok('the lesson plays his pawn first, so it is the child’s move',
     ev(d,"L.game.turn")==='w');
  ok('his pawn is sitting on d5', ev(d,"L.game.get('d5')")==='p');
  play(d,'e5','d5');
  ok('capturing the pawn where it stands is refused', ev(d,'L.done')===false);
  play(d,'e5','d6');
  ok('taking en passant finishes the lesson', ev(d,'L.done')===true);
  ok('and his pawn really is gone', ev(d,"L.game.get('d5')")===null ||
     ev(d,"L.game.get('d5')")===undefined || ev(d,"L.game.get('d5')")==='');

  ev(d,"openWorld('w9',1);");
  ok('the promotion lesson loads', ev(d,"L.task.kind")==='follow');
  play(d,'f7','f8');
  ok('reaching the last row asks what the pawn becomes',
     ev(d,"document.getElementById('lessonPromo').style.display")!=='none');
  ok('all four pieces are offered',
     ev(d,"document.querySelectorAll('#lessonPromo [data-lpromo]').length")===4);
  ev(d,"document.querySelector('#lessonPromo [data-lpromo=\"q\"]').click()");
  ok('choosing a queen is refused here', ev(d,'L.done')===false);
  ok('the board was put back', ev(d,"L.game.get('f7')")==='P');
  ok('the chooser is put away again',
     ev(d,"document.getElementById('lessonPromo').style.display")==='none');
  promote(d,'f7','f8','n');
  ok('choosing a knight is accepted', ev(d,"L.game.get('f8')")==='N');
  await wait(600);
  play(d,'f8','d7');
  ok('and the fork wins the queen', ev(d,'L.done')===true);
}

/* ---------- the stalemate trap ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('K','new'); L.mode='beg'; openWorld('w10',0);");
  ok('the stalemate lesson loads', ev(d,"L.task.kind")==='mate');
  play(d,'h2','g2');
  ok('stalemating does not finish the lesson', ev(d,'L.done')===false);
  ok('and it is named for what it is',
     /Stalemate/.test(ev(d,"document.getElementById('say').textContent")),
     ev(d,"document.getElementById('say').textContent"));
  ok('it explains that it is a draw',
     /draw/.test(ev(d,"document.getElementById('say').textContent")));
  ok('the board was put back', ev(d,"L.game.get('h2')")==='Q');
  play(d,'h2','b2');
  ok('the real mate finishes it', ev(d,'L.done')===true);
  ok('worth three stars', ev(d,"SAVE.stars['w10:0']")===3);

  ev(d,"openWorld('w10',2);");
  play(d,'g3','g2');
  ok('the rook stalemate is caught too', ev(d,'L.done')===false);
  play(d,'g3','a3');
  ok('and the rook mate finishes it', ev(d,'L.done')===true);
}

/* ---------- is it really free? ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('K','new'); L.mode='beg'; openWorld('w11',0);");
  ok('the free-piece lesson loads', ev(d,"L.task.kind")==='grab');
  ok('the answer is not marked on the board',
     ev(d,"document.querySelectorAll('#board .sq.star').length")===0);
  play(d,'d1','b3');
  ok('taking the guarded piece is refused', ev(d,'L.done')===false);
  ok('and it says why',
     /guarded/.test(ev(d,"document.getElementById('say').textContent")),
     ev(d,"document.getElementById('say').textContent"));
  play(d,'d1','d4');
  ok('taking the free piece finishes it', ev(d,'L.done')===true);
  ok('with its own well done',
     /Free piece/.test(ev(d,"document.getElementById('say').textContent")) ||
     ev(d,"SAVE.stars['w11:0']")===3);

  ev(d,"openWorld('w11',1);");
  play(d,'c3','b5');
  ok('the knight is stopped from taking the guarded bishop', ev(d,'L.done')===false);
  play(d,'c3','d5');
  ok('and wins the free rook', ev(d,'L.done')===true);

  ev(d,"openWorld('w11',2);");
  play(d,'d1','d4');
  ok('the tempting knight is refused', ev(d,'L.done')===false);
  play(d,'d1','h5');
  ok('the free bishop is the answer', ev(d,'L.done')===true);
}

/* ---------- the patterns, played through ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Champ','club'); BEGMODE='pat'; L.mode='beg'; openWorld('w14',0);");
  ok('the fork lesson loads', ev(d,"L.task.kind")==='follow');
  play(d,'e5','d7');
  ok('a plausible wrong knight move is refused', ev(d,'L.done')===false);
  play(d,'e5','f7');
  await wait(600);
  ok('the forking move is accepted', ev(d,'L.step')>=2, ev(d,'L.step'));
  play(d,'f7','d8');
  ok('taking the rook finishes the fork lesson', ev(d,'L.done')===true);
  ok('and it earns stars', ev(d,"SAVE.stars['w14:0']")>=1);

  ev(d,"openWorld('w14',1);");
  play(d,'f1','b5');
  ok('the pin lesson is a single move', ev(d,'L.done')===true);

  ev(d,"openWorld('w14',2);");
  play(d,'a1','h1');
  await wait(600);
  play(d,'h1','h7');
  ok('the skewer lesson can be finished', ev(d,'L.done')===true);

  ev(d,"openWorld('w14',3);");
  play(d,'d3','c4');
  await wait(600);
  play(d,'d1','d7');
  ok('the discovered attack lesson can be finished', ev(d,'L.done')===true);
}

/* ---------- checkmate patterns ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Champ','club'); BEGMODE='pat'; L.mode='beg'; openWorld('w15',0);");
  play(d,'e1','e8');
  ok('the rook behind cannot jump over the one in front', ev(d,'L.step')===0);
  play(d,'e2','e8');
  await wait(650);
  play(d,'e1','e8');
  ok('the back rank mate can be finished', ev(d,'L.done')===true);
  ok('and the position really is checkmate', ev(d,"L.game.isCheckmate()")===true);

  ev(d,"openWorld('w15',1);");
  const moves=[['d1','b3'],['g5','f7'],['f7','h6'],['b3','g8'],['h6','f7']];
  for (const [f,t] of moves){ play(d,f,t); await wait(650); }
  ok('the smothered mate can be played right through', ev(d,'L.done')===true);
  ok('and it ends in checkmate', ev(d,"L.game.isCheckmate()")===true);
  ok('with the black king smothered by its own rook',
     ev(d,"L.game.get('g8')")==='r' && ev(d,"L.game.get('h8')")==='k');
}

/* ---------- the new worlds join the daily four ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('K','new'); repaintForPlayer();");
  ok('the beginner path is now longer than a fortnight of dailies',
     ev(d,"WORLDS.filter(w=>w.beg).reduce((a,w)=>a+w.tasks.length,0)")>=30,
     ev(d,"WORLDS.filter(w=>w.beg).reduce((a,w)=>a+w.tasks.length,0)"));
  ok('the daily four still starts at the very beginning',
     ev(d,"JSON.stringify(dailyPlan().plan.lessons[0])")==='["w1",0]');
  ev(d,`(()=>{ for (const w of WORLDS.filter(x=>x.beg))
     for (let i=0;i<w.tasks.length;i++) SAVE.stars[taskKey(w.id,i)]=3;
     SAVE.daily=null; save(); repaintForPlayer(); })()`);
  ok('finishing everything still offers the move up',
     ev(d,"document.getElementById('levelUpBtn').style.display")!=='none');
  ok('and the daily four becomes puzzles again',
     ev(d,'dailyPlan().plan.puzzles.length')===3);
}

/* ---------- the real-game world, played through ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Champ','club'); BEGMODE='pat'; L.mode='beg';");
  ok('the real-game world is listed for a strong player',
     ev(d,"WORLDS.some(w=>w.id==='w16' && w.pat)"));
  ok('each of its positions carries the rating real players earned on it',
     ev(d,"WORLDS.find(w=>w.id==='w16').tasks.every(t=>t.rated>=900 && t.rated<=1500)"));
  ok('and each says so in the instruction',
     ev(d,"WORLDS.find(w=>w.id==='w16').tasks.every(t=>/Rated \\d+/.test(t.say))"));

  ev(d,"openWorld('w16',0);");
  ok('a white lesson is shown from White\u2019s side', ev(d,"L.game.turn")==='w');
  play(d,'h6','f4');
  await wait(650);
  play(d,'f4','h2');
  ok('the bishop double attack can be finished', ev(d,'L.done')===true);

  ev(d,"openWorld('w16',2);");
  ok('a black lesson is shown from Black\u2019s side', ev(d,"L.game.turn")==='b');
  ok('and the board is turned round',
     ev(d,"document.getElementById('board').classList.contains('flip')"));
  play(d,'e6','f4');
  await wait(650);
  play(d,'f7','b3');
  ok('the discovered attack can be finished', ev(d,'L.done')===true);

  ev(d,"openWorld('w16',3);");
  play(d,'c8','h8');
  await wait(650);
  play(d,'h8','h4');
  ok('the mate in two can be finished', ev(d,'L.done')===true);
  ok('and it really is checkmate', ev(d,"L.game.isCheckmate()")===true);
}

/* ---------- the new openings ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('F','club'); document.getElementById('playBtn').click();");
  ok('fifteen openings are offered',
     ev(d,"document.querySelectorAll('#worldList [data-task]').length")===15);
  ok('every one has a name', ev(d,"Array.from(document.querySelectorAll('#worldList .nm')).every(e=>e.textContent.trim().length>2)"));
  ok('none is called Opening n',
     ev(d,"!Array.from(document.querySelectorAll('#worldList .nm')).some(e=>/^Opening \\d/.test(e.textContent.trim()))"));
  ev(d,"openWorld('w13',9);");
  ok('the French lesson opens from Black\u2019s side', ev(d,"L.task.side")==='b');
  ok('and is titled', ev(d,"document.getElementById('lessonName').textContent")==='French');
  ok('every opening lesson line is legal', ev(d,`(()=>{
     const w=WORLDS.find(x=>x.id==='w13');
     for (const t of w.tasks){ if (t.kind!=='follow') continue;
       const g=new Chess(t.fen||undefined);
       for (const san of t.line) if (!g.move(san)) return 'illegal '+san; }
     return true;})()`)===true);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
