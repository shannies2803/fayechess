/* two children, one screen: the pairing, the running score and the record */
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
const d=boot(null); await wait(900);
ev(d,"addPlayer('Amara','new'); addPlayer('Rafi','club'); repaintForPlayer();");
ev(d,"document.getElementById('ppBtn').click(); document.getElementById('ppNames').click();");
ok('the chooser opens instead of a browser prompt',
   ev(d,"document.getElementById('s-ppnames').classList.contains('on')"));
ok('both players plus someone else are offered for White',
   ev(d,"document.querySelectorAll('#ppWhiteList [data-who]').length")===3);
ok('and for Black too',
   ev(d,"document.querySelectorAll('#ppBlackList [data-who]').length")===3);
ok('it says they have not played before',
   /Pick two players/.test(ev(d,"document.getElementById('ppNamesNote').textContent")));

ev(d,"document.querySelector('#ppWhiteList [data-who=\"p1\"]').click()");
ok('picking White sets the name', ev(d,'PP.names.w')==='Amara');
ok('and that player is now unavailable as Black',
   ev(d,"document.querySelector('#ppBlackList [data-who=\"p1\"]').disabled")===true);
ev(d,"document.querySelector('#ppBlackList [data-who=\"p2\"]').click()");
ok('picking Black sets the name', ev(d,'PP.names.b')==='Rafi');
ok('the record line appears',
   /have not played before/.test(ev(d,"document.getElementById('ppNamesNote').textContent")));
ev(d,"document.getElementById('ppNamesDone').click()");
ok('it goes back to the board',
   ev(d,"document.getElementById('s-pp').classList.contains('on')"));
ok('the score line shows both names',
   ev(d,"document.getElementById('ppScore').textContent")==='Amara 0 — 0 Rafi');
ok('a long name is shortened so the top bar still fits',
   ev(d,"(()=>{PP.names.w='Bartholomew'; ppPaintScore(); const t=document.getElementById('ppScore').textContent; PP.names.w='Amara'; ppPaintScore(); return t;})()")==='Barthol… 0 — 0 Rafi');

/* play a fool's mate and see it recorded */
ev(d,"(()=>{ for (const san of ['f3','e5','g4','Qh4']) PP.game.move(san); ppDraw(); ppOver(); })()");
ok('checkmate is spotted', ev(d,'PP.over')===true);
ok('the running score moves', ev(d,"document.getElementById('ppScore').textContent")==='Amara 0 — 1 Rafi');
ok('the winner has a win on record',
   ev(d,"players().find(p=>p.id==='p2').data.h2h.p1.w")===1);
ok('the loser has the matching loss',
   ev(d,"players().find(p=>p.id==='p1').data.h2h.p2.l")===1);
ok('nobody got a phantom draw',
   ev(d,"players().find(p=>p.id==='p1').data.h2h.p2.d")===0);

/* a resignation counts too */
ev(d,"ppNew(); document.getElementById('ppResign').click(); document.getElementById('ppResign').click();");
ok('resigning records a result',
   ev(d,"players().find(p=>p.id==='p2').data.h2h.p1.w")===2);
ok('and moves the running score', ev(d,"document.getElementById('ppScore').textContent")==='Amara 0 — 2 Rafi');

/* the grown-ups panel tells the story once, not twice */
ev(d,"paintParentPlayers()");
const line = ev(d,"document.getElementById('parentH2H').textContent");
ok('the head-to-head shows in the grown-ups panel', /Amara 0 — 2 Rafi/.test(line), line);
ok('and only once', (line.match(/Amara/g)||[]).length===1, line);

/* the pairing survives a reload */
const saved = d.window.localStorage.getItem('knightschool:players');
const d2 = boot({'knightschool:players':saved}); await wait(900);
ok('the pairing is remembered', ev(d2,'PP.names.w')==='Amara' && ev(d2,'PP.names.b')==='Rafi');
ok('so is the record', ev(d2,"players().find(p=>p.id==='p2').data.h2h.p1.w")===2);
ok('the running score starts fresh each sitting',
   ev(d2,"document.getElementById('ppScore').textContent")==='Amara 0 — 0 Rafi');

/* removing a player clears them from the pairing */
ev(d2,"removePlayer('p2'); restorePP();");
ok('a removed player leaves the pairing', ev(d2,'PP.names.b')==='Black');
ok('and no result is recorded against a ghost',
   ev(d2, "(()=>{ PP.wid='p1'; PP.bid='p2'; ppRecordResult('w'); return JSON.stringify(players().find(p=>p.id==='p1').data.h2h||{}); })()").indexOf('\"p2\":{\"w\":1')<0);

/* a guest game records nothing */
const d3=boot(null); await wait(900);
ev(d3,"addPlayer('Solo','some'); document.getElementById('ppBtn').click();");
ev(d3,"(()=>{ for (const san of ['f3','e5','g4','Qh4']) PP.game.move(san); ppDraw(); ppOver(); })()");
ok('a game with no players chosen still announces a winner', ev(d3,'PP.over')===true);
ok('and records nothing', ev(d3,"JSON.stringify(players()[0].data.h2h||{})")==='{}');

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
