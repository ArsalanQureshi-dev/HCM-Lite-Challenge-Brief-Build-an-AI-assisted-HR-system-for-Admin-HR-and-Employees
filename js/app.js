/* app.js - Unified Single Page Application (SPA) Controller & Responsive Router */
const App = {
  titles: {
    admin: 'Admin Dashboard',
    employee: 'My Dashboard',
    employees: 'Employee Directory',
    leaves: 'Leave Requests',
    payslip: 'Salary Statement & Payslips',
    settings: 'Company Settings'
  },

  init() {
    if (document.body.dataset.page !== 'app') return;
    const me = Store.me();
    const authWrap = $('#authContainer');
    const pageEl = $('#page');

    if (!me) {
      if (pageEl) pageEl.style.display = 'none';
      const existingLayout = $('.layout');
      if (existingLayout) existingLayout.remove();
      if (authWrap) authWrap.style.display = 'grid';
      if (typeof initAuthBox === 'function') initAuthBox();
      return;
    }

    if (authWrap) authWrap.style.display = 'none';
    if (pageEl) pageEl.style.display = 'block';

    // Determine initial view from hash or role default
    const hash = (location.hash || '').replace('#', '').split('?')[0];
    const defaultView = me.role === 'admin' ? 'admin' : 'employee';
    const allowedAdmin = ['admin', 'employees', 'leaves', 'payslip', 'settings'];
    const allowedEmp = ['employee', 'payslip'];
    const allowed = me.role === 'admin' ? allowedAdmin : allowedEmp;
    const initialView = allowed.includes(hash) ? hash : defaultView;

    mountShell(me, initialView, App.titles[initialView] || 'HCM Lite', view => App.navigate(view));
    App.renderView(initialView);

    window.addEventListener('hashchange', () => {
      const newHash = (location.hash || '').replace('#', '').split('?')[0];
      if (allowed.includes(newHash)) {
        App.navigate(newHash, null, false);
      }
    });
  },

  navigate(view, extraParam, updateHash = true) {
    const me = Store.me();
    if (!me) { App.init(); return; }

    const allowedAdmin = ['admin', 'employees', 'leaves', 'payslip', 'settings'];
    const allowedEmp = ['employee', 'payslip'];
    const allowed = me.role === 'admin' ? allowedAdmin : allowedEmp;

    if (!allowed.includes(view)) {
      view = me.role === 'admin' ? 'admin' : 'employee';
    }

    if (updateHash) {
      location.hash = '#' + view + (extraParam ? '?id=' + extraParam : '');
    }

    // Update active indicators on desktop sidebar and mobile bottom nav
    $$('a[data-view]').forEach(a => a.classList.toggle('on', a.dataset.view === view));
    setPageTitle(App.titles[view] || 'HCM Lite');

    App.renderView(view, extraParam);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderView(view, extraParam) {
    const me = Store.me();
    const root = $('#page');
    if (!root) return;

    if (view === 'admin') {
      renderAdmin(root, me);
    } else if (view === 'employee') {
      renderEmployee(root, me);
    } else if (view === 'employees') {
      renderEmployees(root, me);
    } else if (view === 'leaves') {
      renderLeaves(root, me);
    } else if (view === 'payslip') {
      renderPayslip(root, me, extraParam);
    } else if (view === 'settings') {
      renderSettings(root, me);
    }

    updateNavBadge();
  }
};

window.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page === 'app') {
    App.init();
  }
});
