const express = require('express'), cors = require('cors');
const { register, lookup } = require('./discovery');
const { pool, initDb, auth, op, mk, mountDocs } = require('./common');
const KEY = process.env.INTERNAL_KEY || 'internal-key';
const app = express(); app.use(cors(), express.json());
const COLS = 'id,name,brand,price::float AS price,stock,image,description,ram,storage,rating::float AS rating';
const U = 'https://images.unsplash.com/';
const SEED = [
  ['iPhone 15 Pro', 'Apple', 134900, 25, U + 'photo-1592750475338-74b7b21085ab?w=800', 'Titanium design, A17 Pro chip, 48MP camera.', '8GB', '256GB', 4.8],
  ['iPhone 14', 'Apple', 69900, 40, U + 'photo-1511707171634-5f897ff02aa9?w=800', 'Brilliant OLED display and great battery life.', '6GB', '128GB', 4.6],
  ['Galaxy S24 Ultra', 'Samsung', 129999, 18, U + 'photo-1610945415295-d9bbf067e59c?w=800', 'AI-powered flagship with S-Pen and 200MP camera.', '12GB', '256GB', 4.7],
  ['Galaxy A54', 'Samsung', 32999, 60, U + 'photo-1598327105666-5b89351aff97?w=800', 'Awesome AMOLED screen at a friendly price.', '8GB', '128GB', 4.3],
  ['OnePlus 12', 'OnePlus', 64999, 30, U + 'photo-1565849904461-04a58ad377e0?w=800', 'Snapdragon 8 Gen 3, 100W fast charging.', '12GB', '256GB', 4.5],
  ['Pixel 8', 'Google', 75999, 20, U + 'photo-1580910051074-3eb694886505?w=800', 'Pure Android with the best computational camera.', '8GB', '128GB', 4.5],
  ['Redmi Note 13 Pro', 'Xiaomi', 25999, 80, U + 'photo-1567581935884-3349723552ca?w=800', '200MP camera and 120Hz AMOLED display.', '8GB', '256GB', 4.2],
  ['Nothing Phone (2)', 'Nothing', 44999, 35, U + 'photo-1585060544812-6b45742d762f?w=800', 'Glyph interface with a transparent, unique design.', '12GB', '256GB', 4.4]
];
app.get('/', async (req, res) => {
  const { brand, q } = req.query, w = [], v = [];
  if (brand) { v.push(brand); w.push(`brand=$${v.length}`); }
  if (q) { v.push(`%${q}%`); w.push(`name ILIKE $${v.length}`); }
  res.json((await pool.query(`SELECT ${COLS} FROM products ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id`, v)).rows);
});
app.get('/:id', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLS} FROM products WHERE id=$1`, [req.params.id]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
});
app.post('/', auth(['admin']), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(`INSERT INTO products(name,brand,price,stock,image,description,ram,storage) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${COLS}`,
    [b.name, b.brand, b.price, b.stock ?? 0, b.image, b.description, b.ram, b.storage]);
  res.status(201).json(rows[0]);
});
app.put('/:id', auth(['admin']), async (req, res) => {
  const b = req.body;
  const { rows } = await pool.query(`UPDATE products SET name=COALESCE($2,name),price=COALESCE($3,price),stock=COALESCE($4,stock),image=COALESCE($5,image) WHERE id=$1 RETURNING ${COLS}`,
    [req.params.id, b.name, b.price, b.stock, b.image]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
});
app.delete('/:id', auth(['admin']), async (req, res) => { await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]); res.json({ deleted: true }); });
app.patch('/:id/stock', async (req, res) => { // internal: called by order-service
  if (req.headers['x-internal-key'] !== KEY) return res.status(403).json({ error: 'Internal only' });
  const { rows } = await pool.query(`UPDATE products SET stock=stock+$2 WHERE id=$1 AND stock+$2>=0 RETURNING ${COLS}`, [req.params.id, req.body.delta]);
  rows[0] ? res.json(rows[0]) : res.status(409).json({ error: 'Insufficient stock' });
});
const sample = { name: 'Moto G84', brand: 'Motorola', price: 18999, stock: 50, image: 'https://...', description: 'Nice phone', ram: '8GB', storage: '128GB' };
mountDocs(app, mk('Product Service', '/api/products', {
  '/': { get: op('List phones (filter by brand / search)', { q: ['brand', 'q'] }), post: op('Add phone (admin)', { auth: true, body: sample }) },
  '/{id}': { get: op('Phone details', { p: ['id'] }), put: op('Update phone (admin)', { auth: true, p: ['id'], body: { price: 19999, stock: 10 } }), delete: op('Delete phone (admin)', { auth: true, p: ['id'] }) }
}));
initDb(`CREATE TABLE IF NOT EXISTS products(id SERIAL PRIMARY KEY,name TEXT NOT NULL,brand TEXT,price NUMERIC(10,2) NOT NULL,stock INT DEFAULT 0,image TEXT,description TEXT,ram TEXT,storage TEXT,rating NUMERIC(2,1) DEFAULT 4.0)`)
  .then(async () => {
    if (!(await pool.query('SELECT 1 FROM products LIMIT 1')).rows.length)
      for (const s of SEED) await pool.query('INSERT INTO products(name,brand,price,stock,image,description,ram,storage,rating) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', s);
    app.listen(process.env.PORT || 4002, () => { console.log('product-service :4002'); register('PRODUCT-SERVICE', process.env.PORT || 4002); });
  });
