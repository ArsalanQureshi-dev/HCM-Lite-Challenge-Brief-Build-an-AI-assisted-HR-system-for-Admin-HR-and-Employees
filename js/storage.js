/* storage.js - localStorage helpers and date utilities (reused on every page) */
document.documentElement.dataset.theme = localStorage.getItem('hcm_theme') || 'light';

const K = { company: 'hcm_company', users: 'hcm_users', att: 'hcm_attendance', leaves: 'hcm_leaves', session: 'hcm_session', ann: 'hcm_announcements', reset: 'hcm_reset' };

const DEFAULT_COMPANY = { name: 'HCM Lite Demo', start: '09:00', grace: 15, quota: 20, workDays: [1, 2, 3, 4, 5], officeLat: null, officeLon: null, officeRadius: 100 };

const DB = {
  get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v === null || v === undefined ? fallback : v; } catch (e) { return fallback; } },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
  del(key) { localStorage.removeItem(key); }
};

const Store = {
  company: () => ({ ...DEFAULT_COMPANY, ...DB.get(K.company, DEFAULT_COMPANY) }),
  saveCompany: c => DB.set(K.company, { ...DEFAULT_COMPANY, ...c }),
  users: () => DB.get(K.users, []), saveUsers: u => DB.set(K.users, u),
  att: () => DB.get(K.att, []), saveAtt: a => DB.set(K.att, a),
  leaves: () => DB.get(K.leaves, []), saveLeaves: l => DB.set(K.leaves, l),
  ann: () => DB.get(K.ann, []), saveAnn: a => DB.set(K.ann, a),
  employees: () => Store.users().filter(u => u.role === 'employee'),
  me() { const s = DB.get(K.session, null); return s ? (Store.users().find(u => u.id === s.id) || null) : null; },
  hasAdmin() { return Store.users().some(u => u.role === 'admin'); },
  seedDemo() {
    const today = D.ymd();
    const admin = { id: 101, name: 'Arsalan Admin', email: 'admin@company.com', password: 'password123', role: 'admin', department: 'Executive', salary: 150000, joined: '2026-01-01' };
    const emp1 = { id: 102, name: 'Ali Khan', email: 'ali@company.com', password: 'password123', role: 'employee', department: 'Engineering', salary: 85000, joined: '2026-01-15' };
    const emp2 = { id: 103, name: 'Sara Ahmed', email: 'sara@company.com', password: 'password123', role: 'employee', department: 'Design', salary: 75000, joined: '2026-02-01' };
    const emp3 = { id: 104, name: 'Hamza Tariq', email: 'hamza@company.com', password: 'password123', role: 'employee', department: 'Marketing', salary: 65000, joined: '2026-02-15' };

    Store.saveCompany({ name: 'TechMatrix Systems', start: '09:00', grace: 15, quota: 20, workDays: [1, 2, 3, 4, 5] });
    Store.saveUsers([admin, emp1, emp2, emp3]);

    // Attendance demo
    const att = [
      { empId: 102, date: today, in: '08:55', out: null, status: 'present', late: false },
      { empId: 103, date: today, in: '09:25', out: null, status: 'late', late: true }
    ];
    Store.saveAtt(att);

    // Leaves demo
    const leaves = [
      { id: 201, empId: 104, type: 'Annual', from: today, to: today, days: 1, reason: 'Family event', status: 'approved', comment: 'Approved, enjoy your day!' },
      { id: 202, empId: 102, type: 'Sick', from: D.ymd(new Date(Date.now() + 86400000)), to: D.ymd(new Date(Date.now() + 86400000 * 2)), days: 2, reason: 'Doctor checkup and recovery', status: 'pending', comment: '' }
    ];
    Store.saveLeaves(leaves);

    // Announcements demo
    const ann = [
      { id: 301, title: 'Welcome to TechMatrix HCM!', body: 'Our new HCM Lite portal is live. Use it for daily attendance, leave applications and payslips.', date: today },
      { id: 302, title: 'Saylani Hackathon Presentation', body: 'Please ensure all monthly tasks and reports are submitted on time.', date: today }
    ];
    Store.saveAnn(ann);
  }
};

const esc = s => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const money = n => 'Rs ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const D = {
  pad: n => String(n).padStart(2, '0'),
  ymd(d = new Date()) { return d.getFullYear() + '-' + D.pad(d.getMonth() + 1) + '-' + D.pad(d.getDate()); },
  parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
  hm(d = new Date()) { return D.pad(d.getHours()) + ':' + D.pad(d.getMinutes()); },
  mins(t) { if (!t) return 0; const p = t.split(':').map(Number); return p[0] * 60 + p[1]; },
  t12(t) { if (!t) return '-'; let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + D.pad(m) + ' ' + ap; },
  nice(s) { if (!s) return '-'; return D.parse(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); },
  isWork(s) { const c = Store.company(); return (c && Array.isArray(c.workDays) ? c.workDays : [1, 2, 3, 4, 5]).includes(D.parse(s).getDay()); },
  range(from, to) { const out = [], end = D.parse(to); for (let d = D.parse(from); d <= end; d.setDate(d.getDate() + 1)) out.push(D.ymd(d)); return out; },
  workDays(from, to) { return D.range(from, to).filter(D.isWork).length; },
  monthDays(ym) { const p = ym.split('-').map(Number); return D.range(ym + '-01', ym + '-' + D.pad(new Date(p[0], p[1], 0).getDate())); },
  weekStart() { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return D.ymd(d); }
};
