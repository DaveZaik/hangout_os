// Removes the duplicate "Nelly" (the SECOND one in creation order). Njeri and the first Nelly stay.
// Usage: node scripts/fix-roster.js        (shows what it would do, changes nothing)
//        node scripts/fix-roster.js --yes  (deletes her, plus her comments and chat messages)
const fs = require('fs'), { MongoClient } = require('mongodb');
try { for (const l of fs.readFileSync('.env.local', 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_0-9]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; } } catch {}
(async () => {
  const cl = await new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect(), db = cl.db('hangout_os'), U = db.collection('users');
  const all = await U.find().toArray(), nellys = all.filter(u => u.name === 'Nelly');
  console.log(`Members: ${all.length}. Users named Nelly: ${nellys.length}`);
  nellys.forEach((u, i) => console.log(`  #${i + 1} id=${u._id} avatar=${String(u.avatar).length} chars, wallpaper=${String(u.wallpaper).slice(0, 18)}`));
  if (nellys.length !== 2) { console.log('Expected exactly two Nellys - nothing to do.'); return cl.close(); }
  const dup = nellys[1];
  console.log(`Would remove #2 (id ${dup._id}) - the later-created one. #1 is kept as the real Nelly.`);
  if (!process.argv.includes('--yes')) { console.log('Dry run. Add --yes to apply.'); return cl.close(); }
  await U.deleteOne({ _id: dup._id });
  await db.collection('comments').deleteMany({ user: dup._id });
  await db.collection('messages').deleteMany({ $or: [{ thread: dup._id }, { from: dup._id }] });
  console.log('Removed. Members now:', await U.countDocuments());
  await cl.close();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
