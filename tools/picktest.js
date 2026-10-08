/* picking up the device after a while, and the beginner's easiest-first order */
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

(async ()=>{
/* build a device with three children on it */
const d=boot(null); await wait(900);
ev(d,"addPlayer('Amara','new'); addPlayer('Rafi','club'); addPlayer('Mei','some');");
const saved=d.window.localStorage.getItem('knightschool:players');

/* used a moment ago: go straight in */
{
  const d2=boot({'knightschool:players':saved}); await wait(900);
  ok('picked up straight away, it does not interrupt',
     ev(d2,"document.getElementById('s-home').classList.contains('on')"));
  ok('and keeps the same player', ev(d2,'activePlayer().name')==='Mei');
}

/* put down for four hours: ask who it is */
{
  const old=JSON.parse(saved); old.lastUsed=Date.now()-4*60*60*1000;
  const d2=boot({'knightschool:players':JSON.stringify(old)}); await wait(900);
  ok('after a long gap it asks who is playing',
     ev(d2,"document.getElementById('s-pick').classList.contains('on')"));
  ok('every child is offered',
     ev(d2,"document.querySelectorAll('#pickList [data-pick]').length")===3);
  ok('each with their level and stars',
     ev(d2,"document.querySelectorAll('#pickList .taunt').length")===3);
  ok('and a way to add someone new', !!ev(d2,"document.getElementById('pickAdd')"));
  ev(d2,"document.querySelector('#pickList [data-pick=\"p1\"]').click()");
  ok('choosing one switches to them', ev(d2,'activePlayer().name')==='Amara');
  ok('and goes to the home screen',
     ev(d2,"document.getElementById('s-home').classList.contains('on')"));
  ok('with their level applied', ev(d2,'playerLevel()')==='new');
}

/* one child alone is never interrupted */
{
  const one={ v:1, active:'p1', lastUsed:Date.now()-99*60*60*1000,
              players:[{id:'p1',name:'Solo',level:'some',face:'🦄',data:{stars:{},badges:[]}}] };
  const d2=boot({'knightschool:players':JSON.stringify(one)}); await wait(900);
  ok('a device with one child never asks',
     ev(d2,"document.getElementById('s-home').classList.contains('on')"));
}

/* the beginner's puzzles come easiest first */
{
  const d2=boot(null); await wait(900);
  ev(d2,"addPlayer('Tiny','new'); repaintForPlayer(); tacStart(false,false,'','');");
  const order=JSON.parse(ev(d2,"JSON.stringify(T.order.slice(0,25).map(i=>TACTICS[i].rating))"));
  const sorted=order.slice().sort((a,b)=>a-b);
  ok('a beginner meets the easiest puzzles first',
     JSON.stringify(order)===JSON.stringify(sorted), order.slice(0,8));
  ok('and the very first is at the bottom of the range', order[0]<=700, order[0]);

  ev(d2,"addPlayer('Champ','club'); repaintForPlayer(); tacStart(false,false,'','');");
  const co=JSON.parse(ev(d2,"JSON.stringify(T.order.slice(0,30).map(i=>TACTICS[i].rating||0))"));
  ok('a strong player still gets a mixed order',
     JSON.stringify(co)!==JSON.stringify(co.slice().sort((a,b)=>a-b)));
}

/* the star board reads itself out */
{
  const d2=boot(null); await wait(900);
  ev(d2,"addPlayer('Tiny','new'); L.mode='beg'; openWorld('w1',0);");
  ok('the piece square says what is on it',
     /your rook/.test(ev(d2,"L.cells['a1'].getAttribute('aria-label')")),
     ev(d2,"L.cells['a1'].getAttribute('aria-label')"));
  ok('a star square says star',
     /star/.test(ev(d2,"L.cells['a4'].getAttribute('aria-label')")));
  ok('a reachable square says so',
     /you can go here/.test(ev(d2,"L.cells['a4'].getAttribute('aria-label')")));
  ok('an unreachable empty square says empty',
     ev(d2,"L.cells['b2'].getAttribute('aria-label')")==='b2, empty');
  ev(d2,"tapStars('a4')");
  ok('the labels follow the piece',
     /your rook/.test(ev(d2,"L.cells['a4'].getAttribute('aria-label')")));
  ok('a collected star stops being called a star',
     !/star/.test(ev(d2,"L.cells['a4'].getAttribute('aria-label')")));
}

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
})();
