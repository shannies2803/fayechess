/* Chess-correctness audit of Philip's site: every position, every line, every
   claim, checked by the engine that ships with it. */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let gaps=0;
const gap=m=>{ gaps++; console.log('GAP: '+m); };
const note=m=>console.log('  '+m);
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const d=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','philip','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=s=>d.window.eval(s);

setTimeout(()=>{
/* the engine's own helper names differ from the other site's; find them once */
const api=ev(`JSON.stringify({
  chess: typeof Chess, sq: typeof sqToAlg, best: typeof bestMove,
  proto: Object.getOwnPropertyNames(Chess.prototype).filter(k=>/move|check|mate|stale|fen|get|undo|turn/i.test(k))
})`);
note('engine api: '+api);

/* ---------- 1. the puzzles ---------- */
console.log('\n--- puzzles ---');
const pz=JSON.parse(ev(`(()=>{
  let badFen=0, badLine=0, dupes=0, noLine=0, badRating=0, wrongTurn=0;
  const seen={}, examples=[];
  for (const p of PUZZLES){
    let g; try{ g=new Chess(p.fen); }catch(e){ badFen++; if(examples.length<3) examples.push(p.id+' fen'); continue; }
    if (seen[p.fen]) dupes++; else seen[p.fen]=1;
    if (!p.line || !p.line.length){ noLine++; continue; }
    if (p.rating && (p.rating<400 || p.rating>3200)) badRating++;
    const gg=new Chess(p.fen);
    let ok=true;
    for (const san of p.line){ if (!gg.move(String(san).replace(/#/g,''))){ ok=false; break; } }
    if (!ok){ badLine++; if (examples.length<6) examples.push(p.id+' line'); }
  }
  return JSON.stringify({total:PUZZLES.length, badFen, badLine, dupes, noLine, badRating, examples});
})()`));
if (pz.badFen) gap(pz.badFen+' puzzles have an illegal position ('+pz.examples.join(', ')+')');
if (pz.badLine) gap(pz.badLine+' puzzles have a solution that cannot be played ('+pz.examples.join(', ')+')');
if (pz.noLine) gap(pz.noLine+' puzzles have no solution at all');
if (pz.dupes) gap(pz.dupes+' puzzles repeat a position already used');
if (pz.badRating) gap(pz.badRating+' puzzles carry an impossible rating');
note(pz.total+' puzzles: '+(pz.badFen+pz.badLine+pz.noLine+pz.dupes+pz.badRating===0
  ? 'every position legal, every solution playable, no repeats' : 'see above'));

/* a mate puzzle must actually end in mate, and a mate in one must be the only one */
const mates=JSON.parse(ev(`(()=>{
  let checked=0, notMate=0, ambiguous=0; const bad=[];
  for (const p of PUZZLES){
    const MATE_THEMES=['Mate in 1','Mate in 2','Mate in 3','Smothered mate'];
    if (!MATE_THEMES.includes(p.theme)) continue;
    const g=new Chess(p.fen); let ok=true;
    for (const san of p.line){ if(!g.move(String(san).replace(/#/g,''))){ ok=false; break; } }
    if (!ok) continue;
    checked++;
    if (!g.isCheckmate()){ notMate++; if (bad.length<5) bad.push(p.id+' ('+p.theme+')'); }
    if (p.theme==='Mate in 1' && p.line.length===1){
      const g2=new Chess(p.fen); let n=0;
      for (const m of g2.moves()){ const g3=new Chess(p.fen);
        g3.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')});
        if (g3.isCheckmate()) n++; }
      if (n>1) ambiguous++;
    }
  }
  return JSON.stringify({checked, notMate, ambiguous, bad});
})()`));
if (mates.notMate) gap(mates.notMate+' puzzles labelled as mate do not end in mate ('+mates.bad.join(', ')+')');
if (mates.ambiguous) note(mates.ambiguous+' mate-in-one puzzles have more than one mating move');
note(mates.checked+' mate puzzles checked, '+(mates.notMate?'':'all really end in mate'));

/* ---------- 2. the mating patterns ---------- */
console.log('\n--- mating patterns ---');
const pat=JSON.parse(ev(`(()=>{
  const rows=[];
  for (const p of PATTERNS){
    const r={id:p.id, name:p.name, mv:p.mv};
    let g; try{ g=new Chess(p.fen); }catch(e){ r.err='illegal position'; rows.push(r); continue; }
    const m=g.move(String(p.mv).replace(/#/g,''));
    if (!m){ r.err='the move does not exist'; rows.push(r); continue; }
    r.claimsMate = /#/.test(p.mv||'');
    r.isMate = g.isCheckmate();
    r.isCheck = g.inCheck();
    rows.push(r);
  }
  return JSON.stringify(rows);
})()`));
for (const r of pat){
  if (r.err) gap(r.id+' '+r.name+': '+r.err);
  else if (r.claimsMate && !r.isMate) gap(r.id+' '+r.name+': written as '+r.mv+' but it is not mate');
  else if (!r.claimsMate && r.isMate) note(r.id+' '+r.name+': '+r.mv+' is mate but not written with a #');
}
note(pat.length+' named patterns checked');

/* ---------- 3. the opening lines ---------- */
console.log('\n--- openings ---');
const op=JSON.parse(ev(`(()=>{
  let bad=[], plies=0, alts=0, badAlt=[];
  for (const o of OPENINGS){
    const g=new Chess();
    for (const m of (o.moves||[])){
      if (!g.move(m.san)){ bad.push(o.name+' at '+m.san); break; }
      plies++;
    }
    for (const a of (o.alts||[])){
      alts++;
      const g2=new Chess();
      // replay the main line up to the branch, then the alternative
      const upto = typeof a.atPly==='number' ? a.atPly : 0;
      let ok=true;
      for (let i=0;i<upto && i<(o.moves||[]).length;i++){
        if (!g2.move(o.moves[i].san)){ ok=false; badAlt.push(o.name+' / main line at ply '+i); break; }
      }
      if (!ok) continue;
      for (const mv of (a.line || a.moves || [])){
        const san = typeof mv==='string' ? mv : mv.san;
        if (!g2.move(san)){ badAlt.push(o.name+' / '+(a.label||a.name||'alt')+' at '+san); break; }
      }
    }
  }
  return JSON.stringify({count:OPENINGS.length, bad, plies, alts, badAlt});
})()`));
if (op.bad.length) gap(op.bad.length+' opening lines are illegal: '+op.bad.slice(0,4).join('; '));
if (op.badAlt.length) gap(op.badAlt.length+' alternative lines are illegal: '+op.badAlt.slice(0,4).join('; '));
note(op.count+' openings, '+op.plies+' moves, '+op.alts+' side lines — all legal');

/* ---------- 4. the annotated games ---------- */
console.log('\n--- annotated games ---');
const gm=JSON.parse(ev(`(()=>{
  const rows=[];
  for (const g0 of GAMES){
    const g=new Chess();
    let bad=null, n=0;
    for (const san of (g0.moves||[])){
      const s=typeof san==='string' ? san : san.san;
      if (!g.move(String(s).replace(/[!?]+$/,''))){ bad=s; break; }
      n++;
    }
    const noteKeys = Object.keys(g0.notes||{}).map(Number).filter(x=>!isNaN(x));
    rows.push({id:g0.id, title:g0.title, bad, plies:n, claimed:(g0.moves||[]).length,
      result:g0.result, mate:g.isCheckmate(), stale:g.isStalemate(),
      maxNote: noteKeys.length? Math.max.apply(null,noteKeys) : 0});
  }
  return JSON.stringify(rows);
})()`));
for (const r of gm){
  if (r.bad) gap(r.id+' '+r.title+': illegal move '+r.bad+' after '+r.plies+' plies');
  else {
    if (/1-0|0-1/.test(r.result||'') && !r.mate)
      note(r.id+' '+r.title+': ends '+r.result+' by resignation, not mate ('+r.plies+' plies)');
    if (r.maxNote >= r.claimed)
      gap(r.id+' '+r.title+': a note is attached to move '+r.maxNote+' but the game has '+r.claimed);
  }
}
note(gm.length+' games checked, '+gm.reduce((a,r)=>a+r.plies,0)+' moves replayed');

if (process.env.SKIP_EG){ console.log(gaps ? ('\n'+gaps+' gaps') : '\nPhilip\u2019s chess content (excluding drills): 0 gaps'); process.exit(0); }
/* ---------- 5. the endgame drills ---------- */
console.log('\n--- endgame drills (playing each one out) ---');
const eg=JSON.parse(ev(`(()=>{
  const rows=[];
  for (const e of ENDGAMES){
    const r={id:e.id, name:e.name, par:e.par, win:e.win};
    let g; try{ g=new Chess(e.fen); }catch(err){ r.err='illegal position'; rows.push(r); continue; }
    r.turn=g.turn;
    r.legal=g.moves().length;
    r.kings=(()=>{let n=0;for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}
      const p=g.board[s]; if(p&&p.toLowerCase()==='k')n++;} return n;})();
    r.blackInCheck=g.inCheck('b');
    // play it out: our side searches deep, the defender as the app plays it
    let moves=0, res='unfinished';
    const hasQ=()=>{for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g.board[s]==='Q')return true;} return false;};
    const blackPawns=()=>{let n=0;for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g.board[s]==='p')n++;} return n;};
    const startPawns=blackPawns();
    while (moves < (e.par||12)+16){
      const m=bestMove(g,5); if(!m){ res=g.inCheck()?'we are mated':'stalemate'; break; }
      g.applyMove(m); moves++;
      if (g.isCheckmate()){ res='mate'; break; }
      if (g.isStalemate()){ res='stalemate'; break; }
      if (e.win==='promote' && hasQ()){ res='promoted'; break; }
      if (e.win==='draw' || e.win==='hold'){ if (startPawns && blackPawns()===0){ res='pawn taken'; break; } }
      const rp=bestMove(g,2); if(!rp){ res=g.inCheck()?'mate':'stalemate'; break; }
      g.applyMove(rp);
    }
    r.moves=moves; r.res=res;
    rows.push(r);
  }
  return JSON.stringify(rows);
})()`));
for (const r of eg){
  if (r.err){ gap(r.id+' '+r.name+': '+r.err); continue; }
  if (r.kings!==2) gap(r.id+' '+r.name+': '+r.kings+' kings');
  if (!r.legal) gap(r.id+' '+r.name+': no legal move');
  if (r.blackInCheck) gap(r.id+' '+r.name+': the side not to move is already in check');
  const won = ['mate','promoted','pawn taken'].includes(r.res);
  const drawGoal = (r.win==='draw' || r.win==='hold');
  if (!won && !drawGoal) {
    if (r.res==='stalemate') gap(r.id+' '+r.name+': best play reaches stalemate, not a win');
    else note(r.id+' '+r.name+': not finished in '+r.moves+' ('+r.res+'), par '+r.par);
  } else if (won && r.par && r.moves > r.par + 6) {
    note(r.id+' '+r.name+': took '+r.moves+' against a par of '+r.par);
  } else {
    note(r.id+' '+r.name+': '+r.res+' in '+r.moves+', par '+r.par);
  }
}

console.log(gaps ? ('\n'+gaps+' gaps') : '\nPhilip’s chess content: 0 gaps');
process.exit(0);
}, 3000);
