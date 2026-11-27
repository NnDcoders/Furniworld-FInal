/* Furniworld shared helpers + data gateway (see DB below). */
const $=(s,o=document)=>o.querySelector(s),$$=(s,o=document)=>[...o.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const fdate=d=>new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
/* ==========================================================================
   DATA LAYER — intentionally empty.
   The old browser-storage (localStorage) database and demo seed data were removed.
   Every read/write in the site goes through these 6 methods, so this is the ONLY place
   where the PHP/MySQL connection has to be attached.

   Collections used by the site:
   products, categories, orders, customers, inquiries, careers, vendors, feedback,
   gallery, projects, services, team, newsletter, content (object), settings (object), cart, user
   ========================================================================== */
const DB={
 /* TODO PHP: load a collection (list) or an object (content/settings). `f` is the fallback value. */
 getData(c,f=[]){return f},
 /* TODO PHP: save a whole collection/object. */
 saveData(c,d){return d},
 /* TODO PHP: INSERT a row and return it WITH the id/createdAt that the database created. */
 addItem(c,item){return item},
 /* TODO PHP: UPDATE a row by id and return the updated row. */
 updateItem(c,id,patch){return null},
 /* TODO PHP: DELETE a row by id. */
 deleteItem(c,id){},
 /* TODO PHP: SELECT one row by id. */
 getItemById(c,id){return undefined}
};
const Cats={all:()=>DB.getData('categories').slice().sort((a,b)=>(a.order===0||a.order==='0'||+a.order?+a.order:99)-(b.order===0||b.order==='0'||+b.order?+b.order:99)),subs:c=>Array.isArray(c&&c.subcategories)?c.subcategories:[],
 /* hierarchy: a category with parent:'Home Furniture' is a child (room) of Home Furniture */
 isChild:c=>!!(c&&c.parent&&DB.getData('categories').some(x=>x.name===c.parent)),top:()=>Cats.all().filter(c=>!Cats.isChild(c)),kids:n=>Cats.all().filter(c=>c.parent===n),isParent:c=>Cats.kids(c.name).length>0,leaf:()=>Cats.all().filter(c=>!Cats.isParent(c)),names:n=>[n,...Cats.kids(n).map(k=>k.name)],img:(c,e)=>`<img src="${e(c.image)}" alt="${e(c.name)}" loading="lazy" onerror="this.onerror=null;this.src='${e(c.fallback||'assets/images/categories/living-room.svg')}'">`};
const Shop={
 sale:p=>p.discountPrice&&p.discountPrice<p.price?p.discountPrice:p.price,
 pct:p=>Shop.sale(p)<p.price?Math.round((1-Shop.sale(p)/p.price)*100):0,
 active:()=>DB.getData('products').filter(p=>p.status==='Active'),
 /* cart entries: {k:lineKey,id,qty,sel:{option:choice},size:{l,w,h}|null,note} — one line per product + chosen options */
 cart:()=>DB.getData('cart').map(c=>c.k?c:{...c,k:c.id,sel:c.sel||{},size:null,note:''}),
 /* each line carries its own unit prices (base + chosen options) */
 lines(){const ps=DB.getData('products');return Shop.cart().map(c=>{const p=ps.find(p=>p.id===c.id);if(!p)return null;const u=Opts.unit(p,c);return{k:c.k,p,qty:c.qty,sel:c.sel||{},size:c.size||null,note:c.note||'',unitSale:u.sale,unitMrp:u.mrp,opt:Opts.text(p,c)}}).filter(Boolean)},
 totals(lines){const S=DB.getData('settings',{});const sub=lines.reduce((a,l)=>a+l.unitMrp*l.qty,0),tot=lines.reduce((a,l)=>a+l.unitSale*l.qty,0);const ship=!lines.length||tot>=(S.freeShippingAbove||50000)?0:(S.shippingFlat||1500);return{sub,disc:sub-tot,ship,total:tot+ship,tax:Math.round(tot*(S.taxPercent||18)/(100+(S.taxPercent||18)))}},
 /* add a configured product. cfg = {sel,size,note}; with no cfg the default options are used */
 add(id,q=1,cfg){const p=DB.getItemById('products',id);if(!p)return false;const c=Shop.cart(),line={sel:cfg?.sel||Opts.defSel(p),size:cfg?.size||null,note:(cfg?.note||'').trim().slice(0,300)},k=Opts.key(id,line),x=c.find(i=>i.k===k);
  const inCart=c.filter(i=>i.id===id&&i.k!==k).reduce((a,i)=>a+i.qty,0),max=Math.max(0,(p.quantity||0)-inCart);
  if(x)x.qty=Math.min(x.qty+q,max||99);else c.push({k,id,qty:Math.min(q,max||99),...line});DB.saveData('cart',c);UI.cartBadge();return true},
 setQty(k,q){let c=Shop.cart();if(q<=0)c=c.filter(i=>i.k!==k);else{const x=c.find(i=>i.k===k);if(x){const p=DB.getItemById('products',x.id),other=c.filter(i=>i.id===x.id&&i.k!==k).reduce((a,i)=>a+i.qty,0);x.qty=Math.min(q,Math.max(1,(p?.quantity||99)-other))}}DB.saveData('cart',c);UI.cartBadge()}
};
/* ---------- Media API: validation of images chosen by the admin ----------
   Rules: direct file upload only (no URLs), JPG/PNG/WebP/SVG, max 2 MB. */
const Media={
 MAX:2*1024*1024,
 TYPES:['image/jpeg','image/png','image/webp','image/svg+xml'],
 LABEL:'JPG, PNG, WebP or SVG · max 2 MB',
 fmt:b=>b>=1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB',
 /* validate a File object before reading it */
 check(f){
  if(!f||typeof f.size!=='number')return{ok:false,reason:'No file selected.'};
  const t=(f.type||'').toLowerCase(),named=/\.(jpe?g|png|webp|svg)$/i.test(f.name||''),nm='"'+(f.name||'file')+'"';
  if(!(Media.TYPES.includes(t)||(!t&&named)))return{ok:false,reason:nm+' is not a supported image. Use JPG, PNG, WebP or SVG.'};
  if(f.size===0)return{ok:false,reason:nm+' is empty.'};
  if(f.size>Media.MAX)return{ok:false,reason:nm+' is '+Media.fmt(f.size)+'. Images must be 2 MB or smaller.'};
  return{ok:true}},
 /* an image reference is allowed only if it is an uploaded data: image or one of the site's own assets/ files — or an https://images.unsplash.com photo link — no other web links */
 isAllowedSrc:s=>s==null||s===''||/^data:image\/(jpeg|png|webp|svg\+xml);base64,/i.test(s)||/^assets\/[\w\-\/.]+$/.test(s)||/^https:\/\/images\.unsplash\.com\/[\w\-\/.?=&%]+$/.test(s),
 sanitize:s=>Media.isAllowedSrc(s)?(s||''):'',
 /* TODO PHP: upload the file to the server (e.g. api/upload.php) and resolve with the stored path, e.g. 'assets/uploads/xyz.jpg'. */
 process(file){return new Promise((res,rej)=>{const c=Media.check(file);if(!c.ok)return rej(new Error(c.reason));rej(new Error('Image upload is not connected yet (PHP upload endpoint needed).'))})}
};
