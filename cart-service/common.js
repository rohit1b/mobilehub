const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const SECRET = process.env.JWT_SECRET || 'mobilehub-super-secret-jwt-signing-key-2026';
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL ? { rejectUnauthorized: false } : undefined });
async function initDb(sql) {
  for (let i = 0; i < 30; i++) {
    try { await pool.query(sql); return; }
    catch (e) { console.log('waiting for db...', e.message); await new Promise(r => setTimeout(r, 2000)); }
  }
  throw new Error('DB not reachable');
}
const auth = (roles) => (req, res, next) => {
  try { req.user = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET); }
  catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (roles && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};
const op = (summary, o = {}) => ({
  summary, security: o.auth ? [{ bearer: [] }] : [],
  parameters: (o.q || []).map(n => ({ name: n, in: 'query', schema: { type: 'string' } }))
    .concat((o.p || []).map(n => ({ name: n, in: 'path', required: true, schema: { type: 'string' } }))),
  ...(o.body ? { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object',
    properties: Object.fromEntries(Object.entries(o.body).map(([k, v]) => [k, { type: typeof v, example: v }])) } } } } } : {}),
  responses: { 200: { description: 'OK' } }
});
const mk = (title, base, paths) => ({ openapi: '3.0.0', info: { title, version: '1.0.0' }, servers: [{ url: base }],
  components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } }, paths });
const mountDocs = (app, spec) => { app.get('/openapi.json', (q, r) => r.json(spec)); app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec)); };
module.exports = { pool, initDb, auth, op, mk, mountDocs, jwt, SECRET };
