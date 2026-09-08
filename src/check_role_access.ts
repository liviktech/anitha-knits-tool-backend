import { query } from './db/query.js';

async function main() {
  const userRes = await query('SELECT id, name, mobile, role, role_access_id FROM users WHERE mobile = \'7539901081\'');
  console.log('--- TAMIL USER ---');
  console.table(userRes.rows);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
