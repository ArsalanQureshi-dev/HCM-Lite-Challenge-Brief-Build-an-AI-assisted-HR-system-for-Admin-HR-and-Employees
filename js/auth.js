/* auth.js - login, first-run setup, forgot password, page guard */
const ROOT = location.pathname.includes('/pages/') ? '../' : '';
const PAGES = f => (ROOT ? '' : 'pages/') + f;

const Auth = {
  home: u => PAGES(u.role === 'admin' ? 'admin.html' : 'employee.html'),
  start(u) {
    DB.set(K.session, { id: u.id });
    if (document.body.dataset.page === 'app' && typeof App !== 'undefined') {
      App.init();
    } else {
      location.href = Auth.home(u);
    }
  },
  guard(role) {
    const u = Store.me();
    if (!u) { location.replace(ROOT + 'index.html'); return null; }
    if (role !== 'any' && u.role !== role) { location.replace(Auth.home(u)); return null; }
    return u;
  },
  logout() {
    DB.del(K.session);
    if (document.body.dataset.page === 'app' && typeof App !== 'undefined') {
      location.hash = '';
      App.init();
    } else {
      location.href = ROOT + 'index.html';
    }
  },
  passwordModal(me) {
    const m = openModal('Change password', `<form id="pwf" novalidate>${fld('Current password', 'old', 'password', '', 'autocomplete="current-password"')}${fld('New password (min 6 characters)', 'nw', 'password', '', 'autocomplete="new-password"')}${fld('Confirm new password', 'cf', 'password', '', 'autocomplete="new-password"')}<button class="btn block">Update password</button></form>`);
    $('#pwf', m).onsubmit = e => {
      e.preventDefault(); const f = e.target, d = formData(f);
      const errs = { old: !d.old ? 'Enter your current password.' : d.old !== me.password && 'Current password is incorrect.', nw: !d.nw ? 'Enter a new password.' : d.nw.length < 6 ? 'Use at least 6 characters.' : d.nw === d.old && 'New password must be different.', cf: d.cf !== d.nw && 'Passwords do not match.' };
      if (!showErrors(f, errs)) return;
      const users = Store.users(); users.find(u => u.id === me.id).password = d.nw; Store.saveUsers(users);
      closeModal(); toast('Password updated.');
    };
  }
};

function initAuthBox() {
  const box = $('#authbox');
  if (!box) return;
  const first = !Store.hasAdmin();

  const views = {
    setup: () => `
      <h2>Set up your company</h2>
      <p class="muted">This is the first run. Create the company and its Admin account.</p>
      <form id="setup" novalidate>
        ${fld('Company name', 'company')}
        ${fld('Admin name', 'name')}
        ${fld('Admin email', 'email', 'email', '', 'autocomplete="email"')}
        ${fld('Password (min 6 characters)', 'password', 'password', '', 'autocomplete="new-password"')}
        ${fld('Confirm password', 'confirm', 'password', '', 'autocomplete="new-password"')}
        <button class="btn block">Create company</button>
      </form>
      <div class="demo-box">
        <p class="muted small center">Evaluating or testing? Load complete demo records in one click:</p>
        <button class="btn ghost block sm" type="button" data-act="seed-demo">&#9889; Load Demo Company & Users</button>
      </div>`,

    login: () => `
      <h2>Welcome back</h2>
      <p class="muted">Log in as Admin or Employee.</p>
      <form id="login" novalidate>
        ${fld('Email', 'email', 'email', '', 'autocomplete="email"')}
        ${fld('Password', 'password', 'password', '', 'autocomplete="current-password"')}
        <button class="btn block">Log in</button>
      </form>
      <div class="quick-logins">
        <small class="muted">Demo shortcuts:</small>
        <div class="row">
          <button class="btn ghost sm" type="button" data-fill="admin@company.com" data-fillpass="password123">Admin Login</button>
          <button class="btn ghost sm" type="button" data-fill="ali@company.com" data-fillpass="password123">Employee Login</button>
        </div>
      </div>
      <p class="center" style="margin-top:0.8rem"><a href="#" data-go="forgot">Forgot password?</a></p>
      <div class="demo-box">
        <button class="btn ghost block sm" type="button" data-act="seed-demo">&#9889; Reset / Load Sample Data</button>
      </div>`,

    forgot: () => `
      <h2>Forgot password</h2>
      <p class="muted">Enter your account email and we will give you a reset code.</p>
      <form id="forgot" novalidate>
        ${fld('Email', 'email', 'email')}
        <button class="btn block">Get reset code</button>
      </form>
      <p class="center"><a href="#" data-go="login">Back to log in</a></p>`,

    reset: code => `
      <h2>Reset password</h2>
      <div class="notice">Demo mode: your 6-digit code is: <b>${code}</b>. <button type="button" class="chip" data-fillcode="${code}" style="margin-left:0.5rem">Auto fill code</button></div>
      <form id="reset" novalidate>
        ${fld('Reset code', 'code', 'text', '', 'inputmode="numeric" maxlength="6"')}
        ${fld('New password (min 6 characters)', 'password', 'password', '', 'autocomplete="new-password"')}
        ${fld('Confirm new password', 'confirm', 'password', '', 'autocomplete="new-password"')}
        <button class="btn block">Save new password</button>
      </form>
      <p class="center"><a href="#" data-go="login">Back to log in</a></p>`
  };

  const show = (name, arg) => {
    box.innerHTML = `<div class="auth-brand"><span class="auth-brand-mark" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><rect x="3" y="3" width="42" height="42" rx="13" fill="currentColor"/><path d="M13 15v18m0-9h12m0-9v18M30 33V15l6 9 6-9v18" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span><b>HCM Lite</b><small>People. Payroll. Made simple.</small></span></div>${views[name](arg)}`;
    const i = $('input', box);
    if (i) i.focus();
  };

  show(first ? 'setup' : 'login');

  box.onclick = e => {
    const a = e.target.closest('[data-go]');
    if (a) { e.preventDefault(); show(a.dataset.go); return; }

    const seedBtn = e.target.closest('[data-act="seed-demo"]');
    if (seedBtn) {
      Store.seedDemo();
      toast('Demo data loaded successfully!');
      show('login');
      return;
    }

    const fillBtn = e.target.closest('[data-fill]');
    if (fillBtn) {
      const emailInput = $('#f_email', box);
      const passInput = $('#f_password', box);
      if (emailInput && passInput) {
        emailInput.value = fillBtn.dataset.fill;
        passInput.value = fillBtn.dataset.fillpass;
        toast('Credentials filled. Click Log In.');
      }
      return;
    }

    const fillCodeBtn = e.target.closest('[data-fillcode]');
    if (fillCodeBtn) {
      const codeInput = $('#f_code', box);
      if (codeInput) {
        codeInput.value = fillCodeBtn.dataset.fillcode;
        toast('Reset code filled.');
      }
      return;
    }
  };

  box.onsubmit = e => {
    e.preventDefault();
    const f = e.target, d = formData(f), users = Store.users();

    if (f.id === 'setup') {
      const errs = {
        company: !d.company && 'Company name is required.',
        name: !d.name && 'Name is required.',
        email: !d.email ? 'Email is required.' : !isEmail(d.email) && 'Enter a valid email address.',
        password: !d.password ? 'Password is required.' : d.password.length < 6 && 'Use at least 6 characters.',
        confirm: d.confirm !== d.password && 'Passwords do not match.'
      };
      if (!showErrors(f, errs)) return;
      const admin = { id: Date.now(), name: d.name, email: d.email, password: d.password, role: 'admin', department: 'Management', salary: 0, joined: D.ymd() };
      Store.saveCompany({ name: d.company, start: '09:00', grace: 15, quota: 20, workDays: [1, 2, 3, 4, 5] });
      Store.saveUsers([admin]);
      Auth.start(admin);
    } else if (f.id === 'login') {
      const u = users.find(x => x.email && x.email.toLowerCase() === (d.email || '').toLowerCase());
      const errs = {
        email: !d.email ? 'Email is required.' : !isEmail(d.email) ? 'Enter a valid email address.' : !u && 'No account found with this email.',
        password: !d.password ? 'Password is required.' : u && u.password !== d.password && 'Incorrect password.'
      };
      if (!showErrors(f, errs)) return;
      Auth.start(u);
    } else if (f.id === 'forgot') {
      const u = users.find(x => x.email && x.email.toLowerCase() === (d.email || '').toLowerCase());
      if (!showErrors(f, { email: !d.email ? 'Email is required.' : !u && 'No account found with this email.' })) return;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      DB.set(K.reset, { id: u.id, code, exp: Date.now() + 600000 });
      show('reset', code);
    } else if (f.id === 'reset') {
      const r = DB.get(K.reset, null);
      const errs = {
        code: !d.code ? 'Enter the reset code.' : (!r || r.code !== d.code) ? 'Code is not correct.' : Date.now() > r.exp && 'Code has expired. Request a new one.',
        password: !d.password ? 'Password is required.' : d.password.length < 6 && 'Use at least 6 characters.',
        confirm: d.confirm !== d.password && 'Passwords do not match.'
      };
      if (!showErrors(f, errs)) return;
      const targetUser = users.find(x => x.id === r.id);
      if (targetUser) {
        targetUser.password = d.password;
        Store.saveUsers(users);
      }
      DB.del(K.reset);
      show('login');
      toast('Password changed. Please log in.');
    }
  };
}

if (document.body.dataset.page === 'login') (function () {
  const cur = Store.me();
  if (cur) { location.replace(Auth.home(cur)); return; }
  initAuthBox();
})();
