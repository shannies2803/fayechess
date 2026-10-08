/* structural audit: ids, tokens, duplicate ids, and unreachable handlers */
const fs=require('fs');
const s=fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
let gaps=0;
const gap=(m)=>{ gaps++; console.log('GAP: '+m); };

/* 1. duplicate element ids */
const ids=[...s.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
const seen={}, dup=[];
for (const i of ids){ if (seen[i]) dup.push(i); else seen[i]=1; }
if (dup.length) gap('duplicate ids: '+[...new Set(dup)].join(', '));

/* 2. every id the script looks up must exist in the markup */
const looked=new Set([...s.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1])
  .concat([...s.matchAll(/getElementById\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1])));
const missing=[...looked].filter(i=>!seen[i]);
if (missing.length) gap('the script looks up ids that do not exist: '+missing.join(', '));

/* 3. every css variable used must be defined in the light theme */
const defined=new Set([...s.matchAll(/(--[a-z-]+)\s*:/g)].map(m=>m[1]));
const used=new Set([...s.matchAll(/var\((--[a-z-]+)\)/g)].map(m=>m[1]));
const undef=[...used].filter(v=>!defined.has(v));
if (undef.length) gap('css variables used but never defined: '+undef.join(', '));

/* 4. every variable the dark theme changes must exist in the light theme too */
const darkStart=s.indexOf('@media (prefers-color-scheme: dark)');
const darkEnd=s.indexOf('\n}\n', s.indexOf('--shadow', darkStart));
const darkBlock=s.slice(darkStart, darkStart+900);
const darkVars=[...darkBlock.matchAll(/(--[a-z-]+)\s*:/g)].map(m=>m[1]);
const lightBlock=s.slice(0, darkStart);
for (const v of darkVars) if (!new RegExp(v+'\\s*:').test(lightBlock))
  gap('dark theme defines '+v+' which the light theme does not');

/* 4b. a colour that must differ between themes must not be hard-coded in a rule
       that applies to both themes (inside the dark block it is fine) */
{
  const dStart=s.indexOf('@media (prefers-color-scheme: dark)');
  const dEnd=s.indexOf('\n}\n', s.indexOf('input,textarea,select', dStart));
  const shared=s.slice(0,dStart)+s.slice(dEnd);
  for (const hex of ['#E6DAC6','#3A332B'])
    if (new RegExp('background:'+hex).test(shared))
      gap(hex+' is hard-coded in a rule that applies to both themes');
}

/* 5. coral must never be used as text colour: it fails contrast on cream */
if (/color:var\(--coral\)/.test(s)) gap('coral is used as a text colour somewhere');

/* 6. every data- attribute the script binds must be produced somewhere */
const bound=[...s.matchAll(/\[data-([a-z]+)\]/g)].map(m=>m[1]);
for (const b of [...new Set(bound)])
  if (!new RegExp('data-'+b+'="').test(s)) gap('nothing ever renders data-'+b);

/* 7. the build must not contain a stray template placeholder */
for (const bad of ['undefined%','NaN','[object Object]','TODO','FIXME'])
  if (s.includes(bad)) gap('the file contains "'+bad+'"');

/* 8. the new screens must all be reachable */
for (const sc of ['s-beg','s-add'])
  if (!seen[sc]) gap('screen '+sc+' is missing');
for (const [btn,scr] of [['begBtn','s-beg'],['addPlayerBtn','s-add']])
  if (!new RegExp("'#"+btn+"'").test(s) && !new RegExp('"'+btn+'"').test(s))
    gap(btn+' is never wired up');

console.log(gaps? (gaps+' gaps'):'structural audit: 0 gaps');
process.exit(gaps?1:0);
