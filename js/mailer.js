/* ==========================================================================
   Furniworld — Mailer
   Sends every website form to the correct company mailbox through api/send-mail.php:

     Contact – product / order / custom / interior / service  -> sales@     (copy: info@)
     Contact – complaint, Feedback                            -> cc@        (copy: info@)
     Contact – general / other, Newsletter                    -> info@
     Vendor registration                                      -> purchase@  (copy: info@)
     Careers (resume attached)                                -> hr@        (copy: info@)
     Cash-on-delivery orders                                  -> sales@     (copy: info@) + confirmation to the customer

   If the server script is not reachable (e.g. site opened as plain files, or hosting without PHP),
   the visitor's own e-mail app opens with the message pre-filled for the right mailbox so nothing is lost.
   ========================================================================== */
const Mailer=(()=>{
 const S=()=>window.SITE||{emails:{info:'info@furniworld.co.in'},mailRoutes:{}};
 const box=r=>{const m=S().mailRoutes[r]||'info';return S().emails[m]||S().emails.info};
 const lines=rows=>rows.filter(r=>r.v!==''&&r.v!=null).map(r=>r.l+': '+r.v).join('\n');
 /* map the Contact form "category" dropdown to a route */
 const routeFor=cat=>{const c=String(cat||'').toLowerCase();if(/product/.test(c))return'product';if(/order/.test(c))return'order';if(/custom/.test(c))return'custom';if(/interior/.test(c))return'interior';if(/complaint/.test(c))return'complaint';return'general'};
 const timeout=(ms)=>{const c=new AbortController();setTimeout(()=>c.abort(),ms);return c.signal};
 async function post(fd){
  const r=await fetch(S().mailApi||'api/send-mail.php',{method:'POST',body:fd,signal:timeout(20000),headers:{'Accept':'application/json'}});
  let j=null;try{j=await r.json()}catch(e){}
  if(!r.ok||!j||!j.ok)throw new Error((j&&j.error)||('Mail server answered '+r.status));
  return j}
 /* opts: {route, subject, rows:[{l,v}], replyTo, name, form (for attachments), customer:{email,name,subject,intro}} */
 async function send(o){
  const fd=new FormData();fd.append('route',o.route);fd.append('subject',o.subject);fd.append('rows',JSON.stringify(o.rows));fd.append('replyTo',o.replyTo||'');fd.append('name',o.name||'');fd.append('page',location.pathname.split('/').pop()||'index.html');fd.append('_hp','');
  if(o.customer)fd.append('customer',JSON.stringify(o.customer));
  if(o.form)[...o.form.querySelectorAll('input[type=file]')].forEach(i=>{if(i.files[0])fd.append('files[]',i.files[0],i.files[0].name)});
  if(location.protocol==='file:')return o.noFallback?{ok:false,via:'none'}:fallback(o,'This site is opened from a file, not a web server.');
  try{await post(fd);return{ok:true,via:'server',to:box(o.route)}}
  catch(e){console.warn('[Mailer] server send failed:',e.message);return o.noFallback?{ok:false,via:'none',why:e.message}:fallback(o,e.message)}}
 /* open the visitor's mail app, pre-filled */
 function fallback(o,why){
  const to=box(o.route),cc=S().emails.info,body=lines(o.rows)+(o.form&&[...o.form.querySelectorAll('input[type=file]')].some(i=>i.files[0])?'\n\n(Please attach your file to this e-mail before sending.)':'');
  const href='mailto:'+to+'?'+(cc&&cc!==to?'cc='+encodeURIComponent(cc)+'&':'')+'subject='+encodeURIComponent(o.subject)+'&body='+encodeURIComponent(body.slice(0,1800));
  try{location.href=href}catch(e){}
  return{ok:false,via:'mailto',to,why}}
 return{send,routeFor,box,lines,whatsapp:(text)=>'https://wa.me/'+S().whatsapp+'?text='+encodeURIComponent(text)}})();
