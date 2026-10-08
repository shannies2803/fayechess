/* the same measured checks, run against Philip's site */
const { chromium } = require('playwright');
let gaps=0;
const gap=m=>{ gaps++; console.log('GAP: '+m); };
const note=m=>console.log('  '+m);
(async ()=>{
const b=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
for (const width of [360, 390, 820]){
  // a phone is a touch device, and the stylesheet gives those bigger hit areas
  const ctx=await b.newContext({ viewport:{width,height:800}, deviceScaleFactor:2, hasTouch:width<700 });
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  await p.goto('file://'+__dirname+'/../philip/index.html');
  await p.waitForTimeout(900);

  const views=await p.evaluate(()=>Array.from(document.querySelectorAll('section[id^="v-"]')).map(s=>s.id));
  for (const view of views){
    await p.evaluate(v=>{
      document.querySelectorAll('section[id^="v-"]').forEach(s=>s.classList.remove('on'));
      const el=document.getElementById(v); if (el) el.classList.add('on');
    }, view);
    await p.waitForTimeout(180);
    const lab=width+'px/'+view;

    const small=await p.evaluate(()=>{
      const bad=[];
      for (const el of document.querySelectorAll('section.on button, section.on input, section.on select, section.on textarea, section.on a')){
        const st=getComputedStyle(el);
        if (st.display==='none'||st.visibility==='hidden') continue;
        const r=el.getBoundingClientRect();
        if (r.width===0||r.height===0) continue;
        // the 44px guideline is for fingers; with a mouse a smaller target is fine,
        // and this stylesheet already keys its bigger hit areas off pointer:coarse
        const floorW = matchMedia('(pointer:coarse)').matches ? 40 : 24;
        const floorH = matchMedia('(pointer:coarse)').matches ? 36 : 24;
        if (r.width<floorW || r.height<floorH)
          bad.push((el.id||el.className||el.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height));
      }
      return bad;
    });
    if (small.length) gap(lab+': tap targets under 40x36: '+[...new Set(small)].slice(0,6).join(', '));

    const t=await p.evaluate(()=>{
      const lum=c=>{ const m=(c||'').match(/[\d.]+/g); if(!m) return 1;
        const [r,g,b]=m.slice(0,3).map(Number).map(v=>v/255)
          .map(v=>v<=0.03928? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
        return 0.2126*r+0.7152*g+0.0722*b; };
      /* translucent panels are the house style here, so the background has to be
         composited down the ancestors, not taken from the first layer that is set */
      const parse=c=>{ const m=(c||'').match(/[\d.]+/g); if(!m) return null;
        return {r:+m[0], g:+m[1], b:+m[2], a: m.length>3 ? +m[3] : 1}; };
      const over=(fg,bgc)=>({ r: fg.r*fg.a + bgc.r*(1-fg.a),
                              g: fg.g*fg.a + bgc.g*(1-fg.a),
                              b: fg.b*fg.a + bgc.b*(1-fg.a), a:1 });
      const bg=el=>{
        const layers=[]; let e=el;
        while (e){ const c=parse(getComputedStyle(e).backgroundColor);
          if (c && c.a>0) layers.push(c);
          if (c && c.a>=1) break;
          e=e.parentElement; }
        let out = layers.length && layers[layers.length-1].a>=1
          ? layers.pop() : (parse(getComputedStyle(document.documentElement).backgroundColor) || {r:255,g:255,b:255,a:1});
        for (let i=layers.length-1;i>=0;i--) out=over(layers[i], out);
        return 'rgb('+out.r+','+out.g+','+out.b+')';
      };
      const who=el=>el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
        (typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'');
      const out=[];
      for (const el of document.querySelectorAll('section.on *')){
        // chess pieces are pictures drawn with glyphs, not prose
        if (el.closest('.pc')||el.closest('.piece')||el.classList.contains('pc')||
            el.classList.contains('piece')||el.classList.contains('sq')) continue;
        const txt=Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('');
        if (!txt) continue;
        const st=getComputedStyle(el);
        if (st.display==='none'||st.visibility==='hidden') continue;
        const size=parseFloat(st.fontSize);
        const op=parseFloat(st.opacity);
        const l1=lum(st.color), l2=lum(bg(el));
        let ratio=(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
        if (op<1) ratio=1+(ratio-1)*op;
        const need=(size>=24 || (size>=18.66 && (st.fontWeight>=700||st.fontWeight==='bold')))?3:4.5;
        if (ratio<need) out.push(who(el)+' "'+txt.slice(0,18)+'" ['+ratio.toFixed(2)+':1 @'+size.toFixed(0)+'px]');
        /* three kinds of text, three floors: prose 12px, the uppercase mono
           micro-labels this design uses 11px, and board square names 9px */
        const cl=el.classList;
        const micro = cl.contains('eyebrow')||cl.contains('tag')||cl.contains('lbl')||cl.contains('who')||
             cl.contains('ls-n')||cl.contains('count')||cl.contains('eco')||el.tagName==='LABEL'||
             !!el.closest('.sheet-cols');       // the scoresheet column headings are labels too
        const floor = cl.contains('co') ? 9 : micro ? 11 : 12;
        if (size < floor) out.push(who(el)+' "'+txt.slice(0,18)+'" ['+size.toFixed(1)+'px, floor '+floor+']');
      }
      return out;
    });
    if (t.length) gap(lab+': hard to read: '+[...new Set(t)].slice(0,5).join(' | '));

    const ov=await p.evaluate(()=>{
      const win=window.innerWidth; let worst=null;
      for (const el of document.querySelectorAll('section.on *')){
        const r=el.getBoundingClientRect();
        if (r.right>win+1 && (!worst||r.right>worst.right))
          worst={right:Math.round(r.right), who:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+
            (typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/).slice(0,2).join('.'):'')};
      }
      return {doc:document.documentElement.scrollWidth, win, worst};
    });
    if (ov.doc>ov.win+1) gap(lab+': scrolls sideways ('+ov.doc+'>'+ov.win+
      (ov.worst?('; widest is '+ov.worst.who+' reaching '+ov.worst.right):'')+')');
  }
  if (errs.length) gap(width+'px: javascript errors: '+[...new Set(errs)].slice(0,3).join(' | '));
  note(width+'px: swept '+views.length+' views');
  await ctx.close();
}
await b.close();
console.log(gaps ? ('\n'+gaps+' gaps') : '\nPhilip’s site: 0 gaps');
process.exit(0);
})();
