const express = require('express'), cors = require('cors'), axios = require('axios');
const { register, lookup } = require('./discovery');
const { pool, initDb, auth, op, mk, mountDocs } = require('./common');
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:4002';
const CART_URL = process.env.CART_URL || 'http://localhost:4004';
const KEY = process.env.INTERNAL_KEY || 'internal-key';
const productUrl = () => lookup('PRODUCT-SERVICE', PRODUCT_URL), cartUrl = () => lookup('CART-SERVICE', CART_URL);
const app = express(); app.use(cors(), express.json());

app.post('/checkout', auth(), async (req, res) => {
  const H = { headers: { Authorization: req.headers.authorization } };
  try {
    const { data: cart } = await axios.get(cartUrl() + '/', H);
    if (!cart.length) return res.status(400).json({ error: 'Cart is empty' });
    const bad = cart.find(i => i.qty > i.stock);
    if (bad) return res.status(409).json({ error: `Not enough stock for ${bad.name}` });
    const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
    for (const i of cart) await axios.patch(`${productUrl()}/${i.productId}/stock`, { delta: -i.qty }, { headers: { 'x-internal-key': KEY } });
    const { rows: [o] } = await pool.query(`INSERT INTO orders(user_id,user_name,total) VALUES($1,$2,$3) RETURNING *`, [req.user.id, req.user.name, total]);
    for (const i of cart) await pool.query('INSERT INTO order_items(order_id,product_id,name,price,qty) VALUES($1,$2,$3,$4,$5)', [o.id, i.productId, i.name, i.price, i.qty]);
    await axios.delete(cartUrl() + '/', H);
    res.status(201).json({ ...o, items: cart });
  } catch (e) { res.status(e.response?.status || 500).json({ error: e.response?.data?.error || e.message }); }
});
app.get('/', auth(), async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { rows } = await pool.query(`SELECT o.id,o.user_name,o.total::float AS total,o.status,o.created_at,
    COALESCE(json_agg(json_build_object('name',i.name,'qty',i.qty,'price',i.price::float)) FILTER (WHERE i.id IS NOT NULL),'[]') AS items
    FROM orders o LEFT JOIN order_items i ON i.order_id=o.id ${isAdmin ? '' : 'WHERE o.user_id=$1'} GROUP BY o.id ORDER BY o.id DESC`, isAdmin ? [] : [req.user.id]);
  res.json(rows);
});
app.get('/stats', auth(['admin']), async (req, res) => {
  const { rows: [s] } = await pool.query('SELECT COUNT(*)::int AS orders, COALESCE(SUM(total),0)::float AS revenue FROM orders');
  let products = 0; try { products = (await axios.get(productUrl() + '/')).data.length; } catch {}
  res.json({ ...s, products });
});
mountDocs(app, mk('Order Service', '/api/orders', {
  '/checkout': { post: op('Place order from cart (calls cart + product services)', { auth: true }) },
  '/': { get: op('My orders (admin sees all)', { auth: true }) },
  '/stats': { get: op('Dashboard stats (admin)', { auth: true }) }
}));
initDb(`CREATE TABLE IF NOT EXISTS orders(id SERIAL PRIMARY KEY,user_id INT,user_name TEXT,total NUMERIC(12,2),status TEXT DEFAULT 'PLACED',created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS order_items(id SERIAL PRIMARY KEY,order_id INT REFERENCES orders(id),product_id INT,name TEXT,price NUMERIC(10,2),qty INT)`)
  .then(() => app.listen(process.env.PORT || 4003, () => { console.log('order-service :4003'); register('ORDER-SERVICE', process.env.PORT || 4003); }));
