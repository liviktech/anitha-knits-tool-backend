import { pool } from './src/db/pool.js';

async function main() {
  const result = await pool.query(`UPDATE "attendances" SET "status" = 'DAY_SHIFT' WHERE "status" = 'PRESENT'`);
  console.log(`Updated ${result.rowCount} attendance records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
