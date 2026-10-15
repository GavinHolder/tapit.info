// Shows which database is in use and who can sign in. Usage: npm run list-users
import path from 'node:path';
import { openDb, DATA_DIR } from '../lib/db.js';

const db = openDb();
console.log(`Database: ${path.join(DATA_DIR, 'studio.db')}`);
const rows = db.prepare('SELECT email, name, role, disabled, created_at FROM users ORDER BY created_at').all();
if (!rows.length) console.log('No logins yet. Create one with: npm run create-owner -- you@example.com "Your Name" "a long password"');
for (const r of rows) console.log(`${r.role === 'owner' ? 'developer' : 'client   '}  ${r.email}  (${r.name})${r.disabled ? '  DISABLED' : ''}`);
