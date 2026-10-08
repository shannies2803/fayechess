/* the app must work through the host storage API as well as localStorage,
   and must survive storage being unavailable altogether */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });

function bootWith(pre){
  let html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  html=html.replace('</head>', '<script>'+pre+'<\/script></head>');
  return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
}
const ev=(d,s)=>d.window.eval(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
/* 1. the host storage API instead of localStorage */
{
  const pre = `window.__bag={};
    window.storage={ get:k=>Promise.resolve({value: window.__bag[k]||null}),
                     set:(k,v)=>{ window.__bag[k]=v; return Promise.resolve(); } };`;
  const d=bootWith(pre); await wait(900);
  ok('a fresh host-storage device asks who is playing',
     ev(d,"document.getElementById('s-add').classList.contains('on')"));
  ev(d,"document.querySelector('#addLevels [data-lv=\"club\"]').click(); document.getElementById('addName').value='Faye'; document.getElementById('addSave').click();");
  await wait(120);
  ok('the player was written through the host API',
     !!ev(d,"window.__bag['knightschool:players']") &&
     ev(d,"window.__bag['knightschool:players']").indexOf('Faye')>=0);
  const bag = ev(d,"window.__bag['knightschool:players']");

  const pre2 = `window.__bag=${JSON.stringify({'knightschool:players':bag})};
    window.storage={ get:k=>Promise.resolve({value: window.__bag[k]||null}),
                     set:(k,v)=>{ window.__bag[k]=v; return Promise.resolve(); } };`;
  const d2=bootWith(pre2); await wait(900);
  ok('it comes back on the next visit', ev(d2,"activePlayer().name")==='Faye');
  ok('with the right level', ev(d2,'playerLevel()')==='club');
}

/* 2. migrating an old single-player save held in host storage */
{
  const old=JSON.stringify({stars:{'w13:0':3}, badges:['c2'], rating:1400});
  const pre=`window.__bag=${JSON.stringify({'knightschool:progress':old})};
    window.storage={ get:k=>Promise.resolve({value: window.__bag[k]||null}),
                     set:(k,v)=>{ window.__bag[k]=v; return Promise.resolve(); } };`;
  const d=bootWith(pre); await wait(900);
  ok('an old host-storage save migrates', ev(d,'players().length')===1);
  ok('and keeps its rating', ev(d,'myRating()')===1400);
  ok('and does not ask who is playing',
     ev(d,"document.getElementById('s-home').classList.contains('on')"));
}

/* 3. storage refusing to work at all, as in a locked-down private window */
{
  const pre=`(()=>{ const bad=()=>{ throw new Error('denied'); };
    try{ Object.defineProperty(window,'localStorage',{get:bad}); }catch(e){}
  })();`;
  const d=bootWith(pre); await wait(900);
  ok('the app still starts with no storage at all',
     ev(d,"document.querySelectorAll('.screen.on').length")===1);
  ok('and a player can still be created in memory',
     ev(d,"(()=>{ try{ addPlayer('Temp','some'); return players().length; }catch(e){ return 'threw: '+e.message; } })()")===1);
  ok('and a lesson still opens',
     ev(d,"(()=>{ try{ L.mode='beg'; openWorld('w1',0); return L.task.kind; }catch(e){ return 'threw: '+e.message; } })()")==='stars');
  ok('and can still be solved',
     ev(d,"(()=>{ try{ tapStars('a4'); tapStars('d4'); return L.done; }catch(e){ return 'threw: '+e.message; } })()")===true);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
