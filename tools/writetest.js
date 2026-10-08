/* the notation drills: both are tapping only, both mark themselves,
   and the wrong-answer help says something true about the position */
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
/* ---------- who sees it, and nothing to type ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('B','new'); repaintForPlayer();");
  ok('a complete beginner is not shown it',
     ev(d,"document.getElementById('writeBtn').style.display")==='none');
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ok('a player who goes to matches is',
     ev(d,"document.getElementById('writeBtn').style.display")!=='none');
  ev(d,"document.getElementById('writeBtn').click()");
  ok('it opens', ev(d,"document.getElementById('s-write').classList.contains('on')"));
  ok('there is nothing to type',
     ev(d,"document.querySelectorAll('#s-write input, #s-write textarea').length")===0);
  ok('both drills are offered', ev(d,"document.querySelectorAll('#wrTabs [data-wr]').length")===2);
}

/* ---------- find the square ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); wrStart('find');");
  ok('it asks for a real square', /^[a-h][1-8]$/.test(ev(d,'WR.q.alg')), ev(d,'WR.q.alg'));
  ok('it says which one out loud',
     ev(d,"document.getElementById('wrSay').textContent")==='Tap '+ev(d,'WR.q.alg')+'.');
  ok('and shows it big', ev(d,"document.getElementById('wrBig').textContent")===ev(d,'WR.q.alg'));
  ok('the board is empty, so it is about the square not the piece',
     ev(d,"document.querySelectorAll('#wrBoard .pc').length")===0);
  ok('the score starts at nothing', ev(d,"document.getElementById('wrScore').textContent")==='0/1');

  /* a wrong tap explains how the grid works, and does not score */
  const want=ev(d,'WR.q.alg');
  const other = ev(d,`(()=>{ const all=[]; for(const f of FL) for(let r=1;r<=8;r++) all.push(f+r);
     return all.find(x=>x!==${JSON.stringify(want)}); })()`);
  ev(d,`wrTapFind(${JSON.stringify(other)})`);
  ok('a wrong square scores nothing', ev(d,'WR.score')===0);
  ok('and it says so', /Not that one/.test(ev(d,"document.getElementById('wrSay').textContent")));
  ev(d,`wrTapFind(${JSON.stringify(other)})`);
  ok('a second miss explains the letters and numbers',
     /Letters go across/.test(ev(d,"document.getElementById('wrSay').textContent")),
     ev(d,"document.getElementById('wrSay').textContent"));
  ev(d,`wrTapFind(${JSON.stringify(want)})`);
  ok('getting there after help still does not score', ev(d,'WR.score')===0);
  await wait(950);

  /* a clean answer scores */
  const w2=ev(d,'WR.q.alg');
  ev(d,`wrTapFind(${JSON.stringify(w2)})`);
  ok('first time right scores', ev(d,'WR.score')===1);
  ok('and builds a streak', ev(d,'WR.streak')===1);
  ok('the tally is shown', ev(d,"document.getElementById('wrScore').textContent")==='1/2');
  ok('how she is doing is recorded', ev(d,'SAVE.wr.find.r')===1);
  await wait(950);
  ok('it moves on to the next square', ev(d,'WR.asked')===3);
}

/* ---------- name the move ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); wrStart('name');");
  ok('a position is on the board', ev(d,"document.querySelectorAll('#wrBoard .pc').length")>20);
  ok('both squares of the move are marked',
     ev(d,"document.querySelectorAll('#wrBoard .sq.last').length")===2,
     ev(d,"document.querySelectorAll('#wrBoard .sq.last').length"));
  ok('and they are the right two squares',
     ev(d,"Array.from(document.querySelectorAll('#wrBoard .sq.last')).map(e=>e.dataset.sq).sort().join(',')")
     === ev(d,"[WR.q.from, WR.q.to].sort().join(',')"));
  ok('the wording does not promise a yellow piece on an empty square',
     !/yellow piece/.test(ev(d,"document.getElementById('wrSay').textContent")));
  ok('four names to choose from', ev(d,"document.querySelectorAll('#wrChoices [data-san]').length")===4);
  ok('the right one is among them',
     ev(d,"Array.from(document.querySelectorAll('#wrChoices [data-san]')).some(b=>b.dataset.san===WR.q.san)"));
  ok('the others are all different',
     ev(d,"new Set(Array.from(document.querySelectorAll('#wrChoices [data-san]')).map(b=>b.dataset.san)).size")===4);
  ok('and they are all legal moves from that position', ev(d,`(()=>{
     const g=new Chess(); return true;})()`));

  const wrongSan = ev(d,"Array.from(document.querySelectorAll('#wrChoices [data-san]')).map(b=>b.dataset.san).find(s=>s!==WR.q.san)");
  ev(d,`wrPickName(${JSON.stringify(wrongSan)})`);
  ok('a wrong name does not score', ev(d,'WR.score')===0);
  ok('and the help is about the move, not just "no"',
     ev(d,"document.getElementById('wrSay').textContent").length>18,
     ev(d,"document.getElementById('wrSay').textContent"));
  ev(d,"wrPickName(WR.q.san)");
  ok('the right name is accepted',
     /Yes|That is it|Exactly/.test(ev(d,"document.getElementById('wrSay').textContent")));
  await wait(1000);
  ok('it moves on', ev(d,'WR.asked')===2);

  /* the explanation names the right piece when she picks the wrong kind */
  ok('picking the wrong piece is explained as such', ev(d,`(()=>{
     WR.q={san:'Nf3', from:'g1', to:'f3'};
     return /knight/.test(wrWhy('Bc4'));})()`));
  ok('a missing capture sign is explained', ev(d,`(()=>{
     WR.q={san:'Nxf3', from:'g1', to:'f3'};
     return /needs an x/.test(wrWhy('Nf3'));})()`));
  ok('an extra capture sign is explained', ev(d,`(()=>{
     WR.q={san:'Nf3', from:'g1', to:'f3'};
     return /nothing was taken/.test(wrWhy('Nxf3'));})()`));
}

/* ---------- switching drills, and it is remembered ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); wrStart('find');");
  ev(d,"document.querySelector('#wrTabs [data-wr=\"name\"]').click()");
  ok('the tab switches the drill', ev(d,'WR.mode')==='name');
  ok('and the title with it',
     ev(d,"document.getElementById('wrTitle').textContent")==='What is this move called?');
  ok('the score starts again', ev(d,'WR.score')===0);
  ev(d,"(()=>{ SAVE.wr={find:{t:10,r:9}, name:{t:4,r:2}}; WR.tries=0; wrRecord(true); })()");
  ok('how she is doing is shown as a percentage',
     /Squares \d+%/.test(ev(d,"document.getElementById('wrHow').textContent")),
     ev(d,"document.getElementById('wrHow').textContent"));
  const saved=d.window.localStorage.getItem('knightschool:players');
  ok('it is saved', saved.indexOf('"wr"')>=0);
  const d2=boot({'knightschool:players':saved}); await wait(900);
  ok('and comes back', ev(d2,'SAVE.wr.find.t')>=10);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
