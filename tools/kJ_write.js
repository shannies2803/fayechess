/* ============ WRITING THE GAME DOWN ============
   Most scholastic tournaments expect a scoresheet, and a child who cannot keep one
   also cannot bring the game home to look at. Both drills are tapping only: one
   names a square and she finds it, the other plays a move and she picks its name.
   Nothing here asks her to type. */

const WR = { mode:'find', game:null, cells:null, q:null, score:0, streak:0, tries:0, asked:0 };

function wrStart(mode){
  WR.mode = mode || 'find';
  WR.score = 0; WR.streak = 0; WR.asked = 0;
  $('#wrTitle').textContent = WR.mode==='find' ? 'Find the square' : 'What is this move called?';
  show('write');
  paintWrTabs();
  wrNext();
}

function paintWrTabs(){
  const host = $('#wrTabs');
  if (!host) return;
  const tabs = [['find','Find the square'],['name','Name the move']];
  host.innerHTML = tabs.map(([k,label])=>
    `<button class="pill${WR.mode===k?' go':''}" data-wr="${k}" aria-pressed="${WR.mode===k}"
      style="flex:1;font-size:15px">${label}</button>`).join('');
  $$('#wrTabs [data-wr]').forEach(b=>b.onclick=()=>wrStart(b.dataset.wr));
}

function wrSay(t, mood){
  $('#wrSay').textContent = t;
  $('#wrBubble').className = 'bubble' + (mood ? ' '+mood : '');
  say(t);
}

function wrScore(){
  $('#wrScore').textContent = WR.score + '/' + WR.asked;
  const s = $('#wrStreak');
  if (s) s.textContent = WR.streak >= 3 ? '🔥 ' + WR.streak + ' in a row' : '';
}

function wrNext(){
  WR.tries = 0;
  WR.asked++;
  if (WR.mode === 'find') wrNextFind(); else wrNextName();
  wrScore();
}

/* ---------- drill one: she is told a square and taps it ---------- */
function wrNextFind(){
  const f = FL[Math.floor(Math.random()*8)];
  const r = 1 + Math.floor(Math.random()*8);
  WR.q = { alg: f + r };
  WR.cells = buildBoard($('#wrBoard'), wrTapFind, false);
  for (const k in WR.cells) setPiece(WR.cells[k], null);
  $('#wrChoices').style.display = 'none';
  $('#wrBoardWrap').style.display = '';
  wrSay('Tap ' + WR.q.alg + '.');
  const big = $('#wrBig');
  if (big){ big.style.display=''; big.textContent = WR.q.alg; }
}

function wrTapFind(alg){
  if (WR.mode !== 'find' || !WR.q) return;
  if (alg === WR.q.alg){
    WR.cells[alg].classList.add('star');
    if (!WR.tries){ WR.score++; WR.streak++; } else WR.streak = 0;
    wrRecord(true);
    wrSay(WR.tries ? 'That is the one.' : pick(['Yes!','Spot on.','Exactly.']), 'win');
    wrScore();
    setTimeout(wrNext, 850);
  } else {
    WR.tries++; WR.streak = 0;
    WR.cells[alg].classList.add('bad');
    const hint = WR.tries >= 2
      ? 'Letters go across the bottom, numbers up the side. Find the ' + WR.q.alg[0] +
        ' column first, then count up to ' + WR.q.alg[1] + '.'
      : 'Not that one. Look for ' + WR.q.alg + '.';
    wrSay(hint, 'oops');
    setTimeout(()=>{ if (WR.cells[alg]) WR.cells[alg].className = WR.cells[alg].dataset.base; }, 500);
    wrRecord(false);
  }
}

/* ---------- drill two: a move is played and she picks its name ---------- */
function wrNextName(){
  // a short random opening so the positions are real, then one move to name
  const g = new Chess();
  const plies = 2 + Math.floor(Math.random()*8);
  for (let i=0;i<plies;i++){
    const ms = g.moves();
    if (!ms.length) break;
    g.applyMove(ms[Math.floor(Math.random()*ms.length)]);
  }
  const opts = g.movesSan();
  if (!opts.length) return wrNextName();
  const chosen = opts[Math.floor(Math.random()*opts.length)];
  const before = g.fen();
  g.move(chosen.san);
  WR.q = { san: chosen.san, from: sqToAlg(chosen.from), to: sqToAlg(chosen.to) };

  WR.cells = buildBoard($('#wrBoard'), ()=>{}, false);
  for (const k in WR.cells) setPiece(WR.cells[k], g.get(k));
  WR.cells[WR.q.from].classList.add('pick');
  WR.cells[WR.q.to].classList.add('hint');

  // three wrong answers that look plausible: other legal moves from the same position
  const pool = new Chess(before).movesSan().map(m=>m.san).filter(s=>s !== chosen.san);
  const wrong = [];
  while (wrong.length < 3 && pool.length){
    const i = Math.floor(Math.random()*pool.length);
    wrong.push(pool.splice(i,1)[0]);
  }
  const all = [chosen.san, ...wrong].sort(()=>Math.random()-0.5);
  const host = $('#wrChoices');
  host.style.display = '';
  host.innerHTML = all.map(s=>
    `<button class="pill" data-san="${s}" style="flex:0 0 auto;font-size:18px;font-weight:700">${s}</button>`).join('');
  $$('#wrChoices [data-san]').forEach(b=>b.onclick=()=>wrPickName(b.dataset.san));
  const big = $('#wrBig'); if (big) big.style.display='none';
  wrSay('The yellow piece moved to the green square. What is that written as?');
}

function wrPickName(san){
  if (WR.mode !== 'name' || !WR.q) return;
  if (san === WR.q.san){
    if (!WR.tries){ WR.score++; WR.streak++; } else WR.streak = 0;
    wrRecord(true);
    wrSay(pick(['Yes!','That is it.','Exactly.']) + ' ' + WR.q.san, 'win');
    wrScore();
    setTimeout(wrNext, 900);
  } else {
    WR.tries++; WR.streak = 0;
    wrRecord(false);
    wrSay(wrWhy(san), 'oops');
  }
}

/* why the answer she picked is not the move on the board */
function wrWhy(san){
  const want = WR.q.san;
  const letter = c => ({K:'king',Q:'queen',R:'rook',B:'bishop',N:'knight'})[c] || 'pawn';
  const mine = letter(want[0]), theirs = letter(san[0]);
  if (mine !== theirs) return 'That is a ' + theirs + ' move. The piece that moved was the ' + mine + '.';
  if (want.includes('x') && !san.includes('x')) return 'Close — but it took something, so it needs an x.';
  if (!want.includes('x') && san.includes('x')) return 'The x means it took a piece, and nothing was taken.';
  return 'Not that square. Look at where the piece landed.';
}

function wrRecord(right){
  SAVE.wr = SAVE.wr || { find:{t:0,r:0}, name:{t:0,r:0} };
  const s = SAVE.wr[WR.mode] || (SAVE.wr[WR.mode] = {t:0,r:0});
  if (!WR.tries || right) s.t++;
  if (right && !WR.tries) s.r++;
  save();
  const el = $('#wrHow');
  if (el){
    const a = SAVE.wr.find || {t:0,r:0}, b = SAVE.wr.name || {t:0,r:0};
    const pct = x => x.t ? Math.round(x.r/x.t*100) + '%' : '—';
    el.textContent = 'Squares ' + pct(a) + '  ·  Move names ' + pct(b);
  }
}

function paintWriteBtn(){
  const b = $('#writeBtn');
  if (!b) return;
  b.style.display = (typeof playerLevel==='function' && playerLevel()==='new') ? 'none' : '';
}
