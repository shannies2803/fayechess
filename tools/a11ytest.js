/* playing without touching the screen: focus, arrow keys, and what gets announced */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const boot=()=>new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=(d,s)=>d.window.eval(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* press a key on whatever has focus */
const key=(d,k)=>ev(d,`(()=>{const e=document.activeElement;
  const ev2=new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true,cancelable:true});
  e.dispatchEvent(ev2); return document.activeElement.dataset.sq||document.activeElement.id||'';})()`);

(async ()=>{
const d=boot(); await wait(900);
ev(d,"document.querySelector('#addLevels [data-lv=\"new\"]').click(); document.getElementById('addSave').click();");
await wait(300);

/* ---------- the page announces itself ---------- */
ok('there is a live region for announcements', !!ev(d,"document.getElementById('live')"));
ok('it is polite, not assertive',
   ['polite','assertive'].includes(ev(d,"document.getElementById('live').getAttribute('aria-live')")),
   ev(d,"document.getElementById('live').getAttribute('aria-live')"));
ok('there is a skip link', !!ev(d,"document.querySelector('.skip, #skip')"));

/* ---------- changing screen moves the focus ---------- */
ev(d,"document.getElementById('begBtn').click()");
ok('opening a screen focuses it',
   ev(d,"document.activeElement.id")==='s-beg', ev(d,"document.activeElement.id"));
ok('the screen is reachable by script but not a tab stop',
   ev(d,"document.getElementById('s-beg').getAttribute('tabindex')")==='-1');
ok('and its name is announced',
   ev(d,"document.getElementById('live').textContent")!==undefined);
ev(d,"document.getElementById('begBack').click()");
ok('going back focuses the home screen', ev(d,"document.activeElement.id")==='s-home');

/* ---------- the board can be walked with the arrow keys ---------- */
ev(d,"L.mode='beg'; openWorld('w1',0);");
ok('exactly one square is in the tab order',
   ev(d,"document.querySelectorAll('#board .sq[tabindex=\"0\"]').length")===1);
ok('and it is the corner', ev(d,"document.querySelector('#board .sq[tabindex=\"0\"]').dataset.sq")==='a1');
ev(d,"document.querySelector('#board .sq[tabindex=\"0\"]').focus()");
ok('focus starts on a1', ev(d,"document.activeElement.dataset.sq")==='a1');
ok('right goes to b1', key(d,'ArrowRight')==='b1');
ok('up goes to b2', key(d,'ArrowUp')==='b2');
ok('left goes back to a2', key(d,'ArrowLeft')==='a2');
ok('down goes back to a1', key(d,'ArrowDown')==='a1');
ok('the edge of the board holds', key(d,'ArrowDown')==='a1' && key(d,'ArrowLeft')==='a1');
ok('still only one square in the tab order',
   ev(d,"document.querySelectorAll('#board .sq[tabindex=\"0\"]').length")===1);

/* ---------- and the rook lesson can be solved with the keyboard alone ---------- */
ok('the piece is on a1', ev(d,'L.spos')==='a1');
key(d,'ArrowUp'); key(d,'ArrowUp'); key(d,'ArrowUp');
ok('the cursor reached a4', ev(d,"document.activeElement.dataset.sq")==='a4');
key(d,'Enter');
ok('Enter plays the move', ev(d,'L.spos')==='a4');
key(d,'ArrowRight'); key(d,'ArrowRight'); key(d,'ArrowRight');
ok('the cursor reached d4', ev(d,"document.activeElement.dataset.sq")==='d4');
key(d,' ');
ok('Space plays a move too', ev(d,'L.done')===true);
ok('and the lesson was solved with the keyboard alone', ev(d,"SAVE.stars['w1:0']")===3);

/* ---------- a board turned round for Black turns the arrows round too ---------- */
{
  const d2=boot(); await wait(900);
  ev(d2,"document.querySelector('#addLevels [data-lv=\"club\"]').click(); document.getElementById('addSave').click();");
  await wait(250);
  ev(d2,"BEGMODE='pat'; L.mode='beg'; openWorld('w16',2);");   // a lesson played as Black
  ok('this lesson is played as Black', ev(d2,"L.task.side")==='b');
  ok('so the board is turned round',
     ev(d2,"document.getElementById('board').classList.contains('flip')"));
  // start in the middle, where every direction has somewhere to go
  ev(d2, `(()=>{document.querySelectorAll('#board .sq').forEach(x=>x.tabIndex=-1); const t=document.querySelector('#board [data-sq="d4"]'); t.tabIndex=0; t.focus();})()`);
  ok('the cursor starts in the middle', ev(d2,"document.activeElement.dataset.sq")==='d4');
  ok('on a turned board, right moves to the square that looks right', key(d2,'ArrowRight')==='c4');
  ok('and up moves to the square that looks up', key(d2,'ArrowUp')==='c3');
  ok('left comes back', key(d2,'ArrowLeft')==='d3');
  ok('down comes back', key(d2,'ArrowDown')==='d4');

  /* and on a board the right way round, the arrows are the plain ones */
  const d3=boot(); await wait(900);
  ev(d3,"document.querySelector('#addLevels [data-lv=\"club\"]').click(); document.getElementById('addSave').click();");
  await wait(250);
  ev(d3,"BEGMODE='pat'; L.mode='beg'; openWorld('w14',0);");
  ok('this lesson is played as White', ev(d3,"L.task.side")!=='b');
  ev(d3, `(()=>{document.querySelectorAll('#board .sq').forEach(x=>x.tabIndex=-1); const t=document.querySelector('#board [data-sq="d4"]'); t.tabIndex=0; t.focus();})()`);
  ok('right moves right', key(d3,'ArrowRight')==='e4');
  ok('up moves up', key(d3,'ArrowUp')==='e5');
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
