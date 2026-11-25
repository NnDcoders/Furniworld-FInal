/* ==========================================================================
   Furniworld — product customisation engine
   Every product gets option groups (sofa size, table size, number of chairs, bed size, …)
   plus an optional "Custom size" (length × width × height) and a special-instructions note.

   Where the options come from
   1. If a product has an "optionsText" value (Admin → Products → "Custom options"), that is used.
   2. Otherwise smart defaults are generated from the product's category / name (see defaults()).

   optionsText format — one option group per line, first choice = default:
        Number of chairs: 4 | 5 +5500 | 6 +11000 | 8 +22000
        Seating size: 2-Seater -18% | 3-Seater | 4-Seater +20%
        Custom size: +12%            <- turns on the length/width/height boxes (optional surcharge)
   A choice can carry   +1500  (₹ extra)   -1500  (₹ less)   +10%  or  -8%  (of the sale price).
   ========================================================================== */
const COLOR_NAMES={'#b9a68a':'Taupe','#a67c52':'Tan','#b18a63':'Oak','#e8dfd1':'Ivory','#d9cdb8':'Linen','#6a4934':'Walnut','#8a7a64':'Olive grey','#d5c3aa':'Sand','#35261e':'Espresso','#6f7b66':'Sage'};
const Opts=(()=>{
 const r10=n=>Math.round(n/10)*10;
 /* ---------- parsing ---------- */
 const parseChoice=s=>{s=s.trim();let add=0,pct=0;const m=s.match(/\s*([+\-−])\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(%?)\s*$/);let label=s;
  if(m){const n=parseFloat(m[2].replace(/,/g,''))*(m[1]==='+'?1:-1);label=s.slice(0,m.index).trim();if(m[3])pct=n;else add=n}
  return{label:label||s,add,pct}};
 const parse=text=>{const groups=[];let custom=null;
  String(text||'').split(/\r?\n/).forEach(line=>{line=line.trim();if(!line||line.startsWith('#'))return;const i=line.indexOf(':');if(i<1)return;const name=line.slice(0,i).trim(),rest=line.slice(i+1).trim();
   if(/^custom\s*size$/i.test(name)){const c=parseChoice('x '+(rest||'+0'));custom={add:c.add,pct:c.pct};return}
   const choices=rest.split('|').map(parseChoice).filter(c=>c.label);if(choices.length)groups.push({name,choices})});
  return{groups,custom}};
 const stringify=cfg=>[...cfg.groups.map(g=>g.name+': '+g.choices.map(c=>c.label+(c.pct?(c.pct>0?' +':' ')+c.pct+'%':c.add?(c.add>0?' +':' ')+c.add:'')).join(' | ')),...(cfg.custom?['Custom size: +'+(cfg.custom.pct||0)+'%']:[])].join('\n');
 /* ---------- smart defaults ---------- */
 const G=(name,list)=>({name,choices:list.map(([label,add,pct])=>({label,add:add||0,pct:pct||0}))});
 const WOOD=G('Wood',[['Teak (as shown)'],['Sheesham'],['Oak',0,5],['Walnut',0,10]]);
 const FAB=G('Upholstery',[['Linen blend (as shown)'],['Cotton canvas'],['Premium velvet',3500],['Leatherette',6500]]);
 const FIN=G('Finish',[['Natural matte (as shown)'],['Honey gloss'],['Dark walnut stain'],['White wash']]);
 const chairsSet=(base,per,tableOnly)=>{const opts=tableOnly?[0,4,5,6,8]:[4,5,6,8];if(!tableOnly&&!opts.includes(base))opts.push(base),opts.sort((a,b)=>a-b);
  return G('Number of chairs',opts.map(n=>[n===0?'Table only (no chairs)':n+' chairs'+(n===base?' (as shown)':''),(n-base)*per]))};
 const defaults=p=>{const n=(p.name||'').toLowerCase(),cat=p.category,g=[];let custom={pct:12};
  const sizes=(name,base,list)=>G(name,list.map(([l,pc])=>[l+(pc===0?' (as shown)':''),0,pc]));
  if(/modular sofa/.test(n)){g.push(G('Configuration',[['3-Seater (as shown)'],['2-Seater',0,-22],['4-Seater',0,18],['L-Shape',0,28],['U-Shape',0,48]]),FAB,WOOD)}
  else if(/sofa/.test(n)){g.push(G('Seating size',[['3-Seater (as shown)'],['2-Seater',0,-20],['4-Seater',0,22],['5-Seater (L-shape)',0,35]]),FAB,WOOD)}
  else if(/lounge chair|mesh chair/.test(n)){g.push(FAB.name?G('Upholstery',[['Standard (as shown)'],['Premium velvet',1800],['Leatherette',3200]]):FAB);custom=null}
  else if(/coffee table/.test(n)){g.push(sizes('Table size',0,[['110 × 60 cm',0],['90 × 50 cm',-8],['130 × 70 cm',12]]),G('Table top',[['Solid wood (as shown)'],['Tempered glass inlay',2500]]),WOOD)}
  else if(/king bed|platform bed|storage bed/.test(n)){const def=/meridian/.test(n)?'Queen':'King';
   g.push(G('Bed size',[['Single (3 × 6.25 ft)',0,-30],['Double (4.5 × 6.25 ft)',0,-18],['Queen (5 × 6.25 ft)'+(def==='Queen'?' (as shown)':''),0,def==='Queen'?0:-8],['King (6 × 6.25 ft)'+(def==='King'?' (as shown)':''),0,def==='King'?0:9],['Super King (6.5 × 7 ft)',0,def==='King'?14:24]].sort((a,b)=>(/as shown/.test(b[0])?1:0)-(/as shown/.test(a[0])?1:0))),
    G('Headboard',[['Wooden (as shown)'],['Cushioned panel',5500]]),/storage/.test(n)?G('Storage',[['Hydraulic lift-up (as shown)'],['Side drawers',6500]]):G('Bedside tables',[['None'],['1 piece',4500],['2 pieces',8500]]),WOOD)}
  else if(/walnut dining set/.test(n)){g.push(chairsSet(6,6500),sizes('Table size',0,[['180 × 90 cm',0],['150 × 90 cm',-10],['210 × 100 cm',16]]),G('Chair seat',[['Wooden (as shown)'],['Cushioned fabric',1200]]),WOOD)}
  else if(/haveli.*dining/.test(n)){g.push(chairsSet(4,5500),sizes('Table size',0,[['140 × 80 cm',0],['120 × 75 cm',-8],['160 × 85 cm',12]]),G('Chair seat',[['Wooden (as shown)'],['Cushioned fabric',1200]]),WOOD)}
  else if(/round dining/.test(n)){g.push(chairsSet(0,5000,true),sizes('Table diameter',0,[['120 cm',0],['100 cm',-10],['135 cm',14],['150 cm',24]]),G('Chair seat',[['Wooden'],['Cushioned fabric',1200]]),WOOD)}
  else if(/writing desk|executive desk/.test(n)){const w=/executive/.test(n)?'180 × 75 cm':'140 × 65 cm';g.push(sizes('Desk size',0,[[w,0],[/executive/.test(n)?'160 × 70 cm':'120 × 60 cm',-10],[/executive/.test(n)?'200 × 80 cm':'160 × 70 cm',14]]),G('Drawers',[['2 drawers (as shown)'],['3 drawers',3500],['4 drawers + cabinet',7500]]),WOOD)}
  else if(/wardrobe/.test(n)&&cat!=='Custom Furniture'){g.push(G('Number of doors',[['2 doors',0,-18],['3 doors (as shown)'],['4 doors',0,22],['5 doors',0,40]].sort((a,b)=>(/as shown/.test(b[0])?1:0)-(/as shown/.test(a[0])?1:0))),G('Interior',[['Standard shelves & hanging rail'],['With full-length mirror',6500],['With loft & drawers',9500]]),WOOD)}
  else if(/book ?shelf/.test(n)){g.push(sizes('Width',0,[['80 cm',0],['100 cm',14],['120 cm',26]]),G('Shelves',[['5 shelves (as shown)'],['6 shelves',2200],['7 shelves',4400]]),WOOD)}
  else if(/sideboard/.test(n)){g.push(sizes('Length',0,[[cat==='Custom Furniture'?'200 cm':'180 cm',0],[cat==='Custom Furniture'?'160 cm':'150 cm',-12],[cat==='Custom Furniture'?'240 cm':'210 cm',16]]),G('Doors & drawers',[['As shown'],['All doors',-1500],['Extra drawers',4500]]),WOOD)}
  else if(/chest of drawers|tallboy/.test(n)){g.push(G('Number of drawers',[['5 drawers (as shown)'],['4 drawers',0,-10],['6 drawers',0,14]]),WOOD)}
  else if(/mirror console/.test(n)){g.push(G('Mirror size',[['As shown'],['Larger mirror',0,12]]),G('Frame',[['Natural wood (as shown)'],['Brass finish',2800]]))}
  else if(/vase|console/.test(n)){g.push(G('Set',[['Console + vase set (as shown)'],['Console only',0,-22],['Console + 2 vase sets',0,18]]),WOOD)}
  else if(/bench/.test(n)){g.push(sizes('Length',0,[['150 cm',0],['120 cm',-15],['180 cm',20]]),G('Cushion',[['None (as shown)'],['Weather-proof cushion',2800]]),G('Wood',[['Teak (as shown)']]))}
  else if(/lounge pair/.test(n)){g.push(G('Set',[['2 lounge chairs (as shown)'],['2 chairs + side table',6500],['4 chairs + 2 side tables',0,92]]),G('Cushion colour',[['Sand (as shown)'],['Charcoal'],['Olive']]))}
  else if(/bespoke/.test(n)){g.push(sizes('Width',0,[[/wardrobe/.test(n)?'300 cm (as shown)':'200 cm (as shown)',0],[/wardrobe/.test(n)?'240 cm':'160 cm',-14],[/wardrobe/.test(n)?'360 cm':'240 cm',16]].map(x=>[x[0].replace(' (as shown)',''),x[1]])),FIN,WOOD)}
  else{g.push(FIN,WOOD)}
  return{groups:g,custom}};
 /* resolve a product's configuration */
 const get=p=>{if(p.optionsText&&String(p.optionsText).trim()){const c=parse(p.optionsText);if(c.groups.length||c.custom)return c}return defaults(p)};
 const cfgCache=new WeakMap();
 const cfg=p=>{let c=cfgCache.get(p);if(!c||c._t!==p.optionsText){c=get(p);c._t=p.optionsText;cfgCache.set(p,c)}return c};
 /* ---------- selection & pricing ---------- */
 const defSel=p=>{const s={};cfg(p).groups.forEach(g=>s[g.name]=g.choices[0].label);return s};
 const base=p=>p.discountPrice&&p.discountPrice<p.price?p.discountPrice:p.price;
 const amt=(p,c)=>r10((c.add||0)+base(p)*(c.pct||0)/100);
 const extras=(p,line)=>{const c=cfg(p);let x=0;c.groups.forEach(g=>{const lab=(line.sel||{})[g.name],ch=g.choices.find(k=>k.label===lab)||g.choices[0];x+=amt(p,ch)});
  if(line.size&&c.custom)x+=amt(p,c.custom);return x};
 const unit=(p,line)=>{const e=extras(p,line);return{sale:base(p)+e,mrp:p.price+e,extra:e}};
 const sizeTxt=s=>s?`${s.l} × ${s.w} × ${s.h} cm`:'';
 const text=(p,line)=>{const bits=[];if(line.sel)Object.entries(line.sel).forEach(([k,v])=>{if(v!==''&&v!=null)bits.push(k+': '+String(v).replace(/ \(as shown\)$/,''))});if(line.size)bits.push('Custom size: '+sizeTxt(line.size));return bits.join(' · ')};
 const key=(id,line)=>id+'|'+JSON.stringify(Object.keys(line.sel||{}).sort().map(k=>[k,line.sel[k]]))+'|'+sizeTxt(line.size)+'|'+(line.note||'').trim().toLowerCase();
 const delta=(p,c)=>{const a=amt(p,c);return a===0?'':(a>0?'+':'−')+'₹'+Math.abs(a).toLocaleString('en-IN')};
 return{parse,stringify,get:cfg,defaults,defSel,unit,text,key,delta,amt,sizeTxt,base}})();
