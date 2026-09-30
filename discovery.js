const { Eureka } = require('eureka-js-client');
let client = null;
function register(app, port) {
  const base = process.env.EUREKA_URL;
  if (!base) return console.log('[eureka] EUREKA_URL not set -> discovery off, using env URLs');
  const e = new URL(base), self = new URL(process.env.RENDER_EXTERNAL_URL || process.env.SELF_URL || `http://localhost:${port}`);
  const isHttps = self.protocol === 'https:';
  const sport = +(self.port || (isHttps ? 443 : 80));
  client = new Eureka({
    instance: {
      app, instanceId: `${app.toLowerCase()}-${self.hostname}-${sport}`, hostName: self.hostname, ipAddr: '127.0.0.1',
      vipAddress: app.toLowerCase(), secureVipAddress: app.toLowerCase(),
      port: { $: isHttps ? 80 : sport, '@enabled': !isHttps },
      securePort: { $: isHttps ? sport : 443, '@enabled': isHttps },
      dataCenterInfo: { '@class': 'com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo', name: 'MyOwn' },
      metadata: { url: self.origin }
    },
    eureka: { host: e.hostname, port: +(e.port || (e.protocol === 'https:' ? 443 : 80)), ssl: e.protocol === 'https:', servicePath: '/eureka/apps/',
      maxRetries: 30, requestRetryDelay: 5000, registryFetchInterval: 10000, heartbeatInterval: 30000 }
  });
  client.logger.level('warn');
  client.start(err => console.log(err ? '[eureka] register failed: ' + err.message : `[eureka] ${app} registered at ${self.origin}`));
}
const lookup = (app, fallback) => {
  try { const up = ((client && client.getInstancesByAppId(app)) || []).filter(i => i.status === 'UP' && i.metadata && i.metadata.url);
    if (up.length) return up[Math.floor(Math.random() * up.length)].metadata.url; } catch (e) {}
  return fallback;
};
module.exports = { register, lookup };
