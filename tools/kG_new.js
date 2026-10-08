/* ============ WHO IS PLAYING ============
   One device, several children, wildly different strengths. Each player keeps
   their own stars, badges, rating and daily four, and a level that decides what
   they are ever shown. A beginner never meets mate-in-three; a tournament
   player never meets "this is how a rook moves". */

const LEVELS_KID = {
  new:  { key:'new',  label:'Brand new',      emoji:'\u{1F331}', max:1000, start:600,
          note:'Start with how the pieces move.' },
  some: { key:'some', label:'I can play',     emoji:'\u{1F642}', max:1600, start:900,
          note:'Puzzles, endgames and openings.' },
  club: { key:'club', label:'I play matches', emoji:'\u{1F3C6}', max:9999, start:1200,
          note:'Everything, including the hardest ladder.' }
};
const LEVEL_ORDER = ['new','some','club'];
const PKEY = 'knightschool:players';
const FACES = ['\u{1F984}','\u{1F431}','\u{1F438}','\u{1F419}','\u{1F41D}','\u{1F427}',
               '\u{1F98A}','\u{1F43C}','\u{1F996}','\u{1F41C}','\u{1F99C}','\u{1F42D}'];
const blankSave = ()=>({ stars:{}, badges:[], seen:false });

let ROOT = { v:1, active:null, players:[] };

function players(){ return (ROOT && ROOT.players) ? ROOT.players : []; }
function activePlayer(){
  const ps = players();
  return ps.find(p=>p.id===ROOT.active) || ps[0] || null;
}
function playerLevel(){
  const p = activePlayer();
  return (p && LEVELS_KID[p.level]) ? p.level : 'some';
}
function levelInfo(){ return LEVELS_KID[playerLevel()]; }
function levelStart(){ return levelInfo().start; }
function isNewbie(){ return playerLevel()==='new'; }
function isClub(){ return playerLevel()==='club'; }

/* a puzzle is allowed if it is not far above this player's head */
function allowedForLevel(t){
  if (!t) return false;
  const lv = playerLevel();
  if (lv === 'club') return true;
  if (lv === 'new' && t.lvl === 6) return false;
  if (!t.rating) return lv !== 'new';        // unrated ones are the older hand-made set
  return t.rating <= levelInfo().max;
}

function newId(){
  let n = 1;
  while (players().some(p=>p.id==='p'+n)) n++;
  return 'p'+n;
}
function freeFace(){
  const used = players().map(p=>p.face);
  return FACES.find(f=>!used.includes(f)) || FACES[players().length % FACES.length];
}
function addPlayer(name, level){
  const lv = LEVELS_KID[level] ? level : 'some';
  const p = { id:newId(), name:(name||'Player').slice(0,14), level:lv, face:freeFace(),
              data:{ ...blankSave(), rating:LEVELS_KID[lv].start } };
  ROOT.players.push(p);
  ROOT.active = p.id;
  SAVE = p.data;
  persistRoot();
  return p;
}
function removePlayer(id){
  ROOT.players = players().filter(p=>p.id!==id);
  if (!ROOT.players.length) addPlayer('Me','some');
  if (!activePlayer()) ROOT.active = ROOT.players[0].id;
  SAVE = activePlayer().data;
  persistRoot();
  repaintForPlayer();
}
function switchTo(id){
  const p = players().find(x=>x.id===id);
  if (!p) return;
  ROOT.active = id;
  SAVE = p.data;
  persistRoot();
  repaintForPlayer();
}
function persistRoot(){
  try{
    const p = activePlayer();
    if (p) p.data = SAVE;
    const j = JSON.stringify(ROOT);
    if (window.storage) window.storage.set(PKEY, j);
    else localStorage.setItem(PKEY, j);
  }catch(e){}
}

/* everything on screen that depends on who is playing */
function repaintForPlayer(){
  paintStars();
  paintPlayers();
  paintLevelGates();
  if (typeof paintArena==='function') paintArena();
  if (typeof paintDaily==='function') paintDaily();
  if (typeof paintMyRating==='function') paintMyRating();
  if (typeof paintBegMap==='function') paintBegMap();
}

/* ---------- the switcher on the home screen ---------- */
function paintPlayers(){
  const host = $('#playerBar');
  if (!host) return;
  const ps = players(), act = ROOT.active;
  host.innerHTML = ps.map(p=>
    `<button class="pchip${p.id===act?' on':''}" data-p="${p.id}">
       <span class="pf">${p.face||'\u{1F642}'}</span>
       <span class="pn">${escapeKid(p.name)}</span>
     </button>`).join('') +
    `<button class="pchip add" id="addPlayerBtn">＋</button>`;
  $$('#playerBar [data-p]').forEach(b=>b.onclick=()=>switchTo(b.dataset.p));
  const add = $('#addPlayerBtn');
  if (add) add.onclick = ()=>showAddPlayer();
  const note = $('#playerNote');
  if (note){
    const p = activePlayer();
    note.textContent = p ? (levelInfo().emoji + ' ' + levelInfo().label) : '';
  }
}
function escapeKid(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- adding a player ---------- */
let ADD = { level:'some', first:false };
function showAddPlayer(first){
  ADD.level = 'some';
  ADD.first = !!first;
  const t = $('#addTitle'); if (t) t.textContent = first ? 'Who is playing?' : 'Add a player';
  const n = $('#addName'); if (n) n.value = '';
  const c = $('#addCancel'); if (c) c.style.display = first ? 'none' : '';
  paintAddLevels();
  show('add');
  if (n) setTimeout(()=>{ try{ n.focus(); }catch(e){} }, 120);
}
function paintAddLevels(){
  const host = $('#addLevels');
  if (!host) return;
  host.innerHTML = LEVEL_ORDER.map(k=>{
    const L = LEVELS_KID[k];
    return `<button class="world${ADD.level===k?' pickon':''}" data-lv="${k}">
      <span class="em">${L.emoji}</span>
      <span class="nm">${L.label}<span class="taunt">${L.note}</span></span>
      <span class="lock">${ADD.level===k?'✓':''}</span>
    </button>`;
  }).join('');
  $$('#addLevels [data-lv]').forEach(b=>b.onclick=()=>{ ADD.level=b.dataset.lv; paintAddLevels(); });
}

/* ---------- what each level is shown ---------- */
function paintLevelGates(){
  const lv = playerLevel();
  const set = (sel, on)=>{ const e=$(sel); if (e) e.style.display = on ? '' : 'none'; };
  set('#begBtn',   lv==='new');
  set('#playBtn',  lv!=='new');          // openings need the pieces first
  set('#tacHardBtn', lv==='club');
  set('#hardHint',   lv==='club');
  const tb = $('#tacBtn');
  if (tb) tb.textContent = lv==='new' ? '⚡ Find the winning move' : '⚡ Find the move';
  const ab = $('#arenaBtn');
  if (ab) ab.textContent = lv==='new'
    ? '\u{1F3C1} Beat the little champions'
    : '\u{1F3C1} Endgames — beat the champions';
}

/* ============ HOW THE PIECES MOVE ============
   A piece alone on the board and some stars to land on. No opponent, no clock,
   nothing to read. Every target below was checked by breadth-first search:
   the gold number is the true shortest solution, not a guess. */

const DIRS = { r:[[1,0],[-1,0],[0,1],[0,-1]], b:[[1,1],[1,-1],[-1,1],[-1,-1]],
               q:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] };
const KSTEP = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const NSTEP = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];

/* where a lone piece can go on an empty board */
function freeMoves(from, kind){
  const f = FL.indexOf(from[0]), r = +from[1]-1, out = [];
  const push = (ff,rr)=>{ if (ff>=0&&ff<8&&rr>=0&&rr<8) out.push(FL[ff]+(rr+1)); };
  if (kind==='k'){ for (const [df,dr] of KSTEP) push(f+df, r+dr); }
  else if (kind==='n'){ for (const [df,dr] of NSTEP) push(f+df, r+dr); }
  else if (kind==='p'){ push(f, r+1); if (r===1) push(f, r+2); }
  else {
    for (const [df,dr] of DIRS[kind]){
      let ff=f+df, rr=r+dr;
      while (ff>=0&&ff<8&&rr>=0&&rr<8){ out.push(FL[ff]+(rr+1)); ff+=df; rr+=dr; }
    }
  }
  return out;
}

/* the true shortest way to land on every star, in any order */
function starOptimal(start, kind, stars){
  const n = stars.length, goal = (1<<n)-1;
  let frontier = [[start, 0]], seen = new Set([start+'#0']), d = 0;
  while (frontier.length && d <= 24){
    const next = [];
    for (const [sq, mask] of frontier){
      if (mask === goal) return d;
      for (const to of freeMoves(sq, kind)){
        let m = mask;
        const i = stars.indexOf(to);
        if (i >= 0) m |= (1<<i);
        const k = to+'#'+m;
        if (seen.has(k)) continue;
        seen.add(k); next.push([to, m]);
      }
    }
    frontier = next; d++;
  }
  return null;
}

const BEG_WORLDS = [
{ id:'w1', name:'The rook', emoji:'\u{1F3F0}', beg:true,
  intro:"Straight lines, as far as you like.",
  tasks:[
    { kind:'stars', piece:'R', from:'a1', stars:['a4','d4'], gold:2, silver:4,
      say:"The rook goes straight. Land on both stars." },
    { kind:'stars', piece:'R', from:'h1', stars:['h5','c5','c8'], gold:3, silver:5,
      say:"Three stars now. Straight lines only — never diagonally." },
    { kind:'grab', fen:'7k/3n4/8/8/8/8/8/3RK3 w - - 0 1', target:'d7',
      say:"Take the horse. Land right on top of it." }
  ]},
{ id:'w2', name:'The bishop', emoji:'⛪', beg:true,
  intro:"Diagonals only — it never changes colour.",
  tasks:[
    { kind:'stars', piece:'B', from:'c1', stars:['f4','h6'], gold:2, silver:4,
      say:"The bishop goes cornerwise. Both stars are on its colour." },
    { kind:'stars', piece:'B', from:'a1', stars:['d4','g1','a7'], gold:3, silver:5,
      say:"Three corners. Notice it can never reach a light square." },
    { kind:'grab', fen:'7k/8/8/8/5p2/8/8/2B1K3 w - - 0 1', target:'f4',
      say:"Take the pawn — diagonally, of course." }
  ]},
{ id:'w3', name:'The queen', emoji:'\u{1F451}', beg:true,
  intro:"Straight AND diagonal. The strongest piece.",
  tasks:[
    { kind:'stars', piece:'Q', from:'d1', stars:['d5','h5','h1'], gold:3, silver:5,
      say:"The queen does both. Three stars, three moves." },
    { kind:'stars', piece:'Q', from:'a8', stars:['h8','h1','a1'], gold:3, silver:5,
      say:"All the way round the edge." },
    { kind:'grab', fen:'7k/8/8/7b/8/8/8/3QK3 w - - 0 1', target:'h5',
      say:"The bishop is a long way off. The queen can still reach it." }
  ]},
{ id:'w4', name:'The king', emoji:'\u{1F934}', beg:true,
  intro:"One step at a time — but he must never be caught.",
  tasks:[
    { kind:'stars', piece:'K', from:'e1', stars:['e3','c3'], gold:4, silver:6,
      say:"One square at a time, any direction." },
    { kind:'grab', fen:'7k/8/8/8/8/8/4p3/4K3 w - - 0 1', target:'e2',
      say:"Even the king can capture. Take the pawn." },
    { kind:'escape', fen:'4r2k/8/8/8/8/8/8/4K3 w - - 0 1',
      say:"That rook is attacking your king. Step out of the way!" }
  ]},
{ id:'w5', name:'The knight', emoji:'\u{1F40E}', beg:true,
  intro:"Two squares, then one — round a corner.",
  tasks:[
    { kind:'stars', piece:'N', from:'g1', stars:['f3','e5','d3'], gold:3, silver:5,
      say:"The knight hops in an L. Follow the green dots." },
    { kind:'stars', piece:'N', from:'b1', stars:['c3','b5'], gold:2, silver:4,
      say:"Two hops. It can jump over anything in the way." },
    { kind:'grab', fen:'7k/8/8/8/8/8/4p3/6NK w - - 0 1', target:'e2',
      say:"Hop onto the pawn." }
  ]},
{ id:'w6', name:'The pawn', emoji:'♟︎', beg:true,
  intro:"Forwards only — but it takes sideways.",
  tasks:[
    { kind:'stars', piece:'P', from:'e2', stars:['e4','e5'], gold:2, silver:4,
      say:"A pawn may go two squares on its very first move." },
    { kind:'grab', fen:'7k/8/8/3p4/4P3/8/8/4K3 w - - 0 1', target:'d5',
      say:"Pawns walk forwards but capture diagonally. Take it." },
    { kind:'promote', fen:'7k/8/8/8/8/8/P7/4K3 w - - 0 1', gold:5, silver:7,
      say:"Walk this pawn all the way up. It becomes a queen!" }
  ]},
{ id:'w7', name:'First checkmates', emoji:'⚔️', beg:true,
  intro:"Attack the king. Then trap him.",
  tasks:[
    { kind:'check', fen:'4k3/8/8/8/8/8/8/3QK3 w - - 0 1',
      say:"Attacking the king is called check. Give him one." },
    { kind:'safe', fen:'7k/8/4n3/8/3R4/8/8/4K3 w - - 0 1', piece:'d4',
      say:"The knight is attacking your rook. Move it somewhere safe." },
    { kind:'mate', fen:'6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1',
      say:"His own pawns block him in. Checkmate in one move!" },
    { kind:'mate', fen:'6k1/8/6K1/8/8/8/8/Q7 w - - 0 1',
      say:"Your king guards the escape squares. Bring the queen in." }
  ]}
];
for (const w of BEG_WORLDS) WORLDS.push(w);

const BEG_CHARS = ['c1','c3','c5','e1','c4'];

/* ---------- the star board ---------- */
function loadStars(){
  const t = L.task;
  L.spos = t.from;
  L.skind = t.piece.toLowerCase();
  L.sleft = t.stars.slice();
  L.cells = buildBoard($('#board'), tapStars, false);
  drawStars();
}
function drawStars(){
  clearMarks(L.cells);
  for (const k in L.cells) setPiece(L.cells[k], null);
  setPiece(L.cells[L.spos], L.task.piece);
  L.cells[L.spos].classList.add('pick');
  for (const s of L.sleft) L.cells[s].classList.add('star');
  for (const m of freeMoves(L.spos, L.skind)) L.cells[m].classList.add('hint');
}
function tapStars(alg){
  if (L.done) return;
  if (alg === L.spos) return;
  const can = freeMoves(L.spos, L.skind);
  if (!can.includes(alg)){
    L.tries++;
    L.cells[alg].classList.add('bad');
    setTimeout(()=>drawStars(), 420);
    bubble('\u{1F914}', L.tries>2 ? 'Only the green dots. Tap one of those.' : pick(NUDGE), 'oops');
    return;
  }
  L.spos = alg;
  L.moves++;
  const i = L.sleft.indexOf(alg);
  if (i >= 0) L.sleft.splice(i, 1);
  drawStars();
  if (!L.sleft.length) return finishByMoves(L.task, 'All of them!');
  bubble('\u{1F434}', L.sleft.length===1 ? 'One star left.' : L.sleft.length+' stars left.');
}

/* ---------- the beginner map ---------- */
function paintBegMap(){
  const host = $('#begList');
  if (!host) return;
  const ws = WORLDS.filter(w=>w.beg);
  host.innerHTML = ws.map(w=>{
    const got = worldStars(w.id), max = w.tasks.length*3;
    return `<button class="world" data-bw="${w.id}">
      <span class="em">${w.emoji}</span>
      <span class="nm">${w.name}
        <span class="taunt">${w.intro}</span>
        <span class="pips">${w.tasks.map((_,i)=>`<i class="${SAVE.stars[taskKey(w.id,i)]?'on':''}"></i>`).join('')}</span>
      </span>
      <span class="lock">${got===max?'⭐':''}</span>
    </button>`;
  }).join('');
  $$('#begList [data-bw]').forEach(b=>b.onclick=()=>{ L.mode='beg'; openWorld(b.dataset.bw); });
  const c = $('#begCount');
  if (c){
    const done = ws.filter(w=>worldStars(w.id)===w.tasks.length*3).length;
    c.textContent = done + '/' + ws.length;
  }
}
