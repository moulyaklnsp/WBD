const bcrypt = require('bcryptjs');
const { connectDB } = require('../src/config/database');

const BCRYPT_ROUNDS = 12;
const isBcryptHash = (v) => typeof v === 'string' && /^\$2[aby]\$/.test(v);

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return '';
  return process.argv[idx + 1] || '';
}

async function main() {
  const email = String(process.env.SUPERADMIN_EMAIL || getArg('email') || '').trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || getArg('password') || '');
  const name = String(process.env.SUPERADMIN_NAME || getArg('name') || 'Super Admin').trim();

  if (!email || !password) {
    console.error('Missing SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD');
    console.error('Usage: node backend/scripts/seedSuperAdmin.js --email saivivash.d23@iiits.in --password "Vivash@14" --name "Admin"');
    process.exit(1);
  }

  const db = await connectDB();
  const users = db.collection('users');

  const existing = await users.findOne({ email });
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  if (existing) {
    const update = {
      role: 'admin',
      isSuperAdmin: true,
      status: 'active',
      isDeleted: 0
    };
    if (!existing.password || !isBcryptHash(existing.password)) {
      update.password = hashedPassword;
    }
    if (!existing.name && name) {
      update.name = name;
    }
    await users.updateOne(
      { _id: existing._id },
      { $set: update, $unset: { inviteToken: '', inviteExpires: '' } }
    );
    console.log(`Super admin updated: ${email}`);
    return;
  }

  await users.insertOne({
    name,
    email,
    password: hashedPassword,
    role: 'admin',
    isSuperAdmin: true,
    status: 'active',
    isDeleted: 0,
    createdAt: new Date()
  });
  console.log(`Super admin created: ${email}`);
}

main().catch((err) => {
  console.error('Failed to seed super admin:', err);
  process.exit(1);
});
