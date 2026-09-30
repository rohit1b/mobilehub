import { useState, useEffect } from 'react';
import { api, inr, onImgErr } from './api.js';

const HERO = ['photo-1592750475338-74b7b21085ab', 'photo-1610945415295-d9bbf067e59c', 'photo-1511707171634-5f897ff02aa9'].map(i => `https://images.unsplash.com/${i}?w=700`);

export default function App() {
  const [view, setView] = useState('home');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'));
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [brand, setBrand] = useState(''); const [q, setQ] = useState('');
  const [toast, setToast] = useState('');
  const say = m => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const loadProducts = () => api(`/products?${new URLSearchParams({ ...(brand && { brand }), ...(q && { q }) })}`).then(setProducts).catch(e => say(e.message));
  const loadCart = () => user && api('/cart').then(setCart).catch(() => {});
  useEffect(() => { loadProducts(); }, [brand, q]);
  useEffect(() => { loadCart(); }, [user]);

  const logout = () => { localStorage.clear(); setUser(null); setCart([]); setView('home'); };
  const add = async p => {
    if (!user) { say('Please login first'); return setView('login'); }
    try { await api('/cart', 'POST', { productId: p.id, qty: 1 }); say(`${p.name} added to cart 🛒`); loadCart(); } catch (e) { say(e.message); }
  };
  const brands = ['Apple', 'Samsung', 'OnePlus', 'Google', 'Xiaomi', 'Nothing'];
  const count = cart.reduce((s, i) => s + i.qty, 0);

  if (view === 'dash' && user) return <Dashboard user={user} logout={logout} go={setView} say={say} toast={toast} reload={loadProducts} />;
  return (<>
    <nav className="nav"><b className="logo" onClick={() => setView('home')}>Mobile<span>Hub</span></b>
      <input placeholder="Search phones…" value={q} onChange={e => { setQ(e.target.value); setView('home'); }} />
      <div className="navr">
        <button className="ghost" onClick={() => setView('cart')}>🛒 Cart ({count})</button>
        {user ? <><button className="ghost" onClick={() => setView('dash')}>Dashboard</button><button onClick={logout}>Logout</button></> : <button onClick={() => setView('login')}>Login</button>}
      </div></nav>
    {view === 'login' && <Login done={u => { setUser(u); setView('home'); say(`Welcome ${u.name}!`); }} />}
    {view === 'cart' && <Cart cart={cart} user={user} reload={loadCart} say={say} go={setView} />}
    {view === 'home' && <>
      <header className="hero">
        <div><span className="pill">🔥 Festive Sale — up to 30% off</span>
          <h1>Find your next <em>phone</em>.<br />Feel the difference.</h1>
          <p>Flagships, mid-rangers and everything in between. Fast delivery, easy EMI, 1-year warranty.</p>
          <button className="big" onClick={() => document.getElementById('shop').scrollIntoView({ behavior: 'smooth' })}>Shop now →</button></div>
        <div className="collage">{HERO.map((s, i) => <img key={i} src={s} onError={onImgErr} className={'c' + i} />)}</div>
      </header>
      <section className="brands">{brands.map(b => <div key={b} className={'brand ' + (brand === b ? 'on' : '')} onClick={() => setBrand(brand === b ? '' : b)}>{b}</div>)}</section>
      <main id="shop" className="grid">
        {products.map(p => <article className="card" key={p.id}>
          <div className="imgw"><img src={p.image} onError={onImgErr} loading="lazy" /><span className="rate">⭐ {p.rating}</span></div>
          <h3>{p.name}</h3><small>{p.brand} • {p.ram} • {p.storage}</small><p>{p.description}</p>
          <div className="row"><b>{inr(p.price)}</b><button disabled={!p.stock} onClick={() => add(p)}>{p.stock ? 'Add to cart' : 'Sold out'}</button></div>
        </article>)}
        {!products.length && <p className="empty">No phones found.</p>}
      </main>
      <footer>© MobileHub — built with React, Node.js microservices & PostgreSQL</footer></>}
    {toast && <div className="toast">{toast}</div>}
  </>);
}

function Login({ done }) {
  const [reg, setReg] = useState(false); const [f, setF] = useState({ name: '', email: '', password: '' }); const [err, setErr] = useState('');
  const submit = async () => {
    try { const d = await api(reg ? '/auth/register' : '/auth/login', 'POST', f);
      localStorage.setItem('token', d.token); localStorage.setItem('user', JSON.stringify(d.user)); done(d.user); } catch (e) { setErr(e.message); } };
  const set = k => e => setF({ ...f, [k]: e.target.value });
  return <div className="authwrap"><div className="authbox"><h2>{reg ? 'Create account' : 'Welcome back'}</h2>
    {reg && <input placeholder="Name" value={f.name} onChange={set('name')} />}
    <input placeholder="Email" value={f.email} onChange={set('email')} />
    <input placeholder="Password" type="password" value={f.password} onChange={set('password')} />
    {err && <p className="err">{err}</p>}<button className="big" onClick={submit}>{reg ? 'Sign up' : 'Login'}</button>
    <p className="link" onClick={() => { setReg(!reg); setErr(''); }}>{reg ? 'Have an account? Login' : 'New here? Register'}</p>
    <small>Admin demo: admin@mobilehub.com / admin123</small></div></div>;
}

function Cart({ cart, user, reload, say, go }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (!user) return <div className="empty">Please <a onClick={() => go('login')}>login</a> to see your cart.</div>;
  const checkout = async () => { try { const o = await api('/orders/checkout', 'POST'); say(`Order #${o.id} placed! 🎉`); reload(); go('dash'); } catch (e) { say(e.message); } };
  return <div className="page"><h2>Your Cart</h2>
    {cart.map(i => <div className="line" key={i.productId}><img src={i.image} onError={onImgErr} /><div><b>{i.name}</b><br /><small>Qty {i.qty} × {inr(i.price)}</small></div>
      <b>{inr(i.qty * i.price)}</b><button className="ghost" onClick={async () => { await api('/cart/' + i.productId, 'DELETE'); reload(); }}>✕</button></div>)}
    {!cart.length ? <p className="empty">Cart is empty.</p> : <div className="row"><h3>Total: {inr(total)}</h3><button className="big" onClick={checkout}>Place order</button></div>}</div>;
}

function Dashboard({ user, logout, go, say, toast, reload }) {
  const admin = user.role === 'admin';
  const [tab, setTab] = useState('overview'); const [orders, setOrders] = useState([]); const [stats, setStats] = useState(null); const [prods, setProds] = useState([]);
  const [np, setNp] = useState({ name: '', brand: '', price: '', stock: '', image: '', description: '', ram: '8GB', storage: '128GB' });
  const load = () => { api('/orders').then(setOrders).catch(() => {}); api('/products').then(setProds);
    if (admin) api('/orders/stats').then(setStats).catch(() => {}); };
  useEffect(load, []);
  const addP = async () => { try { await api('/products', 'POST', { ...np, price: +np.price, stock: +np.stock }); say('Phone added'); load(); reload(); } catch (e) { say(e.message); } };
  const tabs = [['overview', '📊 Overview'], ['orders', '📦 Orders'], ...(admin ? [['products', '📱 Products']] : [])];
  return <div className="dash"><aside><b className="logo">Mobile<span>Hub</span></b>
    <div className="who">👤 {user.name}<small>{admin ? 'Administrator' : 'Customer'}</small></div>
    {tabs.map(([k, l]) => <a key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</a>)}
    <a onClick={() => go('home')}>🏠 Back to shop</a><a onClick={logout}>🚪 Logout</a></aside>
    <section>
      {tab === 'overview' && <><h2>Hello, {user.name} 👋</h2><div className="stats">
        <div><b>{admin ? stats?.orders ?? '…' : orders.length}</b><small>Orders</small></div>
        <div><b>{inr(admin ? stats?.revenue ?? 0 : orders.reduce((s, o) => s + o.total, 0))}</b><small>{admin ? 'Revenue' : 'Total spent'}</small></div>
        <div><b>{admin ? stats?.products ?? '…' : prods.length}</b><small>Phones in store</small></div></div></>}
      {tab === 'orders' && <><h2>{admin ? 'All orders' : 'My orders'}</h2>{orders.map(o => <div className="order" key={o.id}>
        <b>#{o.id}</b> <span className="pill">{o.status}</span> <small>{admin && o.user_name} • {new Date(o.created_at).toLocaleString()}</small>
        <div>{o.items.map(i => `${i.name} ×${i.qty}`).join(', ')}</div><b>{inr(o.total)}</b></div>)}{!orders.length && <p className="empty">No orders yet.</p>}</>}
      {tab === 'products' && <><h2>Manage phones</h2><div className="form">
        {Object.keys(np).map(k => <input key={k} placeholder={k} value={np[k]} onChange={e => setNp({ ...np, [k]: e.target.value })} />)}
        <button onClick={addP}>Add phone</button></div>
        {prods.map(p => <div className="line" key={p.id}><img src={p.image} onError={onImgErr} /><div><b>{p.name}</b><br /><small>{inr(p.price)} • stock {p.stock}</small></div>
          <button className="ghost" onClick={async () => { await api('/products/' + p.id, 'DELETE'); load(); reload(); }}>Delete</button></div>)}</>}
    </section>{toast && <div className="toast">{toast}</div>}</div>;
}
