export const api = async (path, method = 'GET', body) => {
  const t = localStorage.getItem('token');
  const r = await fetch((import.meta.env.VITE_API_URL || '') + '/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(t && { Authorization: 'Bearer ' + t }) }, body: body && JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
};
export const inr = n => '₹' + Number(n).toLocaleString('en-IN');
const fb = "data:image/svg+xml;utf8," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><defs><linearGradient id='g'><stop stop-color='#7c3aed'/><stop offset='1' stop-color='#06b6d4'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><text x='300' y='340' font-size='160' text-anchor='middle'>📱</text></svg>");
export const onImgErr = e => { e.target.onerror = null; e.target.src = fb; };
