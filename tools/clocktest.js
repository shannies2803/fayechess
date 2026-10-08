/* the clock: it counts down, it gives the increment, it flags, and it never runs
   while she is somewhere else in the app */
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
/* ---------- off by default ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ok('the clock is off unless she asks for it', ev(d,'CL.on')===false);
  ok('and nothing is shown', ev(d,"document.getElementById('fpClocks').style.display")==='none');
  ev(d,"document.getElementById('freeBtn').click()");
  ok('the time controls are offered',
     ev(d,"document.querySelectorAll('#fpTimes [data-tc]').length")===4);
  ok('four choices including no clock',
     ev(d,"Array.from(document.querySelectorAll('#fpTimes [data-tc]')).map(b=>b.dataset.tc).join(',')")==='off,10,15+5,25');
  ok('no clock is the one selected',
     ev(d,"document.querySelector('#fpTimes [data-tc=\"off\"]').classList.contains('go')"));
}

/* ---------- it counts down while it is her move ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"10\"]').click()");
  await wait(120);
  ok('choosing a time control turns it on', ev(d,'CL.on')===true);
  ok('and shows both clocks', ev(d,"document.getElementById('fpClocks').style.display")!=='none');
  ok('each starting at ten minutes', ev(d,"document.getElementById('fpClockMe').textContent")==='10:00');
  ok('hers is the one running', ev(d,'CL.turn')==='me');
  ok('and it is marked as running',
     ev(d,"document.getElementById('fpClockMe').classList.contains('run')"));
  const before=ev(d,'CL.me');
  await wait(700);
  ev(d,'clockTick()');
  ok('her time goes down while she thinks', ev(d,'CL.me') < before, {before, after:ev(d,'CL.me')});
  ok('his does not', ev(d,'CL.them')===600000);
  ev(d,"(()=>{ CL.last = Date.now() - 1500; clockTick(); })()");
  ok('the display counts down too',
     ev(d,"document.getElementById('fpClockMe').textContent")!=='10:00',
     ev(d,"document.getElementById('fpClockMe').textContent"));
  ok('and reads as minutes and seconds',
     /^\d+:\d\d$/.test(ev(d,"document.getElementById('fpClockMe').textContent")));
}

/* ---------- the increment ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"15+5\"]').click()");
  await wait(120);
  ok('fifteen minutes on the clock', ev(d,'CL.me')===900000);
  ev(d,"(()=>{ CL.me = 100000; CL.last = Date.now(); clockMoved('me'); })()");
  ok('a completed move earns five seconds', ev(d,'CL.me')>=104000 && ev(d,'CL.me')<=105000,
     ev(d,'CL.me'));
  ev(d,"(()=>{ CL.them = 100000; CL.turn='them'; CL.last = Date.now(); clockMoved('them'); })()");
  ok('and so does his', ev(d,'CL.them')>=104000 && ev(d,'CL.them')<=105000);
  ok('a clock with no increment gives none', ev(d,`(()=>{
     clockSet('10'); CL.me=100000; CL.last=Date.now(); clockMoved('me');
     return CL.me<=100000;})()`));
}

/* ---------- running out loses the game ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"10\"]').click()");
  await wait(120);
  ev(d,"(()=>{ for (const san of ['e4','e5','Nf3','Nc6']) FP.game.move(san); })()");
  ev(d,"(()=>{ CL.me = 150; CL.turn='me'; CL.last = Date.now() - 500; clockTick(); })()");
  ok('her flag falls', ev(d,'CL.flagged')==='me');
  ok('the clock stops', ev(d,'CL.timer')===null);
  ok('it says what that means in a real game',
     /time is up/.test(ev(d,"document.getElementById('freeSay').textContent")),
     ev(d,"document.getElementById('freeSay').textContent"));
  ok('and that it is a loss even from a winning position',
     /even a winning position/.test(ev(d,"document.getElementById('freeSay').textContent")));
  ok('the clock face shows it is out',
     ev(d,"document.getElementById('fpClockMe').classList.contains('out')"));
  ok('the game is kept, as a loss', ev(d,'savedGames().length')===1 && ev(d,'savedGames()[0].res')==='lost');
  ok('she cannot keep playing after the flag', ev(d,'FP.busy')===true);
  ok('and the clock does not keep ticking',
     ev(d,"(()=>{const a=CL.me; CL.last=Date.now()-1000; clockTick(); return CL.me===a;})()"));

  /* his flag is a win */
  const d2=boot(null); await wait(900);
  ev(d2,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d2,"document.querySelector('#fpTimes [data-tc=\"10\"]').click()");
  await wait(120);
  ev(d2,"(()=>{ for (const san of ['e4','e5','Nf3','Nc6']) FP.game.move(san); })()");
  ev(d2,"(()=>{ CL.them = 100; CL.turn='them'; CL.last = Date.now() - 500; clockTick(); })()");
  ok('his flag falls', ev(d2,'CL.flagged')==='them');
  ok('and she wins on time',
     /win on time/.test(ev(d2,"document.getElementById('freeSay').textContent")));
  ok('kept as a win', ev(d2,'savedGames()[0].res')==='won');
}

/* ---------- it never runs while she is elsewhere ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"25\"]').click()");
  await wait(120);
  ok('it is running', ev(d,'CL.timer')!==null);
  ev(d,"document.getElementById('freeBack').click()");
  ok('leaving the screen stops it', ev(d,'CL.timer')===null && ev(d,'CL.turn')===null);
  const at=ev(d,'CL.me');
  await wait(400);
  ev(d,'clockTick()');
  ok('and no time is lost while she is away', ev(d,'CL.me')===at);
}

/* ---------- a new game resets it, and the choice is remembered ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"10\"]').click()");
  await wait(120);
  ev(d,"(()=>{ CL.me = 42000; paintClock(); })()");
  ev(d,"document.getElementById('freeNew').click()");
  ok('a new game puts the time back', ev(d,'CL.me')===600000);
  ok('nobody has flagged', ev(d,'CL.flagged')===null);
  const saved=d.window.localStorage.getItem('knightschool:players');
  ok('the choice is saved', saved.indexOf('"tc"')>=0);
  const d2=boot({'knightschool:players':saved}); await wait(900);
  ok('and comes back next time', ev(d2,"CL.tc.id")==='10' && ev(d2,'CL.on')===true);
  ev(d2,"addPlayer('Other','club'); clockSet((SAVE&&SAVE.tc)||'off');");
  ok('another child starts with no clock', ev(d2,'CL.on')===false);
}

/* ---------- playing a move actually switches the clocks ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('freeBtn').click();");
  ev(d,"document.querySelector('#fpTimes [data-tc=\"25\"]').click()");
  await wait(120);
  ok('hers runs first', ev(d,'CL.turn')==='me');
  ev(d,"(()=>{ FP.sel=null; fpTap('e2'); fpTap('e4'); })()");
  await wait(150);
  ok('after her move it is his clock', ev(d,'CL.turn')==='them' || ev(d,'FP.busy')===true,
     {turn:ev(d,'CL.turn'), busy:ev(d,'FP.busy')});
  await wait(2200);
  ok('and it comes back to her once he has replied', ev(d,'CL.turn')==='me',
     {turn:ev(d,'CL.turn'), moves:ev(d,'FP.game.history.length')});
  ok('his clock went down while he thought', ev(d,'CL.them') < 1500000);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
