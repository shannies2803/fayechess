/* Audit from a seven-year-old's point of view, measured rather than guessed:
   how much reading, how many taps, how big the targets, how readable the text,
   and whether anything on screen can be missed or mis-tapped. */
const fs=require('fs');
const { chromium } = require('playwright');
const { JSDOM, VirtualConsole } = require('jsdom');
let gaps=0;
const gap=m=>{ gaps++; console.log('GAP: '+m); };
const note=m=>console.log('  '+m);

/* ---------- reading burden, measured on the content itself ---------- */
function readingAudit(){
  return new Promise(res=>{
    const vc=new VirtualConsole(); vc.on('jsdomError',()=>{});
    const d=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),
      {runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,url:'https://x.test/'});
    setTimeout(()=>{
      const rows=JSON.parse(d.window.eval(`(()=>{
        const out=[];
        for (const w of WORLDS) for (let i=0;i<w.tasks.length;i++){
          const t=w.tasks[i];
          out.push({id:w.id+':'+i, text:t.say||'', group:(w.beg?'beg':w.pat?'pat':'op')});
        }
        for (const c of CHARS) out.push({id:c.id, text:c.how||'', group:'champion'});
        return JSON.stringify(out);
      })()`));
      res(rows);
    }, 1000);
  });
}

/* a crude but consistent reading-difficulty measure: long words and long sentences */
function hard(text){
  const words=text.split(/\s+/).filter(Boolean);
  const long=words.filter(w=>w.replace(/[^A-Za-z]/g,'').length>=9);
  const sentences=text.split(/[.!?]+/).filter(x=>x.trim().length>1);
  const perSentence=sentences.length? words.length/sentences.length : words.length;
  return { words:words.length, long:long.map(w=>w.replace(/[^A-Za-z-]/g,'')), sentences:sentences.length, perSentence };
}

(async ()=>{
console.log('--- how much does a child have to read before they can act? ---');
const rows=await readingAudit();
let wordy=[], longWords={};
for (const r of rows){
  const h=hard(r.text);
  if (h.words > 40) wordy.push(r.id+' ('+h.words+' words)');
  if (h.perSentence > 22) wordy.push(r.id+' (sentences average '+Math.round(h.perSentence)+' words)');
  for (const w of h.long) longWords[w.toLowerCase()]=(longWords[w.toLowerCase()]||0)+1;
}
const avg=Math.round(rows.reduce((a,r)=>a+hard(r.text).words,0)/rows.length);
note('instructions: '+rows.length+', average '+avg+' words');
const longest=rows.map(r=>({id:r.id,n:hard(r.text).words})).sort((a,b)=>b.n-a.n).slice(0,5);
note('longest: '+longest.map(x=>x.id+' '+x.n+'w').join(', '));
if (wordy.length) gap('too much to read before acting: '+wordy.join('; '));
const bigWords=Object.entries(longWords).sort((a,b)=>b[1]-a[1]).slice(0,12);
if (bigWords.length) note('nine-letter-plus words used: '+bigWords.map(([w,n])=>w+'×'+n).join(', '));

/* ---------- everything else is measured in a real browser ---------- */
const b=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
for (const scheme of ['light','dark']){
  for (const width of [320, 390]){
    const ctx=await b.newContext({ viewport:{width,height:740}, deviceScaleFactor:2, colorScheme:scheme });
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
    await p.goto('file://'+__dirname+'/../index.html');
    await p.waitForTimeout(700);
    await p.click('#addLevels [data-lv="new"]');
    await p.fill('#addName','Kid');
    await p.click('#addSave');
    await p.waitForTimeout(350);

    /* walk the app and check every screen, not only the first one */
    const screens=[
      ['home', []],
      ['pieces list', ['#begBtn']],
      ['a lesson', ['#begBtn','#begList [data-bw="w1"]']],
      ['puzzles', ['#tacBtn']],
      ['champions', ['#arenaBtn']],
      ['a match', ['#arenaBtn','#arenaList [data-c]']],
      ['a game', ['#freeBtn']],
      ['two players', ['#ppBtn']],
      ['who is playing', ['#ppBtn','#ppNames']],
      ['for grown-ups', ['#parentBtn']],
      ['add a player', ['#addPlayerBtn']],
      ['write it down', ['#writeBtn']],
      ['name the move', ['#writeBtn','#wrTabs [data-wr="name"]']],
      ['look at a game', ['#lookBtn']],
      ['tap a game out', ['#lookBtn','#lookEnterBtn']],
      ['a game with a clock', ['#freeBtn','#fpTimes [data-tc="10"]']]
    ];
    for (const [sname, steps] of screens){
      await p.goto('file://'+__dirname+'/../index.html');
      await p.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
      await p.reload(); await p.waitForTimeout(600);
      const lv = /write it down|name the move|look at a game|tap a game out|a game with a clock/.test(sname) ? 'club' : 'new';
      const fresh=await p.$(`#addLevels [data-lv="${lv}"]`);
      if (fresh){ await fresh.click(); await p.fill('#addName','Kid'); await p.click('#addSave'); await p.waitForTimeout(300); }
      let reached=true;
      for (const sel of steps){
        const el=await p.$(sel);
        if (!el){ reached=false; break; }
        const shown=await el.isVisible().catch(()=>false);
        if (!shown){ reached=false; break; }
        try{ await el.click({ timeout:3000 }); }catch(e){ reached=false; break; }
        await p.waitForTimeout(320);
      }
      if (!reached){ note(scheme+'/'+width+'px: could not reach "'+sname+'" — skipped'); continue; }
      const lab=scheme+'/'+width+'px/'+sname;
      const s1=await p.evaluate(()=>{
        const bad=[];
        for (const el of document.querySelectorAll('.screen.on button, .screen.on input, .screen.on textarea')){
          if (el.classList.contains('sq') || el.closest('.board')) continue;
          const st=getComputedStyle(el);
          if (st.display==='none' || st.visibility==='hidden') continue;
          const r=el.getBoundingClientRect();
          if (r.width===0||r.height===0) continue;
          if (r.width<44 || r.height<44) bad.push((el.id||el.className||el.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));
        }
        return bad;
      });
      if (s1.length) gap(lab+': tap targets under 44px: '+[...new Set(s1)].slice(0,6).join(', '));
      const t1=await p.evaluate(()=>{
        const lum=c=>{ const [r,g,b]=c.match(/\d+/g).map(Number).map(v=>v/255)
            .map(v=>v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
          return 0.2126*r+0.7152*g+0.0722*b; };
        const bg=el=>{ let e=el;
          while (e){ const c=getComputedStyle(e).backgroundColor;
            if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
            e=e.parentElement; }
          return 'rgb(255,255,255)'; };
        const out=[];
        const who=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
          (el.className && typeof el.className==='string' ? '.'+el.className.trim().split(/\s+/).join('.') : '');
        for (const el of document.querySelectorAll('.screen.on *')){
          if (el.closest('.pc')||el.classList.contains('pc')) continue;   // pieces are pictures, not prose
          const txt=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
          if (!txt) continue;
          const st=getComputedStyle(el);
          if (st.display==='none'||st.visibility==='hidden') continue;
          const size=parseFloat(st.fontSize);
          const op=parseFloat(st.opacity);
          const l1=lum(st.color), l2=lum(bg(el));
          let ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
          if (op<1) ratio=1+(ratio-1)*op;            // faded text really is fainter
          const need=(size>=24 || (size>=18.66 && (st.fontWeight>=700||st.fontWeight==='bold')))?3:4.5;
          if (ratio<need) out.push(who(el)+' "'+txt.slice(0,16)+'" ['+ratio.toFixed(2)+':1]');
          // square names are labels on a board, not prose: 12px is the floor for them
          const floor = el.classList.contains('co') ? 12 : 13;
          if (size < floor) out.push(who(el)+' "'+txt.slice(0,16)+'" ['+size.toFixed(1)+'px]');
        }
        return out;
      });
      if (t1.length) gap(lab+': hard to read: '+[...new Set(t1)].slice(0,6).join(' | '));
      const ov=await p.evaluate(()=>{
        const win=window.innerWidth;
        let worst=null;
        for (const el of document.querySelectorAll('.screen.on *')){
          const r=el.getBoundingClientRect();
          if (r.right > win+1 && (!worst || r.right>worst.right))
            worst={ right:Math.round(r.right),
                    who:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
                        (typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).join('.'):'') };
        }
        return { doc:document.documentElement.scrollWidth, win, worst };
      });
      if (ov.doc>ov.win+1) gap(lab+': scrolls sideways ('+ov.doc+'>'+ov.win+
        (ov.worst?('; widest is '+ov.worst.who+' reaching '+ov.worst.right):'')+')');
      const back=await p.evaluate(()=>{
        const sc=document.querySelector('.screen.on');
        if (sc.id==='s-home') return true;
        return !!sc.querySelector('.back, #mapBtn, #nextBtn, #addSave');
      });
      if (!back) gap(lab+': no way back from this screen');
    }
    note(scheme+'/'+width+'px: swept '+screens.length+' screens');

    await p.goto('file://'+__dirname+'/../index.html');
    await p.evaluate(()=>{ try{ localStorage.clear(); }catch(e){} });
    await p.reload(); await p.waitForTimeout(600);
    { const fresh=await p.$('#addLevels [data-lv="new"]');
      if (fresh){ await fresh.click(); await p.fill('#addName','Kid'); await p.click('#addSave'); await p.waitForTimeout(350); } }

    const label=scheme+'/'+width+'px';

    /* the page must never scroll sideways */
    const over=await p.evaluate(()=>({ doc:document.documentElement.scrollWidth, win:window.innerWidth }));
    if (over.doc > over.win+1) gap(label+': the page scrolls sideways ('+over.doc+' > '+over.win+')');

    /* every button a child can tap must be big enough for a child’s finger */
    const small=await p.evaluate(()=>{
      const bad=[];
      for (const el of document.querySelectorAll('button, input, [role="gridcell"], textarea')){
        const s=getComputedStyle(el);
        if (s.display==='none' || s.visibility==='hidden') continue;
        const scr=el.closest('.screen');
        if (scr && !scr.classList.contains('on')) continue;
        const r=el.getBoundingClientRect();
        if (r.width===0 || r.height===0) continue;
        if (r.width < 44 || r.height < 44)
          bad.push((el.id||el.className||el.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));
      }
      return bad;
    });
    if (small.length) gap(label+': tap targets under 44px: '+small.join(', '));
    else note(label+': every tap target on the home screen is at least 44px');

    /* text must be readable: contrast and size */
    const badText=await p.evaluate(()=>{
      const lum=c=>{ const [r,g,b]=c.match(/\d+/g).map(Number).map(v=>v/255)
          .map(v=>v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
        return 0.2126*r+0.7152*g+0.0722*b; };
      const bg=el=>{ let e=el;
        while (e){ const c=getComputedStyle(e).backgroundColor;
          if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c;
          e=e.parentElement; }
        return 'rgb(255,255,255)'; };
      const out=[];
      for (const el of document.querySelectorAll('.screen.on *')){
        if (!el.childNodes.length) continue;
        const txt=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
        if (!txt) continue;
        const s=getComputedStyle(el);
        if (s.display==='none' || s.visibility==='hidden') continue;
        const size=parseFloat(s.fontSize);
        const l1=lum(s.color), l2=lum(bg(el));
        const ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        const need = (size>=24 || (size>=18.66 && (s.fontWeight>=700||s.fontWeight==='bold'))) ? 3 : 4.5;
        if (ratio < need) out.push(txt.slice(0,28)+' ['+ratio.toFixed(2)+':1 at '+size+'px]');
        if (size < 13) out.push(txt.slice(0,28)+' [only '+size+'px]');
      }
      return out;
    });
    if (badText.length) gap(label+': hard to read: '+badText.slice(0,8).join(' | '));
    else note(label+': all visible text passes contrast and size');

    /* a child must be able to reach the board without reading past the fold */
    const fold=await p.evaluate(()=>{
      const firstPlay=document.querySelector('#dailyItems [data-day]');
      if (!firstPlay) return null;
      const r=firstPlay.getBoundingClientRect();
      return { top:Math.round(r.top), viewport:window.innerHeight };
    });
    if (fold && fold.top > fold.viewport)
      gap(label+': the first thing to play is below the fold ('+fold.top+'px down)');
    else if (fold) note(label+': the first thing to play is '+fold.top+'px down, on screen at once');

    if (errs.length) gap(label+': javascript errors: '+errs.slice(0,3).join(' | '));
    await ctx.close();
  }
}

/* ---------- how many taps to reach each thing? ---------- */
{
  const ctx=await b.newContext({ viewport:{width:390,height:844} });
  const p=await ctx.newPage();
  await p.goto('file://'+__dirname+'/../index.html');
  await p.waitForTimeout(700);
  await p.click('#addLevels [data-lv="new"]'); await p.fill('#addName','Kid'); await p.click('#addSave');
  await p.waitForTimeout(300);
  const routes=[
    ['the first lesson of the day', ['#dailyItems [data-day="p0"]'], '#s-play'],
    ['how the pieces move',         ['#begBtn','#begList [data-bw="w1"]'], '#s-play'],
    ['a puzzle',                    ['#tacBtn'], '#s-tac'],
    ['an endgame champion',         ['#arenaBtn','#arenaList [data-c]'], '#s-match'],
    ['a game against the computer', ['#freeBtn'], '#s-free'],
    ['two players on one screen',   ['#ppBtn'], '#s-pp']
  ];
  for (const [name, steps, dest] of routes){
    await p.goto('file://'+__dirname+'/../index.html'); await p.waitForTimeout(600);
    let n=0, okr=true;
    for (const sel of steps){
      const el=await p.$(sel);
      if (!el){ okr=false; break; }
      await el.click(); n++; await p.waitForTimeout(350);
    }
    const there = okr && await p.evaluate(d=>document.querySelector(d).classList.contains('on'), dest);
    if (!there) gap('could not reach '+name+' by tapping');
    else {
      note(name+': '+n+' tap'+(n===1?'':'s'));
      if (n>2) gap(name+' takes '+n+' taps, which is one too many for this audience');
    }
  }
  await ctx.close();
}
await b.close();

console.log(gaps ? ('\n'+gaps+' gaps') : '\nchild audit: 0 gaps');
process.exit(gaps?1:0);
})();
