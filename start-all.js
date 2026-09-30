// npm start -> starts 4 services + gateway + React together
const { spawn } = require('child_process');
const U = process.env.DB_USER || 'postgres', P = process.env.DB_PASS || 'postgres', H = process.env.DB_HOST || 'localhost', PORT = process.env.DB_PORT || 5432;
const db = n => `postgres://${U}:${P}@${H}:${PORT}/${n}`;
const run = (name, cwd, cmd, args, env = {}) => {
  const p = spawn(cmd, args, { cwd, env: { EUREKA_URL: 'http://localhost:8761', ...process.env, ...env }, shell: true });
  const log = d => d.toString().split('\n').filter(Boolean).forEach(l => console.log(`[${name}] ${l}`));
  p.stdout.on('data', log); p.stderr.on('data', log);
};
run('eureka ', 'eureka-server', 'node', ['index.js']);
run('auth   ', 'auth-service', 'node', ['index.js'], { DATABASE_URL: db('auth_db') });
run('product', 'product-service', 'node', ['index.js'], { DATABASE_URL: db('product_db') });
run('cart   ', 'cart-service', 'node', ['index.js'], { DATABASE_URL: db('cart_db') });
run('order  ', 'order-service', 'node', ['index.js'], { DATABASE_URL: db('order_db') });
setTimeout(() => run('gateway', 'gateway', 'node', ['index.js']), 2000);
setTimeout(() => run('frontend', 'frontend', 'npm', ['run', 'dev']), 3000);
console.log('\nShop: http://localhost:5173 | Swagger: http://localhost:8080/docs | Eureka: http://localhost:8761 | Admin: admin@mobilehub.com / admin123\n');
