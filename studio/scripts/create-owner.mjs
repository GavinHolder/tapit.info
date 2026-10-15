// Creates a login. Usage:
//   npm run create-owner -- you@example.com "Your Name" "a long password"            (developer / owner)
//   npm run create-owner -- client@example.com "Client Name" "a long password" client  (a client login)
import path from 'node:path';
import { openDb, createUser, DATA_DIR } from '../lib/db.js';

const [email, name, password, roleArg] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-owner -- <email> "<name>" "<password, 10+ characters>" [client]');
  process.exit(1);
}
const role = roleArg === 'client' ? 'client' : 'owner';
const db = openDb();
console.log(`Database: ${path.join(DATA_DIR, 'studio.db')}`);
try {
  createUser(db, { email, name: name || 'Owner', role, password });
  console.log(`Created ${role === 'owner' ? 'developer' : 'client'} login for ${email.toLowerCase()}.`);
} catch (e) {
  const msg = String(e.message || e);
  if (/UNIQUE/i.test(msg)) console.error(`That email already has a login. To set a new password use:\n  npm run reset-password -- ${email} "<new password>"`);
  else console.error(msg);
  process.exit(1);
}
