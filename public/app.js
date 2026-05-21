const { useState, useEffect, useRef, useCallback } = React;

// === Toast ===
let _toast = null;
function showToast(msg, type = 'success') { if (_toast) _toast(msg, type); }

// === Notifications System ===
function NotificationBell({ userId }) {
    const [count, setCount] = useState(0);
    const [show, setShow] = useState(false);
    const [notifications, setNotifications] = useState([]);
    
    const loadCount = async () => {
        const r = await api.get('../api/notifications.php?action=count_unread');
        if (r.success) setCount(r.count);
    };
    
    const loadNotifications = async () => {
        const r = await api.get('../api/notifications.php?action=list');
        if (r.success) setNotifications(r.notifications);
    };
    
    useEffect(() => {
        loadCount();
        const interval = setInterval(loadCount, 30000);
        return () => clearInterval(interval);
    }, [userId]);
    
    const handleOpen = () => {
        setShow(true);
        loadNotifications();
    };
    
    const markAllRead = async () => {
        await api.request('../api/notifications.php', { action: 'mark_all_read' });
        loadCount();
        loadNotifications();
    };
    
    return (
        <div style={{position:'relative'}}>
            <button className="button button-outline button-small" onClick={handleOpen} style={{position:'relative',padding:'0 12px'}}>
                <i className="bi bi-bell"></i>
                {count > 0 && <span style={{position:'absolute',top:-4,right:-4,background:'#000',color:'#fff',borderRadius:'999px',fontSize:10,fontWeight:700,padding:'2px 6px',minWidth:18,textAlign:'center'}}>{count}</span>}
            </button>
            {show && (
                <div style={{position:'fixed',inset:0,zIndex:99999}} onClick={()=>setShow(false)}>
                    <div className="card" style={{position:'absolute',top:60,right:20,width:360,maxWidth:'calc(100vw - 40px)',margin:0,maxHeight:'70vh',display:'flex',flexDirection:'column'}} onClick={e=>e.stopPropagation()}>
                        <div className="card-header" style={{justifyContent:'space-between'}}>
                            <span>Уведомления</span>
                            <div style={{display:'flex',gap:8}}>
                                {count > 0 && <button className="button button-small" onClick={markAllRead} style={{height:32,padding:'0 12px',fontSize:12}}>Прочитать все</button>}
                                <button className="button button-small button-outline" onClick={()=>setShow(false)} style={{height:32,width:32,padding:0}}><i className="bi bi-x-lg"></i></button>
                            </div>
                        </div>
                        <div style={{flex:1,overflowY:'auto',padding:12}}>
                            {notifications.length === 0 ? (
                                <div className="empty-state" style={{padding:40}}>
                                    <i className="bi bi-bell-slash"></i>
                                    <div>Нет уведомлений</div>
                                </div>
                            ) : notifications.map(n => (
                                <div key={n.id} style={{padding:12,borderRadius:8,background:n.is_read?'transparent':'var(--gray-100)',marginBottom:8,border:'1px solid var(--border)'}}>
                                    <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>{n.title}</div>
                                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>{n.message}</div>
                                    <div style={{fontSize:11,color:'var(--text-light)'}}>{new Date(n.created_at).toLocaleString('ru-RU')}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
function ToastContainer() {
    const [toasts, setToasts] = useState([]);
    const c = useRef(0);
    useEffect(() => {
        _toast = (msg, type) => {
            const id = ++c.current;
            setToasts(p => [...p, { id, msg, type }]);
            setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
        };
    }, []);
    return (
        <div style={{position:'fixed',top:12,left:12,right:12,zIndex:99999}}>
            {toasts.map(t => (
                <div key={t.id} className={'toast toast-opened' + (t.type==='error'?' color-red':'')}
                     style={{position:'relative',marginBottom:8}}>
                    <div className="toast-content">{t.msg}</div>
                    <button className="toast-close-button" onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))}></button>
                </div>
            ))}
        </div>
    );
}

// === API ===
const api = {
    async request(url, data = {}) {
        const fd = new FormData();
        for (const k in data) fd.append(k, data[k]);
        return (await fetch(url, { method: 'POST', body: fd })).json();
    },
    async get(url) { return (await fetch(url)).json(); },
    checkAuth() { return this.get('../api/user.php?action=check_auth'); }
};

// === Status ===
const STATUS = {
    pending:     { text: 'Ожидает',   cls: 'color-gray' },
    accepted:    { text: 'Принят',    cls: 'color-gray' },
    in_progress: { text: 'В пути',    cls: '' },
    delivered:   { text: 'Доставлен', cls: '' },
    cancelled:   { text: 'Отменён',   cls: 'color-red' }
};
function StatusBadge({ status }) {
    const s = STATUS[status] || STATUS.pending;
    return React.createElement('span', {className: 'badge ' + s.cls}, s.text);
}

// === Confirm Dialog ===
function ConfirmDialog({ show, title, message, onConfirm, onCancel, danger }) {
    if (!show) return null;
    return (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:99998,display:'flex',alignItems:'center',justifyContent:'center'}}
             onClick={onCancel}>
            <div className="card" style={{width:280,margin:0}} onClick={e=>e.stopPropagation()}>
                <div className="card-header" style={{fontWeight:600}}>{title||'Подтверждение'}</div>
                <div className="card-content card-content-padding"><p style={{margin:0}}>{message}</p></div>
                <div className="card-footer" style={{justifyContent:'flex-end',gap:8}}>
                    <button className="button button-outline" onClick={onCancel}>Отмена</button>
                    <button className={'button button-fill' + (danger?' color-red':'')} onClick={onConfirm}>Подтвердить</button>
                </div>
            </div>
        </div>
    );
}

// === Page Header ===
function PageHeader({ title, subtitle, actions }) {
    return (
        <div className="page-header">
            <div className="page-header-title">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="page-header-actions">{actions}</div>}
        </div>
    );
}

// === Landing ===
function LandingPage() {
    return (
        <div className="landing-hero">
            <div className="landing-logo"><i className="bi bi-truck"></i></div>
            <h1 className="landing-title">DeliveryCarGo</h1>
            <p className="landing-sub">Быстрая и надёжная доставка грузов по всей стране — оформляйте заказы за пару минут.</p>
            <div className="landing-actions">
                <a href="login.html" className="button button-fill button-large">Войти</a>
                <a href="register.html" className="button button-outline button-large">Создать аккаунт</a>
            </div>
            <div className="landing-features">
                {[
                    {i:'bi-lightning-charge-fill',t:'Быстро',d:'Мгновенное оформление'},
                    {i:'bi-shield-check',t:'Надёжно',d:'Проверенные водители'},
                    {i:'bi-cash-coin',t:'Выгодно',d:'Честные цены'}
                ].map(f=>(
                    <div key={f.t} className="landing-feat">
                        <i className={'bi '+f.i}></i>
                        <div className="landing-feat-t">{f.t}</div>
                        <div className="landing-feat-d">{f.d}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// === DaData ===
const DADATA_TOKEN = '804fe2318870082d27e18b9bda5d241d4d3d549d';
const DADATA_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
function AddressSuggest({ value, onChange, onSelect, placeholder }) {
    const [sugg, setSugg] = useState([]);
    const [show, setShow] = useState(false);
    const ref = useRef(null);
    const db = useRef(null);
    const fetchS = (q) => {
        clearTimeout(db.current);
        if (!q || q.length < 3) { setSugg([]); return; }
        db.current = setTimeout(async () => {
            try {
                const r = await fetch(DADATA_URL, {
                    method:'POST',
                    headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Token '+DADATA_TOKEN},
                    body: JSON.stringify({query:q,count:5})
                });
                const d = await r.json();
                setSugg(d.suggestions||[]); setShow(true);
            } catch(e) { setSugg([]); }
        }, 300);
    };
    useEffect(() => {
        const h = e => { if (ref.current && !ref.current.contains(e.target)) setShow(false); };
        document.addEventListener('mousedown', h);
        document.addEventListener('touchstart', h);
        return () => {
            document.removeEventListener('mousedown', h);
            document.removeEventListener('touchstart', h);
        };
    }, []);
    const pick = (s) => {
        onChange(s.value);
        setSugg([]); setShow(false);
        if (onSelect) onSelect(s);
    };
    return (
        <div ref={ref} style={{position:'relative'}}>
            <div className="list no-hairlines-md" style={{margin:0}}>
                <ul><li className="item-content item-input"><div className="item-inner"><div className="item-input-wrap">
                    <input type="text" placeholder={placeholder} value={value} autoComplete="off"
                        onChange={e=>{onChange(e.target.value);fetchS(e.target.value);}}
                        onFocus={()=>{if(sugg.length)setShow(true);}} />
                </div></div></li></ul>
            </div>
            {show && sugg.length > 0 && (
                <ul className="dadata-suggestions">
                    {sugg.map((s,i)=>(
                        <li key={i} onMouseDown={(e)=>{e.preventDefault();pick(s);}} onTouchStart={(e)=>{e.preventDefault();pick(s);}}>
                            <i className="bi bi-geo-alt-fill" style={{color:'#09090b',marginRight:8}}></i>{s.value}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// Haversine distance (km)
function haversineKm(a, b) {
    if (!a || !b) return 0;
    const R = 6371;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const x = Math.sin(dLat/2)**2 + Math.sin(dLng/2)**2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * R * Math.asin(Math.sqrt(x));
}

// === Create Order Components ===
const YANDEX_API_KEY = '485cdea2-4f3a-4f5a-b0ad-9251c4962490';
const PRICE = {
    base: 300,
    perKm: 25,
    weightRates: [
        { max: 10, mult: 1.0 },
        { max: 50, mult: 1.3 },
        { max: 200, mult: 1.6 },
        { max: 500, mult: 2.0 },
        { max: Infinity, mult: 2.5 }
    ],
    dimensionRate: 0.5,
    options: {
        fragile: { label: 'Хрупкий груз', icon: 'bi-exclamation-diamond', price: 500 },
        express: { label: 'Экспресс доставка', icon: 'bi-lightning-charge', price: 800 },
        insurance: { label: 'Страхование', icon: 'bi-shield-check', price: 400 },
        loading: { label: 'Погрузка/Разгрузка', icon: 'bi-people', price: 600 },
    }
};

function calcPrice(distanceKm, weightKg, volumeM3, selectedOptions) {
    let total = PRICE.base;
    total += distanceKm * PRICE.perKm;
    const wRate = PRICE.weightRates.find(r => weightKg <= r.max) || PRICE.weightRates[PRICE.weightRates.length - 1];
    total *= wRate.mult;
    if (volumeM3 > 1) total += (volumeM3 - 1) * PRICE.dimensionRate * 1000;
    for (const opt of selectedOptions) {
        if (PRICE.options[opt]) total += PRICE.options[opt].price;
    }
    return Math.round(total);
}

function formatTime(minutes) {
    const mins = Math.round(minutes);
    if (mins >= 1440) {
        const days = Math.round(mins / 1440);
        return days + ' ' + (days === 1 ? 'день' : (days >= 2 && days <= 4) ? 'дня' : 'дней');
    }
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const m = mins % 60;
        const hLabel = hours + ' ' + (hours === 1 ? 'час' : (hours >= 2 && hours <= 4) ? 'часа' : 'часов');
        return m > 0 ? hLabel + ' ' + m + ' мин' : hLabel;
    }
    return mins + ' мин';
}

async function geocodeAddress(address) {
    try {
        const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${YANDEX_API_KEY}&geocode=${encodeURIComponent(address)}&format=json&results=1`;
        const r = await fetch(url);
        const data = await r.json();
        const pos = data.response.GeoObjectCollection.featureMember[0]?.GeoObject.Point.pos;
        if (!pos) return null;
        const [lng, lat] = pos.split(' ').map(Number);
        return [lat, lng];
    } catch { return null; }
}

function Stepper({ steps, current }) {
    const pct = ((current + 1) / steps.length) * 100;
    return (
        <React.Fragment>
            {/* Desktop / tablet: dot-based stepper */}
            <div className="stepper-row stepper-desktop">
                {steps.map((s, i) => (
                    <React.Fragment key={i}>
                        {i > 0 && <div className={'stepper-bar' + (i <= current ? ' done' : '')}></div>}
                        <div className={'stepper-item' + (i === current ? ' active' : '') + (i < current ? ' done' : '')}>
                            <div className={'stepper-dot' + (i === current ? ' active' : '') + (i < current ? ' done' : '')}>
                                {i < current ? <i className="bi bi-check-lg"></i> : i + 1}
                            </div>
                            <div className="stepper-label">{s}</div>
                        </div>
                    </React.Fragment>
                ))}
            </div>
            {/* Mobile: compact progress bar */}
            <div className="stepper-mobile">
                <div className="stepper-mobile-head">
                    <span className="stepper-mobile-step">Шаг {current + 1} из {steps.length}</span>
                    <span className="stepper-mobile-title">{steps[current]}</span>
                </div>
                <div className="stepper-mobile-track">
                    <div className="stepper-mobile-fill" style={{width: pct + '%'}}></div>
                </div>
            </div>
        </React.Fragment>
    );
}

// === Stats ===
function Stats({ orders, userRole }) {
    const total = orders.length;
    const pending = orders.filter(o => o.status === 'pending').length;
    const inProg = orders.filter(o => o.status === 'in_progress').length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    const earnings = orders.filter(o => o.status === 'delivered').reduce((s, o) => s + parseFloat(o.price || 0), 0);
    const cards = [
        { icon: 'bi-receipt', val: total, label: 'Всего' },
        { icon: 'bi-clock', val: pending, label: 'Ожидают' },
        { icon: 'bi-truck', val: inProg, label: 'В пути' },
        { icon: 'bi-check-circle', val: delivered, label: 'Доставлено' },
    ];
    return (
        <div className="stat-grid" style={{marginBottom:16}}>
            {cards.map(c => (
                <div key={c.label} className="stat-item">
                    <i className={'bi '+c.icon+' stat-icon'}></i>
                    <div className="stat-val">{c.val}</div>
                    <div className="stat-lbl">{c.label}</div>
                </div>
            ))}
            {userRole === 'driver' && (
                <div className="stat-item">
                    <i className="bi bi-wallet2 stat-icon"></i>
                    <div className="stat-val">{earnings.toLocaleString('ru-RU')} ₽</div>
                    <div className="stat-lbl">Заработано</div>
                </div>
            )}
        </div>
    );
}

// === OrderCard ===
function OrderCard({ order, userRole, userId, onAction }) {
    const [confirm, setConfirm] = useState(null);
    const doAction = async () => {
        if (!confirm) return;
        const { action, status } = confirm;
        setConfirm(null);
        let r;
        if (action === 'accept') r = await api.request('../api/orders.php', { action: 'accept', order_id: order.id });
        else if (action === 'cancel') r = await api.request('../api/orders.php', { action: 'cancel', order_id: order.id });
        else r = await api.request('../api/orders.php', { action: 'update_status', order_id: order.id, status, comment: '' });
        if (r.success) { showToast(r.message, 'success'); if (onAction) onAction(); }
        else showToast(r.message, 'error');
    };
    const myOrder = String(order.driver_id) === String(userId);
    return (
        <React.Fragment>
            <ConfirmDialog show={!!confirm} title="Подтверждение" danger={confirm && confirm.action === 'cancel'}
                message={confirm ? confirm.label : ''} onConfirm={doAction} onCancel={() => setConfirm(null)} />
            <div className="card order-card">
                <div className="card-content card-content-padding">
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                        <span style={{fontWeight:600,fontSize:15}}>Заказ #{order.id}</span>
                        <StatusBadge status={order.status} />
                    </div>
                    <div style={{fontSize:13,marginBottom:4}}>
                        <i className="bi bi-circle" style={{color:'#09090b',marginRight:6,fontSize:10}}></i>
                        <strong>От:</strong> {order.pickup_address}
                    </div>
                    <div style={{fontSize:13,marginBottom:6}}>
                        <i className="bi bi-geo-alt-fill" style={{color:'#09090b',marginRight:6,fontSize:10}}></i>
                        <strong>До:</strong> {order.delivery_address}
                    </div>
                    {order.cargo_description && <div style={{fontSize:12,color:'#71717a',marginBottom:4}}><i className="bi bi-box-seam" style={{marginRight:4}}></i>{order.cargo_description}</div>}
                    {order.cargo_weight > 0 && <div style={{fontSize:12,color:'#71717a',marginBottom:4}}>Вес: {order.cargo_weight} кг</div>}
                    <div className="price-tag" style={{margin:'6px 0'}}>{Number(order.price).toLocaleString('ru-RU')} ₽</div>
                    <div style={{fontSize:11,color:'#a1a1aa'}}><i className="bi bi-clock" style={{marginRight:4}}></i>{new Date(order.created_at).toLocaleString('ru-RU')}</div>
                    {(order.driver_name || order.client_name) && (
                        <div style={{background:'#f4f4f5',borderRadius:6,padding:'8px 10px',marginTop:8,fontSize:12}}>
                            {order.driver_name && <div><i className="bi bi-person-check" style={{marginRight:4}}></i><strong>Водитель:</strong> {order.driver_name}</div>}
                            {order.client_name && <div><i className="bi bi-person" style={{marginRight:4}}></i><strong>Клиент:</strong> {order.client_name}</div>}
                        </div>
                    )}
                    <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
                        {userRole === 'driver' && order.status === 'pending' && (
                            <button className="button button-fill button-small" onClick={() => setConfirm({ action:'accept', label:'Принять заказ #'+order.id+'?' })}>
                                <i className="bi bi-check" style={{marginRight:4}}></i>Принять
                            </button>
                        )}
                        {userRole === 'driver' && order.status === 'accepted' && myOrder && (
                            <button className="button button-fill button-small" onClick={() => setConfirm({ action:'update_status', status:'in_progress', label:'Начать доставку?' })}>
                                <i className="bi bi-truck" style={{marginRight:4}}></i>В путь
                            </button>
                        )}
                        {userRole === 'driver' && order.status === 'in_progress' && myOrder && (
                            <button className="button button-fill button-small" onClick={() => setConfirm({ action:'update_status', status:'delivered', label:'Отметить как доставленный?' })}>
                                <i className="bi bi-check-circle" style={{marginRight:4}}></i>Доставлено
                            </button>
                        )}
                        {userRole === 'client' && order.status === 'pending' && (
                            <button className="button button-outline color-red button-small" onClick={() => setConfirm({ action:'cancel', label:'Отменить заказ #'+order.id+'?' })}>
                                <i className="bi bi-x-circle" style={{marginRight:4}}></i>Отменить
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </React.Fragment>
    );
}

// === FilterModal ===
function FilterModal({ show, filter, onSelect, onClose }) {
    const filters = [
        { key: 'all', label: 'Все заказы', icon: 'bi-grid', color: '#09090b' },
        { key: 'pending', label: 'Ожидают', icon: 'bi-clock', color: '#f59e0b' },
        { key: 'accepted', label: 'Приняты', icon: 'bi-check-circle', color: '#3b82f6' },
        { key: 'in_progress', label: 'В пути', icon: 'bi-truck', color: '#8b5cf6' },
        { key: 'delivered', label: 'Доставлены', icon: 'bi-box-seam', color: '#10b981' },
        { key: 'cancelled', label: 'Отменены', icon: 'bi-x-circle', color: '#ef4444' }
    ];
    if (!show) return null;
    return (
        <div className="filter-modal-backdrop" onClick={onClose}>
            <div className="filter-modal" onClick={e => e.stopPropagation()}>
                <div className="filter-modal-header">
                    <span>Фильтр заказов</span>
                    <button className="button" onClick={onClose}><i className="bi bi-x-lg"></i></button>
                </div>
                <div className="filter-modal-body">
                    {filters.map(f => (
                        <button key={f.key} className={'filter-option' + (filter === f.key ? ' active' : '')} onClick={() => { onSelect(f.key); onClose(); }}>
                            <i className={'bi ' + f.icon} style={{ color: f.color }}></i>
                            <span>{f.label}</span>
                            {filter === f.key && <i className="bi bi-check-lg check-icon"></i>}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// === OrderList ===
function OrderList({ userRole, userId, refreshKey }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [showFilter, setShowFilter] = useState(false);
    const loadOrders = async () => {
        setLoading(true);
        const r = await api.request('../api/orders.php', { action: 'list' });
        if (r.success) setOrders(r.orders);
        setLoading(false);
    };
    useEffect(() => { loadOrders(); }, [refreshKey]);
    const filterLabel = { all: 'Все', pending: 'Ожидают', accepted: 'Приняты', in_progress: 'В пути', delivered: 'Доставлены', cancelled: 'Отменены' };
    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
    if (loading) return <div className="loading-center"><div className="preloader"></div></div>;
    return (
        <div className="orders-page">
            <FilterModal show={showFilter} filter={filter} onSelect={setFilter} onClose={() => setShowFilter(false)} />
            <div className="orders-header">
                <div className="orders-title">
                    <span className="block-title">Заказы</span>
                    <span className="badge">{filtered.length}</span>
                </div>
                <div className="orders-actions">
                    <button className="button button-filter" onClick={() => setShowFilter(true)}>
                        <i className="bi bi-funnel"></i>
                        <span>{filterLabel[filter]}</span>
                    </button>
                    <button className="button button-refresh" onClick={loadOrders}>
                        <i className="bi bi-arrow-clockwise"></i>
                    </button>
                </div>
            </div>
            <div className="orders-list">
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <i className="bi bi-inbox"></i>
                        <div>Нет заказов</div>
                        <div className="empty-hint">Попробуйте изменить фильтры</div>
                    </div>
                ) : filtered.map(o => (
                    <OrderCard key={o.id} order={o} userRole={userRole} userId={userId} onAction={loadOrders} />
                ))}
            </div>
        </div>
    );
}

// === Profile ===
function Profile({ onUpdate, orders }) {
    const [profile, setProfile] = useState(null);
    const [editing, setEditing] = useState(false);
    const [editingDriver, setEditingDriver] = useState(false);
    const [form, setForm] = useState({ full_name: '', phone: '' });
    const [driverForm, setDriverForm] = useState({ car_model: '', car_number: '', license_number: '' });
    const [loading, setLoading] = useState(false);
    const loadProfile = async () => {
        const r = await api.request('../api/user.php', { action: 'get_profile' });
        if (r.success) {
            setProfile(r.user);
            setForm({ full_name: r.user.full_name, phone: r.user.phone || '' });
            if (r.user.driver_info) setDriverForm({ car_model: r.user.driver_info.car_model||'', car_number: r.user.driver_info.car_number||'', license_number: r.user.driver_info.license_number||'' });
        }
    };
    useEffect(() => { loadProfile(); }, []);
    
    const userOrders = orders || [];
    const totalOrders = userOrders.length;
    const completedOrders = userOrders.filter(o => o.status === 'delivered').length;
    const totalSpent = userOrders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + parseFloat(o.price || 0), 0);
    const handleUserUpdate = async (e) => {
        e.preventDefault(); setLoading(true);
        const r = await api.request('../api/user.php', { action: 'update_profile', ...form });
        setLoading(false);
        if (r.success) { showToast(r.message,'success'); setEditing(false); loadProfile(); if(onUpdate) onUpdate(); }
        else showToast(r.message,'error');
    };
    const handleDriverUpdate = async (e) => {
        e.preventDefault(); setLoading(true);
        const r = await api.request('../api/driver.php', { action: 'update_profile', ...driverForm });
        setLoading(false);
        if (r.success) { showToast(r.message,'success'); setEditingDriver(false); loadProfile(); }
        else showToast(r.message,'error');
    };
    if (!profile) return <div style={{textAlign:'center',padding:40}}><div className="preloader"></div></div>;
    const roleLabel = { client:'Клиент', driver:'Водитель', admin:'Администратор' };
    return (
        <div>
            <div className="card">
                <div className="card-content card-content-padding" style={{textAlign:'center'}}>
                    <div className="avatar">{profile.full_name.charAt(0).toUpperCase()}</div>
                    <div style={{fontWeight:700,fontSize:18}}>{profile.full_name}</div>
                    <div style={{color:'var(--text-muted)',fontSize:13,marginBottom:6}}>{profile.email}</div>
                    <span className="badge color-gray">{roleLabel[profile.role]||profile.role}</span>
                </div>
            </div>
            
            {totalOrders > 0 && (
                <div className="card">
                    <div className="card-header"><i className="bi bi-bar-chart"></i>Моя статистика</div>
                    <div className="card-content-padding">
                        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                            <div style={{textAlign:'center'}}>
                                <div style={{fontSize:24,fontWeight:700,marginBottom:4}}>{totalOrders}</div>
                                <div style={{fontSize:12,color:'var(--text-muted)'}}>Всего заказов</div>
                            </div>
                            <div style={{textAlign:'center'}}>
                                <div style={{fontSize:24,fontWeight:700,marginBottom:4}}>{completedOrders}</div>
                                <div style={{fontSize:12,color:'var(--text-muted)'}}>Выполнено</div>
                            </div>
                            <div style={{textAlign:'center'}}>
                                <div style={{fontSize:24,fontWeight:700,marginBottom:4}}>{totalSpent.toLocaleString('ru-RU')} ₽</div>
                                <div style={{fontSize:12,color:'var(--text-muted)'}}>{profile.role === 'driver' ? 'Заработано' : 'Потрачено'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="card">
                <div className="card-header">Личные данные</div>
                <div className="card-content card-content-padding">
                    {editing ? (
                        <form onSubmit={handleUserUpdate}>
                            <div className="list no-hairlines-md" style={{margin:'-8px 0'}}>
                                <ul>
                                    <li className="item-content item-input"><div className="item-inner"><div className="item-title item-label">ФИО</div><div className="item-input-wrap"><input type="text" value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} required /></div></div></li>
                                    <li className="item-content item-input"><div className="item-inner"><div className="item-title item-label">Телефон</div><div className="item-input-wrap"><input type="tel" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} /></div></div></li>
                                </ul>
                            </div>
                            <div style={{display:'flex',gap:8,marginTop:12}}>
                                <button type="submit" className="button button-fill button-small" disabled={loading}>Сохранить</button>
                                <button type="button" className="button button-outline button-small" onClick={()=>setEditing(false)}>Отмена</button>
                            </div>
                        </form>
                    ) : (
                        <div>
                            <div style={{fontSize:14,marginBottom:4}}><strong>Телефон:</strong> {profile.phone || <span style={{color:'#a1a1aa'}}>Не указан</span>}</div>
                            <div style={{fontSize:14,marginBottom:10}}><strong>Регистрация:</strong> {new Date(profile.created_at).toLocaleDateString('ru-RU')}</div>
                            <button className="button button-fill button-small" onClick={()=>setEditing(true)}>
                                <i className="bi bi-pencil" style={{marginRight:4}}></i>Редактировать
                            </button>
                        </div>
                    )}
                </div>
            </div>
            {profile.role === 'driver' && (
                <div className="card">
                    <div className="card-header">Данные водителя</div>
                    <div className="card-content card-content-padding">
                        {editingDriver ? (
                            <form onSubmit={handleDriverUpdate}>
                                <div className="list no-hairlines-md" style={{margin:'-8px 0'}}>
                                    <ul>
                                        <li className="item-content item-input"><div className="item-inner"><div className="item-title item-label">Авто</div><div className="item-input-wrap"><input type="text" placeholder="Toyota Hiace" value={driverForm.car_model} onChange={e=>setDriverForm(p=>({...p,car_model:e.target.value}))} /></div></div></li>
                                        <li className="item-content item-input"><div className="item-inner"><div className="item-title item-label">Гос. номер</div><div className="item-input-wrap"><input type="text" placeholder="А123БВ77" value={driverForm.car_number} onChange={e=>setDriverForm(p=>({...p,car_number:e.target.value}))} /></div></div></li>
                                        <li className="item-content item-input"><div className="item-inner"><div className="item-title item-label">Номер ВУ</div><div className="item-input-wrap"><input type="text" placeholder="77 ЯЯ 123456" value={driverForm.license_number} onChange={e=>setDriverForm(p=>({...p,license_number:e.target.value}))} /></div></div></li>
                                    </ul>
                                </div>
                                <div style={{display:'flex',gap:8,marginTop:12}}>
                                    <button type="submit" className="button button-fill button-small" disabled={loading}>Сохранить</button>
                                    <button type="button" className="button button-outline button-small" onClick={()=>setEditingDriver(false)}>Отмена</button>
                                </div>
                            </form>
                        ) : (
                            <div>
                                {profile.driver_info ? (
                                    <div style={{fontSize:14}}>
                                        <div style={{marginBottom:4}}><strong>Автомобиль:</strong> {profile.driver_info.car_model || <span style={{color:'#a1a1aa'}}>Не указан</span>}</div>
                                        <div style={{marginBottom:4}}><strong>Гос. номер:</strong> {profile.driver_info.car_number || <span style={{color:'#a1a1aa'}}>Не указан</span>}</div>
                                        <div style={{marginBottom:10}}><strong>Рейтинг:</strong> {profile.driver_info.rating}</div>
                                    </div>
                                ) : <div style={{color:'#a1a1aa',marginBottom:10}}>Данные не заполнены</div>}
                                <button className="button button-fill button-small" onClick={()=>setEditingDriver(true)}>
                                    <i className="bi bi-pencil" style={{marginRight:4}}></i>Изменить
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// === AdminPanel ===
function AdminPanel() {
    const [tab, setTab] = useState('dashboard');
    const [users, setUsers] = useState([]);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [stats, setStats] = useState(null);
    const loadOrders = async () => { setLoading(true); const r = await api.request('../api/orders.php',{action:'list'}); if(r.success)setOrders(r.orders); setLoading(false); };
    const loadUsers = async () => { setLoading(true); const r = await api.get('../api/admin.php?action=list_users'); if(r.success)setUsers(r.users); setLoading(false); };
    const loadStats = async () => { const r = await api.get('../api/admin.php?action=stats'); if(r.success)setStats(r.stats); };
    useEffect(() => { loadStats(); if(tab==='orders')loadOrders(); else if(tab==='users')loadUsers(); }, [tab]);
    const askConfirm = (title,msg,danger,fn) => setConfirm({title,msg,danger,fn});
    const cancelOrder = (id) => askConfirm('Отмена','Отменить заказ #'+id+'?',true,async()=>{
        const r = await api.request('../api/orders.php',{action:'cancel',order_id:id});
        if(r.success){showToast(r.message,'success');loadOrders();loadStats();}else showToast(r.message,'error');
    });
    const deleteUser = (id,name) => askConfirm('Удаление','Удалить «'+name+'»?',true,async()=>{
        const r = await api.request('../api/admin.php',{action:'delete_user',user_id:id});
        if(r.success){showToast(r.message,'success');loadUsers();loadStats();}else showToast(r.message,'error');
    });
    const changeRole = async (id,role) => {
        const r = await api.request('../api/admin.php',{action:'update_user_role',user_id:id,role});
        if(r.success){showToast(r.message,'success');loadUsers();}else showToast(r.message,'error');
    };
    const roleLabel = {client:'Клиент',driver:'Водитель',admin:'Админ'};
    return (
        <div>
            <ConfirmDialog show={!!confirm} title={confirm?.title} message={confirm?.msg} danger={confirm?.danger}
                onConfirm={()=>{const fn=confirm.fn;setConfirm(null);fn();}} onCancel={()=>setConfirm(null)} />
            
            <div className="segmented segmented-strong" style={{marginBottom:24}}>
                <button className={'button'+(tab==='dashboard'?' button-active':'')} onClick={()=>setTab('dashboard')}>Дашборд</button>
                <button className={'button'+(tab==='orders'?' button-active':'')} onClick={()=>setTab('orders')}>Заказы</button>
                <button className={'button'+(tab==='users'?' button-active':'')} onClick={()=>setTab('users')}>Пользователи</button>
            </div>
            
            {tab === 'dashboard' && stats && (
                <div>
                    <div className="stat-grid">
                        {[
                            {i:'bi-people',v:stats.clients,l:'Клиентов',c:'#000'},
                            {i:'bi-truck',v:stats.drivers,l:'Водителей',c:'#000'},
                            {i:'bi-receipt',v:stats.orders_total,l:'Всего заказов',c:'#000'},
                            {i:'bi-clock',v:stats.orders_pending,l:'Ожидают',c:'#000'},
                            {i:'bi-arrow-right-circle',v:stats.orders_in_progress,l:'В пути',c:'#000'},
                            {i:'bi-check-circle',v:stats.orders_delivered,l:'Доставлено',c:'#000'},
                            {i:'bi-x-circle',v:stats.orders_cancelled,l:'Отменено',c:'#000'},
                            {i:'bi-wallet2',v:Number(stats.revenue).toLocaleString('ru-RU')+' ₽',l:'Выручка',c:'#000'}
                        ].map(c=>(
                            <div key={c.l} className="stat-item">
                                <i className={'bi '+c.i+' stat-icon'} style={{color:c.c}}></i>
                                <div className="stat-val">{c.v}</div>
                                <div className="stat-lbl">{c.l}</div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="card">
                        <div className="card-header"><i className="bi bi-graph-up"></i>Статистика заказов за 7 дней</div>
                        <div className="card-content-padding">
                            {stats.orders_by_day && stats.orders_by_day.length > 0 ? (
                                <div style={{display:'flex',alignItems:'flex-end',gap:8,height:200,padding:'20px 0'}}>
                                    {stats.orders_by_day.map((d,i)=>{
                                        const max = Math.max(...stats.orders_by_day.map(x=>x.count));
                                        const h = max > 0 ? (d.count / max) * 160 : 20;
                                        return (
                                            <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                                                <div style={{fontSize:11,fontWeight:600}}>{d.count}</div>
                                                <div style={{width:'100%',height:h,background:'#000',borderRadius:4,transition:'all 0.3s'}}></div>
                                                <div style={{fontSize:10,color:'var(--text-muted)',textAlign:'center'}}>{new Date(d.date).toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>Нет данных</div>}
                        </div>
                    </div>
                    
                    {stats.top_drivers && stats.top_drivers.length > 0 && (
                        <div className="card">
                            <div className="card-header"><i className="bi bi-trophy"></i>Топ водителей</div>
                            <div className="card-content-padding">
                                {stats.top_drivers.map((d,i)=>(
                                    <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:i<stats.top_drivers.length-1?'1px solid var(--border)':'none'}}>
                                        <div style={{display:'flex',alignItems:'center',gap:12}}>
                                            <div style={{width:32,height:32,borderRadius:'50%',background:'var(--gray-100)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:14}}>#{i+1}</div>
                                            <div>
                                                <div style={{fontWeight:600,fontSize:14}}>{d.full_name}</div>
                                                <div style={{fontSize:12,color:'var(--text-muted)'}}>{d.order_count} заказов</div>
                                            </div>
                                        </div>
                                        <div style={{fontWeight:700,fontSize:15}}>{Number(d.total_revenue).toLocaleString('ru-RU')} ₽</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {loading && <div style={{textAlign:'center',padding:30}}><div className="preloader"></div></div>}
            {!loading && tab === 'orders' && (
                <div>
                    {orders.length===0 ? <div className="empty-state"><i className="bi bi-inbox"></i><div>Нет заказов</div></div> :
                    orders.map(o=>(
                        <div key={o.id} className="card" style={{marginBottom:10}}>
                            <div className="card-content card-content-padding" style={{padding:'12px 14px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                                    <span style={{fontWeight:600,fontSize:14}}>#{o.id} {o.client_name}</span>
                                    <StatusBadge status={o.status} />
                                </div>
                                <div style={{fontSize:12,color:'#71717a',marginBottom:2}}>{o.pickup_address}</div>
                                <div style={{fontSize:12,color:'#71717a',marginBottom:4}}>→ {o.delivery_address}</div>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                                    <span style={{fontWeight:600}}>{Number(o.price).toLocaleString('ru-RU')} ₽</span>
                                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                                        {o.driver_name && <span style={{fontSize:12,color:'#71717a'}}>{o.driver_name}</span>}
                                        {!['delivered','cancelled'].includes(o.status) && (
                                            <button className="button button-small button-outline color-red" onClick={()=>cancelOrder(o.id)} style={{minWidth:32,padding:'2px 8px'}}>
                                                <i className="bi bi-x-lg"></i>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {!loading && tab === 'users' && (
                <div>
                    {users.length===0 ? <div className="empty-state"><i className="bi bi-people"></i><div>Нет пользователей</div></div> :
                    users.map(u=>(
                        <div key={u.id} className="card" style={{marginBottom:10}}>
                            <div className="card-content card-content-padding" style={{padding:'12px 14px'}}>
                                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                                    <div>
                                        <div style={{fontWeight:600,fontSize:14}}>{u.full_name}</div>
                                        <div style={{fontSize:12,color:'#71717a'}}>{u.email}</div>
                                    </div>
                                    {u.role !== 'admin' && (
                                        <button className="button button-small button-outline color-red" onClick={()=>deleteUser(u.id,u.full_name)} style={{minWidth:32,padding:'2px 8px'}}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    )}
                                </div>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
                                    {u.role === 'admin' ? <span className="badge color-red">Админ</span> : (
                                        <select value={u.role} onChange={e=>changeRole(u.id,e.target.value)}
                                            style={{border:'1px solid #e4e4e7',borderRadius:6,padding:'4px 8px',fontSize:13,background:'#fff'}}>
                                            <option value="client">Клиент</option>
                                            <option value="driver">Водитель</option>
                                            <option value="admin">Администратор</option>
                                        </select>
                                    )}
                                    {u.phone && <span style={{fontSize:12,color:'#71717a'}}>{u.phone}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// === CreateOrder ===
function CreateOrder({ onComplete }) {
    const [step, setStep] = useState(0);
    const [pickup, setPickup] = useState('');
    const [delivery, setDelivery] = useState('');
    const [pickupCoords, setPickupCoords] = useState(null);
    const [deliveryCoords, setDeliveryCoords] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [cargoType, setCargoType] = useState('');
    const [cargoWeight, setCargoWeight] = useState('');
    const [cargoDimL, setCargoDimL] = useState('');
    const [cargoDimW, setCargoDimW] = useState('');
    const [cargoDimH, setCargoDimH] = useState('');
    const [selectedOptions, setSelectedOptions] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const steps = ['Маршрут', 'Груз', 'Опции', 'Подтверждение'];

    // Auto-build routeInfo as soon as both coords are known
    useEffect(() => {
        if (pickupCoords && deliveryCoords) {
            const dist = haversineKm(pickupCoords, deliveryCoords);
            // average truck speed ~ 40 km/h in city => 1.5 min per km
            setRouteInfo({ distanceKm: dist, timeMin: dist * 1.5 });
        } else {
            setRouteInfo(null);
        }
    }, [pickupCoords, deliveryCoords]);

    const handleSelect = async (which, s) => {
        // DaData suggestion already contains lat/lng in data.geo_lat/geo_lon
        setLoadingRoute(true);
        let coords = null;
        const geo = s && s.data;
        if (geo && geo.geo_lat && geo.geo_lon) {
            coords = [parseFloat(geo.geo_lat), parseFloat(geo.geo_lon)];
        } else {
            coords = await geocodeAddress(s.value);
        }
        if (which === 'pickup') setPickupCoords(coords);
        else setDeliveryCoords(coords);
        setLoadingRoute(false);
    };

    const volumeM3 = (parseFloat(cargoDimL) || 0) * (parseFloat(cargoDimW) || 0) * (parseFloat(cargoDimH) || 0);
    const weightKg = parseFloat(cargoWeight) || 0;
    const distanceKm = routeInfo ? routeInfo.distanceKm : 0;
    const price = calcPrice(distanceKm, weightKg, volumeM3, selectedOptions);

    const toggleOption = (key) => {
        setSelectedOptions(prev => prev.includes(key) ? prev.filter(o => o !== key) : [...prev, key]);
    };

    const canProceed = (s) => {
        if (s === 0) return pickup && delivery && pickupCoords && deliveryCoords && routeInfo;
        if (s === 1) return cargoType && cargoWeight;
        return true;
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        const dims = (cargoDimL && cargoDimW && cargoDimH) ? `${cargoDimL}×${cargoDimW}×${cargoDimH}` : '';
        const r = await api.request('../api/orders.php', {
            action: 'create',
            pickup_address: pickup,
            delivery_address: delivery,
            cargo_description: cargoType + (selectedOptions.length ? ' | Опции: ' + selectedOptions.map(o => PRICE.options[o].label).join(', ') : ''),
            cargo_weight: cargoWeight,
            cargo_dimensions: dims,
            price: price
        });
        setSubmitting(false);
        if (r.success) {
            showToast('Заказ успешно создан!', 'success');
            if (onComplete) onComplete();
        } else {
            showToast(r.message || 'Ошибка', 'error');
        }
    };

    return (
        <div className="create-order-container">
            <Stepper steps={steps} current={step} />

            {step === 0 && (
                <div>
                    <div className="card create-order-card">
                        <div className="card-header"><i className="bi bi-geo-alt"></i>Маршрут доставки</div>
                        <div className="list no-hairlines-md">
                            <ul>
                                <li className="item-content item-input route-row">
                                    <div className="item-inner">
                                        <div className="item-title item-label"><i className="bi bi-circle-fill route-dot pickup"></i>Откуда забрать{pickupCoords && <span className="address-ok"><i className="bi bi-check-circle-fill"></i>распознан</span>}</div>
                                        <div className="item-input-wrap">
                                            <AddressSuggest placeholder="Введите адрес отправления..." value={pickup}
                                                onChange={v => { setPickup(v); setPickupCoords(null); setRouteInfo(null); }}
                                                onSelect={s => handleSelect('pickup', s)} />
                                        </div>
                                    </div>
                                </li>
                                <li className="item-content item-input route-row">
                                    <div className="item-inner">
                                        <div className="item-title item-label"><i className="bi bi-geo-alt-fill route-dot delivery"></i>Куда доставить{deliveryCoords && <span className="address-ok"><i className="bi bi-check-circle-fill"></i>распознан</span>}</div>
                                        <div className="item-input-wrap">
                                            <AddressSuggest placeholder="Введите адрес доставки..." value={delivery}
                                                onChange={v => { setDelivery(v); setDeliveryCoords(null); setRouteInfo(null); }}
                                                onSelect={s => handleSelect('delivery', s)} />
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        {loadingRoute && (
                            <div className="form-loading">
                                <div className="preloader"></div>
                                <div>Определяем координаты...</div>
                            </div>
                        )}
                        {pickupCoords && deliveryCoords && routeInfo && (
                            <div className="route-info-grid">
                                <div>
                                    <div className="ri-val">{routeInfo.distanceKm.toFixed(1)} км</div>
                                    <div className="ri-lbl">Расстояние</div>
                                </div>
                                <div>
                                    <div className="ri-val">~{formatTime(routeInfo.timeMin)}</div>
                                    <div className="ri-lbl">В пути</div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="form-navigation" style={{justifyContent:'flex-end'}}>
                        <button className="button button-next" disabled={!canProceed(0)} onClick={() => setStep(1)}>
                            Далее <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 1 && (
                <div>
                    <div className="card create-order-card">
                        <div className="card-header"><i className="bi bi-box-seam"></i>Информация о грузе</div>
                        <div className="list no-hairlines-md">
                            <ul>
                                <li className="item-content item-input">
                                    <div className="item-inner">
                                        <div className="item-title item-label"><i className="bi bi-box" style={{marginRight:6}}></i>Тип груза</div>
                                        <div className="item-input-wrap">
                                            <select value={cargoType} onChange={e => setCargoType(e.target.value)} required>
                                                <option value="">Выберите тип...</option>
                                                <option value="Документы">Документы</option>
                                                <option value="Электроника">Электроника</option>
                                                <option value="Мебель">Мебель</option>
                                                <option value="Стройматериалы">Стройматериалы</option>
                                                <option value="Продукты питания">Продукты питания</option>
                                                <option value="Одежда и текстиль">Одежда и текстиль</option>
                                                <option value="Оборудование">Оборудование</option>
                                                <option value="Другое">Другое</option>
                                            </select>
                                        </div>
                                    </div>
                                </li>
                                <li className="item-content item-input">
                                    <div className="item-inner">
                                        <div className="item-title item-label"><i className="bi bi-speedometer" style={{marginRight:6}}></i>Вес (кг)</div>
                                        <div className="item-input-wrap">
                                            <input type="number" step="0.1" min="0.1" placeholder="Укажите вес"
                                                value={cargoWeight} onChange={e => setCargoWeight(e.target.value)} required />
                                        </div>
                                    </div>
                                    {weightKg > 0 && (
                                        <div style={{fontSize:13,color:'#71717a',padding:'0 16px 12px'}}>
                                            Коэффициент веса: x{(PRICE.weightRates.find(r => weightKg <= r.max) || PRICE.weightRates[PRICE.weightRates.length - 1]).mult}
                                        </div>
                                    )}
                                </li>
                            </ul>
                        </div>
                        <div className="card-content-padding">
                            <div style={{fontSize:14,fontWeight:500,color:'#71717a',marginBottom:12}}><i className="bi bi-rulers" style={{marginRight:6}}></i>Габариты (м)</div>
                            <div className="dimension-grid">
                                <input type="number" step="0.1" min="0" placeholder="Длина"
                                    value={cargoDimL} onChange={e => setCargoDimL(e.target.value)} />
                                <input type="number" step="0.1" min="0" placeholder="Ширина"
                                    value={cargoDimW} onChange={e => setCargoDimW(e.target.value)} />
                                <input type="number" step="0.1" min="0" placeholder="Высота"
                                    value={cargoDimH} onChange={e => setCargoDimH(e.target.value)} />
                            </div>
                            {volumeM3 > 0 && <div style={{fontSize:13,color:'#71717a',marginTop:12,textAlign:'center'}}>Объём: {volumeM3.toFixed(2)} м³</div>}
                        </div>
                    </div>
                    <div className="form-navigation">
                        <button className="button button-prev" onClick={() => setStep(0)}>
                            <i className="bi bi-arrow-left"></i>Назад
                        </button>
                        <button className="button button-next" disabled={!canProceed(1)} onClick={() => setStep(2)}>
                            Далее <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 2 && (
                <div>
                    <div className="card create-order-card">
                        <div className="card-header"><i className="bi bi-sliders"></i>Дополнительные опции</div>
                        <div className="card-content card-content-padding">
                            <div style={{fontSize:14,color:'#71717a',marginBottom:16}}>Выберите нужные дополнительные услуги (необязательно)</div>
                            <div className="option-cards">
                                {Object.entries(PRICE.options).map(([key, opt]) => (
                                    <div key={key} className={'option-card' + (selectedOptions.includes(key) ? ' selected' : '')}
                                        onClick={() => toggleOption(key)}>
                                        {selectedOptions.includes(key) && <i className="bi bi-check-lg option-check"></i>}
                                        <i className={'bi ' + opt.icon}></i>
                                        <div className="option-label">{opt.label}</div>
                                        <div className="option-price">+{opt.price.toLocaleString('ru-RU')} ₽</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><i className="bi bi-cash-coin"></i>Расчёт стоимости</div>
                        <div className="card-content card-content-padding">
                            <div className="price-summary" style={{margin:0,background:'transparent',padding:0}}>
                                <div className="price-summary-row"><span>Базовая стоимость</span><span>{PRICE.base} ₽</span></div>
                                <div className="price-summary-row"><span>Расстояние ({distanceKm.toFixed(1)} км × {PRICE.perKm} ₽)</span><span>{Math.round(distanceKm * PRICE.perKm)} ₽</span></div>
                                <div className="price-summary-row"><span>Коэффициент веса ({weightKg} кг)</span><span>×{(PRICE.weightRates.find(r => weightKg <= r.max) || PRICE.weightRates[PRICE.weightRates.length - 1]).mult}</span></div>
                                {volumeM3 > 1 && <div className="price-summary-row"><span>Объём (+{(volumeM3 - 1).toFixed(2)} м³)</span><span>+{Math.round((volumeM3 - 1) * PRICE.dimensionRate * 1000)} ₽</span></div>}
                                {selectedOptions.map(key => (
                                    <div key={key} className="price-summary-row"><span>{PRICE.options[key].label}</span><span>+{PRICE.options[key].price} ₽</span></div>
                                ))}
                                <div className="price-summary-total">
                                    <span>Итого</span>
                                    <span>{price.toLocaleString('ru-RU')} ₽</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-navigation">
                        <button className="button button-prev" onClick={() => setStep(1)}>
                            <i className="bi bi-arrow-left"></i>Назад
                        </button>
                        <button className="button button-next" onClick={() => setStep(3)}>
                            Далее <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            )}

            {step === 3 && (
                <div>
                    <div className="card create-order-card">
                        <div className="card-header"><i className="bi bi-clipboard-check"></i>Подтверждение заказа</div>
                        <div className="list no-hairlines-md">
                            <ul>
                                <li className="item-content">
                                    <div className="item-inner">
                                        <div className="item-title" style={{fontWeight:600}}><i className="bi bi-signpost-2" style={{marginRight:6}}></i>Маршрут</div>
                                    </div>
                                </li>
                                <li className="item-content">
                                    <div className="item-inner" style={{padding:'8px 16px'}}>
                                        <div style={{fontSize:15,marginBottom:6}}><strong>Откуда:</strong> {pickup}</div>
                                        <div style={{fontSize:15,marginBottom:6}}><strong>Куда:</strong> {delivery}</div>
                                        <div style={{fontSize:13,color:'#71717a'}}>{distanceKm.toFixed(1)} км • ~{routeInfo ? formatTime(routeInfo.timeMin) : '—'}</div>
                                    </div>
                                </li>
                                <li className="item-content">
                                    <div className="item-inner">
                                        <div className="item-title" style={{fontWeight:600}}><i className="bi bi-box-seam" style={{marginRight:6}}></i>Груз</div>
                                    </div>
                                </li>
                                <li className="item-content">
                                    <div className="item-inner" style={{padding:'8px 16px'}}>
                                        <div style={{fontSize:15,marginBottom:6}}><strong>Тип:</strong> {cargoType}</div>
                                        <div style={{fontSize:15,marginBottom:6}}><strong>Вес:</strong> {cargoWeight} кг</div>
                                        {volumeM3 > 0 && <div style={{fontSize:15}}><strong>Габариты:</strong> {cargoDimL}×{cargoDimW}×{cargoDimH} м ({volumeM3.toFixed(2)} м³)</div>}
                                    </div>
                                </li>
                                {selectedOptions.length > 0 && (
                                    <React.Fragment>
                                        <li className="item-content">
                                            <div className="item-inner">
                                                <div className="item-title" style={{fontWeight:600}}><i className="bi bi-sliders" style={{marginRight:6}}></i>Доп. услуги</div>
                                            </div>
                                        </li>
                                        <li className="item-content">
                                            <div className="item-inner" style={{padding:'8px 16px'}}>
                                                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                                                    {selectedOptions.map(key => (
                                                        <span key={key} className="badge"><i className={'bi ' + PRICE.options[key].icon} style={{marginRight:6}}></i>{PRICE.options[key].label}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        </li>
                                    </React.Fragment>
                                )}
                            </ul>
                        </div>
                        <div className="card-content-padding" style={{borderTop:'1px solid var(--border)'}}>
                            <div className="price-summary" style={{margin:0,background:'transparent',padding:0}}>
                                <div className="price-summary-total" style={{border:'none',paddingTop:0,marginTop:0}}>
                                    <span><i className="bi bi-cash-coin" style={{marginRight:8}}></i>Стоимость доставки</span>
                                    <span>{price.toLocaleString('ru-RU')} ₽</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="form-navigation form-navigation-submit">
                        <button className="button button-prev" onClick={() => setStep(2)}>
                            <i className="bi bi-arrow-left"></i><span className="btn-text">Назад</span>
                        </button>
                        <button className="button button-next" disabled={submitting} onClick={handleSubmit}>
                            {submitting
                                ? <span className="preloader preloader-white" style={{width:16,height:16}}></span>
                                : <i className="bi bi-check-circle"></i>}
                            <span className="btn-text">Подтвердить</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// === Dashboard ===
function Dashboard({ userRole, userName, orders, onNavigate }) {
    const recent = orders.slice(0, 3);
    const titles = {
        client: { t: 'Главная', s: 'Создавайте заказы и отслеживайте их статус в реальном времени', icon: 'bi-box-seam', cta: 'Новый заказ', tab: 'create' },
        driver: { t: 'Главная', s: 'Принимайте заказы и управляйте текущими доставками', icon: 'bi-truck', cta: 'Свободные заказы', tab: 'orders' },
        admin:  { t: 'Главная', s: 'Управляйте пользователями и заказами сервиса', icon: 'bi-shield-lock', cta: 'Открыть админку', tab: 'admin' }
    };
    const cfg = titles[userRole] || titles.client;
    return (
        <div>
            <PageHeader title={`Привет, ${(userName||'').split(' ')[0] || 'пользователь'}!`} subtitle={cfg.s} />
            <div className="welcome-card">
                <div className="welcome-icon"><i className={'bi ' + cfg.icon}></i></div>
                <div className="welcome-text">
                    <div className="welcome-title">Добро пожаловать в DeliveryCarGo</div>
                    <div className="welcome-sub">Все ваши доставки — в одном месте. Быстро, прозрачно, надёжно.</div>
                </div>
                <div className="welcome-cta">
                    <button className="button" onClick={() => onNavigate(cfg.tab)}>{cfg.cta} <i className="bi bi-arrow-right"></i></button>
                </div>
            </div>
            <Stats orders={orders} userRole={userRole} />
            {recent.length > 0 && (
                <div>
                    <div className="section-title">
                        <span>Последние заказы</span>
                        <button className="button button-outline button-small" onClick={()=>onNavigate('orders')}>Все<i className="bi bi-arrow-right" style={{marginLeft:4}}></i></button>
                    </div>
                    {recent.map(o => (
                        <div key={o.id} className="order-item" onClick={()=>onNavigate('orders')}>
                            <div className="order-item-top">
                                <span className="order-item-id">Заказ #{o.id}</span>
                                <StatusBadge status={o.status} />
                            </div>
                            <div className="order-item-route"><i className="bi bi-arrow-right" style={{margin:'0 4px',fontSize:10,color:'#a1a1aa'}}></i>{o.pickup_address} → {o.delivery_address}</div>
                            <div className="order-item-bottom">
                                <span className="order-item-price">{Number(o.price).toLocaleString('ru-RU')} ₽</span>
                                <span className="order-item-meta">{new Date(o.created_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// === Main App ===
function App() {
    const [user, setUser] = useState(null);
    const [checking, setChecking] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [orders, setOrders] = useState([]);
    const [refreshKey, setRefreshKey] = useState(0);

    const checkAuth = async () => {
        const r = await api.checkAuth();
        if (r.success) setUser(r.user);
        setChecking(false);
    };
    const loadOrders = async () => {
        const r = await api.request('../api/orders.php', { action: 'list' });
        if (r.success) setOrders(r.orders);
    };
    useEffect(() => { checkAuth(); }, []);
    useEffect(() => { if (user) loadOrders(); }, [user, refreshKey]);

    const logout = async () => {
        await api.request('../api/auth.php', { action: 'logout' });
        setUser(null); setActiveTab('dashboard');
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    if (checking) return (
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh'}}>
            <div className="preloader"></div>
        </div>
    );

    // Not logged in
    if (!user) return (
        <div id="app">
            <div className="page">
                <div className="navbar">
                    <div className="navbar-bg"></div>
                    <div className="navbar-inner">
                        <div className="title"><i className="bi bi-truck" style={{marginRight:8}}></i>DeliveryCarGo</div>
                    </div>
                </div>
                <div className="page-content" style={{paddingTop:56}}>
                    <ToastContainer />
                    <LandingPage />
                </div>
            </div>
        </div>
    );

    // Logged in
    const roleLabel = { client:'Клиент', driver:'Водитель', admin:'Администратор' };
    const tabItems = [
        { id:'dashboard', icon:'bi-house', label:'Главная' },
        ...(user.role==='client' ? [{ id:'create', icon:'bi-plus-circle', label:'Новый заказ' }] : []),
        { id:'orders', icon:'bi-list-ul', label:'Заказы' },
        { id:'profile', icon:'bi-person', label:'Профиль' },
        ...(user.role==='admin' ? [{ id:'admin', icon:'bi-shield-lock', label:'Админ' }] : []),
    ];

    return (
        <div id="app">
            <div className="app-layout">
                {/* Sidebar for Desktop */}
                <div className="sidebar">
                    <div className="sidebar-header">
                        <i className="bi bi-truck"></i>
                        <span>DeliveryCarGo</span>
                    </div>
                    <nav className="sidebar-nav">
                        {tabItems.map(t => (
                            <a key={t.id} href="#" 
                               className={'sidebar-link' + (activeTab===t.id?' active':'')}
                               onClick={e=>{e.preventDefault();handleTabClick(t.id);}}>
                                <i className={'bi '+t.icon}></i>
                                <span>{t.label}</span>
                            </a>
                        ))}
                    </nav>
                    <div className="sidebar-footer">
                        <button className="button button-logout" onClick={logout} title="Выйти">
                            <i className="bi bi-box-arrow-right"></i>
                            <span>Выйти</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="main-content">
                    {/* Top navbar for Mobile */}
                    <div className="navbar navbar-main mobile-navbar">
                        <div className="navbar-bg"></div>
                        <div className="navbar-inner">
                            <div className="navbar-brand">
                                <i className="bi bi-truck"></i>
                                <span>DeliveryCarGo</span>
                            </div>
                            <div className="navbar-actions" style={{display:'flex',gap:8,alignItems:'center'}}>
                                <NotificationBell userId={user.id} />
                                <button className="button button-logout" onClick={logout} title="Выйти">
                                    <i className="bi bi-box-arrow-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Page content */}
                    <div className="page-content page-content-main">
                        <ToastContainer />
                        <div className="content-wrapper">
                            {activeTab === 'dashboard' && <Dashboard userRole={user.role} userName={user.full_name} orders={orders} onNavigate={setActiveTab} />}
                            {activeTab === 'create' && <React.Fragment><PageHeader title="Новый заказ" subtitle="Заполните данные и отправьте заказ за несколько шагов" /><CreateOrder onComplete={() => { setRefreshKey(k => k + 1); setActiveTab('orders'); }} /></React.Fragment>}
                            {activeTab === 'orders' && <OrderList userRole={user.role} userId={user.id} refreshKey={refreshKey} />}
                            {activeTab === 'profile' && <React.Fragment><PageHeader title="Профиль" subtitle="Управляйте личными данными и настройками аккаунта" /><Profile onUpdate={checkAuth} orders={orders} /></React.Fragment>}
                            {activeTab === 'admin' && <React.Fragment><PageHeader title="Администрирование" subtitle="Управление заказами и пользователями платформы" /><AdminPanel /></React.Fragment>}
                        </div>
                    </div>

                    {/* Bottom toolbar for Mobile */}
                    <div className="toolbar toolbar-bottom toolbar-main mobile-toolbar">
                        <div className="toolbar-inner">
                            {tabItems.map(t => (
                                <a key={t.id} href="#" 
                                   className={'toolbar-link' + (activeTab===t.id?' active':'')}
                                   onClick={e=>{e.preventDefault();handleTabClick(t.id);}}>
                                    <i className={'bi '+t.icon}></i>
                                    <span>{t.label}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// === Mount ===
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<App />);
