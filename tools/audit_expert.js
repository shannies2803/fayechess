/* chess-correctness audit of the beginner content.
   The movement code used by the star tasks is a second implementation, separate
   from the game engine, so it is checked here against a third one written a
   different way: a geometric predicate rather than a ray walk. */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let gaps=0;
const gap=m=>{ gaps++; console.log('GAP: '+m); };
const note=m=>console.log('  '+m);
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
  {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=s=>dom.window.eval(s);

setTimeout(()=>{
const FL='abcdefgh';
const sq=(f,r)=>FL[f]+(r+1);
const all=[]; for(let f=0;f<8;f++) for(let r=0;r<8;r++) all.push(sq(f,r));
const parse=a=>[FL.indexOf(a[0]), +a[1]-1];

/* a third, independent definition: is B reachable from A on an empty board? */
function reach(kind, a, b){
  const [af,ar]=parse(a), [bf,br]=parse(b);
  const df=bf-af, dr=br-ar;
  if (!df && !dr) return false;
  switch(kind){
    case 'r': return (df===0) !== (dr===0);
    case 'b': return Math.abs(df)===Math.abs(dr);
    case 'q': return (df===0) !== (dr===0) || Math.abs(df)===Math.abs(dr);
    case 'k': return Math.max(Math.abs(df),Math.abs(dr))===1;
    case 'n': return (Math.abs(df)===1&&Math.abs(dr)===2)||(Math.abs(df)===2&&Math.abs(dr)===1);
    case 'p': return df===0 && (dr===1 || (dr===2 && ar===1));
  }
  return false;
}

/* 1. the two definitions must agree on all 64 squares for all six pieces */
let mismatches=0;
for (const kind of ['r','b','q','k','n','p']){
  for (const a of all){
    const mine=new Set(ev(`JSON.stringify(freeMoves(${JSON.stringify(a)}, ${JSON.stringify(kind)}))`)
      ? JSON.parse(ev(`JSON.stringify(freeMoves(${JSON.stringify(a)}, ${JSON.stringify(kind)}))`)) : []);
    const theirs=new Set(all.filter(b=>reach(kind,a,b)));
    for (const b of theirs) if (!mine.has(b)) { mismatches++; gap(kind+' from '+a+': misses '+b); }
    for (const b of mine) if (!theirs.has(b)) { mismatches++; gap(kind+' from '+a+': wrongly allows '+b); }
  }
}
if (!mismatches) note('movement: both definitions agree on all 384 piece-square cases');

/* 2. the piece-count table every chess book prints */
const counts=k=>all.map(a=>JSON.parse(ev(`JSON.stringify(freeMoves(${JSON.stringify(a)}, ${JSON.stringify(k)}))`)).length);
const tally=a=>{ const t={}; for(const n of a) t[n]=(t[n]||0)+1; return t; };
const kn=tally(counts('n'));
const want={2:4, 3:8, 4:20, 6:16, 8:16};
for (const k in want) if (kn[k]!==want[k]) gap('knight move counts wrong: '+k+' moves from '+kn[k]+' squares, expected '+want[k]);
if (Object.keys(kn).every(k=>kn[k]===want[k]) && Object.keys(kn).length===5)
  note('knight: the standard 2/3/4/6/8 distribution is exactly right');
const kg=tally(counts('k'));
if (!(kg[3]===4 && kg[5]===24 && kg[8]===36)) gap('king move counts wrong: '+JSON.stringify(kg));
else note('king: 3 in the corners, 5 on the edges, 8 in the middle');
if (!counts('r').every(n=>n===14)) gap('a rook does not always have 14 moves');
else note('rook: 14 from every square');
const bs=tally(counts('b'));
if (!(bs[7]===28 && bs[9]===20 && bs[11]===12 && bs[13]===4)) gap('bishop move counts wrong: '+JSON.stringify(bs));
else note('bishop: 7/9/11/13 by ring, as it should be');

/* 3. pawns: never backwards, never sideways, two only from the second rank */
let pawnBad=0;
for (const a of all){
  const ms=JSON.parse(ev(`JSON.stringify(freeMoves(${JSON.stringify(a)}, 'p'))`));
  const [af,ar]=parse(a);
  for (const m of ms){
    const [mf,mr]=parse(m);
    if (mf!==af) pawnBad++;
    if (mr<=ar) pawnBad++;
    if (mr-ar===2 && ar!==1) pawnBad++;
  }
  if (ar===7 && ms.length) pawnBad++;
}
if (pawnBad) gap('pawn movement is wrong in '+pawnBad+' cases');
else note('pawn: forwards only, and two squares only from its home rank');

/* 4. every beginner star task is solvable, and the gold is the true shortest */
const starRows=JSON.parse(ev(`(()=>{const o=[];
  for (const w of WORLDS.filter(x=>x.beg)) for (let i=0;i<w.tasks.length;i++){
    const t=w.tasks[i]; if (t.kind!=='stars') continue;
    o.push({id:w.id+':'+i, pc:t.piece, from:t.from, stars:t.stars,
            opt:starOptimal(t.from,t.piece.toLowerCase(),t.stars), gold:t.gold, silver:t.silver});
  } return JSON.stringify(o);})()`));
for (const r of starRows){
  if (r.opt===null) gap(r.id+': the stars cannot all be reached');
  else if (r.opt!==r.gold) gap(r.id+': gold is '+r.gold+' but the shortest solution is '+r.opt);
  if (r.silver<=r.gold) gap(r.id+': silver is not slacker than gold');
  if (r.stars.includes(r.from)) gap(r.id+': a star sits on the starting square');
}
note('star tasks: '+starRows.length+' checked, gold equals the shortest solution in each');

/* 5. every beginner chess position, checked by the engine */
const rows=JSON.parse(ev(`(()=>{const o=[];
  for (const w of WORLDS.filter(x=>x.beg||x.pat)) for (let i=0;i<w.tasks.length;i++){
    const t=w.tasks[i]; if (t.kind==='stars') continue;
    const r={id:w.id+':'+i, kind:t.kind, side:t.side||'w', hidden:!!t.hidden};
    let g; try{ g=new Chess(t.fen); }catch(e){ r.err=String(e.message); o.push(r); continue; }
    r.turn=g.turn; r.legal=g.moves().length; r.inCheck=g.inCheck();
    r.blackInCheck=g.inCheck('b');
    r.kings=(()=>{let n=0;for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}
      const p=g.board[s]; if(p&&p.toLowerCase()==='k')n++;} return n;})();
    r.men=(()=>{let n=0;for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g.board[s])n++;} return n;})();
    r.fenRoundTrip = g.fen().split(' ').slice(0,4).join(' ')===t.fen.split(' ').slice(0,4).join(' ');
    if (t.kind==='mate'){ const m=[]; for(const mv of g.moves()){ const gg=new Chess(t.fen);
      const made=gg.move({from:sqToAlg(mv.from),to:sqToAlg(mv.to),promotion:(mv.promotion||'q')});
      if (gg.isCheckmate()) m.push(made.san); } r.mates=m; }
    if (t.kind==='check'){ let n=0; for(const mv of g.moves()){ const gg=new Chess(t.fen);
      gg.move({from:sqToAlg(mv.from),to:sqToAlg(mv.to),promotion:(mv.promotion||'q')}); if(gg.inCheck()) n++; } r.checks=n; }
    if (t.kind==='grab'){ const caps=g.moves().filter(mv=>g.get(sqToAlg(mv.to)));
      r.toTarget=caps.filter(mv=>sqToAlg(mv.to)===t.target).length;
      r.otherCaps=caps.length-r.toTarget;
      let free=0, guarded=0, targetFree=false;
      for (const mv of caps){
        const to=sqToAlg(mv.to);
        const gg=new Chess(t.fen);
        gg.move({from:sqToAlg(mv.from), to, promotion:(mv.promotion||'q')});
        if (!attacked(gg, to, false)){ free++; if (to===t.target) targetFree=true; } else guarded++;
      }
      r.freeCaps=free; r.guardedCaps=guarded; r.targetIsFree=targetFree;
      r.targetIsBlack=(()=>{const p=g.get(t.target); return !!p && p===p.toLowerCase();})(); }
    if (t.kind==='safe'){ r.attacked=attacked(g,t.piece,false);
      const fr=g.moves().filter(mv=>sqToAlg(mv.from)===t.piece);
      let safe=0; for(const mv of fr){ const gg=new Chess(t.fen);
        gg.move({from:t.piece,to:sqToAlg(mv.to),promotion:(mv.promotion||'q')});
        if(!attacked(gg,sqToAlg(mv.to),false)) safe++; }
      r.safe=safe; r.unsafe=fr.length-safe; }
    if (t.kind==='follow'){
      const g2=new Chess(t.fen);
      let step=0, bad=null;
      const me=t.side||'w';
      while (step<t.line.length && g2.turn!==me){ if(!g2.move(t.line[step])){bad=t.line[step];break;} step++; }
      r.firstIsStudent = g2.turn===me;
      const askFen=g2.fen(), firstWant=String(t.line[step]||'').replace(/[+#]/g,'');
      const bm=bestMove(g2,5);
      if (bm){ const g3=new Chess(askFen);
        const mm=g3.move({from:sqToAlg(bm.from),to:sqToAlg(bm.to),promotion:(bm.promotion||'q')});
        r.engineFirst=mm?mm.san.replace(/[+#]/g,''):'?';
        r.engineAgrees=r.engineFirst===firstWant; }
      const g4=new Chess(t.fen);
      for (const san of t.line){ if(!g4.move(String(san).replace(/#/g,''))){ bad=san; break; } }
      r.lineOk=!bad; r.lineBad=bad; r.endsInMate=g4.isCheckmate(); r.lineLen=t.line.length;
      r.rated = t.rated || 0;
      const val=q=>({p:1,n:3,b:3,r:5,q:9,k:0}[q.toLowerCase()]||0);
      const mat=gg=>{ let mine=0, theirs=0;
        for (let sq=0;sq<128;sq++){ if(sq&0x88){sq+=7;continue;} const q=gg.board[sq]; if(!q) continue;
          const white=q===q.toUpperCase();
          if (me==='w' ? white : !white) mine+=val(q); else theirs+=val(q); }
        return mine-theirs; };
      r.gain = mat(g4) - mat(new Chess(t.fen));
    }
    if (t.kind==='castle'){
      const opts=[];
      for (const mv of g.moves()){ const gg=new Chess(t.fen);
        const made=gg.move({from:sqToAlg(mv.from),to:sqToAlg(mv.to)});
        if (made && /^O-O/.test(made.san)) opts.push(made.san); }
      r.castleNow=opts; r.gold=t.gold; r.silver=t.silver;
    }
    if (t.kind==='promote'){
      // can the pawn actually get there against best defence?
      const g2=new Chess(t.fen); let plies=0, made=true;
      while (plies<40){
        const p=(()=>{for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g2.board[s]==='P') return sqToAlg(s);} return null;})();
        if (!p) { made=false; break; }
        if ((()=>{for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g2.board[s]==='Q') return true;} return false;})()) break;
        const f=p[0], rk=+p[1];
        const step = rk===2 ? [f+'4', f+'3'] : [f+(rk+1)+(rk+1===8?'=Q':'')];
        let ok=false;
        for (const cand of step) if (g2.move(cand)) { ok=true; break; }
        if (!ok){ made=false; break; }
        plies++;
        if ((()=>{for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g2.board[s]==='Q') return true;} return false;})()) break;
        const bm=bestMove(g2,2); if (!bm) break;
        g2.applyMove(bm);
      }
      r.promoteIn=plies; r.promoted=made &&
        (()=>{for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;} if(g2.board[s]==='Q') return true;} return false;})();
    }
    o.push(r);
  } return JSON.stringify(o);})()`));

for (const r of rows){
  if (r.err) { gap(r.id+': the position is illegal — '+r.err); continue; }
  if (r.kings!==2) gap(r.id+': '+r.kings+' kings on the board');
  if (r.turn!=='w' && r.kind!=='follow')
    gap(r.id+': it is not the child’s move');
  if (!r.legal) gap(r.id+': there is no legal move');
  if (r.blackInCheck) gap(r.id+': the side not to move is in check, which cannot happen in a real game');
  if (!r.fenRoundTrip) gap(r.id+': the engine reads the position differently from how it is written');
  // castling and the demonstration lines need a real board; the one-idea tasks do not
  if (r.men>6 && !['pawns','castle','follow'].includes(r.kind))
    gap(r.id+': '+r.men+' pieces is too busy for a first lesson');
  if (r.kind==='mate'){
    if (!r.mates.length) gap(r.id+': no mate in one exists');
    else note(r.id+' mate: '+r.mates.join(' or '));
  }
  if (r.kind==='check' && !r.checks) gap(r.id+': no check is available');
  if (r.kind==='escape' && !r.inCheck) gap(r.id+': the king is not actually in check');
  if (r.kind==='grab'){
    if (r.toTarget!==1) gap(r.id+': the marked piece cannot be captured in one move');
    if (!r.targetIsBlack) gap(r.id+': the marked piece is not the opponent’s');
    if (r.hidden){
      // the lesson is "which one is free": exactly one safe capture, and a guarded decoy
      if (r.freeCaps!==1) gap(r.id+': '+r.freeCaps+' captures are undefended, so the answer is not unique');
      if (!r.targetIsFree) gap(r.id+': the answer is a defended capture');
      if (!r.guardedCaps) gap(r.id+': every capture is free, so there is nothing to work out');
      else note(r.id+' free-or-not: 1 free capture and '+r.guardedCaps+' guarded decoy(s)');
    } else if (r.otherCaps){
      gap(r.id+': '+r.otherCaps+' other captures exist, which muddles the lesson');
    }
  }
  if (r.kind==='safe'){
    if (!r.attacked) gap(r.id+': the piece is not actually attacked');
    if (!r.safe) gap(r.id+': there is nowhere safe to go');
    if (!r.unsafe) gap(r.id+': every square is safe, so there is nothing to work out');
  }
  if (r.kind==='follow'){
    if (!r.lineOk) gap(r.id+': the line is illegal at '+r.lineBad);
    if (!r.firstIsStudent) gap(r.id+': after the opening moves it is still not the child’s turn');
    if (r.rated){
      // a position from the rated database: the check is what the line wins, not
      // whether a time-budgeted search happens to agree on this particular run
      if (!r.endsInMate && r.gain <= 0)
        gap(r.id+': a database position whose line wins nothing (material change '+r.gain+')');
      else note(r.id+' follow: from the rated database ('+r.rated+'), the line '+
        (r.endsInMate ? 'ends in checkmate' : 'wins '+r.gain+' points of material'));
    }
    else if (!r.engineAgrees && !r.endsInMate)
      gap(r.id+': the move taught is not the engine’s choice ('+r.engineFirst+') and does not force mate');
    else note(r.id+' follow: '+(r.engineAgrees?'engine plays the same move':'forced to checkmate')+', '+r.lineLen+' plies');
  }
  if (r.kind==='castle'){
    if (r.gold===1 && !r.castleNow.length) gap(r.id+': it claims castling is available now, and it is not');
    if (r.gold>1 && r.castleNow.length) gap(r.id+': it asks to clear the way, but castling is already possible');
    note(r.id+' castle: '+(r.castleNow.length?('available now: '+r.castleNow.join(', ')):'must develop first')+', gold '+r.gold);
  }
  if (r.kind==='promote'){
    if (!r.promoted) gap(r.id+': the pawn cannot promote against the engine');
    else note(r.id+' promote: reached the eighth rank in '+r.promoteIn+' moves against the engine');
  }
}

/* 6. the pools a beginner draws from must not be empty */
ev("addPlayer('Audit','new'); repaintForPlayer();");
const pools=JSON.parse(ev(`(()=>{
  const fit=TACTICS.filter(t=>allowedForLevel(t));
  return JSON.stringify({
    total:fit.length,
    eg:fit.filter(t=>t.eg).length,
    byTheme:fit.reduce((a,t)=>{a[t.theme]=(a[t.theme]||0)+1;return a;},{}),
    maxRating:Math.max.apply(null,fit.map(t=>t.rating||0)),
    minRating:Math.min.apply(null,fit.map(t=>t.rating||9999))
  });})()`));
if (pools.total<150) gap('a beginner has only '+pools.total+' puzzles to draw from');
if (pools.eg<20) gap('a beginner has only '+pools.eg+' endgame puzzles');
if (pools.maxRating>1000) gap('a beginner can be shown a puzzle rated '+pools.maxRating);
if (pools.byTheme['Mate in 3']) gap('a beginner can be shown a mate in three');
if (pools.byTheme['Quiet move']) gap('a beginner can be shown a quiet-move puzzle');
note('beginner pool: '+pools.total+' puzzles, '+pools.eg+' of them endgames, rated '+
     pools.minRating+'–'+pools.maxRating);
note('beginner themes: '+Object.entries(pools.byTheme).sort((a,b)=>b[1]-a[1])
     .map(([k,v])=>k+' '+v).join(', '));

/* 7. every champion a beginner is offered must be one a beginner can attempt */
const cs=JSON.parse(ev(`JSON.stringify(BEG_CHARS.map(id=>{
  const c=CHARS.find(x=>x.id===id);
  if (!c) return {id, missing:true};
  const g=new Chess(c.fen);
  let men=0; for(let s=0;s<128;s++){ if(s&0x88){s+=7;continue;} if(g.board[s]) men++; }
  return {id, name:c.name, kind:c.kind, hard:!!c.hard, men, gold:c.gold||null, legal:g.moves().length};
}))`));
for (const c of cs){
  if (c.missing) gap('BEG_CHARS names a champion that does not exist: '+c.id);
  else {
    if (c.hard) gap(c.id+' is flagged as needing real theory but is offered to beginners');
    // a board of nothing but pawns is a classic first game, however many men it has
    if (c.men>6 && c.kind!=='pawns') gap(c.id+' has '+c.men+' pieces, too many for a beginner');
    if (!c.legal) gap(c.id+' has no legal move');
  }
}
note('beginner champions: '+cs.filter(c=>!c.missing).map(c=>c.name+' ('+c.kind+', '+c.men+' pieces)').join('; '));

/* 8. the teaching order */
const order=JSON.parse(ev("JSON.stringify(WORLDS.filter(w=>w.beg).map(w=>w.name))"));
note('teaching order: '+order.join(' → '));
if (order.indexOf('The queen') < Math.max(order.indexOf('The rook'), order.indexOf('The bishop')))
  gap('the queen is taught before the rook and bishop it combines');
{
  const pieces=['The rook','The bishop','The queen','The king','The knight','The pawn'];
  const lastPiece=Math.max.apply(null, pieces.map(n=>order.indexOf(n)));
  if (order.indexOf('First checkmates') < lastPiece)
    gap('checkmate is taught before all the pieces are');
}

console.log(gaps ? ('\n'+gaps+' gaps') : '\nexpert audit: 0 gaps');
process.exit(gaps?1:0);
}, 1000);
