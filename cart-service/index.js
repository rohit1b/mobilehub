const express = require('express'), cors = require('cors'), axios = require('axios');
const { register, lookup } = require('./discovery');
const { pool, initDb, auth, op, mk, mountDocs } = require('./common');
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:4002';
const productUrl = () => lookup('PRODUCT-SERVICE', PRODUCT_URL);
const app = express(); app.use(cors(), express.json());

app.get('/', auth(), async (req, res) => {
  const { rows } = await pool.query('SELECT product_id,qty FROM cart_items WHERE user_id=$1 ORDER BY product_id', [req.user.id]);
  const items = await Promise.all(rows.map(async r => {
    try { const { data: p } = await axios.get(`${productUrl()}/${r.product_id}`);
      return { productId: r.product_id, qty: r.qty, name: p.name, price: p.price, image: p.image, stock: p.stock }; }
    catch { return null; }
  }));
  res.json(items.filter(Boolean));
});
app.post('/', auth(), async (req, res) => {
  const { productId, qty = 1 } = req.body;
  try { await axios.get(`${productUrl()}/${productId}`); } catch { return res.status(404).json({ error: 'Product not found' }); }
  await pool.query(`INSERT INTO cart_items(user_id,product_id,qty) VALUES($1,$2,$3) ON CONFLICT(user_id,product_id) DO UPDATE SET qty=cart_items.qty+$3`, [req.user.id, productId, qty]);
  res.status(201).json({ added: true });
});
app.delete('/:productId', auth(), async (req, res) => { await pool.query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]); res.json({ removed: true }); });
app.delete('/', auth(), async (req, res) => { await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]); res.json({ cleared: true }); });

mountDocs(app, mk('Cart Service', '/api/cart', {
  '/': { get: op('My cart (with product details)', { auth: true }), post: op('Add to cart', { auth: true, body: { productId: 1, qty: 1 } }), delete: op('Clear cart', { auth: true }) },
  '/{productId}': { delete: op('Remove item', { auth: true, p: ['productId'] }) }
}));
initDb(`CREATE TABLE IF NOT EXISTS cart_items(user_id INT,product_id INT,qty INT NOT NULL DEFAULT 1,PRIMARY KEY(user_id,product_id))`)
  .then(() => app.listen(process.env.PORT || 4004, () => { console.log('cart-service :4004'); register('CART-SERVICE', process.env.PORT || 4004); }));
