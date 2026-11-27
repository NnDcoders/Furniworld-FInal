/* Furniworld effects: Earth-and-universe intro, star field, gold dividers, floating buttons, live-edit mode. */
(function(){
const th=Content.theme(),RM=matchMedia('(prefers-reduced-motion:reduce)').matches,body=document.body;
/* ---- ambient page background ---- */
window.FX={blades:()=>{}};
/* ==========================================================================
   INTRO — "universe around the Earth"
   1. a night sky of stars and nebula fades in            4. the camera pulls back, the sky turns to light
   2. the Furniworld globe rises, spinning meridians      5. the full Furniworld logo is revealed around the globe
   3. golden orbit rings + satellites circle the Earth    6. tagline, then the site appears
   Shown once per browser session. Click / tap / Esc to skip.
   ========================================================================== */
const GX=.6882,GY=.4497,GR=.0675,LAR=1472/4276; /* globe centre & radius inside the logo image (fractions) */
/* INTRO RULES: only on the HOME page, only on a first open (typed address / bookmark / link from another site) or a refresh.
   It never plays on About, Shop, Contact… and never when a visitor clicks a link inside the site (including the logo back to Home). */
const isHome=/(^|\/)(index\.html)?$/.test(location.pathname.replace(/\/+$/,'/'))||/\/index\.html$/.test(location.pathname);
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href]');if(a&&a.origin===location.origin&&!a.target)try{sessionStorage.setItem('fw_internal',String(Date.now()))}catch(x){}},true);
const navType=(performance.getEntriesByType&&performance.getEntriesByType('navigation')[0]||{}).type||'navigate';
let fromSite=false;try{fromSite=navType==='navigate'&&((!!document.referrer&&new URL(document.referrer).origin===location.origin)||(Date.now()-(+sessionStorage.getItem('fw_internal')||0)<15000))}catch(e){}
try{if(navType==='reload')sessionStorage.removeItem('fw_internal')}catch(e){}
const showIntro=isHome&&th.intro!==false&&!RM&&!EDIT&&!/[?&]nointro/.test(location.search)&&!fromSite;
if(showIntro){body.classList.add('intro-on');document.documentElement.classList.add('intro-on');
 const el=document.createElement('div');el.id='intro';el.setAttribute('aria-hidden','true');
 const vw=innerWidth,vh=innerHeight,lw=Math.min(vw*.9,1180,vh*2.2);                        /* final logo width (px) */
 const g=Math.max(46,Math.min(vw*.17,vh*.2,150));                                          /* globe radius while it is the hero (px) */
 const S=g/(GR*lw*.985);                                                                    /* scale that makes the globe that big */
 el.style.cssText=`--lw:${lw}px;--S:${S};--g:${g}px;--gx:${GX*100}%;--gy:${GY*100}%`;
 el.innerHTML=`<div class="sky"><canvas id="introStars"></canvas><i class="neb n1"></i><i class="neb n2"></i><i class="neb n3"></i></div>
 <div class="orb" style="width:${g*6}px;height:${g*6}px"><svg viewBox="-100 -100 200 200" overflow="visible"><defs><linearGradient id="og" x1="0" x2="1"><stop offset="0" stop-color="#f6d57a" stop-opacity="0"/><stop offset=".5" stop-color="#f6d57a"/><stop offset="1" stop-color="#c9962b" stop-opacity=".2"/></linearGradient></defs>
  <ellipse class="ring r1" rx="94" ry="33" transform="rotate(-22)" pathLength="1"/><ellipse class="ring r2" rx="86" ry="27" transform="rotate(34)" pathLength="1"/><circle class="ring r3" r="64" pathLength="1"/>
  <path id="p1" d="M-94 0a94 33 0 1 0 188 0a94 33 0 1 0 -188 0" transform="rotate(-22)" fill="none"/><path id="p2" d="M-86 0a86 27 0 1 0 172 0a86 27 0 1 0 -172 0" transform="rotate(34)" fill="none"/>
  <circle class="sat" r="3.6"><animateMotion dur="3.2s" repeatCount="indefinite"><mpath href="#p1"/></animateMotion></circle><circle class="sat s2" r="2.6"><animateMotion dur="4.4s" begin="-1.5s" repeatCount="indefinite"><mpath href="#p2"/></animateMotion></circle><circle class="sat s3" r="2"><animateMotion dur="2.6s" begin="-.8s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear"><mpath href="#p1"/></animateMotion></circle></svg></div>
 <div class="lg"><img src="assets/brand/logo-full.png" alt="" draggable="false"><canvas class="mer" id="introMer"></canvas><i class="flare"></i></div>
 <div class="glow"></div><p class="skip">Tap to skip</p>`;
 body.prepend(el);
 /* stars */
 (function(){const cv=document.getElementById('introStars'),x=cv.getContext('2d'),dpr=Math.min(devicePixelRatio||1,2);cv.width=vw*dpr;cv.height=vh*dpr;x.scale(dpr,dpr);
  const N=Math.round(vw*vh/2600),st=Array.from({length:N},()=>({x:Math.random()*vw,y:Math.random()*vh,r:Math.random()*1.5+.2,a:Math.random()*6.28,s:.6+Math.random()*2.4,d:Math.random()*.12+.02,gold:Math.random()<.18}));
  let t=0,sh=null;(function f(){if(!el.isConnected)return;t+=.016;x.clearRect(0,0,vw,vh);
   for(const p of st){const a=.35+.65*Math.abs(Math.sin(p.a+t*p.s));p.x-=p.d;if(p.x<0)p.x=vw;x.globalAlpha=a;x.fillStyle=p.gold?'#f6d57a':'#fff';x.beginPath();x.arc(p.x,p.y,p.r,0,6.283);x.fill();if(p.r>1.2){x.globalAlpha=a*.35;x.fillRect(p.x-p.r*3,p.y-.4,p.r*6,.8);x.fillRect(p.x-.4,p.y-p.r*3,.8,p.r*6)}}
   if(!sh&&Math.random()<.012)sh={x:Math.random()*vw*.8+vw*.2,y:Math.random()*vh*.4,l:0};if(sh){sh.l+=14;x.globalAlpha=Math.max(0,1-sh.l/260);const gr=x.createLinearGradient(sh.x,sh.y,sh.x+sh.l,sh.y-sh.l*.5);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(1,'#fff');x.strokeStyle=gr;x.lineWidth=1.6;x.beginPath();x.moveTo(sh.x,sh.y);x.lineTo(sh.x-sh.l,sh.y+sh.l*.5);x.stroke();if(sh.l>260)sh=null}
   requestAnimationFrame(f)})()})();
 /* spinning meridians drawn over the globe (orthographic projection) */
 (function(){const cv=document.getElementById('introMer'),img=el.querySelector('.lg img');const draw=()=>{const R=GR*lw*1.02,sz=Math.ceil(R*2*Math.min(S,3.2));};
  const px=Math.ceil(g*2.1);cv.width=cv.height=px;const x=cv.getContext('2d'),c=px/2,r=px/2-2;let a=0,run=true;
  cv.style.cssText=`left:${GX*100}%;top:${GY*100}%;width:${GR*lw*2.1}px;height:${GR*lw*2.1}px;margin:${-GR*lw*1.05}px 0 0 ${-GR*lw*1.05}px`;
  (function f(){if(!el.isConnected||!run)return;a+=.018;x.clearRect(0,0,px,px);x.save();x.beginPath();x.arc(c,c,r*.93,0,6.283);x.clip();x.lineWidth=1.1;
   for(let i=0;i<12;i++){const th=a+i*Math.PI/6,rx=Math.abs(Math.cos(th))*r*.93;const front=Math.sin(th)>0;x.strokeStyle=front?'rgba(255,224,140,.55)':'rgba(255,224,140,.14)';x.beginPath();x.ellipse(c,c,Math.max(.5,rx),r*.93,0,0,6.283);x.stroke()}
   for(let k=-2;k<=2;k++){const ly=Math.sin(k*.5)*r*.93,lr=Math.cos(k*.5)*r*.93;x.strokeStyle='rgba(255,224,140,.28)';x.beginPath();x.ellipse(c,c+ly,lr,lr*.12,0,0,6.283);x.stroke()}
   x.restore();requestAnimationFrame(f)})();el._stopMer=()=>run=false})();
 let ended=false;const done=()=>{if(ended)return;ended=true;el.classList.add('out');setTimeout(()=>{el.remove();body.classList.remove('intro-on');document.documentElement.classList.remove('intro-on')},650)};
 /* timeline */
 const T=[['rise',.2],['rings',1.1],['pull',3.0],['light',3.4],['tag',4.5]];T.forEach(([c,t])=>setTimeout(()=>el.classList.add(c),t*1000));
 setTimeout(done,5600);el.addEventListener('click',()=>{el.classList.add('pull','light','tag');setTimeout(done,500)});addEventListener('keydown',e=>{if(e.key==='Escape')done()},{once:true});window.__introFail=setTimeout(done,8000)}
/* ---- star field in hero (twinkling gold & white stars + the odd shooting star) ---- */
function dust(){const cv=document.getElementById('dust');if(!cv||th.dust===false||RM)return;const x=cv.getContext('2d');let W,H,P=[],run=true,dpr=Math.min(devicePixelRatio||1,2);
 const sz=()=>{const r=cv.getBoundingClientRect();W=r.width;H=r.height;cv.width=W*dpr;cv.height=H*dpr;x.setTransform(dpr,0,0,dpr,0,0)};sz();addEventListener('resize',sz);
 const N=W<700?60:130;for(let i=0;i<N;i++)P.push({x:Math.random()*W,y:Math.random()*H,r:.4+Math.random()*1.5,ph:Math.random()*6.28,sp:.01+Math.random()*.03,vx:.03+Math.random()*.1,gold:Math.random()<.3});let t=0,sh=null;
 (function f(){if(run){t++;x.clearRect(0,0,W,H);for(const p of P){p.x-=p.vx;if(p.x<-4)p.x=W+4;const a=.25+.75*Math.abs(Math.sin(p.ph+t*p.sp));x.globalAlpha=a;x.fillStyle=p.gold?'#f6d57a':'#dfe8ff';x.beginPath();x.arc(p.x,p.y,p.r,0,6.283);x.fill();if(p.r>1.3){x.globalAlpha=a*.4;x.fillRect(p.x-p.r*3.2,p.y-.4,p.r*6.4,.8);x.fillRect(p.x-.4,p.y-p.r*3.2,.8,p.r*6.4)}}
  if(!sh&&Math.random()<.004)sh={x:Math.random()*W*.7+W*.3,y:Math.random()*H*.35,l:0};if(sh){sh.l+=12;x.globalAlpha=Math.max(0,1-sh.l/240);const g=x.createLinearGradient(sh.x,sh.y,sh.x-sh.l,sh.y+sh.l*.5);g.addColorStop(0,'#fff');g.addColorStop(1,'rgba(255,255,255,0)');x.strokeStyle=g;x.lineWidth=1.5;x.beginPath();x.moveTo(sh.x,sh.y);x.lineTo(sh.x-sh.l,sh.y+sh.l*.5);x.stroke();if(sh.l>240)sh=null}}
  requestAnimationFrame(f)})();new IntersectionObserver(e=>run=e[0].isIntersecting).observe(cv)}
/* ---- hero parallax (desktop pointer) ---- */
function hero(){const h=document.getElementById('hero');if(!h||RM||!matchMedia('(hover:hover)').matches)return;h.addEventListener('pointermove',e=>{const r=h.getBoundingClientRect(),mx=(e.clientX-r.left)/r.width-.5,my=(e.clientY-r.top)/r.height-.5;h.style.setProperty('--mx',mx.toFixed(3));h.style.setProperty('--my',my.toFixed(3))})}
/* ---- gold divider lines with a travelling spark ---- */
function cuts(){document.querySelectorAll('main .sec.alt,main .woods,main .proc,main .nl').forEach(s=>{if(s.previousElementSibling?.classList.contains('cutline'))return;const c=document.createElement('div');c.className='cutline';c.setAttribute('aria-hidden','true');c.innerHTML='<i class="spark"></i>';s.before(c)});
 const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.6});document.querySelectorAll('.cutline').forEach(c=>io.observe(c))}
/* ---- floating buttons ---- */
function floats(){if(document.getElementById('sfloat'))return;const ph=SITE.whatsapp,so=(Content.get().social||{}),
 S=[['instagram','Instagram',so.instagram||SITE.social.instagram],['facebook','Facebook',so.facebook||SITE.social.facebook],['pinterest','Pinterest',so.pinterest||SITE.social.pinterest]].filter(x=>x[2]);
 body.insertAdjacentHTML('beforeend',`<div id="sfloat" class="sfloat" role="group" aria-label="Follow Furniworld">${S.map(([n,l,u])=>`<a class="sf-${n}" href="${u.replace(/"/g,'&quot;')}" target="_blank" rel="noopener" aria-label="${l}" title="${l}"><i class="bi bi-${n}"></i></a>`).join('')}</div>${Content.t('whatsapp.on')!=='no'&&ph?`<a class="wa" href="https://wa.me/${ph}?text=${encodeURIComponent(Content.t('whatsapp.msg'))}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><i class="bi bi-whatsapp"></i><span>Chat with us</span></a>`:''}`)}
/* ---- footer wood ---- */
function foot(){const f=document.querySelector('.ft-wood'),u=Content.t('img.footBg');if(f&&u)f.style.backgroundImage=`url('${u}')`}
/* ---- live edit mode (admin → "Edit live site") ---- */
function edit(){if(!EDIT)return;body.classList.add('editing');
 body.insertAdjacentHTML('beforeend','<div class="edbar" role="region" aria-label="Live edit"><b><i class="bi bi-pencil-square"></i> Live edit</b><span>Click any dotted text to edit. Saves automatically.</span><a href="admin/content.html">Admin panel</a><a href="'+location.pathname.split('/').pop()+'" class="ex">Exit</a></div>');
 document.addEventListener('click',e=>{if(e.target.closest('.edbar'))return;if(e.target.closest('[data-t]')){e.preventDefault();e.stopPropagation();return}const a=e.target.closest('a[href]');if(a){const h=a.getAttribute('href');if(h&&!/^(https?:|mailto:|tel:|#|admin\/)/.test(h)&&!/edit=1/.test(h)){e.preventDefault();const [u,hash]=h.split('#');location.href=u+(u.includes('?')?'&':'?')+'edit=1'+(hash?'#'+hash:'')}}},true);
 document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.closest?.('[data-t]')){e.preventDefault();e.target.blur()}});
 document.addEventListener('focusout',e=>{const el=e.target.closest?.('[data-t]');if(!el)return;const v=el.textContent.trim(),c=Content.get(),t={...(c.t||{})};if(t[el.dataset.t]===v||(t[el.dataset.t]===undefined&&v===TXT[el.dataset.t].def))return;t[el.dataset.t]=v;Content.save({t});UI.toast('Saved ✓')});
 $$('.rv,.imgrv').forEach(x=>x.classList.add('in'))}
function init(){dust();hero();cuts();floats();foot();edit();UI.reveal()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
