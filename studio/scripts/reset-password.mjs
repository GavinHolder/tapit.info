// Sets a new password for an existing login (and signs it out everywhere). Usage:
//   npm run reset-password -- you@example.com "a new long password"
import path from 'node:path';
import { openDb, DATA_DIR } from '../lib/db.js';
import { hashPassword, checkPasswordStrength } from '../lib/password.js';

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run reset-password -- <email> "<new password, 10+ characters>"');
  process.exit(1);
}
const problem = checkPasswordStrength(password);
if (problem) { console.error(problem); process.exit(1); }
const db = openDb();
console.log(`Database: ${path.join(DATA_DIR, 'studio.db')}`);
const u = db.prepare('SELECT id, name, role FROM users WHERE email = ?').get(email.trim().toLowerCase());
if (!u) { console.error(`No login for ${email}. Run: npm run list-users`); process.exit(1); }
db.prepare('UPDATE users SET password_hash = ?, disabled = 0 WHERE id = ?').run(hashPassword(password), u.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(u.id);
console.log(`New password set for ${u.name} (${u.role === 'owner' ? 'developer' : 'client'}). The login is enabled.`);
