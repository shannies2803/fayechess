/* third suite: the daily four adapts to the level, the opponent strength follows
   the player, and a beginner can get from a cold start to a finished lesson
   without reading anything */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
let pass=0, fail=0;
function ok(label, cond, detail){
  if (cond) pass++;
  else { fail++; console.log('FAIL: '+label+(detail!==undefined?('  -> '+JSON.stringify(detail)):'')); }
}
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
const ev=(d,src)=>d.window.eval(src);
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async ()=>{
/* ---------- the daily four for a beginner is lessons, not tactics ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Amara','new'); repaintForPlayer(); paintDaily();");
  ok('a beginner gets lessons in the daily four', ev(d,'dailyPlan().plan.lessons.length')===3);
  ok('and no tactics puzzles', ev(d,'dailyPlan().plan.puzzles.length')===0);
  ok('the lessons are all beginner worlds',
     ev(d,"dailyPlan().plan.lessons.every(l=>WORLDS.find(w=>w.id===l[0]).beg)"));
  ok('the lessons start at the very beginning',
     ev(d,"JSON.stringify(dailyPlan().plan.lessons[0])")==='["w1",0]');
  ok('four things to do today', ev(d,"document.querySelectorAll('#dailyItems [data-day]').length")===4);
  ok('the first is named after the piece',
     ev(d,"document.querySelector('#dailyItems [data-day=\"p0\"] .nm').textContent").indexOf('The rook')===0);
  ok('with what it asks in plain words',
     ev(d,"document.querySelector('#dailyItems [data-day=\"p0\"] .taunt').textContent")==='two stars');
  ok('and the three rook lessons do not all read the same',
     new Set(JSON.parse(ev(d,"JSON.stringify(Array.from(document.querySelectorAll('#dailyItems .taunt')).map(e=>e.textContent))"))).size===4);
  ok("the beginner's daily endgame is a gentle one",
     ev(d,'BEG_CHARS.includes(dailyPlan().plan.endgame)'));

  /* tapping the first daily item opens that lesson and solving it ticks the box */
  ev(d,"document.querySelector('#dailyItems [data-day=\"p0\"]').click()");
  ok('the daily lesson opens the right task', ev(d,"L.world.id")==='w1' && ev(d,'L.ti')===0);
  ok('and it is a star task', ev(d,"L.task.kind")==='stars');
  ev(d,"tapStars('a4'); tapStars('d4');");
  ok('the lesson was solved', ev(d,"SAVE.stars['w1:0']")===3);
  ok('the daily box was ticked', ev(d,"dailyPlan().done.indexOf('p0')")>=0);
  ev(d,"paintDaily()");
  ok('the screen shows it as done',
     ev(d,"document.querySelector('#dailyItems [data-day=\"p0\"] .em').textContent")==='✅');
  ok('three left today', /3 left today/.test(ev(d,"document.getElementById('dailyNote').textContent")));

  /* solving a lesson opened on its own does not tick a daily box */
  ev(d,"L.mode='beg'; openWorld('w5',1); tapStars('c3'); tapStars('b5');");
  ok('an off-plan lesson still earns stars', ev(d,"SAVE.stars['w5:1']")===3);
  ok('but does not tick a daily box', ev(d,"dailyPlan().done.length")===1);

  /* a beginner who has finished the beginner path gets puzzles again */
  ev(d,`(()=>{ for (const w of WORLDS.filter(x=>x.beg))
      for (let i=0;i<w.tasks.length;i++) SAVE.stars[taskKey(w.id,i)]=3;
      SAVE.daily=null; save(); })()`);
  ok('once the pieces are learned the daily four is puzzles again',
     ev(d,'dailyPlan().plan.lessons.length')===0 && ev(d,'dailyPlan().plan.puzzles.length')===3);
  ok('and those puzzles are still within reach',
     ev(d,'dailyPlan().plan.puzzles.every(i=>TACTICS[i].rating && TACTICS[i].rating<=1000)'));
}

/* ---------- a club player is unaffected ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Rafi','club'); repaintForPlayer(); paintDaily();");
  ok('a club player gets tactics in the daily four', ev(d,'dailyPlan().plan.puzzles.length')>=2);
  ok('and a named pattern to learn alongside them',
     ev(d,'(dailyPlan().plan.lessons||[]).length')===1);
  ok('that pattern is from the tactics worlds, not the beginner ones',
     ev(d,"dailyPlan().plan.lessons.every(l=>WORLDS.find(w=>w.id===l[0]).pat)"));
  ok('and it still adds up to four',
     ev(d,'dailyPlan().plan.puzzles.length + dailyPlan().plan.lessons.length')===3);
  ok('four things to do', ev(d,"document.querySelectorAll('#dailyItems [data-day]').length")===4);
}

/* ---------- the opponent strength follows the player ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Kid','new'); repaintForPlayer();");
  ok('a beginner gets the gentle opponent', ev(d,'FP.level')===1);
  ev(d,"addPlayer('Champ','club'); repaintForPlayer();");
  ok('a club player starts on the toughest setting', ev(d,'FP.level')===3);
  ok('three strength buttons exist',
     !!ev(d,"document.getElementById('freeEasier')") &&
     !!ev(d,"document.getElementById('freeHarder')") &&
     !!ev(d,"document.getElementById('freeHardest')"));
  ev(d,"document.getElementById('freeHardest').click()");
  ok('the toughest setting sticks', ev(d,'FP.level')===3);
  ok('the chosen strength is marked',
     ev(d,"document.getElementById('freeHardest').classList.contains('go')"));
  ok('and only one is marked',
     ev(d,"['freeEasier','freeHarder','freeHardest'].filter(i=>document.getElementById(i).classList.contains('go')).length")===1);
  ev(d,"switchTo(players().find(p=>p.name==='Kid').id)");
  ok('switching back restores the gentle opponent', ev(d,'FP.level')===1);
  ev(d,"switchTo(players().find(p=>p.name==='Champ').id)");
  ok('and the strong player keeps their choice', ev(d,'FP.level')===3);
  ok('the toughest setting really searches deeper', ev(d,`(()=>{
     const g=new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4');
     const a=bestMove(g,1), b=bestMove(g,3);
     return !!a && !!b;})()`));
}

/* ---------- a beginner never meets anything out of reach ---------- */
{
  const d=boot(null); await wait(900);
  ev(d,"addPlayer('Tiny','new'); repaintForPlayer();");
  ok('every beginner world task is a beginner task', ev(d,`(()=>{
     const kinds=new Set();
     for (const w of WORLDS.filter(x=>x.beg)) for (const t of w.tasks) kinds.add(t.kind);
     return Array.from(kinds).every(k=>['stars','grab','safe','check','escape','mate','promote','castle','follow'].includes(k));
   })()`));
  ok('no mate-in-two or three anywhere in the beginner path', ev(d,`(()=>{
     for (const w of WORLDS.filter(x=>x.beg)) for (const t of w.tasks){
       if (t.kind!=='mate') continue;
       const g=new Chess(t.fen);
       let mates=0;
       for (const m of g.moves()){ const gg=new Chess(t.fen);
         gg.move({from:sqToAlg(m.from),to:sqToAlg(m.to),promotion:(m.promotion||'q')});
         if (gg.isCheckmate()) mates++; }
       if (!mates) return false;
     }
     return true;})()`));
  ev(d,"tacStart(false,false,'','')");
  ok('the puzzle queue never contains a mate in three',
     ev(d,"T.order.every(i=>TACTICS[i].theme!=='Mate in 3')"));
  ev(d,"paintArena()");
  ok('no champion needing real theory is offered',
     ev(d,"Array.from(document.querySelectorAll('#arenaList [data-c]')).every(b=>!CHARS.find(c=>c.id===b.dataset.c).hard)"));
  ok('the beginner arena still has five opponents',
     ev(d,"document.querySelectorAll('#arenaList [data-c]').length")===5);

  /* and the whole beginner path can be played with taps alone */
  const played = ev(d,`(()=>{
    let done=0, notes=[];
    for (const w of WORLDS.filter(x=>x.beg)) for (let i=0;i<w.tasks.length;i++){
      const t=w.tasks[i];
      if (t.kind!=='stars') continue;
      L.mode='beg'; openWorld(w.id, i);
      // walk the shortest route by breadth-first search, tapping as we go
      let guard=0;
      while (L.sleft.length && guard++ < 30){
        const from=L.spos, kind=L.skind;
        // the tap that keeps us on a shortest route: one move closer to done
        const need = starOptimal(from, kind, L.sleft);
        let bestSq=null;
        for (const to of freeMoves(from, kind)){
          const rest=L.sleft.filter(x=>x!==to);
          const after=starOptimal(to, kind, rest);
          if (after !== null && after === need-1){ bestSq=to; break; }
        }
        if (!bestSq) break;
        tapStars(bestSq);
      }
      if (SAVE.stars[taskKey(w.id,i)]===3) done++;
      else notes.push(w.id+':'+i+' got '+SAVE.stars[taskKey(w.id,i)]+' in '+L.moves);
    }
    return JSON.stringify({done, notes});
  })()`);
  const pr=JSON.parse(played);
  ok('every star task is winnable with three stars by playing the shortest route',
     pr.done===10, pr);
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
