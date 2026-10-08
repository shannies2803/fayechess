/* Looking at a game again — tapping it out with no typing, and the review
   finding the moment it went wrong. */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
const ok=(l,c,d)=>{ if(c) pass++; else {fail++; console.log('FAIL: '+l+(d!==undefined?' -> '+JSON.stringify(d):''));} };
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Not implemented/.test(e.message)) console.log('JSDOM ERR:',e.message); });
function boot(store){
  let html=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
  if (store){
    const seed='<script>'+Object.keys(store).map(k=>
      'localStorage.setItem('+JSON.stringify(k)+','+JSON.stringify(store[k])+');').join('')+'<\/script>';
    html=html.replace('</head>', seed+'</head>');
  }
  return new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
}
const ev=(d,s)=>d.window.eval(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* tap a move out the way a child does: piece, then square */
const tap=(d,from,to)=>ev(d,`(()=>{ LK.sel=null; lookTap(${JSON.stringify(from)}); lookTap(${JSON.stringify(to)}); })()`);

(async ()=>{
/* ---------- nothing asks her to type ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ok('the button is offered to a player who plays matches',
     ev(d,"document.getElementById('lookBtn').style.display")!=='none');
  ev(d,"addPlayer('B','new'); repaintForPlayer();");
  ok('and not to a complete beginner',
     ev(d,"document.getElementById('lookBtn').style.display")==='none');
  ev(d,"switchTo(players().find(p=>p.name==='F').id); document.getElementById('lookBtn').click();");
  ok('it opens', ev(d,"document.getElementById('s-look').classList.contains('on')"));
  ok('there is nothing to type on the screen',
     ev(d,"document.querySelectorAll('#s-look input, #s-look textarea').length")===0);
  ok('it says there are no games yet',
     /No games yet/.test(ev(d,"document.getElementById('lookList').textContent")));
  ok('and offers to tap one out', !!ev(d,"document.getElementById('lookEnterBtn')"));
}

/* ---------- tapping out a game she played at school ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('lookBtn').click();");
  ev(d,"document.getElementById('lookEnterBtn').click()");
  ok('the entry board appears', ev(d,"document.getElementById('lookBoardWrap').style.display")!=='none');
  ok('with a full set of pieces', ev(d,"document.querySelectorAll('#lookBoard .pc').length")===32);
  ok('and she can say which colour she was',
     ev(d,"document.getElementById('lookSideRow').style.display")!=='none');

  /* the scholar's mate she lost to, tapped out move by move */
  const moves=[['e2','e4'],['e7','e5'],['f1','c4'],['b8','c6'],['d1','h5'],['g8','f6'],['h5','f7']];
  for (const [f,t] of moves) tap(d,f,t);
  ok('every tap was accepted', ev(d,'LK.moves.length')===7, ev(d,'JSON.stringify(LK.moves)'));
  ok('the app wrote the notation for her',
     ev(d,"JSON.stringify(LK.moves)")==='["e4","e5","Bc4","Nc6","Qh5","Nf6","Qxf7#"]',
     ev(d,"JSON.stringify(LK.moves)"));
  ok('and showed it on screen',
     ev(d,"document.querySelectorAll('#lookMoves .mv').length")===7);
  ok('it noticed the game is over',
     /Checkmate/.test(ev(d,"document.getElementById('lookSay').textContent")));

  /* a wrong tap is simply refused, and take back works */
  const before=ev(d,'LK.moves.length');
  tap(d,'a1','a5');
  ok('an impossible move is ignored', ev(d,'LK.moves.length')===before);
  ev(d,"document.getElementById('lookTakeBack').click()");
  ok('take back removes the last move', ev(d,'LK.moves.length')===before-1);
  tap(d,'h5','f7');
  ok('and she can put it back', ev(d,'LK.moves.length')===before);

  /* she was Black in this one */
  ev(d,"document.getElementById('lookSideB').click()");
  ok('choosing Black is remembered', ev(d,'LK.side')==='b');
  ev(d,"document.getElementById('lookDone').click()");
  ok('the review opens', ev(d,'LK.mode')==='review');
  ok('the game was kept', ev(d,'savedGames().length')===1);
  ok('with her colour', ev(d,'savedGames()[0].side')==='b');
  ok('the board is turned round for Black',
     ev(d,"document.getElementById('lookBoard').classList.contains('flip')"));

  /* the review found the losing moment */
  ok('it found something to look at', ev(d,'LK.notes.length')>=1, ev(d,'JSON.stringify(LK.notes)'));
  ok('and it is one of her own moves',
     ev(d,'LK.notes.every(n=>n.ply % 2 === 1)'), ev(d,'JSON.stringify(LK.notes.map(n=>n.ply))'));
  ok('the moment is listed in words',
     ev(d,"document.querySelectorAll('#lookNotes [data-note]').length")>=1);
  ok('it does not offer to take back a move from a finished game',
     !/Take it back/.test(ev(d,"document.getElementById('lookNotes').textContent")),
     ev(d,"document.getElementById('lookNotes').textContent").slice(0,140));
  ok('the words come from the coach she already knows',
     /checkmate|take|guard/i.test(ev(d,"document.getElementById('lookNotes').textContent")),
     ev(d,"document.getElementById('lookNotes').textContent").slice(0,120));

  /* tapping a moment jumps to that position */
  const firstPly=ev(d,'LK.notes[0].ply');
  ev(d,`document.querySelector('#lookNotes [data-note="${firstPly}"]').click()`);
  ok('tapping a moment moves the board there', ev(d,'LK.ply')===firstPly+1);
  ok('and the bubble explains it',
     ev(d,"document.getElementById('lookSay').textContent")===ev(d,'LK.notes[0].text'));
  ok('the move is marked in the notation',
     ev(d,"document.querySelectorAll('#lookMoves .mv.flag').length")>=1);

  /* stepping */
  ev(d,"document.getElementById('lookPrev').click()");
  ok('back a move', ev(d,'LK.ply')===firstPly);
  ev(d,"document.getElementById('lookNext').click()");
  ok('forward a move', ev(d,'LK.ply')===firstPly+1);
  ev(d,"lookGoto(0)");
  ok('back to the start', ev(d,'LK.ply')===0);
  ok('and the board really is the starting position',
     ev(d,"LK.game.fen().split(' ')[0]")==='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
  ev(d,"document.getElementById('lookWorst').click()");
  ok('"take me to it" jumps to the first problem', ev(d,'LK.ply')===firstPly+1);
  ev(d,"lookGoto(999)");
  ok('it cannot run off the end', ev(d,'LK.ply')===ev(d,'LK.all.length'));
}

/* ---------- a game with nothing wrong says so ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ev(d,"lookReview(['e4','e5','Nf3','Nc6','Bb5','a6'], 'w', 'own')");
  ok('a clean opening flags nothing', ev(d,'LK.notes.length')===0, ev(d,'JSON.stringify(LK.notes)'));
  ok('and it says so kindly',
     /Nothing went badly wrong/.test(ev(d,"document.getElementById('lookNotes').textContent")));
  ok('the arrows still work', ev(d,"(()=>{lookGoto(3); return LK.ply;})()")===3);
}

/* ---------- games played in the app are kept without her doing anything ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ok('no games yet', ev(d,'savedGames().length')===0);
  ev(d,`(()=>{ document.getElementById('freeBtn').click();
     for (const san of ['f3','e5','g4','Qh4']) FP.game.move(san);
     fpDraw(); fpOver(); })()`);
  ok('a finished game against the computer is kept', ev(d,'savedGames().length')===1);
  ok('with the result', ev(d,'savedGames()[0].res')==='lost');
  ok('and where it came from', ev(d,'savedGames()[0].from')==='play');
  ok('the moves were kept', ev(d,'savedGames()[0].m.length')===4);

  ev(d,`(()=>{ document.getElementById('ppBtn').click();
     for (const san of ['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7']) PP.game.move(san);
     ppDraw(); ppOver(); })()`);
  ok('a two-player game is kept too', ev(d,'savedGames().length')===2);
  ok('marked as two players', ev(d,'savedGames()[1].from')==='pass');

  ev(d,"document.getElementById('lookBtn').click()");
  ok('both are listed', ev(d,"document.querySelectorAll('#lookList [data-game]').length")===2);
  ok('newest first',
     /Two players/.test(ev(d,"document.querySelectorAll('#lookList [data-game]')[0].textContent")));
  ev(d,"document.querySelectorAll('#lookList [data-game]')[0].click()");
  ok('opening one reviews it', ev(d,'LK.mode')==='review' && ev(d,'LK.all.length')===7);

  /* a few taps are not a game */
  ev(d,"saveGame(['e4','e5'], 'w', '', 'own')");
  ok('two moves are not saved as a game', ev(d,'savedGames().length')===2);

  /* the list is capped */
  ev(d,"(()=>{ for (let i=0;i<20;i++) saveGame(['e4','e5','Nf3','Nc6'],'w','','play'); })()");
  ok('the list is kept to a dozen', ev(d,'savedGames().length')<=12, ev(d,'savedGames().length'));
}

/* ---------- underpromotion can be tapped out too ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer(); document.getElementById('lookBtn').click();");
  ev(d,"document.getElementById('lookEnterBtn').click()");
  ev(d,"(()=>{ LK.game=new Chess('8/P7/8/8/8/8/8/K6k w - - 0 1'); LK.moves=[]; lookDraw(); })()");
  tap(d,'a7','a8');
  ok('reaching the last row asks what the pawn became',
     ev(d,"document.getElementById('lookPromo').style.display")!=='none');
  ok('nothing was recorded yet', ev(d,'LK.moves.length')===0);
  ev(d,"document.querySelector('#lookPromo [data-kpromo=\"r\"]').click()");
  ok('choosing a rook records a rook', ev(d,"JSON.stringify(LK.moves)")==='["a8=R"]',
     ev(d,"JSON.stringify(LK.moves)"));
  ok('and the chooser goes away',
     ev(d,"document.getElementById('lookPromo').style.display")==='none');
}

/* ---------- it survives a reload, and belongs to one player ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); saveGame(['e4','e5','Nf3','Nc6'],'w','won','own'); save();");
  const saved=d.window.localStorage.getItem('knightschool:players');
  ok('the game is written to storage', saved.indexOf('"games"')>=0);
  const d2=boot({'knightschool:players':saved}); await wait(900);
  ok('and comes back', ev(d2,'savedGames().length')===1);
  ev(d2,"addPlayer('Other','club')");
  ok('another child does not see it', ev(d2,'savedGames().length')===0);
}

/* ---------- what should I have played, and a second chance ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  // she was Black and walked into the four-move mate
  ev(d,"lookReview(['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7'], 'b', 'own')");
  ok('the losing moment was found', ev(d,'LK.notes.length')>=1);
  const ply=ev(d,'LK.notes[0].ply');

  ev(d,"lookGoto(0)");
  ok('the two buttons are hidden away from a mistake',
     ev(d,"document.getElementById('lookFixRow').style.display")==='none');
  ev(d,`lookGoto(${ply}+1)`);
  ok('and shown on the moment itself',
     ev(d,"document.getElementById('lookFixRow').style.display")!=='none');

  ev(d,"document.getElementById('lookBetter').click()");
  ok('it steps back to the position she actually faced', ev(d,'LK.ply')===ply);
  await wait(900);
  const said=ev(d,"document.getElementById('lookSay').textContent");
  ok('it tells her what she played', /You played/.test(said) || /find something better/.test(said), said);
  ok('and it is not still "thinking"', !/Thinking about/.test(said), said);
  ok('something is marked on the board for her to look at',
     ev(d,"document.querySelectorAll('#lookBoard .sq.pick, #lookBoard .sq.hint, #lookBoard .sq.danger').length")>0);
  ok('and the previous move is not still marked in the same colour, which would confuse it',
     ev(d,"document.querySelectorAll('#lookBoard .sq.last').length")===0,
     ev(d,"document.querySelectorAll('#lookBoard .sq.last').length"));
  ok('at most one piece is marked to move',
     ev(d,"document.querySelectorAll('#lookBoard .sq.pick').length")<=1);
  ok('the suggestion is named, not just pointed at',
     /[A-Za-z][1-8]|O-O/.test(ev(d,"document.getElementById('lookSay').textContent")));

  /* the second chance */
  ev(d,`lookGoto(${ply}+1); document.getElementById('lookReplay').click();`);
  await wait(900);
  ok('playing it again opens a game',
     ev(d,"document.getElementById('s-free').classList.contains('on')"));
  ok('from the position before the mistake, not the start',
     ev(d,'FP.game.history.length')<=1 && ev(d,"FP.game.fen()")!==ev(d,"new Chess().fen()"));
  ok('with her on the same side she was', ev(d,'FP.me')==='b');
  ok('and the board turned round for her',
     ev(d,"document.getElementById('freeBoard').classList.contains('flip')"));
  ok('it says this is a second go',
     /second chance|different way/.test(ev(d,"document.getElementById('freeSay').textContent")),
     ev(d,"document.getElementById('freeSay').textContent"));
  ok('the colour button matches',
     ev(d,"document.getElementById('fpSwap').textContent").indexOf('White')>=0);
  ok('the clock starts again from the top',
     ev(d,'CL.flagged')===null);
  ok('and she can actually move', ev(d,`(()=>{
     const before=FP.game.history.length;
     const mv=FP.game.moves().find(m=>true);
     if (!mv) return false;
     FP.sel=null; fpTap(sqToAlg(mv.from)); fpTap(sqToAlg(mv.to));
     return FP.game.history.length > before;})()`));
}

/* ---------- a position where she was simply fine ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('F','club'); repaintForPlayer();");
  ev(d,"lookReview(['e4','e5','Nf3','Nc6','Bb5','a6'], 'w', 'own')");
  ok('nothing is flagged', ev(d,'LK.notes.length')===0);
  ev(d,"lookGoto(2)");
  ok('so the second-chance buttons stay away',
     ev(d,"document.getElementById('lookFixRow').style.display")==='none');
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
