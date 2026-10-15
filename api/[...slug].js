const { MongoClient } = require('mongodb'), c = require('crypto');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const SEED = require('../seed.js'); // shared starter data (roster, demo hangouts)
let cl, s3Client;
const getDb = async () => {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set (see .env.local / Vercel env vars)');
  return (await (cl ??= new MongoClient(process.env.MONGODB_URI).connect())).db('hangout_os');
};
const getS3 = () => {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET || !process.env.R2_PUBLIC_URL) {
    throw new Error('R2 environment variables not set (see .env.local)');
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3Client;
};
const S = process.env.SESSION_SECRET || 'dev-secret-change-me';
const id = () => c.randomUUID();
const hash = (p, s) => c.scryptSync(p, s, 32).toString('hex');
const mac = b => c.createHmac('sha256', S).update(b).digest('base64url');
const sign = u => { const b = Buffer.from(JSON.stringify({ id: u._id, a: !!u.admin, e: Date.now() + 2592e6 })).toString('base64url'); return b + '.' + mac(b); };
const check = t => { try { const [b, s] = t.split('.'); if (s !== mac(b)) return null; const p = JSON.parse(Buffer.from(b, 'base64url')); return p.e > Date.now() ? p : null; } catch { return null; } };
const pub = u => ({ id: u._id, name: u.name, avatar: u.avatar, wallpaper: u.wallpaper, accent: u.accent, admin: !!u.admin, jingle: u.jingle, ambient: u.ambient, volume: u.volume, clicks: u.clicks });
const WP = ['peach', 'dusk', 'lilac', 'moss', 'ember', 'night'], ACC = ['#e07a5f', '#6a8caf', '#8e7dbe', '#5f9e6e', '#d4a017', '#c95d8a'];
const pick = a => a[Math.random() * a.length | 0];
const mk = (U, name, pw, admin, avatar, extra = {}) => { const _id = id(); return U.insertOne({ _id, name, hash: hash(pw, _id), admin: !!admin, avatar: avatar || '🙂', wallpaper: pick(WP), accent: pick(ACC), jingle: 'none', ambient: 0, volume: 50, clicks: 0, ...extra }); };
const clean = b => ({
  title: String(b.title || 'Untitled').slice(0, 80), date: String(b.date || '').slice(0, 10), place: String(b.place || '').slice(0, 80),
  who: String(b.who || '').slice(0, 120), emoji: String(b.emoji || '🖼️').slice(0, 8), story: String(b.story || '').slice(0, 3000),
  media: (b.media || []).slice(0, 300).map(m => ({ url: String(m.url || ''), video: m.video ? 1 : 0, caption: String(m.caption || '').slice(0, 80), e: String(m.e || '').slice(0, 8) }))
});
module.exports = async (q, r) => {
  try {
    const d = await getDb(), U = d.collection('users'), H = d.collection('hangouts'), N = d.collection('notes'), C = d.collection('comments'), M = d.collection('messages');
    const [x, i, sub] = q.url.split('?')[0].replace(/^\/api\/?/, '').split('/');
    const k = q.method + ' ' + x + (sub ? '/' + sub : ''), b = q.body || {};
    const ok = (v, s = 200) => r.status(s).json(v), no = (e, s = 400) => ok({ e }, s);

    if (!await U.countDocuments()) { // fresh database: roster + demo content (password = lowercase name unless ADMIN_PASSWORD is set)
      for (const u of SEED.users) await mk(U, u.name, u.admin && process.env.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD : u.name.toLowerCase(), u.admin, u.avatar, { wallpaper: u.wallpaper, accent: u.accent });
      await H.insertMany(SEED.hangouts.map(h => ({ _id: id(), ...h })));
      await N.insertMany(SEED.notes.map(n => ({ _id: id(), votes: [], by: '', ...n })));
    }
    if (k === 'GET users') return ok((await U.find().toArray()).map(pub));
    if (k === 'POST upload-url') {
      const me = check((q.headers.authorization || '').slice(7));
      if (!me) return no('auth', 401);
      const { contentType, size, type } = b;
      if (!contentType || !size || !type) return no('Missing contentType, size, or type');
      const validTypes = type === 'video' ? ['video/mp4', 'video/webm', 'video/quicktime'] : type === 'image' ? ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] : ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
      if (!validTypes.includes(contentType)) return no('Invalid content type');
      const maxSize = type === 'video' ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
      if (size > maxSize) return no(`File too large (max ${type === 'video' ? '100MB' : '10MB'})`);
      if (type === 'hangout' && !me.a) return no('admin only', 403);
      const key = `${type}/${id()}.${contentType.split('/')[1]}`;
      const s3 = getS3();
      const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        ContentType: contentType,
      });
      const presignedPutUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
      const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
      return ok({ presignedPutUrl, publicUrl });
    }
    if (k === 'POST login') {
      const u = await U.findOne({ _id: b.id });
      if (!u || hash(String(b.password || ''), u._id) !== u.hash) return no('Wrong password', 401);
      return ok({ token: sign(u), me: pub(u) });
    }
    const me = check((q.headers.authorization || '').slice(7));
    if (!me) return no('auth', 401);

    if (k === 'GET data') {
      const [u, h, n, cm] = await Promise.all([U.find().toArray(), H.find().sort({ date: -1 }).toArray(), N.find().toArray(), C.find().toArray()]);
      const mine = u.find(z => z._id === me.id); if (!mine) return no('auth', 401);
      return ok({ me: pub(mine), users: u.map(pub), hangouts: h, notes: n, comments: cm });
    }
    if (k === 'PUT me') {
      const s = {}; for (const f of ['wallpaper', 'accent', 'avatar', 'jingle']) if (typeof b[f] === 'string') s[f] = b[f].slice(0, b[f].startsWith('data:') ? 400000 : 500);
      if (typeof b.name === 'string' && b.name.trim()) s.name = b.name.trim().slice(0, 30);
      if (typeof b.password === 'string' && b.password.length >= 3) s.hash = hash(b.password, me.id);
      if (typeof b.ambient === 'number') s.ambient = b.ambient ? 1 : 0;
      if (typeof b.volume === 'number') s.volume = Math.max(0, Math.min(100, b.volume));
      if (typeof b.clicks === 'number') s.clicks = b.clicks ? 1 : 0;
      await U.updateOne({ _id: me.id }, { $set: s }); return ok({});
    }
    if (k === 'POST notes') {
      if (!b.text) return no('empty'); await N.insertOne({ _id: id(), kind: b.kind === 'place' ? '📍 Place' : '🎯 Activity', text: String(b.text).slice(0, 120), votes: [me.id], by: me.id }); return ok({});
    }
    if (k === 'POST notes/vote') {
      const n = await N.findOne({ _id: i }); if (!n) return no('gone', 404);
      await N.updateOne({ _id: i }, n.votes.includes(me.id) ? { $pull: { votes: me.id } } : { $addToSet: { votes: me.id } }); return ok({});
    }
    if (k === 'POST comments') {
      if (!b.text || !b.hangout) return no('empty');
      await C.insertOne({ _id: id(), hangout: b.hangout, user: me.id, text: String(b.text).slice(0, 500), at: Date.now() }); return ok({});
    }
    if (k === 'DELETE comments') { const cm = await C.findOne({ _id: i }); if (cm && (me.a || cm.user === me.id)) await C.deleteOne({ _id: i }); return ok({}); }
    // chat: a member has one thread with the admin (thread id = member id); the admin can open any thread
    if (k === 'GET messages') return ok(await M.find({ thread: i === 'all' ? 'all' : me.a ? i : me.id }).sort({ at: 1 }).limit(300).toArray());
    if (k === 'POST messages') {
      if (!b.text) return no('empty');
      await M.insertOne({ _id: id(), thread: i === 'all' ? 'all' : me.a ? i : me.id, from: me.id, text: String(b.text).slice(0, 1000), at: Date.now() }); return ok({});
    }
    if (!me.a) return no('admin only', 403);

    if (k === 'POST hangouts') { const _id = id(); await H.insertOne({ _id, ...clean(b) }); return ok({ id: _id }); }
    if (k === 'PUT hangouts') { await H.updateOne({ _id: i }, { $set: clean(b) }); return ok({}); }
    if (k === 'DELETE hangouts') { await H.deleteOne({ _id: i }); return ok({}); }
    if (k === 'DELETE notes') { await N.deleteOne({ _id: i }); return ok({}); }
    if (k === 'POST users') {
      if (!b.name) return no('name required');
      await mk(U, String(b.name).slice(0, 30), String(b.password || String(b.name).toLowerCase()), 0, String(b.avatar || '🙂').slice(0, 8)); return ok({});
    }
    if (k === 'PUT users') { await U.updateOne({ _id: i }, { $set: { hash: hash(String(b.password), i) } }); return ok({}); }
    if (k === 'DELETE users') { if (i === me.id) return no("can't remove yourself"); await U.deleteOne({ _id: i }); return ok({}); }
    return no('not found', 404);
  } catch (e) { r.status(500).json({ e: e.message }); }
};