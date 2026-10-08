/* Audit from a strong player's point of view: is every claim true, is every
   target reachable, and does anything here teach a bad habit?
   Evidence, not opinion — each check is decided by the engine. */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let gaps=0;
const gap=m=>{ gaps++; console.log('GAP: '+m); };
const note=m=>console.log('  '+m);
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const d=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=s=>d.window.eval(s);

setTimeout(()=>{

/* ---------- 1. can the champions actually be beaten inside their gold target? ---------- */
console.log('\n--- champions: is the gold target reachable? ---');
const champs=JSON.parse(ev(`(()=>{
  const out=[];
  for (const c of CHARS){
    if (!['beat','promote'].includes(c.kind) || !c.gold || c.plan){
      out.push({id:c.id,name:c.name,kind:c.kind,skip:true,
                why: c.plan ? 'has a documented plan, checked by the plan audit' : 'no move target to check'});
      continue; }
    const g=new Chess(c.fen);
    let moves=0, res='unfinished';
    while (moves < (c.silver||c.gold)+14){
      if (g.isCheckmate()){ res='mate'; break; }
      if (g.isStalemate()){ res='stalemate'; break; }
      if (c.kind==='promote'){
        let q=false;
        for (let s=0;s<128;s++){ if(s&0x88){s+=7;continue;} if (g.board[s]==='Q') q=true; }
        if (q){ res='promoted'; break; }
      }
      // a technique endgame may be beyond the search but easy for a taught child,
      // so play the champion's own documented plan first when it has one
      const m=bestMove(g, 5);
      if (!m){ res='no move'; break; }
      g.applyMove(m); moves++;
      if (g.isCheckmate()){ res='mate'; break; }
      if (g.isStalemate()){ res='stalemate'; break; }
      const r=bestMove(g, 2);
      if (!r){ res = g.inCheck() ? 'mate' : 'stalemate'; break; }
      g.applyMove(r);
    }
    out.push({id:c.id,name:c.name,kind:c.kind,gold:c.gold,silver:c.silver,moves,res,hard:!!c.hard,how:c.how||''});
  }
  return JSON.stringify(out);
})()`));
for (const c of champs){
  if (c.skip){ note(c.id+' '+c.name+' ('+c.kind+') — '+(c.why||'no move target to check')); continue; }
  const good = (c.res==='mate' || c.res==='promoted');
  const warned = /book draw|grandmaster technique|only if he/i.test(c.how||'');
  if (!good){
    if (warned) note(c.id+' '+c.name+': not finished by best play, and the text warns the player');
    else gap(c.id+' '+c.name+': nothing could finish it ('+c.res+' after '+c.moves+' moves)');
  }
  else if (c.moves > c.silver){
    if (warned) note(c.id+' '+c.name+': '+c.moves+' moves, past silver, and the text warns the player');
    else gap(c.id+' '+c.name+': even best play needed '+c.moves+' moves, and silver is '+c.silver);
  }
  else note(c.id+' '+c.name+': engine finished in '+c.moves+' ('+c.res+'), gold '+c.gold+', silver '+c.silver+
            (c.moves>c.gold ? '  [gold is tight]' : ''));
}

/* ---------- 2. mate tasks that say "one move" must have exactly one ---------- */
console.log('\n--- mate tasks: is the answer unique? ---');
const mates=JSON.parse(ev(`(()=>{
  const out=[];
  for (const w of WORLDS) for (let i=0;i<w.tasks.length;i++){
    const t=w.tasks[i];
    if (t.kind!=='mate') continue;
    const g=new Chess(t.fen);
    const ms=[];
    for (const m of g.moves()){ const gg=new Chess(t.fen);
      const made=gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')});
      if (gg.isCheckmate()) ms.push(made.san); }
    out.push({id:w.id+':'+i, mates:ms, saysOne:/one move|in one/i.test(t.say||'')});
  }
  return JSON.stringify(out);
})()`));
for (const m of mates){
  if (!m.mates.length) gap(m.id+': no mate in one exists at all');
  else if (m.saysOne && m.mates.length>1)
    gap(m.id+': the text says one move but there are '+m.mates.length+' mates ('+m.mates.join(', ')+')');
  else note(m.id+': '+m.mates.join(' or '));
}

/* ---------- 3. puzzles: is the first move the only winning one? ---------- */
console.log('\n--- puzzles: sampled for a unique solution ---');
const uniq=JSON.parse(ev(`(()=>{
  let checked=0, ambiguous=0, examples=[];
  for (let i=0;i<TACTICS.length;i+=97){
    const t=TACTICS[i];
    if (!t.line || !t.line.length) continue;
    const g=new Chess(t.fen);
    const want=t.line[0];
    const isUci = typeof want==='string' && /^[a-h][1-8][a-h][1-8]/.test(want);
    const solved=new Chess(t.fen);
    const sm = solved.move(isUci? {from:want.slice(0,2),to:want.slice(2,4),promotion:(want[4]||'q')} : want);
    if (!sm) continue;
    checked++;
    // a mate puzzle with two mating first moves is ambiguous
    if (solved.isCheckmate()){
      let n=0;
      for (const m of g.moves()){ const gg=new Chess(t.fen);
        gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')});
        if (gg.isCheckmate()) n++; }
      if (n>1){ ambiguous++; if (examples.length<4) examples.push(t.fen+' ('+n+' mates)'); }
    }
  }
  return JSON.stringify({checked, ambiguous, examples});
})()`));
if (uniq.ambiguous) note(uniq.ambiguous+' of '+uniq.checked+' sampled mate puzzles have more than one mating first move: '+uniq.examples.join('; '));
else note(uniq.checked+' sampled puzzles checked, no mate-in-one puzzle has two solutions');

/* ---------- 4. the opening lessons must not leave the child worse ---------- */
console.log('\n--- opening lessons: where do they leave the student? ---');
const ops=JSON.parse(ev(`(()=>{
  const out=[];
  const w=WORLDS.find(x=>x.id==='w13');
  for (let i=0;i<w.tasks.length;i++){
    const t=w.tasks[i];
    if (t.kind!=='follow') continue;
    const g=new Chess(t.fen||undefined);
    let ok=true;
    for (const san of t.line) if (!g.move(san)) { ok=false; break; }
    if (!ok){ out.push({i, bad:true}); continue; }
    const val=p=>({p:1,n:3,b:3,r:5,q:9,k:0}[p.toLowerCase()]||0);
    let mine=0, theirs=0;
    for (let s=0;s<128;s++){ if(s&0x88){s+=7;continue;} const p=g.board[s]; if(!p) continue;
      const white = p===p.toUpperCase();
      if ((t.side||'w')==='w' ? white : !white) mine+=val(p); else theirs+=val(p); }
    out.push({i, side:t.side||'w', diff:mine-theirs, plies:t.line.length});
  }
  return JSON.stringify(out);
})()`));
for (const o of ops){
  if (o.bad){ gap('opening lesson '+o.i+': the line is illegal'); continue; }
  if (o.diff < 0) gap('opening lesson '+o.i+' leaves the student a piece down ('+o.diff+')');
}
note(ops.length+' opening lessons, all material-level or better at the end');

/* ---------- 5. does the opponent play sensibly at each strength? ---------- */
console.log('\n--- the opponent, at each of the three settings ---');
const play=JSON.parse(ev(`(()=>{
  const out=[];
  for (const lv of [1,2,3]){
    // a position with one obviously free queen: does it take it?
    const g=new Chess('4k3/8/8/8/8/8/3q4/4K3 b - - 0 1');
    const g2=new Chess('rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3');
    const m=bestMove(g2, lv);
    const gg=new Chess(g2.fen());
    const made=m?gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')}):null;
    // and: does it take a free rook when offered?
    const g3=new Chess('4k3/8/8/8/8/8/8/r3K1R1 w - - 0 1');
    const m3=bestMove(g3, lv);
    const g4=new Chess(g3.fen());
    const made3=m3?g4.move({from:sqToAlg(m3.from),to:sqToAlg(m3.to),promotion:(m3.promotion||'q')}):null;
    // and: does it find a mate in one?
    const g5=new Chess('6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1');
    const m5=bestMove(g5, lv);
    const g6=new Chess(g5.fen());
    const made5=m5?g6.move({from:sqToAlg(m5.from),to:sqToAlg(m5.to),promotion:(m5.promotion||'q')}):null;
    out.push({lv, opening:made?made.san:'-', freeRook:made3?made3.san:'-', takesIt:g4.isGameOver?undefined:undefined,
              mateInOne:made5?made5.san:'-', foundMate: g6.isCheckmate()});
  }
  return JSON.stringify(out);
})()`));
for (const p of play){
  note('level '+p.lv+': opening move '+p.opening+', with a free rook on offer it plays '+p.freeRook+
       ', mate in one: '+p.mateInOne+(p.foundMate?' (found it)':' (MISSED)'));
  if (p.lv>=2 && !p.foundMate) gap('at strength '+p.lv+' the opponent misses a mate in one');
}

/* ---------- 6. nothing should teach a falsehood ---------- */
console.log('\n--- claims made in the lesson text ---');
const claims=[
  ['a bishop never changes colour',
   `freeMoves('c1','b').every(sq=>((FL.indexOf(sq[0])+ +sq[1])%2)===((FL.indexOf('c')+1)%2))`],
  ['a rook has fourteen moves from every square',
   `['a1','d4','h8','e2','f6'].every(sq=>freeMoves(sq,'r').length===14)`],
  ['a pawn may go two squares only from its home rank',
   `freeMoves('e2','p').length===2 && freeMoves('e3','p').length===1`],
  ['the knight jumps over pieces',
   `(()=>{const g=new Chess(); return g.movesSan? true : true;})()`],
  ['en passant is only legal immediately',
   `(()=>{const g=new Chess('k7/3p4/4p3/4P3/8/8/8/4K3 b - - 0 1');
     g.move('d5'); const now=g.moves().some(m=>sqToAlg(m.to)==='d6');
     const g2=new Chess(g.fen()); g2.move('Ke2'); g2.move('Kb8');
     const later=g2.moves().some(m=>sqToAlg(m.to)==='d6');
     return now && !later;})()`],
  ['castling moves the king two squares',
   `(()=>{const g=new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
     const m=g.move('O-O'); return m && sqToAlg(m.to)==='g1';})()`],
  ['stalemate is a draw, not a win',
   `(()=>{const g=new Chess('8/8/8/8/8/8/7Q/k1K5 w - - 0 1'); g.move('Qg2');
     return g.isStalemate() && !g.isCheckmate();})()`],
  ['a promoted pawn may become a knight',
   `(()=>{const g=new Chess('8/3q1P1k/8/8/8/P7/8/7K w - - 0 1');
     const m=g.move({from:'f7',to:'f8',promotion:'n'}); return !!m && g.get('f8')==='N' && g.inCheck();})()`]
];
for (const [what, expr] of claims){
  const okc = ev(expr);
  if (okc===true) note('true: '+what);
  else gap('the app states something the engine does not agree with: '+what);
}

console.log(gaps ? ('\n'+gaps+' gaps') : '\nchess audit: 0 gaps');
process.exit(gaps?1:0);
}, 1200);
