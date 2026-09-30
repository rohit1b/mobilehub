const express = require('express'), cors = require('cors');
const app = express(); app.use(cors(), express.json());
const reg = {}, TTL = +process.env.TTL_MS || 90000; // APP -> { instanceId -> {instance,last,since} }
const list = () => Object.entries(reg).filter(([, v]) => Object.keys(v).length).map(([name, v]) => ({ name, instance: Object.values(v).map(e => e.instance) }));

app.post('/eureka/apps/:app', (req, res) => {           // register
  const i = req.body.instance, A = req.params.app.toUpperCase();
  if (!i) return res.sendStatus(400);
  i.app = A; i.instanceId = i.instanceId || i.hostName; i.status = i.status || 'UP';
  (reg[A] = reg[A] || {})[i.instanceId] = { instance: i, last: Date.now(), since: Date.now() };
  console.log('REGISTER ', A, i.instanceId, i.metadata && i.metadata.url); res.sendStatus(204);
});
app.put('/eureka/apps/:app/:id', (req, res) => {        // heartbeat
  const e = (reg[req.params.app.toUpperCase()] || {})[req.params.id];
  if (!e) return res.sendStatus(404);                    // client will re-register
  e.last = Date.now(); res.sendStatus(200);
});
app.delete('/eureka/apps/:app/:id', (req, res) => { const g = reg[req.params.app.toUpperCase()]; if (g) delete g[req.params.id]; console.log('DEREGISTER', req.params.app, req.params.id); res.sendStatus(200); });
app.get('/eureka/apps', (q, r) => r.json({ applications: { versions__delta: '1', apps__hashcode: 'UP_' + list().length, application: list() } }));
app.get('/eureka/apps/:app', (q, r) => { const a = list().find(x => x.name === q.params.app.toUpperCase()); a ? r.json({ application: a }) : r.sendStatus(404); });
setInterval(() => { for (const [A, g] of Object.entries(reg)) for (const [id, e] of Object.entries(g))
  if (Date.now() - e.last > TTL) { delete g[id]; console.log('EVICTED  ', A, id, '(no heartbeat)'); } }, 15000);

app.get('/', (req, res) => {                            // dashboard
  const rows = list().flatMap(a => a.instance.map(i => { const e = reg[a.name][i.instanceId];
    return `<tr><td><b>${a.name}</b></td><td>${i.instanceId}</td><td class="up">${i.status}</td><td>${i.metadata && i.metadata.url || ''}</td><td>${Math.round((Date.now() - e.last) / 1000)}s ago</td></tr>`; })).join('');
  res.send(`<!doctype html><meta http-equiv="refresh" content="5"><title>MobileHub Eureka</title><style>body{background:#0b0b14;color:#eef;font-family:sans-serif;padding:40px}
  h1{background:linear-gradient(90deg,#7c3aed,#06b6d4);-webkit-background-clip:text;color:transparent}table{width:100%;border-collapse:collapse;background:#15152a;border-radius:12px}
  td,th{padding:14px;text-align:left;border-bottom:1px solid #ffffff18}th{color:#06b6d4}.up{color:#4ade80;font-weight:bold}</style>
  <h1>🛰️ MobileHub — Service Registry (Eureka)</h1><p>Registered instances: ${list().reduce((s, a) => s + a.instance.length, 0)} (auto-refresh 5s)</p>
  <table><tr><th>Application</th><th>Instance ID</th><th>Status</th><th>URL</th><th>Last heartbeat</th></tr>${rows || '<tr><td colspan=5>No services registered yet</td></tr>'}</table>`);
});
app.listen(process.env.PORT || 8761, () => console.log('Eureka server :' + (process.env.PORT || 8761)));
