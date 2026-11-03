// Prints the SQL that creates an account, with a hashed password.
// The password never leaves your computer and is never stored in clear.
//
//   node scripts/create-user.mjs you@example.com "Your name"
//
// It asks for the password, then prints an INSERT to run on the D1 database
// (Cloudflare dashboard > D1 > citybook > Console, or `wrangler d1 execute citybook --remote --command "..."`).

import { createInterface } from 'node:readline/promises';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../worker/auth.js';

const [email, name = 'Me'] = process.argv.slice(2);
if (!email) {
  console.error('Usage: node scripts/create-user.mjs you@example.com "Your name"');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stderr });
const password = await rl.question('Password (12 characters or more): ');
rl.close();
if (password.length < 12) {
  console.error('Too short: use at least 12 characters.');
  process.exit(1);
}

const q = (s) => `'${s.replace(/'/g, "''")}'`;
const hash = await hashPassword(password);
console.log(
  `insert into users (id, email, name, password_hash) values (${q(randomUUID())}, ${q(email.trim().toLowerCase())}, ${q(name)}, ${q(hash)});`,
);
