import pg from 'pg';
const pool = new pg.Pool({
  connectionString: "postgresql://neondb_owner:npg_0Ig1qbojUfZQ@ep-bold-dust-ao02kgr8-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  ssl: true,
});
try {
  const res = await pool.query(`SELECT "id","empId","firstName","lastName","email","phoneNumber","designation","department","dateOfJoining","status","isActive" FROM "Employee" ORDER BY "created_at" DESC LIMIT 3`);
  console.log('OK, rows:', res.rowCount);
  console.log(res.rows);
  const c = await pool.query(`SELECT COUNT(*)::text AS count FROM "Employee"`);
  console.log('Total:', c.rows[0].count);
} catch (err) {
  console.error('FAILED:', err.message);
} finally {
  await pool.end();
}
