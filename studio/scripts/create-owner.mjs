// Create the owner (developer) account. Usage: npm run create-owner -- you@example.com "Your Name" "a long password"
import { openDb, createUser } from '../lib/db.js';

const [email, name, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: npm run create-owner -- <email> "<name>" "<password, 10+ characters>"');
  process.exit(1);
}
const db = openDb();
try {
  createUser(db, { email, name: name || 'Owner', role: 'owner', password });
  console.log(`Created owner ${email}.`);
} catch (e) {
  console.error(String(e.message || e));
  process.exit(1);
}
