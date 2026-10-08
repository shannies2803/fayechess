/* ============ LOOK AT A GAME AGAIN ============
   The most useful hour of a competing child's week is going back over her own
   game. She cannot write chess notation yet, so nothing here asks her to type:
   she taps the moves out on a board exactly as they happened, and the app writes
   the notation underneath as she goes. Games played inside the app are kept
   automatically, so those need no input at all.

   The verdicts come from the same coach that watches her live games, so the
   wording is the wording she already knows. */

const LK = { mode:'list', game:null, cells:null, sel:null, moves:[], side:'w',
             ply:0, notes:[], promo:null, src:null, flip:false };

function savedGames(){ return SAVE.games || (SAVE.games = []); }

/* keep the last dozen; a child does not go back further than that */
function saveGame(moves, side, res, from){
  if (!moves || moves.length < 4) return;        // not a game, just a few taps
  const list = savedGames();
  list.push({ m:moves.slice(0, 200), side, res: res||'', from: from||'play', when: Date.now() });
  if (list.length > 12) SAVE.games = list.slice(-12);
  save();
}

function gameLabel(g){
  const when = new Date(g.when);
  const day = when.getDate() + ' ' +
    ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][when.getMonth()];
  const where = g.from==='pass' ? 'Two players' : g.from==='own' ? 'Your match' : 'Against the computer';
  return { day, where };
}

/* ---------- the list of games ---------- */
function paintLookList(){
  const host = $('#lookList');
  if (!host) return;
  const list = savedGames().slice().reverse();
  host.innerHTML = list.length ? list.map((g,i)=>{
    const L2 = gameLabel(g);
    const res = g.res==='won' ? '🏆 you won' : g.res==='lost' ? 'you lost' : g.res==='draw' ? 'a draw' : '';
    return `<button class="world" data-game="${list.length-1-i}">
      <span class="em">${g.from==='own' ? '🏅' : g.from==='pass' ? '👫' : '🤖'}</span>
      <span class="nm">${L2.where}
        <span class="taunt">${Math.ceil(g.m.length/2)} moves · ${L2.day}${res ? ' · ' + res : ''}</span></span>
      <span class="lock">▸</span>
    </button>`;
  }).join('')
    : `<p class="streak" style="text-align:left">No games yet. Play one, or tap the button below and
       tap out the moves from a game you played at school.</p>`;
  $$('#lookList [data-game]').forEach(b=>b.onclick=()=>lookOpen(+b.dataset.game));
}

/* ---------- tapping a game out ---------- */
function lookEnter(){
  LK.mode = 'enter';
  LK.game = new Chess();
  LK.moves = [];
  LK.sel = null;
  LK.promo = null;
  LK.flip = false;
  LK.src = 'own';
  $('#lookTitle').textContent = 'Tap out your game';
  show('look');
  lookPaintMode();
  LK.cells = buildBoard($('#lookBoard'), lookTap, false);
  lookDraw();
  lookSay('Play the moves exactly as they happened — both sides. I will write them down for you.');
}

function lookSay(t){
  const el = $('#lookSay');
  if (el) el.textContent = t;
  if (typeof say==='function') say(t);
}

function lookPaintMode(){
  const set = (sel,on)=>{ const e=$(sel); if (e) e.style.display = on ? '' : 'none'; };
  set('#lookPickRow', LK.mode==='list');
  set('#lookBoardWrap', LK.mode!=='list');
  set('#lookEnterRow', LK.mode==='enter');
  set('#lookReviewRow', LK.mode==='review');
  set('#lookNotes', LK.mode==='review');
  set('#lookMoves', LK.mode!=='list');
  set('#lookSayWrap', LK.mode!=='list');
  set('#lookSideRow', LK.mode==='enter');
}

function lookDraw(){
  clearMarks(LK.cells);
  const g = LK.game;
  for (const k in LK.cells) setPiece(LK.cells[k], g.get(k));
  const h = g.history;
  markLast(LK.cells, h.length ? h[h.length-1].move : null);
  if (LK.sel){
    LK.cells[LK.sel].classList.add('pick');
    for (const m of g.movesFrom(LK.sel)) LK.cells[sqToAlg(m.to)].classList.add('hint');
  }
  if (g.inCheck()){
    const k = sqToAlg(g.findKing(g.turn));
    if (LK.cells[k]) LK.cells[k].classList.add('bad');
  }
  lookPaintMoves();
}

/* the notation, written for her, with the move she is on marked */
function lookPaintMoves(){
  const host = $('#lookMoves');
  if (!host) return;
  const list = LK.mode==='enter' ? LK.moves : (LK.all || []);
  if (!list.length){ host.innerHTML = '<span class="streak">No moves yet.</span>'; return; }
  const upto = LK.mode==='enter' ? list.length : LK.ply;
  let html = '';
  for (let i=0;i<list.length;i++){
    if (i % 2 === 0) html += `<b class="mvno">${i/2+1}.</b>`;
    const flagged = LK.mode==='review' && (LK.notes||[]).some(n=>n.ply===i);
    html += `<span class="mv${i===upto-1?' now':''}${flagged?' flag':''}" data-ply="${i}">${list[i]}</span>`;
  }
  host.innerHTML = html;
  if (LK.mode==='review')
    $$('#lookMoves [data-ply]').forEach(b=>b.onclick=()=>lookGoto(+b.dataset.ply + 1));
  const now = host.querySelector('.mv.now');
  if (now && now.scrollIntoView){ try{ now.scrollIntoView({block:'nearest', inline:'center'}); }catch(e){} }
}

function lookTap(alg){
  if (LK.mode !== 'enter' || LK.promo) return;
  const g = LK.game;
  const p = g.get(alg);
  if (p && colorOf(p) === g.turn){ LK.sel = (LK.sel===alg ? null : alg); lookDraw(); return; }
  if (!LK.sel) return;
  const mv = g.movesFrom(LK.sel).find(m=>sqToAlg(m.to)===alg);
  if (!mv){ LK.sel = null; lookDraw(); return; }
  const from = LK.sel;
  const mover = g.get(from);
  if (mover && mover.toLowerCase()==='p' && (alg[1]==='8' || alg[1]==='1')){
    LK.promo = { from, to:alg };
    LK.sel = null;
    lookDraw();
    LK.cells[from].classList.add('pick');
    LK.cells[alg].classList.add('hint');
    $('#lookPromo').style.display = '';
    lookSay('What did the pawn become?');
    return;
  }
  lookPlay(from, alg, 'q');
}

function lookPlay(from, to, kind){
  const made = LK.game.move({ from, to, promotion: kind || 'q' });
  if (!made) return;
  LK.sel = null;
  LK.moves.push(made.san);
  lookDraw();
  if (LK.game.isCheckmate()) lookSay('Checkmate — that is the end of the game. Tap "That is the game".');
  else if (LK.game.isStalemate()) lookSay('Stalemate. Tap "That is the game".');
  else lookSay('Move ' + LK.moves.length + ' in. Keep going, or tap "That is the game".');
}

function lookUndo(){
  if (LK.mode!=='enter' || !LK.moves.length) return;
  LK.game.undo();
  LK.moves.pop();
  LK.sel = null;
  LK.promo = null;
  $('#lookPromo').style.display = 'none';
  lookDraw();
  lookSay('Taken back.');
}

/* ---------- the review ---------- */
function lookOpen(idx){
  const g = savedGames()[idx];
  if (!g) return;
  lookReview(g.m, g.side || 'w', g.from);
}

function lookReview(moves, side, from){
  LK.mode = 'review';
  LK.all = moves.slice();
  LK.side = side || 'w';
  LK.src = from || 'play';
  LK.flip = LK.side === 'b';
  LK.ply = 0;
  LK.game = new Chess();
  LK.sel = null;
  $('#lookTitle').textContent = 'Where did it go wrong?';
  show('look');
  lookPaintMode();
  LK.cells = buildBoard($('#lookBoard'), ()=>{}, LK.flip);
  LK.notes = lookAnalyse(LK.all, LK.side);
  paintLookNotes();
  lookGoto(0);
}

/* run every one of her moves past the same coach that watches her live games */
function lookAnalyse(moves, side){
  const out = [];
  const g = new Chess();
  for (let i=0;i<moves.length;i++){
    const mine = (i % 2 === 0) === (side === 'w');
    const before = g.fen();
    const made = g.move(moves[i]);
    if (!made) break;
    if (!mine) continue;
    let v = null;
    try { v = coachVerdict(before, made.san, g, side); } catch(e){ v = null; }
    if (v && v.mood === 'oops')
      out.push({ ply:i, move:made.san, no:Math.floor(i/2)+1, text:v.text, face:v.face || '🤔' });
  }
  return out;
}

function paintLookNotes(){
  const host = $('#lookNotes');
  if (!host) return;
  const n = LK.notes || [];
  if (!n.length){
    host.innerHTML = `<div class="parent" style="text-align:left">
      <h3 style="margin-bottom:6px">Nothing went badly wrong</h3>
      <p style="margin:0">I could not find a move where you gave something away or missed a
      checkmate. Step through with the arrows and see what you would play differently.</p></div>`;
    return;
  }
  host.innerHTML = `<div class="parent" style="text-align:left">
    <h3 style="margin-bottom:8px">${n.length} moment${n.length===1?'':'s'} to look at</h3>
    <div class="worlds">` +
    n.map(x=>`<button class="world" data-note="${x.ply}">
        <span class="em">${x.face}</span>
        <span class="nm">Move ${x.no}: ${x.move}
          <span class="taunt">${escapeKid(x.text)}</span></span>
      </button>`).join('') +
    `</div></div>`;
  $$('#lookNotes [data-note]').forEach(b=>b.onclick=()=>lookGoto(+b.dataset.note + 1));
}

function lookGoto(ply){
  LK.ply = Math.max(0, Math.min(ply, (LK.all||[]).length));
  LK.game = new Chess();
  for (let i=0;i<LK.ply;i++) if (!LK.game.move(LK.all[i])) break;
  lookDraw();
  const note = (LK.notes||[]).find(n=>n.ply === LK.ply - 1);
  if (note) lookSay(note.text);
  else if (!LK.ply) lookSay('The start of the game. Tap ▶ to walk through it.');
  else lookSay('Move ' + Math.ceil(LK.ply/2) + ' of ' + Math.ceil(LK.all.length/2) + '.');
  const b = $('#lookPrev'); if (b) b.disabled = LK.ply === 0;
  const f = $('#lookNext'); if (f) f.disabled = LK.ply >= LK.all.length;
  const w = $('#lookWorst');
  if (w) w.style.display = (LK.notes||[]).length ? '' : 'none';
}

function lookFirstProblem(){
  const n = (LK.notes||[])[0];
  if (n) lookGoto(n.ply + 1);
}

function paintLookBtn(){
  const b = $('#lookBtn');
  if (!b) return;
  const lv = (typeof playerLevel==='function') ? playerLevel() : 'some';
  b.style.display = lv === 'new' ? 'none' : '';
}
