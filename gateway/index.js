const express = require('express'), cors = require('cors'), jwt = require('jsonwebtoken'), swaggerUi = require('swagger-ui-express'), axios = require('axios');
const { createProxyMiddleware: proxy } = require('http-proxy-middleware');
const { register, lookup } = require('./discovery');
const APP = { auth: 'AUTH-SERVICE', products: 'PRODUCT-SERVICE', cart: 'CART-SERVICE', orders: 'ORDER-SERVICE' };
const SECRET = process.env.JWT_SECRET || 'mobilehub-secret';
const S = { auth: process.env.AUTH_URL || 'http://localhost:4001', products: process.env.PRODUCT_URL || 'http://localhost:4002',
  cart: process.env.CART_URL || 'http://localhost:4004', orders: process.env.ORDER_URL || 'http://localhost:4003' };
const app = express(); app.use(cors());
app.use((req, res, next) => { console.log(`[gateway] ${req.method} ${req.originalUrl}`); next(); });

const hits = {}; // simple rate limit: 300 req/min per IP
app.use((req, res, next) => { const k = req.ip + Math.floor(Date.now() / 60000); hits[k] = (hits[k] || 0) + 1;
  hits[k] > 300 ? res.status(429).json({ error: 'Too many requests' }) : next(); });
const guard = (req, res, next) => { // gateway-level JWT check for protected routes
  try { jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); next(); }
  catch { res.status(401).json({ error: 'Login required (gateway)' }); } };

app.use('/api/cart', guard); app.use('/api/orders', guard);
app.use('/api/auth', (req, res, next) => (req.path === '/users' || req.path === '/me') ? guard(req, res, next) : next());
for (const [name, target] of Object.entries(S))
  app.use(`/api/${name}`, proxy({ target, router: () => lookup(APP[name], target), changeOrigin: true, pathRewrite: { [`^/api/${name}`]: '' },
    onError: (e, q, r) => r.status(502).json({ error: `${name} service unavailable` }) }));

app.get('/health', async (req, res) => {
  const out = {};
  for (const [n, t] of Object.entries(S)) out[n] = await axios.get(t + '/health', { timeout: 1500 }).then(() => 'UP').catch(() => n === 'auth' ? 'DOWN' : 'UP?');
  res.json({ gateway: 'UP', services: out });
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(null, { explorer: true, swaggerOptions: { urls: [
  { url: '/api/auth/openapi.json', name: '1. Auth Service' }, { url: '/api/products/openapi.json', name: '2. Product Service' },
  { url: '/api/cart/openapi.json', name: '3. Cart Service' }, { url: '/api/orders/openapi.json', name: '4. Order Service' }] } }));
app.get('/', (q, r) => r.redirect('/docs'));
app.listen(process.env.PORT || 8080, () => { console.log('API Gateway :8080  (Swagger: /docs)'); register('API-GATEWAY', process.env.PORT || 8080); });
