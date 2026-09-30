// npm run setup  -> installs deps for every folder + creates the 4 PostgreSQL databases
const { execSync } = require('child_process');
const dirs = ['eureka-server', 'auth-service', 'product-service', 'cart-service', 'order-service', 'gateway', 'frontend'];
for (const d of dirs) { console.log(`\n== npm install (${d})`); execSync('npm install', { cwd: d, stdio: 'inherit' }); }
const { Client } = require('./auth-service/node_modules/pg');
const U = process.env.DB_USER || 'postgres', P = process.env.DB_PASS || 'postgres', H = process.env.DB_HOST || 'localhost', PORT = process.env.DB_PORT || 5432;
(async () => {
  const c = new Client({ connectionString: `postgres://${U}:${P}@${H}:${PORT}/postgres` });
  try { await c.connect(); } catch (e) { console.error('\nPostgreSQL se connect nahi hua:', e.message, '\nDB_USER / DB_PASS / DB_HOST / DB_PORT env set karo.'); process.exit(1); }
  for (const db of ['auth_db', 'product_db', 'cart_db', 'order_db']) {
    const { rows } = await c.query('SELECT 1 FROM pg_database WHERE datname=$1', [db]);
    if (!rows.length) { await c.query(`CREATE DATABASE ${db}`); console.log('created', db); } else console.log('exists ', db);
  }
  await c.end(); console.log('\nSetup done. Ab chalao: npm start');
})();
