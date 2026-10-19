/* Add Njeri to the database if missing. Run with: node scripts/add-njeri.js */
const { MongoClient } = require('mongodb');
const c = require('crypto');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set (see .env.local)');
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('hangout_os');
    const users = db.collection('users');

    const existing = await users.findOne({ name: 'Njeri' });
    if (existing) {
      console.log('Njeri already exists in database. Skipping.');
      return;
    }

    const id = c.randomUUID();
    const W = ['peach', 'dusk', 'lilac', 'moss', 'ember', 'night'];
    const A = ['#e07a5f', '#6a8caf', '#8e7dbe', '#5f9e6e', '#d4a017', '#c95d8a'];
    const hash = (p, s) => c.scryptSync(p, s, 32).toString('hex');

    await users.insertOne({
      _id: id,
      name: 'Njeri',
      hash: hash('njeri', id),
      admin: 0,
      avatar: 'img/users/njeri.png',
      wallpaper: 'peach',
      accent: '#e07a5f',
      ambient: 0,
      volume: 50,
      clicks: 0
    });

    console.log('Njeri added successfully to database.');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
