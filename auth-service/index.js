const express = require('express'), cors = require('cors'), bcrypt = require('bcryptjs');
const { register, lookup } = require('./discovery');
const { pool, initDb, auth, op, mk, mountDocs, jwt, SECRET } = require('./common');
const app = express(); app.use(cors(), express.json());
const tok = u => jwt.sign({ id: u.id, name: u.name, email: u.email, role: u.role }, SECRET, { expiresIn: '8h' });

app.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  try {
    const { rows } = await pool.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',
      [name, email, await bcrypt.hash(password, 10)]);
    res.status(201).json({ user: rows[0], token: tok(rows[0]) });
  } catch { res.status(409).json({ error: 'Email already registered' }); }
});
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash))) return res.status(401).json({ error: 'Invalid email or password' });
  const { password_hash, ...user } = rows[0];
  res.json({ user, token: tok(user) });
});
app.get('/me', auth(), (req, res) => res.json(req.user));
app.get('/users', auth(['admin']), async (req, res) => res.json((await pool.query('SELECT id,name,email,role FROM users ORDER BY id')).rows));
app.get('/health', (q, r) => r.json({ service: 'auth', ok: true }));

mountDocs(app, mk('Auth Service', '/api/auth', {
  '/register': { post: op('Register a new user', { body: { name: 'Rahul', email: 'rahul@mail.com', password: '123456' } }) },
  '/login': { post: op('Login (admin: admin@mobilehub.com / admin123)', { body: { email: 'admin@mobilehub.com', password: 'admin123' } }) },
  '/me': { get: op('Current user from JWT', { auth: true }) },
  '/users': { get: op('List users (admin)', { auth: true }) }
}));
initDb(`CREATE TABLE IF NOT EXISTS users(id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user')`)
  .then(async () => {
    await pool.query(`INSERT INTO users(name,email,password_hash,role) VALUES('Admin','admin@mobilehub.com',$1,'admin') ON CONFLICT DO NOTHING`, [await bcrypt.hash('admin123', 10)]);
    app.listen(process.env.PORT || 4001, () => { console.log('auth-service :4001'); register('AUTH-SERVICE', process.env.PORT || 4001); });
  });
