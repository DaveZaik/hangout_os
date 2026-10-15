/* ---- config: Cloudflare R2 (S3-compatible) handles photo/video storage; MongoDB stores everything else ---- */
const ASSETS={wallpapers:{/* name:'url(img/wallpapers/name.jpg)' — see img/README.md */}};
const WP={peach:'linear-gradient(135deg,#e3c2b3,#b69a9f)',dusk:'linear-gradient(160deg,#355c7d,#6c5b7b 55%,#c06c84)',lilac:'linear-gradient(135deg,#cdb4db,#a2d2ff)',moss:'linear-gradient(160deg,#b7c9a8,#4f7942)',ember:'linear-gradient(160deg,#ffb26b,#e4572e 60%,#5b2a3f)',night:'linear-gradient(160deg,#1b1f3b,#3b2f63 60%,#7a4f8f)'};
Object.assign(WP,ASSETS.wallpapers);
const ACC=['#e07a5f','#6a8caf','#8e7dbe','#5f9e6e','#d4a017','#c95d8a'],EMO=['😎','🙂','🤠','🦊','🐱','🐸','👾','🌸','🔥','🎧','⚡','🍕'],NC=['#ffe58f','#ffc4b0','#c5e8c0','#bfe0ff'];
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const av=(a,n)=>/^(https?:|data:|img\/)/.test(a||'')?`<img src="${esc(a)}" alt="${esc((n||'?')[0])}" onerror="this.outerHTML='<b>'+this.alt+'</b>'">`:esc(a||(n||'🙂')[0]),hue=s=>[...s].reduce((a,c)=>a+c.charCodeAt(0),0)*7%360;
let tok=localStorage.tok,D={},page=0,L=[],G={},LOCAL=false;
/* ---- data layer: talks to /api (MongoDB). If no server is reachable it falls back to a localStorage demo so the app always works. ---- */
async function api(m,p,b){
 if(!LOCAL){const r=await fetch('/api/'+p,{method:m,headers:{'content-type':'application/json',authorization:'Bearer '+(tok||'')},body:b?JSON.stringify(b):undefined}).catch(()=>null),j=r&&await r.json().catch(()=>null);
  if(j){if(r.status===401&&p!=='login'){logout();throw new Error('auth')}if(!r.ok)throw new Error(j.e||'Error');return j}
  LOCAL=true;document.body.classList.add('local')}
 return mock(m,p,b)}
const MK='hos_db';
function mdb(){let d=JSON.parse(localStorage[MK]||'null');if(!d){d={users:SEED.users.map((u,i)=>({...u,id:'u'+i,pw:u.name.toLowerCase()})),hangouts:SEED.hangouts.map((h,i)=>({...h,_id:'h'+i})),notes:SEED.notes.map((n,i)=>({...n,_id:'n'+i,votes:[],by:''})),comments:[],messages:[]};localStorage[MK]=JSON.stringify(d)}return d}
async function mock(m,p,b={}){const d=mdb(),[x,i,sub]=p.split('/'),k=m+' '+x+(sub?'/'+sub:''),rid=()=>Math.random().toString(36).slice(2,10),ok=v=>{localStorage[MK]=JSON.stringify(d);return v},
 pub=u=>({id:u.id,name:u.name,avatar:u.avatar,wallpaper:u.wallpaper,accent:u.accent,admin:!!u.admin,jingle:u.jingle,ambient:u.ambient,volume:u.volume,clicks:u.clicks}),me=(tok||'').startsWith('local:')&&d.users.find(u=>u.id===tok.slice(6));
 if(k==='GET users')return d.users.map(pub);
 if(k==='POST login'){const u=d.users.find(u=>u.id===b.id);if(!u||u.pw!==String(b.password||''))throw new Error('Wrong password');return{token:'local:'+u.id,me:pub(u)}}
 if(!me){logout();throw new Error('auth')}
 if(k==='GET data')return{me:pub(me),users:d.users.map(pub),hangouts:[...d.hangouts].sort((a,b)=>(b.date||'').localeCompare(a.date||'')),notes:d.notes,comments:d.comments,messages:d.messages};
 if(k==='PUT me'){for(const f of['name','wallpaper','accent','avatar','jingle'])if(typeof b[f]==='string'&&b[f])me[f]=b[f];if(typeof b.ambient==='number')me.ambient=b.ambient;if(typeof b.volume==='number')me.volume=Math.max(0,Math.min(100,b.volume));if(typeof b.clicks==='number')me.clicks=b.clicks;if(b.password)me.pw=b.password;return ok({})}
 if(k==='POST notes'){d.notes.push({_id:rid(),kind:b.kind==='place'?'📍 Place':'🎯 Activity',text:b.text,votes:[me.id],by:me.id});return ok({})}
 if(k==='POST notes/vote'){const n=d.notes.find(n=>n._id===i);n.votes=n.votes.includes(me.id)?n.votes.filter(v=>v!==me.id):[...n.votes,me.id];return ok({})}
 if(k==='POST comments'){d.comments.push({_id:rid(),hangout:b.hangout,user:me.id,text:b.text,at:Date.now()});return ok({})}
 if(k==='DELETE comments'){const c=d.comments.find(c=>c._id===i);if(c&&(me.admin||c.user===me.id))d.comments=d.comments.filter(c=>c._id!==i);return ok({})}
 if(k==='GET messages')return d.messages.filter(x=>x.thread===(i==='all'?'all':me.admin?i:me.id));
 if(k==='POST messages'){d.messages.push({_id:rid(),thread:i==='all'?'all':me.admin?i:me.id,from:me.id,text:b.text,at:Date.now()});return ok({})}
 if(!me.admin)throw new Error('admin only');
 if(k==='POST hangouts'){const _id=rid();d.hangouts.push({_id,...b});return ok({id:_id})}
 if(k==='PUT hangouts'){Object.assign(d.hangouts.find(h=>h._id===i),b);return ok({})}
 if(k==='DELETE hangouts'){d.hangouts=d.hangouts.filter(h=>h._id!==i);return ok({})}
 if(k==='DELETE notes'){d.notes=d.notes.filter(n=>n._id!==i);return ok({})}
 if(k==='POST users'){d.users.push({id:rid(),name:b.name,avatar:b.avatar||'🙂',wallpaper:'peach',accent:'#e07a5f',pw:b.password||b.name.toLowerCase(),jingle:'none',ambient:0,volume:50,clicks:0});return ok({})}
 if(k==='PUT users'){d.users.find(u=>u.id===i).pw=b.password;return ok({})}
 if(k==='DELETE users'){d.users=d.users.filter(u=>u.id!==i||i===me.id);return ok({})}
 throw new Error('not found')}
const shrink=(f,max)=>new Promise((res,rej)=>{const i=new Image,u=URL.createObjectURL(f);i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);URL.revokeObjectURL(u);
 let q=.8,o;do{o=c.toDataURL(max<=256?'image/png':'image/jpeg',q);q-=.15}while(o.length>350000&&q>.2);res(o)};i.onerror=()=>rej(new Error('Could not read that image'));i.src=u});
async function up(f,max=1280,uploadType='avatar'){
 try{const r=await fetch('/api/upload-url',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+tok},body:JSON.stringify({contentType:f.type,size:f.size,type:uploadType})});
  if(!r.ok)throw new Error('R2 not configured or upload denied');
  const{presignedPutUrl,publicUrl}=await r.json();
  const u=await fetch(presignedPutUrl,{method:'PUT',headers:{'Content-Type':f.type},body:f});
  if(!u.ok)throw new Error('Upload to R2 failed');
  return{url:publicUrl,video:f.type.startsWith('video')?1:0,caption:f.name.replace(/\.\w+$/,'')}}
 catch(e){if(f.type.startsWith('image'))return{url:await shrink(f,max),video:0,caption:f.name.replace(/\.\w+$/,'')};
  if(f.size>1.5e6)throw new Error('File too big for demo mode — set up R2 environment variables.');
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res({url:r.result,video:f.type.startsWith('video')?1:0,caption:f.name.replace(/\.\w+$/,'')});r.onerror=rej;r.readAsDataURL(f)})}}
const logout=()=>{localStorage.removeItem('tok');location.reload()};
const load=async()=>{D=await api('GET','data')};

/* ---- pixel art icons ---- */
const art=(rows,pal)=>`<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${rows.map((r,y)=>[...r].map((c,x)=>pal[c]?`<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>`:'').join('')).join('')}</svg>`;
const FOLDER=['.kkkkkk.........','kaaaaaak........','kaaaaaakkkkkkkk.','kabbbbbbbbbbbbak','kabbbbbbbbbbbbak','kabbbbbbbbbbbbak','kabbbbbbbbbbbbak','kabbbbbbbbbbbbak','kabbbbbbbbbbbbak','kaaaaaaaaaaaaaak','kkkkkkkkkkkkkkkk'];
const BOARD=['kkkkkkkkkkkkkk','kaaaaaaaaaaaak','kayyyaaappppak','kayyyaaappppak','kayyyaaappppak','kaaaaaaaaaaaak','kagggggaaabbak','kagggggaaabbak','kagggggaaabbak','kaaaaaaaaaaaak','kkkkkkkkkkkkkk'];
const CHAT=['..kkkkkkkkkk..','.kaaaaaaaaaak.','kaaaaaaaaaaaak','kaakaakaakaaak','kaaaaaaaaaaaak','.kaaaaaaaaaak.','..kkkkkaakkk..','.....kaak.....','......kk......'];
const K='#241a18',SYS={
 pics:{l:'Pictures',img:art(FOLDER,{k:K,a:'#4aa3e8',b:'#9bd8ff'}),open:()=>folder(0)},
 vids:{l:'Videos',img:art(FOLDER,{k:K,a:'#ee7b4d',b:'#ffc4a3'}),open:()=>folder(1)},
 board:{l:'Ideas',img:art(BOARD,{k:K,a:'#d8a56a',y:'#ffe58f',p:'#ffb3a0',g:'#b8e3a8',b:'#a8d4ff'}),open:()=>board()},
 chat:{l:'Chat',img:art(CHAT,{k:K,a:'#fff'}),open:()=>chat()},
 get me(){return{l:'Profile',img:`<div class="tl" style="background:#fff">${av(D.me.avatar,D.me.name)}</div>`,open:()=>profile()}}};
const thumb=h=>{const m=h.media.find(m=>m.url&&!m.video);return m?`<img src="${esc(m.url)}">`:`<div class="tl" style="background:hsl(${hue(h.title)} 55% 62%)">${esc(h.emoji)}</div>`};
const info=id=>id[0]==='s'?SYS[id.slice(2)]:(h=>h&&{l:h.title,img:thumb(h),open:()=>hangout(h._id)})(D.hangouts.find(x=>x._id===id.slice(2)));

/* ---- procedural scatter + automatic pages ---- */
function grid(){const W=innerWidth,Hh=innerHeight,m=W<700,top=m?72:80,bot=66,cs=m?106:132,cols=Math.max(2,W/cs|0),rows=Math.max(2,(Hh-top-bot)/cs|0);
 G={cs,cols,rows,cap:Math.max(3,Math.min(m?9:12,Math.floor(cols*rows*.7))),ox:(W-cols*cs)/2,oy:top+(Hh-top-bot-rows*cs)/2};G.key=[cols,rows,G.cap].join()}
function put(id){let p=L.find(p=>p.n.length<G.cap);if(!p)L.push(p={n:[]});const u=new Set(p.n.map(n=>n.c));let c;do c=Math.random()*G.cols*G.rows|0;while(u.has(c));
 p.n.push({id,c,x:G.ox+(c%G.cols)*G.cs+Math.random()*(G.cs-96),y:G.oy+Math.floor(c/G.cols)*G.cs+Math.random()*(G.cs-100),r:Math.random()*6-3})}
function sync(){const want=[...Object.keys(SYS).map(k=>'s:'+k),...D.hangouts.map(h=>'h:'+h._id)];
 L.forEach(p=>p.n=p.n.filter(n=>want.includes(n.id)));const have=L.flatMap(p=>p.n.map(n=>n.id));want.filter(i=>!have.includes(i)).forEach(put);L=L.filter(p=>p.n.length);page=Math.min(page,L.length-1)}
function draw(){const box=$('#icons');box.innerHTML='';L[page].n.forEach((n,i)=>{const f=info(n.id);if(!f)return;const e=document.createElement('div');e.className='ic';
 e.style.cssText=`left:${n.x}px;top:${n.y}px;transform:rotate(${n.r}deg);animation-delay:${i*45}ms`;e.innerHTML=`<div class="im">${f.img}</div><span>${esc(f.l)}</span>`;e.onclick=f.open;box.appendChild(e)});
 $('#pg').textContent=`${page+1}/${L.length}`}
const go=d=>{page=(page+d+L.length)%L.length;draw()};
const pageOf=id=>{const i=L.findIndex(p=>p.n.some(n=>n.id==='h:'+id));if(i>=0){page=i;draw()}};

/* ---- windows ---- */
const W={};let z=10;
function win(id,title,fn,keep){let w=W[id];
 if(!w){w=W[id]=document.createElement('div');w.className='win';w.innerHTML='<div class="tb"><b></b><i></i></div><div class="bd"></div>';const o=Object.keys(W).length%5*28;
  w.style.left=Math.max(8,innerWidth/2-280+o-40)+'px';w.style.top=90+o+'px';w.querySelector('b').textContent=title;$('#wins').appendChild(w);
  w.querySelector('i').onclick=()=>shut(id);w.onpointerdown=()=>w.style.zIndex=++z;
  const t=w.querySelector('.tb');t.onpointerdown=e=>{if(innerWidth<700||e.target.tagName==='I')return;const ox=e.clientX-w.offsetLeft,oy=e.clientY-w.offsetTop;t.setPointerCapture(e.pointerId);
   t.onpointermove=e=>{w.style.left=e.clientX-ox+'px';w.style.top=Math.max(0,e.clientY-oy)+'px'};t.onpointerup=()=>t.onpointermove=null}}
 w._f=fn;w._k=keep;w.style.zIndex=++z;fn(w.querySelector('.bd'))}
const shut=id=>{W[id]?.remove();delete W[id]};
const refresh=()=>Object.values(W).forEach(w=>{if(!w._k)w._f(w.querySelector('.bd'))});
async function reload(){await load();sync();draw();refresh();theme()}
const act=async f=>{try{await f();await reload()}catch(e){alert(e.message)}};

/* ---- viewers ---- */
const tile=(h,i,cap)=>{const m=h.media[i];return `<div class="tile" data-h="${h._id}" data-i="${i}" style="background:hsl(${hue(h.title)+i*30} 55% 62%)">${m.url?(m.video?`<video src="${esc(m.url)}#t=0.1" preload="metadata" muted></video><span class="pl">▶</span>`:`<img loading="lazy" src="${esc(m.url)}">`):esc(m.e||'🖼️')}<div class="cp">${esc(cap??m.caption)}</div></div>`};
const wire=bd=>bd.querySelectorAll('.tile').forEach(t=>t.onclick=()=>view(D.hangouts.find(x=>x._id===t.dataset.h),+t.dataset.i));
function view(h,i){const m=h.media[i],v=$('#vw');
 v.innerHTML=`<div class="vc">${m.url?(m.video?`<video src="${esc(m.url)}" controls autoplay playsinline></video>`:`<img src="${esc(m.url)}">`):`<div class="big" style="background:hsl(${hue(h.title)+i*30} 55% 62%)">${esc(m.e||'🖼️')}</div>`}</div>
 <div>${esc(m.caption||'')} — ${esc(h.title)}</div><div><button class="btn" id="v1">Open hangout</button> ${D.me.admin?'<button class="btn" id="v2">Remove</button> ':''}<button class="btn p" id="v3">Close</button></div>`;
 v.style.display='flex';const close=()=>{v.style.display='none';v.innerHTML=''};v.onclick=e=>{if(e.target===v)close()};
 $('#v3').onclick=close;$('#v1').onclick=()=>{close();hangout(h._id)};
 if(D.me.admin)$('#v2').onclick=()=>{if(confirm('Remove this item?')){close();act(()=>api('PUT','hangouts/'+h._id,{...h,media:h.media.filter((_,j)=>j!==i)}))}}}

/* ---- apps ---- */
function hangout(id){win('h'+id,(D.hangouts.find(x=>x._id===id)||{}).title||'',bd=>{const h=D.hangouts.find(x=>x._id===id);if(!h)return shut('h'+id);
 const cs=(D.comments||[]).filter(c=>c.hangout===id).sort((a,b)=>a.at-b.at),un=u=>D.users.find(x=>x.id===u)||{name:'?'};
 bd.innerHTML=`<div style="font-size:34px">${esc(h.emoji)}</div><div class="meta">${esc(h.date)}${h.place?' · 📍 '+esc(h.place):''}${h.who?' · '+esc(h.who):''}</div><p class="story">${esc(h.story)}</p>
 <h4>GALLERY (${h.media.length})</h4><div class="grid">${h.media.map((_,i)=>tile(h,i)).join('')||'<i>Nothing here yet.</i>'}</div>
 <h4>COMMENTS (${cs.length})</h4>${cs.map(c=>`<div class="cm"><div class="av sm">${av(un(c.user).avatar,un(c.user).name)}</div><div style="flex:1"><b>${esc(un(c.user).name)}</b> <small>${new Date(c.at).toLocaleDateString()}</small><div>${esc(c.text)}</div></div>${c.user===D.me.id||D.me.admin?`<span class="x" data-cd="${c._id}">✕</span>`:''}</div>`).join('')}
 <div class="row" style="margin-top:10px"><input id="ci" placeholder="What did you think of this one?"><button class="btn p" id="cp">Post</button></div>
 ${D.me.admin?`<p style="margin-top:14px"><button class="btn" id="he">Edit</button> <label class="btn p">+ Upload<input hidden type="file" multiple accept="image/*,video/*"></label> <button class="btn" id="hd">Delete</button></p>`:''}`;
 wire(bd);const post=()=>{const t=bd.querySelector('#ci').value.trim();if(t)act(()=>api('POST','comments',{hangout:id,text:t}))};
 bd.querySelector('#cp').onclick=post;bd.querySelector('#ci').onkeydown=e=>{if(e.key==='Enter')post()};
 bd.querySelectorAll('[data-cd]').forEach(x=>x.onclick=()=>act(()=>api('DELETE','comments/'+x.dataset.cd)));
 if(!D.me.admin)return;bd.querySelector('#he').onclick=()=>form(h);
 bd.querySelector('#hd').onclick=()=>{if(confirm('Delete this hangout?'))act(()=>api('DELETE','hangouts/'+id))};
 bd.querySelector('input[type=file]').onchange=e=>act(async()=>{const media=[...h.media];for(const f of e.target.files)media.push(await up(f,1280,'hangout'));await api('PUT','hangouts/'+id,{...h,media})})})}
function folder(v){win('f'+v,v?'Videos':'Pictures',bd=>{const a=D.hangouts.flatMap(h=>h.media.map((m,i)=>({h,i,m}))).filter(x=>!!x.m.video===!!v);
 bd.innerHTML=`<div class="meta">${a.length} item${a.length==1?'':'s'} from all hangouts</div><div class="grid" style="margin-top:10px">${a.map(x=>tile(x.h,x.i,x.h.title)).join('')}</div>`;wire(bd)})}
function board(){win('board','Ideas',bd=>{const by=id=>(D.users.find(u=>u.id===id)||{}).name||'';
 bd.innerHTML=`<div class="row"><select id="bk" style="width:auto;margin:0"><option value="place">📍 Place</option><option value="act">🎯 Activity</option></select><input id="bn" placeholder="Pitch a place or hangout idea…"><button class="btn p" id="ba">Pin</button></div>
 <div class="notes">${[...D.notes].sort((a,b)=>b.votes.length-a.votes.length).map((n,i)=>`<div class="note" style="background:${NC[i%4]};--r:${(i%3-1)*1.5}deg"><small>${esc(n.kind)} ${by(n.by)?'· '+esc(by(n.by)):''}</small><div>${esc(n.text)}</div><button class="btn" data-v="${n._id}">▲ ${n.votes.length}${n.votes.includes(D.me.id)?' ✓':''}</button>${D.me.admin?`<b data-d="${n._id}">✕</b>`:''}</div>`).join('')}</div>`;
 const add=()=>{const t=bd.querySelector('#bn').value.trim();if(t)act(()=>api('POST','notes',{kind:bd.querySelector('#bk').value,text:t}))};
 bd.querySelector('#ba').onclick=add;bd.querySelector('#bn').onkeydown=e=>{if(e.key==='Enter')add()};
 bd.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>act(()=>api('POST','notes/'+b.dataset.v+'/vote')));
 bd.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>act(()=>api('DELETE','notes/'+b.dataset.d)))})}
/* ---- audio system ---- */
let audioCtx,ambientOsc,ambientGain,jingleSrc;
const JINGLE_PRESETS={chime:()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(523.25,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(1046.5,audioCtx.currentTime+0.1);g.gain.setValueAtTime(0.3,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.3);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.3)},
ding:()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='triangle';o.frequency.setValueAtTime(880,audioCtx.currentTime);g.gain.setValueAtTime(0.2,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.2);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.2)},
bloop:()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.setValueAtTime(400,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(600,audioCtx.currentTime+0.05);g.gain.setValueAtTime(0.25,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.15);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.15)},
retro:()=>{const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='square';o.frequency.setValueAtTime(220,audioCtx.currentTime);o.frequency.setValueAtTime(440,audioCtx.currentTime+0.1);g.gain.setValueAtTime(0.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(0.01,audioCtx.currentTime+0.2);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.2)}};
function playJingle(name){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(D.me.jingle&&D.me.jingle.startsWith('data:')){const a=new Audio(D.me.jingle);a.volume=(D.me.volume||50)/100;a.play();return}if(JINGLE_PRESETS[name])JINGLE_PRESETS[name]()}
function startAmbient(){if(!D.me.ambient||ambientOsc)return;if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();ambientOsc=audioCtx.createOscillator();ambientGain=audioCtx.createGain();ambientOsc.type='sine';ambientOsc.frequency.setValueAtTime(110,audioCtx.currentTime);ambientGain.gain.setValueAtTime(0,(D.me.volume||50)/200);ambientOsc.connect(ambientGain);ambientGain.connect(audioCtx.destination);ambientOsc.start()}
function stopAmbient(){if(ambientOsc){ambientOsc.stop();ambientOsc=null}}
function playClick(){if(!D.me.clicks)return;if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='square';o.frequency.setValueAtTime(800,audioCtx.currentTime);g.gain.setValueAtTime(0.05,(D.me.volume||50)/100);g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.03);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.03)}
document.addEventListener('click',()=>{if(D.me.clicks)playClick()},{passive:true});

/* Profile = list of sections. To add a new editable thing later, push another {t,html,bind} here. */
const PROFILE=[
 {t:'Account',html:m=>`<input id="pn" placeholder="Display name" value="${esc(m.name)}"><input id="pp" type="password" placeholder="New password (blank = keep)"><button class="btn p" id="ps">Save</button>`,
  bind:(bd,pref)=>bd.querySelector('#ps').onclick=()=>{const p={name:bd.querySelector('#pn').value.trim()},w=bd.querySelector('#pp').value;if(w)p.password=w;pref(p)}},
 {t:'Profile icon',html:()=>`${EMO.map(e=>`<span class="sw" data-e="${e}" style="display:inline-flex;align-items:center;justify-content:center;font-size:26px;background:#fff">${e}</span>`).join('')}<br><label class="btn">Upload photo<input hidden id="au" type="file" accept="image/*"></label>`,
  bind:(bd,pref)=>{bd.querySelectorAll('[data-e]').forEach(s=>s.onclick=()=>pref({avatar:s.dataset.e}));bd.querySelector('#au').onchange=e=>act(async()=>{const r=await up(e.target.files[0],160);await api('PUT','me',{avatar:r.url})})}},
 {t:'Avatar builder',html:()=>{const skin=['#ffe58f','#ffc4b0','#c5e8c0','#bfe0ff','#d4a017','#e07a5f'],hair=['none','short','spiky','long','bowl','mohawk'],hairCol=['#241a18','#5a4a42','#8b4513','#d4a017','#e07a5f','#6a8caf'],shirt=['#e07a5f','#6a8caf','#8e7dbe','#5f9e6e','#d4a017','#c95d8a'],acc=['none','glasses','hat','bowtie'];
  return`<div id="avp" style="background:#f5f5f5;padding:10px;border-radius:8px;margin-bottom:10px">
  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">
  <select id="sk" style="width:auto">${skin.map(c=>`<option value="${c}">Skin</option>`).join('')}</select>
  <select id="hs" style="width:auto">${hair.map(h=>`<option value="${h}">${h}</option>`).join('')}</select>
  <select id="hc" style="width:auto">${hairCol.map(c=>`<option value="${c}">Hair color</option>`).join('')}</select>
  <select id="sc" style="width:auto">${shirt.map(c=>`<option value="${c}">Shirt</option>`).join('')}</select>
  <select id="ac" style="width:auto">${acc.map(a=>`<option value="${a}">${a}</option>`).join('')}</select>
  </div>
  <div id="avv" style="width:80px;height:80px;margin:0 auto"></div>
  </div>
  <button class="btn p" id="as">Save as avatar</button>`},
  bind:(bd,pref)=>{const draw=()=>{const s=bd.querySelector('#sk').value,h=bd.querySelector('#hs').value,hc=bd.querySelector('#hc').value,sc=bd.querySelector('#sc').value,a=bd.querySelector('#ac').value;
   const grid=[['.','.','.','.','.','.','.','.'],['.','.','F','F','F','F','.','.'],['.','.','F','F','F','F','.','.'],['.','.','E','E','E','E','.','.'],['.','.','E','E','E','E','.','.'],['.','.','S','S','S','S','.','.'],['.','.','S','S','S','S','.','.'],['.','.','.','.','.','.','.','.']];
   const pal={'.':null,F:s,E:h==='none'?s:hc,S:sc};
   if(h==='short'){grid[1][2]=grid[1][3]=grid[1][4]=grid[1][5]=hc;grid[2][2]=grid[2][5]=hc}
   if(h==='spiky'){grid[0][2]=grid[0][3]=grid[0][4]=grid[0][5]=hc;grid[1][1]=grid[1][6]=hc}
   if(h==='long'){grid[0][2]=grid[0][3]=grid[0][4]=grid[0][5]=hc;grid[1][1]=grid[1][6]=hc;grid[2][1]=grid[2][6]=hc;grid[3][1]=grid[3][6]=hc}
   if(h==='bowl'){grid[0][2]=grid[0][3]=grid[0][4]=grid[0][5]=hc;grid[1][1]=grid[1][2]=grid[1][3]=grid[1][4]=grid[1][5]=grid[1][6]=hc}
   if(h==='mohawk'){grid[0][3]=grid[0][4]=hc;grid[1][3]=grid[1][4]=hc;grid[2][3]=grid[2][4]=hc}
   if(a==='glasses'){grid[2][2]=grid[2][5]='#333';grid[2][3]=grid[2][4]='#333'}
   if(a==='hat'){grid[0][2]=grid[0][3]=grid[0][4]=grid[0][5]='#5a4a42';grid[1][2]=grid[1][5]='#5a4a42'}
   if(a==='bowtie'){grid[4][3]=grid[4][4]='#e07a5f'}
   bd.querySelector('#avv').innerHTML=art(grid,pal)};
  bd.querySelectorAll('select').forEach(s=>s.onchange=draw);draw();
  bd.querySelector('#as').onclick=()=>{const svg=bd.querySelector('#avv').querySelector('svg');svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
   const data='data:image/svg+xml;base64,'+btoa(svg.outerHTML);act(async()=>{await api('PUT','me',{avatar:data})})}}},
 {t:'Desktop',html:m=>`${Object.keys(WP).map(k=>`<span class="sw ${m.wallpaper===k?'on':''}" data-w="${k}" style="background:${WP[k]}"></span>`).join('')}<br><label class="btn">Upload wallpaper<input hidden id="wu" type="file" accept="image/*"></label><div style="margin-top:10px">${ACC.map(c=>`<span class="sw ${m.accent===c?'on':''}" data-c="${c}" style="background:${c}"></span>`).join('')}</div>`,
  bind:(bd,pref)=>{bd.querySelectorAll('[data-w]').forEach(s=>s.onclick=()=>pref({wallpaper:s.dataset.w}));bd.querySelectorAll('[data-c]').forEach(s=>s.onclick=()=>pref({accent:s.dataset.c}));
   bd.querySelector('#wu').onchange=e=>act(async()=>{const r=await up(e.target.files[0]);await api('PUT','me',{wallpaper:r.url})})}},
 {t:'Sounds',html:m=>{const j=['chime','ding','bloop','retro','none'],jm=m.jingle||'none';
  return`<h5>Login jingle</h5><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">${j.map(n=>`<button class="sw ${jm===n?'on':''}" data-j="${n}" style="padding:6px 12px">${n.charAt(0).toUpperCase()+n.slice(1)}</button>`).join('')}</div>
  <label class="btn p">Upload custom jingle (max 10s)<input hidden id="ju" type="file" accept="audio/*"></label>
  <h5 style="margin-top:15px">Ambient music</h5><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="am" ${m.ambient?'checked':''}> Enable ambient music</label>
  <div style="margin-top:8px"><label>Volume: <input type="range" id="vl" min="0" max="100" value="${m.volume||50}"></label></div>
  <h5 style="margin-top:15px">Click sounds</h5><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="cs" ${m.clicks?'checked':''}> Enable click sounds</label>`},
  bind:(bd,pref)=>{bd.querySelectorAll('[data-j]').forEach(s=>s.onclick=()=>{pref({jingle:s.dataset.j});if(s.dataset.j!=='none')playJingle(s.dataset.j)});
  bd.querySelector('#ju').onchange=e=>act(async()=>{const f=e.target.files[0];if(f.size>500000)throw new Error('Audio too large (max 10s)');const r=await up(f,0,'jingle');await api('PUT','me',{jingle:r.url})});
  bd.querySelector('#am').onchange=e=>pref({ambient:e.target.checked?1:0});
  bd.querySelector('#vl').oninput=e=>pref({volume:+e.target.value});
  bd.querySelector('#cs').onchange=e=>pref({clicks:e.target.checked?1:0})}}];
function profile(){win('me','Profile',bd=>{const pref=p=>act(()=>api('PUT','me',p));
 bd.innerHTML=PROFILE.map(s=>`<h4>${s.t.toUpperCase()}</h4>${s.html(D.me)}`).join('');PROFILE.forEach(s=>s.bind(bd,pref))})}
function chat(){const adm=D.me.admin,boss=D.users.find(u=>u.admin)||{name:'admin'};win('chat','Chat',bd=>{
 let th='all';
 const opts=[['all','📢 Everyone (group chat)'],...(adm?D.users.filter(u=>!u.admin).map(u=>[u.id,'💬 Private: '+u.name]):[[D.me.id,'💬 Private with '+boss.name]])];
 bd.innerHTML=`<select id="ct">${opts.map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select><div class="meta" id="cn"></div><div class="cl" id="cl"></div><div class="row"><input id="cx" placeholder="Message…"><button class="btn p" id="cb">Send</button></div>`;
 const note=()=>bd.querySelector('#cn').textContent=th==='all'?'Everyone in the group can see this chat.':adm?'Only you and this member can see this.':`Only you and ${boss.name} can see this. Ask for changes, report bugs, pitch features.`;
 const paint=async()=>{if(!W.chat)return;const ms=await api('GET','messages/'+th),cl=bd.querySelector('#cl'),end=cl.scrollTop+cl.clientHeight>=cl.scrollHeight-30;
  cl.innerHTML=ms.map(m=>`<div class="msg ${m.from===D.me.id?'me':''}"><small>${esc((D.users.find(u=>u.id===m.from)||{}).name||'')} · ${new Date(m.at).toLocaleString([],{dateStyle:'short',timeStyle:'short'})}</small>${esc(m.text)}</div>`).join('')||'<i>No messages yet.</i>';if(end)cl.scrollTop=cl.scrollHeight};
 const send=async()=>{const t=bd.querySelector('#cx').value.trim();if(!t)return;bd.querySelector('#cx').value='';try{await api('POST','messages/'+th,{text:t});paint()}catch(e){alert(e.message)}};
 bd.querySelector('#cb').onclick=send;bd.querySelector('#cx').onkeydown=e=>{if(e.key==='Enter')send()};
 bd.querySelector('#ct').onchange=e=>{th=e.target.value;note();paint()};
 note();paint();const t=setInterval(()=>W.chat?paint().catch(()=>{}):clearInterval(t),6000)},1)}
function admin(){win('admin','Admin',bd=>{
 bd.innerHTML=`<button class="btn p" id="hn">+ New hangout</button><h4>MEMBERS (${D.users.length})</h4>${D.users.map(u=>`<div class="row"><div class="av">${av(u.avatar,u.name)}</div><b style="flex:1">${esc(u.name)}</b>${u.id===D.me.id?'':`<button class="btn" data-r="${u.id}">Reset pw</button><button class="btn" data-x="${u.id}">Remove</button>`}</div>`).join('')}
 <h4>ADD MEMBER</h4><input id="un" placeholder="Name"><input id="up" placeholder="Password (blank = their name in lowercase)"><input id="ua" placeholder="Avatar emoji (optional)" maxlength="4"><button class="btn p" id="uc">Create member</button>`;
 bd.querySelector('#hn').onclick=()=>form();
 bd.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>confirm('Remove this member?')&&act(()=>api('DELETE','users/'+b.dataset.x)));
 bd.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{const u=D.users.find(x=>x.id===b.dataset.r);confirm(`Reset ${u.name}'s password to "${u.name.toLowerCase()}"?`)&&act(()=>api('PUT','users/'+u.id,{password:u.name.toLowerCase()}))});
 bd.querySelector('#uc').onclick=()=>act(async()=>{const n=bd.querySelector('#un').value.trim();if(!n)throw new Error('Name required');await api('POST','users',{name:n,password:bd.querySelector('#up').value,avatar:bd.querySelector('#ua').value.trim()})})})}
function form(h){const id='form'+(h?h._id:'');win(id,h?'Edit hangout':'New hangout',bd=>{
 bd.innerHTML=`<input id="ft" placeholder="Name (e.g. Karaoke Night)" value="${esc(h?.title)}"><input id="fd" type="date" value="${esc(h?.date)}"><input id="fp" placeholder="Place" value="${esc(h?.place)}"><input id="fw" placeholder="Who came" value="${esc(h?.who)}"><input id="fe" placeholder="Emoji" maxlength="4" value="${esc(h?.emoji)}"><textarea id="fs" rows="5" placeholder="What happened?">${esc(h?.story)}</textarea>
 <div class="meta">Photos & videos</div><input id="ff" type="file" multiple accept="image/*,video/*"><p id="fst"></p><button class="btn p" id="fsv">Save</button>`;
 bd.querySelector('#fsv').onclick=async e=>{const v=s=>bd.querySelector(s).value,st=bd.querySelector('#fst');if(!v('#ft').trim()){st.textContent='Give it a name';return}e.target.disabled=true;
  try{const media=[...(h?.media||[])],fl=[...bd.querySelector('#ff').files];for(let i=0;i<fl.length;i++){st.textContent=`Uploading ${i+1}/${fl.length}…`;media.push(await up(fl[i],1280,'hangout'))}
   const body={title:v('#ft'),date:v('#fd'),place:v('#fp'),who:v('#fw'),emoji:v('#fe')||'🖼️',story:v('#fs'),media},r=h?await api('PUT','hangouts/'+h._id,body):await api('POST','hangouts',body);
   shut(id);await reload();const nid=h?h._id:r.id;pageOf(nid);hangout(nid)}catch(x){st.textContent=x.message;e.target.disabled=false}}},1)}

/* ---- shell ---- */
function theme(){const m=D.me;document.documentElement.style.setProperty('--ac',m.accent);$('#desk').style.setProperty('--wp',WP[m.wallpaper]||`url("${m.wallpaper}")`);bar()}
function bar(){$('#me').innerHTML=av(D.me.avatar,D.me.name);$('#mn').textContent=D.me.name}
function start(){$('#login').hidden=true;$('#desk').hidden=false;theme();
 const P=[['home',()=>{Object.keys(W).forEach(shut);page=0;draw()}],['pictures',()=>folder(0)],['videos',()=>folder(1)],['ideas',board],['chat',chat],['profile',profile]];if(D.me.admin)P.push(['admin',admin]);
 $('#pills').innerHTML='';P.forEach(([n,f])=>{const b=document.createElement('button');b.className='pill';b.textContent=n;b.onclick=f;$('#pills').appendChild(b)});
 $('#me').onclick=profile;$('#pv').onclick=()=>go(-1);$('#nx').onclick=()=>go(1);$('#lo').onclick=logout;
 grid();L=[];sync();draw();
 let tx;$('#desk').ontouchstart=e=>tx=e.target.closest('.win,.pill')?null:e.touches[0].clientX;
 $('#desk').ontouchend=e=>{if(tx==null)return;const d=e.changedTouches[0].clientX-tx;if(Math.abs(d)>70)go(d<0?1:-1)};
 let t;onresize=()=>{clearTimeout(t);t=setTimeout(()=>{const k=G.key;grid();if(G.key!==k){L=[];sync();page=0}draw()},200)};
 const clk=()=>$('#clk').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});clk();setInterval(clk,30000)}
function ring(us){const n=us.length,step=360/n,R=Math.max(230,n*21),box=$('#ring'),wrap=$('#rw'),pwf=$('#pwf');let ang=0,sel=null,drag=null,idle=true;
 box.innerHTML=us.map((u,i)=>`<div class="rb" data-i="${i}" style="--a:${i*step}deg;--r:${R}px"><div class="bub">${av(u.avatar,u.name)}</div><div class="rn">${esc(u.name)}</div></div>`).join('');
 const items=[...box.children],rel=i=>{const a=((i*step+ang)%360+360)%360;return a>180?a-360:a},front=()=>((Math.round(-ang/step)%n)+n)%n;
 const paint=()=>{box.style.transform=`translateZ(${-R}px) rotateY(${ang}deg)`;items.forEach((e,i)=>{const r=rel(i);e.style.opacity=.3+.7*Math.max(0,Math.cos(r*Math.PI/180));e.classList.toggle('on',Math.abs(r)<step/2)})};
 const snap=t=>{box.style.transition='transform .6s cubic-bezier(.2,.8,.2,1)';ang=t;paint();setTimeout(()=>box.style.transition='',650)};
 const unpick=()=>{sel=null;pwf.hidden=true};
 const pick=i=>{sel=us[i];$('#who').textContent=sel.name;pwf.hidden=false;$('#err').textContent='';$('#pw').value='';$('#pw').focus()};
 wrap.onpointerdown=e=>{idle=false;drag={x:e.clientX,a:ang,m:0,t:e.target.closest('.rb')};wrap.setPointerCapture(e.pointerId);box.style.transition=''};
 wrap.onpointermove=e=>{if(!drag)return;drag.m=Math.max(drag.m,Math.abs(e.clientX-drag.x));if(drag.m>6){ang=drag.a+(e.clientX-drag.x)*.35;paint()}};
 wrap.onpointerup=()=>{if(!drag)return;const d=drag;drag=null;
  if(d.m<=6&&d.t){const i=+d.t.dataset.i;if(i===front())pick(i);else{unpick();snap(ang-rel(i))}}
  else{const f=front();snap(-f*step+Math.round((ang+f*step)/360)*360);if(sel&&us[front()]!==sel)unpick()}};
 const turn=d=>{idle=false;unpick();snap(Math.round(ang/step)*step+d*-step)};
 $('#lp').onclick=()=>turn(-1);$('#rp').onclick=()=>turn(1);
 onkeydown=e=>{if(!$('#login').hidden&&document.activeElement.tagName!=='INPUT'){if(e.key==='ArrowLeft')turn(-1);if(e.key==='ArrowRight')turn(1);if(e.key==='Enter')pick(front())}};
 pwf.onsubmit=async e=>{e.preventDefault();try{const r=await api('POST','login',{id:sel.id,password:$('#pw').value});tok=r.token;localStorage.tok=tok;await load();start();playJingle(D.me.jingle||'none');startAmbient()}catch(x){$('#err').textContent=x.message}};
 (function spin(){if(idle&&!sel&&!$('#login').hidden){ang-=.12;paint()}requestAnimationFrame(spin)})();paint()}
async function boot(){if(tok){try{await load();return start()}catch{}}
 let us;try{us=await api('GET','users')}catch(e){$('#rw').textContent='Could not reach the server: '+e.message;return}
 ring(us)}
boot();