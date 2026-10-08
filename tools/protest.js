/* a smoke test for Philip's site: it must still start and render every view */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
const vc=new VirtualConsole();
const errs=[];
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) errs.push(e.message); });
const d=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','philip','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=s=>d.window.eval(s);
setTimeout(()=>{
  ok('no startup errors', errs.length===0, errs.slice(0,3));
  ok('the engine loaded', ev("typeof Chess")==='function');
  ok('the openings are there', ev('OPENINGS.length')>=100, ev('OPENINGS.length'));
  ok('the puzzles are there', ev('PUZZLES.length')>1000, ev('PUZZLES.length'));
  ok('the endgames are there', ev('ENDGAMES.length')>=20, ev('ENDGAMES.length'));
  ok('the patterns are there', ev('PATTERNS.length')>=20, ev('PATTERNS.length'));
  ok('the annotated games are there', ev('GAMES.length')>=8, ev('GAMES.length'));
  ok('every view is in the document',
     ev("document.querySelectorAll('section[id^=\"v-\"]').length")>=12);
  ok('the about paragraph is not the background colour',
     ev("document.getElementById('aboutCounts').getAttribute('style')").indexOf('var(--ink)')<0);
  ok('the scrolling tab strips cannot stretch the page',
     ev("getComputedStyle(document.querySelector('.btnrow')).minWidth")==='0px');
  ok('the board coordinates are readable',
     parseFloat(ev("getComputedStyle(document.querySelector('.co')||document.body).fontSize"))>=9);
  /* changing view must take the focus and announce itself */
  ev("go('tactics')");
  ok('changing view focuses it', ev("document.activeElement && document.activeElement.id")==='v-tactics',
     ev("document.activeElement && document.activeElement.id"));
  ok('the view is reachable by script but not a tab stop',
     ev("document.getElementById('v-tactics').getAttribute('tabindex')")==='-1');
  ok('there is a live region to announce it',
     ev("document.getElementById('live').getAttribute('aria-live')")==='polite');
  ev("go('home')");
  ok('and going home focuses home', ev("document.activeElement.id")==='v-home');

  /* checkmate is accepted even when the book move was different */
  ok('any checkmate is accepted as a solution',
     ev("(function(){var src=String(pzUserMove); return src.indexOf('|| isMate')>=0;})()"));

  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
}, 2500);
