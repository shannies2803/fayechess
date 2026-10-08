/* ============ THE CLOCK ============
   At her level more games are lost to spending ten minutes on move four than to
   anything on the board. A clock only teaches that if running out actually costs
   the game, so it does. It is off by default: a countdown steadies some children
   and rattles others, and that is a parent's call, not mine.

   The engine's own thinking runs down the engine's clock, exactly as an opponent's
   thinking would. The clock stops the moment she leaves the screen. */

const TCS = [
  { id:'off',  label:'No clock',  ms:0,          inc:0 },
  { id:'10',   label:'10 min',    ms:10*60000,   inc:0 },
  { id:'15+5', label:'15 min +5', ms:15*60000,   inc:5000 },
  { id:'25',   label:'25 min',    ms:25*60000,   inc:0 }
];
const CL = { on:false, tc:TCS[0], me:0, them:0, turn:null, last:0, timer:null, flagged:null };

function tcById(id){ return TCS.find(t=>t.id===id) || TCS[0]; }

function clockSet(id){
  const tc = tcById(id);
  CL.tc = tc;
  CL.on = tc.ms > 0;
  SAVE.tc = tc.id;
  save();
  clockReset();
  paintClockChips();
}

function clockReset(){
  clockStop();
  CL.me = CL.tc.ms;
  CL.them = CL.tc.ms;
  CL.turn = null;
  CL.flagged = null;
  paintClock();
}

/* whose clock is running, if anyone */
function clockTurn(side){
  if (!CL.on || CL.flagged) return;
  clockTick();                       // settle whatever was running first
  CL.turn = side;
  CL.last = Date.now();
  if (!CL.timer) CL.timer = setInterval(clockTick, 200);
  paintClock();
}

function clockStop(){
  if (CL.timer){ clearInterval(CL.timer); CL.timer = null; }
  CL.turn = null;
}

/* a completed move earns the increment, as it would on a real clock */
function clockMoved(side){
  if (!CL.on || CL.flagged) return;
  clockTick();
  if (CL.tc.inc){
    if (side === 'me') CL.me += CL.tc.inc; else CL.them += CL.tc.inc;
  }
  paintClock();
}

function clockTick(){
  if (!CL.on || !CL.turn || CL.flagged) return;
  const now = Date.now();
  const dt = now - CL.last;
  CL.last = now;
  if (CL.turn === 'me') CL.me = Math.max(0, CL.me - dt);
  else                  CL.them = Math.max(0, CL.them - dt);
  if (CL.me === 0 || CL.them === 0) return clockFlag(CL.me === 0 ? 'me' : 'them');
  paintClock();
}

function clockFlag(who){
  CL.flagged = who;
  clockStop();
  paintClock();
  if (typeof FP === 'object' && FP) FP.busy = true;
  if (who === 'me'){
    fpSay('Your time is up. In a real game that is a loss — even a winning position. ⏰', 'oops');
    if (typeof saveGame==='function' && FP && FP.game)
      saveGame(FP.game.history.map(h=>(h.move&&h.move.san)||h.san).filter(Boolean), FP.me||'w', 'lost', 'play');
  } else {
    fpSay('His time is up — you win on time! \u{1F3C6}');
    if (typeof confetti==='function') confetti();
    if (typeof saveGame==='function' && FP && FP.game)
      saveGame(FP.game.history.map(h=>(h.move&&h.move.san)||h.san).filter(Boolean), FP.me||'w', 'won', 'play');
  }
  if (typeof paintLookList==='function') paintLookList();
}

function clockText(ms){
  const t = Math.max(0, Math.ceil(ms/1000));
  const m = Math.floor(t/60), s = t % 60;
  return m + ':' + String(s).padStart(2,'0');
}

function paintClock(){
  const wrap = $('#fpClocks');
  if (!wrap) return;
  wrap.style.display = CL.on ? '' : 'none';
  if (!CL.on) return;
  const mine = $('#fpClockMe'), theirs = $('#fpClockThem');
  if (mine){
    mine.textContent = clockText(CL.me);
    mine.classList.toggle('run', CL.turn === 'me');
    mine.classList.toggle('low', CL.me <= 30000 && CL.me > 0);
    mine.classList.toggle('out', CL.me === 0);
  }
  if (theirs){
    theirs.textContent = clockText(CL.them);
    theirs.classList.toggle('run', CL.turn === 'them');
    theirs.classList.toggle('low', CL.them <= 30000 && CL.them > 0);
    theirs.classList.toggle('out', CL.them === 0);
  }
}

function paintClockChips(){
  const host = $('#fpTimes');
  if (!host) return;
  host.innerHTML = TCS.map(t=>
    `<button class="pill${CL.tc.id===t.id?' go':''}" data-tc="${t.id}"
       aria-pressed="${CL.tc.id===t.id}" style="flex:0 0 auto;font-size:14px;padding:12px 14px">${t.label}</button>`
  ).join('');
  $$('#fpTimes [data-tc]').forEach(b=>b.onclick=()=>{
    clockSet(b.dataset.tc);
    if (typeof fpNew==='function') fpNew();
  });
}

/* the clock must never run while she is somewhere else in the app */
function clockWatchScreen(){
  const free = $('#s-free');
  if (!free) return;
  if (!free.classList.contains('on')) clockStop();
}
