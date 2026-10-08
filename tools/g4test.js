/* fourth suite: faces, the start-here marker, and growing out of the beginner path */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
function ok(label, cond, detail){
  if (cond) pass++;
  else { fail++; console.log('FAIL: '+label+(detail!==undefined?('  -> '+JSON.stringify(detail)):'')); }
}
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const boot=()=>new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=(d,src)=>d.window.eval(src);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
/* ---------- a face of your own ---------- */
{
  const d=boot(); await wait(900);
  ok('the first run offers faces', ev(d,"document.querySelectorAll('#addFaces [data-face]').length")>=8);
  ok('one face is preselected', ev(d,"document.querySelectorAll('#addFaces .pchip.on').length")===1);
  const second = ev(d,"document.querySelectorAll('#addFaces [data-face]')[2].dataset.face");
  ev(d,"document.querySelectorAll('#addFaces [data-face]')[2].click()");
  ok('tapping a face selects it', ev(d,'ADD.face')===second);
  ok('and only one stays selected', ev(d,"document.querySelectorAll('#addFaces .pchip.on').length")===1);
  ev(d,"document.getElementById('addName').value='Nia'; document.getElementById('addSave').click();");
  ok('the chosen face is kept', ev(d,'activePlayer().face')===second);
  ok('the chip on the home screen shows it',
     ev(d,"document.querySelector('#playerBar .pchip.on .pf').textContent")===second);

  /* a second player cannot take the same face */
  ev(d,"showAddPlayer()");
  const faceDisabled = (dd,f)=>ev(dd,`(()=>{const b=Array.from(document.querySelectorAll('#addFaces [data-face]'))
     .find(x=>x.dataset.face===${JSON.stringify(f)}); return b? b.disabled : 'missing';})()`);
  ok('the taken face is disabled', faceDisabled(d, second)===true, faceDisabled(d, second));
  ok('and a free one is offered instead', ev(d,'ADD.face')!==second);
  ev(d,"document.getElementById('addName').value='Omar'; document.getElementById('addSave').click();");
  ok('two players have different faces',
     ev(d,"players()[0].face")!==ev(d,"players()[1].face"));

  /* editing can change the face but not to one in use */
  ev(d,"showEditPlayer(players()[1].id)");
  ok('the editor starts on that player’s own face', ev(d,'ADD.face')===ev(d,'players()[1].face'));
  ok('their own face is not disabled in their own editor',
     faceDisabled(d, ev(d,'players()[1].face'))===false);
  const keep = ev(d,'players()[1].face');
  ev(d,`ADD.face=${JSON.stringify(ev(d,'players()[0].face'))}; document.getElementById('addSave').click();`);
  ok('a face already in use is refused', ev(d,'players()[1].face')===keep);
}

/* ---------- the beginner map says where to start ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Kid','new'); repaintForPlayer(); paintBegMap();");
  ok('exactly one world is marked as the place to start',
     ev(d,"document.querySelectorAll('#begList .world.pickon').length")===1);
  ok('and it is the first one',
     ev(d,"document.querySelector('#begList .world.pickon').dataset.bw")==='w1');
  ok('it says start here',
     /^Start here/.test(ev(d,"document.querySelector('#begList .world.pickon .taunt').textContent")));
  ok('the counter shows none finished', ev(d,"document.getElementById('begCount').textContent")==='0/11');
  // finish the rook world
  ev(d,"(()=>{const w=WORLDS.find(x=>x.id==='w1'); for(let i=0;i<w.tasks.length;i++) SAVE.stars[taskKey('w1',i)]=3; save();})()");
  ev(d,"paintBegMap()");
  ok('the marker moves on',
     ev(d,"document.querySelector('#begList .world.pickon').dataset.bw")==='w2');
  ok('the finished world gets its star',
     ev(d,"document.querySelector('#begList [data-bw=\"w1\"] .lock').textContent")==='⭐');
  ok('the counter counts it', ev(d,"document.getElementById('begCount').textContent")==='1/11');
}

/* ---------- finishing the beginner path opens the way up ---------- */
{
  const d=boot(); await wait(900);
  ev(d,"addPlayer('Kid','new'); repaintForPlayer();");
  ok('no move-up button while there is still work',
     ev(d,"document.getElementById('levelUpBtn').style.display")==='none');
  ev(d,`(()=>{ for (const w of WORLDS.filter(x=>x.beg))
     for (let i=0;i<w.tasks.length;i++) SAVE.stars[taskKey(w.id,i)]=3; save(); repaintForPlayer(); })()`);
  ok('finishing everything offers the move up',
     ev(d,"document.getElementById('levelUpBtn').style.display")!=='none');
  ok('the marker is gone from the beginner map',
     ev(d,"document.querySelectorAll('#begList .world.pickon').length")===0);
  ev(d,"document.getElementById('levelUpBtn').click()");
  ok('moving up changes the level', ev(d,'playerLevel()')==='some');
  ok('the move-up button goes away',
     ev(d,"document.getElementById('levelUpBtn').style.display")==='none');
  ok('openings appear', ev(d,"document.getElementById('playBtn').style.display")!=='none');
  ok('the beginner button goes away', ev(d,"document.getElementById('begBtn').style.display")==='none');
  ok('the stars earned are kept', ev(d,'totalStars()')>0);
  ok("today's four is rebuilt for the new level",
     ev(d,'dailyPlan().plan.puzzles.length + (dailyPlan().plan.lessons||[]).length')===3);
  ok('and it is no longer beginner lessons',
     ev(d,"(dailyPlan().plan.lessons||[]).every(l=>!WORLDS.find(w=>w.id===l[0]).beg)"));
  ok('and the harder cap applies now', ev(d,'levelInfo().max')===1600);
  ok('the beginner lessons are still reachable from the grown-ups panel',
     !!ev(d,"document.getElementById('begUnlockBtn')"));
  ev(d,"document.getElementById('begUnlockBtn').click()");
  ok('and they really open',
     ev(d,"document.getElementById('s-beg').classList.contains('on')"));
  const raw=d.window.localStorage.getItem('knightschool:players');
  ok('the new level is saved', raw.indexOf('"some"')>=0);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
