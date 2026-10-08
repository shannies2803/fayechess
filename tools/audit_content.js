/* content audit: what is taught, at what level, and what is missing between them */
const fs=require('fs'); const {JSDOM,VirtualConsole}=require('jsdom');
const vc=new VirtualConsole(); vc.on('jsdomError',e=>{if(!/scrollTo|Not implemented/.test(e.message))console.log('ERR',e.message);});
const d=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
const ev=s=>d.window.eval(s);
setTimeout(()=>{
console.log('=== WORLDS ===');
console.log(ev(`WORLDS.map(w=>(w.beg?'[beg] ':'      ')+w.id+'  '+w.name+'  '+w.tasks.length+' tasks: '+w.tasks.map(t=>t.kind).join(',')).join('\\n')`));

console.log('\n=== CHAMPIONS ===');
console.log(ev(`CHARS.map(c=>'  '+c.id.padEnd(3)+(c.hard?'HARD ':'     ')+(c.eg?'eg ':'-- ')+c.kind.padEnd(8)+c.name+' — '+c.how).join('\\n')`));

console.log('\n=== PUZZLES BY LEVEL BAND AND THEME ===');
console.log(ev(`(()=>{
  const band=r=>!r?'unrated':r<=1000?'new (<=1000)':r<=1600?'some (<=1600)':'club (>1600)';
  const t={};
  for (const p of TACTICS){ const b=band(p.rating); t[b]=t[b]||{}; t[b][p.theme]=(t[b][p.theme]||0)+1; }
  return Object.entries(t).map(([b,m])=>'  '+b+': '+Object.entries(m).sort((x,y)=>y[1]-x[1]).map(([k,v])=>k+' '+v).join(', ')).join('\\n');
})()`));

console.log('\n=== ENDGAME PUZZLE TYPES ===');
console.log(ev(`(()=>{const t={}; for(const p of TACTICS) if(p.eg) t[p.et||'?']=(t[p.et||'?']||0)+1;
  return '  '+JSON.stringify(t)+'\\n  key: '+JSON.stringify(typeof EG_TYPES!=='undefined'?EG_TYPES:'none');})()`));

console.log('\n=== RULES TAUGHT ANYWHERE (searching every task, champion and lesson text) ===');
const corpus = ev(`(()=>{
  let s=[];
  for (const w of WORLDS){
    s.push((w.intro||'')+' '+(w.note||'')+' '+(w.name||''));
    for (const t of w.tasks) s.push((t.say||'')+' '+(t.wrongSay||'')+' '+(t.winSay||'')+' '+t.kind);
  }
  for (const c of CHARS) s.push(c.how+' '+c.taunt+' '+c.kind);
  return s.join(' | ').toLowerCase();})()`);
const rules = {
  'castling':/castl/, 'en passant':/en passant/, 'stalemate':/stalemate/,
  'promotion':/promot|becomes a queen|new queen|turn into a queen|brand new queen/,
  'underpromotion':/knight instead|underpromot/,
  'piece values':/worth|value/, 'check (naming it)':/check/,
  'three ways out of check':/block|get in the way/,
  'draw by repetition':/repetition|same position/,
  'fifty-move':/fifty|50-move/,
  'pins':/pin\b|pinned/, 'skewer':/skewer/, 'fork':/fork/,
  'discovered attack':/discover/, 'back rank':/back rank/,
  'opposition':/opposition/, 'the square rule':/the square/,
  'development':/develop|pieces out/, 'centre':/centre|center|middle/,
  'king safety':/king safe|tucked/, 'counting defenders':/defend/
};
for (const k in rules) console.log('  '+(rules[k].test(corpus)?'yes':'NO ')+'  '+k);

console.log('\n=== OPENINGS ===');
console.log(ev(`'  lesson openings: '+WORLDS.find(w=>w.id==='w13').tasks.length+
  '   library: '+ALL_OPENINGS.length+
  '   white: '+ALL_OPENINGS.filter(o=>o.side==='w').length+
  '   black: '+ALL_OPENINGS.filter(o=>o.side==='b').length`));
console.log(ev(`'  groups: '+JSON.stringify(OPENING_GROUPS)`));

console.log('\n=== COUNTS ===');
console.log(ev(`'  tasks: '+WORLDS.reduce((a,w)=>a+w.tasks.length,0)+
  '   beginner tasks: '+WORLDS.filter(w=>w.beg).reduce((a,w)=>a+w.tasks.length,0)+
  '   puzzles: '+TACTICS.length+'   champions: '+CHARS.length`));
},1000);
