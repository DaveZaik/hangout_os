/* API and data layer */
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const av = (a, n) => /^(https?:|data:|img\/)/.test(a || '') ? `<img src="${esc(a)}" alt="${esc((n || '?')[0])}" onerror="this.outerHTML='<b>'+this.alt+'</b>'">` : esc(a || (n || '🙂')[0]);
export const hue = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 7 % 360;

let tok = localStorage.tok, D = {}, LOCAL = false;

export const getD = () => D;
export const setD = (val) => D = val;
export const getTok = () => tok;
export const setTok = (val) => tok = val;
export const isLocal = () => LOCAL;

export async function api(m, p, b) {
  if (!LOCAL) {
    const r = await fetch('/api/' + p, { method: m, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + (tok || '') }, body: b ? JSON.stringify(b) : undefined }).catch(() => null);
    const j = r && await r.json().catch(() => null);
    if (j) {
      if (r.status === 401 && p !== 'login') logout();
      if (!r.ok) throw new Error(j.e || 'Error');
      return j;
    }
    LOCAL = true;
    document.body.classList.add('local');
  }
  return mock(m, p, b);
}

const MK = 'hos_db';

function mdb() {
  let d = JSON.parse(localStorage[MK] || 'null');
  if (!d) {
    d = {
      users: window.SEED.users.map((u, i) => ({ ...u, id: 'u' + i, pw: u.name.toLowerCase() })),
      hangouts: window.SEED.hangouts.map((h, i) => ({ ...h, _id: 'h' + i })),
      notes: window.SEED.notes.map((n, i) => ({ ...n, _id: 'n' + i, votes: [], by: '' })),
      comments: [],
      messages: []
    };
    localStorage[MK] = JSON.stringify(d);
  }
  return d;
}

async function mock(m, p, b = {}) {
  const d = mdb(), [x, i, sub] = p.split('/'), k = m + ' ' + x + (sub ? '/' + sub : ''), rid = () => Math.random().toString(36).slice(2, 10), ok = v => { localStorage[MK] = JSON.stringify(d); return v };
  const pub = u => ({ id: u.id, name: u.name, avatar: u.avatar, wallpaper: u.wallpaper, accent: u.accent, admin: !!u.admin, ambient: u.ambient, volume: u.volume, clicks: u.clicks });
  const me = (tok || '').startsWith('local:') && d.users.find(u => u.id === tok.slice(6));

  if (k === 'GET users') return d.users.map(pub);
  if (k === 'POST login') {
    const u = d.users.find(u => u.id === b.id);
    if (!u || u.pw !== String(b.password || '')) throw new Error('Wrong password');
    return { token: 'local:' + u.id, me: pub(u) };
  }
  if (!me) { logout(); throw new Error('auth'); }
  if (k === 'GET data') return { me: pub(me), users: d.users.map(pub), hangouts: [...d.hangouts].sort((a, b) => (b.date || '').localeCompare(a.date || '')), notes: d.notes, comments: d.comments, messages: d.messages };
  if (k === 'PUT me') {
    for (const f of ['name', 'wallpaper', 'accent', 'avatar']) if (typeof b[f] === 'string' && b[f]) me[f] = b[f];
    if (typeof b.ambient === 'number') me.ambient = b.ambient;
    if (typeof b.volume === 'number') me.volume = Math.max(0, Math.min(100, b.volume));
    if (typeof b.clicks === 'number') me.clicks = b.clicks;
    if (b.password) me.pw = b.password;
    return ok({});
  }
  if (k === 'POST notes') { d.notes.push({ _id: rid(), kind: b.kind === 'place' ? '📍 Place' : '🎯 Activity', text: b.text, votes: [me.id], by: me.id }); return ok({}); }
  if (k === 'POST notes/vote') {
    const n = d.notes.find(n => n._id === i);
    n.votes = n.votes.includes(me.id) ? n.votes.filter(v => v !== me.id) : [...n.votes, me.id];
    return ok({});
  }
  if (k === 'POST comments') { d.comments.push({ _id: rid(), hangout: b.hangout, user: me.id, text: b.text, at: Date.now() }); return ok({}); }
  if (k === 'DELETE comments') {
    const c = d.comments.find(c => c._id === i);
    if (c && (me.admin || c.user === me.id)) d.comments = d.comments.filter(c => c._id !== i);
    return ok({});
  }
  if (k === 'GET messages') return d.messages.filter(x => x.thread === (i === 'all' ? 'all' : me.admin ? i : me.id));
  if (k === 'POST messages') { d.messages.push({ _id: rid(), thread: i === 'all' ? 'all' : me.admin ? i : me.id, from: me.id, text: b.text, at: Date.now() }); return ok({}); }
  if (!me.admin) throw new Error('admin only');
  if (k === 'POST hangouts') { const _id = rid(); d.hangouts.push({ _id, ...b }); return ok({ id: _id }); }
  if (k === 'PUT hangouts') { Object.assign(d.hangouts.find(h => h._id === i), b); return ok({}); }
  if (k === 'DELETE hangouts') { d.hangouts = d.hangouts.filter(h => h._id !== i); return ok({}); }
  if (k === 'DELETE notes') { d.notes = d.notes.filter(n => n._id !== i); return ok({}); }
  if (k === 'POST users') { d.users.push({ id: rid(), name: b.name, avatar: b.avatar || '🙂', wallpaper: 'peach', accent: '#e07a5f', pw: b.password || b.name.toLowerCase(), ambient: 0, volume: 50, clicks: 0 }); return ok({}); }
  if (k === 'PUT users') { d.users.find(u => u.id === i).pw = b.password; return ok({}); }
  if (k === 'DELETE users') { d.users = d.users.filter(u => u.id !== i || i === me.id); return ok({}); }
  throw new Error('not found');
}

export const shrink = (f, max) => new Promise((res, rej) => {
  const i = new Image(), u = URL.createObjectURL(f);
  i.onload = () => {
    const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
    c.width = Math.round(i.width * k);
    c.height = Math.round(i.height * k);
    c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
    URL.revokeObjectURL(u);
    let q = .8, o;
    do { o = c.toDataURL(max <= 256 ? 'image/png' : 'image/jpeg', q); q -= .15; } while (o.length > 350000 && q > .2);
    res(o);
  };
  i.onerror = () => rej(new Error('Could not read that image'));
  i.src = u;
});

const Bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

const ditherPixel = (ctx, w, h, imgData) => {
  const d = imgData.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const m = Bayer[y % 4][x % 4] / 16 - 0.5;
      d[i] = Math.min(255, Math.max(0, Math.round((d[i] + m * 255) / 64) * 64));
      d[i + 1] = Math.min(255, Math.max(0, Math.round((d[i + 1] + m * 255) / 64) * 64));
      d[i + 2] = Math.min(255, Math.max(0, Math.round((d[i + 2] + m * 255) / 64) * 64));
    }
  }
};

export const retroWallpaper = f => new Promise((res, rej) => {
  const i = new Image(), u = URL.createObjectURL(f);
  i.onload = () => {
    const sw = 240, sh = Math.round(i.height * sw / i.width), c = document.createElement('canvas');
    c.width = sw;
    c.height = sh;
    const ctx = c.getContext('2d');
    ctx.drawImage(i, 0, 0, sw, sh);
    URL.revokeObjectURL(u);
    const imgData = ctx.getImageData(0, 0, sw, sh);
    ditherPixel(ctx, sw, sh, imgData);
    ctx.putImageData(imgData, 0, 0);
    res(c.toDataURL('image/png'));
  };
  i.onerror = () => rej(new Error('Could not read that image'));
  i.src = u;
});

export const drawPixelScene = (name) => {
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext('2d');
  const sky = name === 'peach' ? ['#e3c2b3', '#d4b0a0', '#c59d8d'] : name === 'dusk' ? ['#355c7d', '#4a5b6d', '#6c5b7b', '#c06c84'] : name === 'lilac' ? ['#cdb4db', '#c4a8d8', '#bb9cd5', '#a2d2ff'] : name === 'moss' ? ['#b7c9a8', '#9fbc94', '#87b280', '#4f7942'] : name === 'ember' ? ['#ffb26b', '#ff8a50', '#e4572e', '#5b2a3f'] : ['#1b1f3b', '#252a4d', '#3b2f63', '#7a4f8f'];
  const bands = name === 'dusk' || name === 'ember' || name === 'night' ? 4 : 3;
  const bandH = 50 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = sky[i];
    ctx.fillRect(0, i * bandH, 160, bandH + 1);
  }
  if (name === 'peach' || name === 'lilac' || name === 'moss') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(120, 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (name === 'dusk' || name === 'night') {
    ctx.fillStyle = '#ffe58f';
    ctx.beginPath();
    ctx.arc(120, 25, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (name === 'night') {
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 160, y = Math.random() * 40;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (name === 'ember') {
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.arc(120, 18, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const mountain = [[0, 50], [20, 40], [40, 45], [60, 35], [80, 42], [100, 38], [120, 44], [140, 36], [160, 45], [160, 90], [0, 90]];
  ctx.fillStyle = name === 'peach' ? '#8b7355' : name === 'dusk' ? '#2a3a4a' : name === 'lilac' ? '#8b7ba8' : name === 'moss' ? '#3d5a2e' : name === 'ember' ? '#3a1f2f' : '#151030';
  ctx.beginPath();
  ctx.moveTo(0, 90);
  mountain.forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(160, 90);
  ctx.fill();
  return c.toDataURL('image/png');
};

const ASSETS = { wallpapers: {} };
const WP = { peach: drawPixelScene('peach'), dusk: drawPixelScene('dusk'), lilac: drawPixelScene('lilac'), moss: drawPixelScene('moss'), ember: drawPixelScene('ember'), night: drawPixelScene('night') };
Object.assign(WP, ASSETS.wallpapers);

export { WP };

export async function up(f, max = 1280, uploadType = 'avatar') {
  try {
    const r = await fetch('/api/upload-url', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ contentType: f.type, size: f.size, type: uploadType }) });
    if (!r.ok) throw new Error('R2 not configured or upload denied');
    const { presignedPutUrl, publicUrl } = await r.json();
    const u = await fetch(presignedPutUrl, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f });
    if (!u.ok) throw new Error('Upload to R2 failed');
    return { url: publicUrl, video: f.type.startsWith('video') ? 1 : 0, caption: f.name.replace(/\.\w+$/, '') };
  } catch (e) {
    if (f.type.startsWith('image')) return { url: await shrink(f, max), video: 0, caption: f.name.replace(/\.\w+$/, '') };
    if (f.size > 1.5e6) throw new Error('File too big for demo mode — set up R2 environment variables.');
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res({ url: r.result, video: f.type.startsWith('video') ? 1 : 0, caption: f.name.replace(/\.\w+$/, '') });
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }
}

export function logout() {
  localStorage.removeItem('tok');
  location.reload();
}

export async function load() {
  D = await api('GET', 'data');
}
