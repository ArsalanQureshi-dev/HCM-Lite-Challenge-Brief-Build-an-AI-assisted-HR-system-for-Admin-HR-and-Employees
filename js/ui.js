/* ui.js - layout shell, modal, toast and form helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function toast(msg, type = 'ok') {
  let w = $('#toasts');
  if (!w) { w = document.createElement('div'); w.id = 'toasts'; document.body.appendChild(w); }
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; w.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

const fld = (label, name, type = 'text', val = '', attrs = '') => {
  if (type === 'password') {
    return `<div class="field"><label for="f_${name}">${label}</label><div class="pw-wrap"><input id="f_${name}" name="${name}" type="password" value="${esc(val)}" ${attrs}><button type="button" class="pw-eye" title="Show/Hide password" aria-label="Show password">&#128065;</button></div><small class="err"></small></div>`;
  }
  return `<div class="field"><label for="f_${name}">${label}</label><input id="f_${name}" name="${name}" type="${type}" value="${esc(val)}" ${attrs}><small class="err"></small></div>`;
};

const area = (label, name, val = '', attrs = '') =>
  `<div class="field"><label for="f_${name}">${label}</label><textarea id="f_${name}" name="${name}" rows="3" ${attrs}>${esc(val)}</textarea><small class="err"></small></div>`;

const sel = (label, name, opts, val = '') =>
  `<div class="field"><label for="f_${name}">${label}</label><select id="f_${name}" name="${name}">${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select><small class="err"></small></div>`;

const formData = f => Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, typeof v === 'string' && !/pass|confirm|^old$|^nw$|^cf$/.test(k) ? v.trim() : v]));

// Global listener for password eye toggle
document.addEventListener('click', e => {
  const eye = e.target.closest('.pw-eye');
  if (!eye) return;
  const inp = eye.previousElementSibling;
  if (inp && (inp.type === 'password' || inp.type === 'text')) {
    inp.type = inp.type === 'password' ? 'text' : 'password';
    eye.classList.toggle('active', inp.type === 'text');
  }
});

/* errs = { fieldName: 'message' | falsy }. Shows the message next to the field. Returns true when valid. */
function showErrors(form, errs) {
  $$('.err', form).forEach(e => e.textContent = '');
  $$('.bad', form).forEach(e => e.classList.remove('bad'));
  let ok = true;
  Object.keys(errs).forEach(k => {
    if (!errs[k]) return;
    ok = false;
    const f = form.querySelector(`[name="${k}"]`);
    if (f) { f.classList.add('bad'); const box = f.closest('.field'); if (box) box.querySelector('.err').textContent = errs[k]; }
  });
  const first = $('.bad', form); if (first) first.focus();
  return ok;
}

function openModal(title, body) {
  closeModal();
  const m = document.createElement('div'); m.className = 'modal'; m.id = 'modal';
  m.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="sh-h"><h3>${title}</h3><button class="x" aria-label="Close" type="button">&times;</button></div><div class="sh-b">${body}</div></div>`;
  m.addEventListener('mousedown', e => { if (e.target === m || e.target.classList.contains('x')) closeModal(); });
  document.body.appendChild(m);
  const i = $('input,textarea,select', m); if (i) i.focus();
  return m;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
function askConfirm(text, yesLabel, onYes) {
  const m = openModal('Please confirm', `<p>${text}</p><div class="row end"><button class="btn ghost" type="button" id="no">Cancel</button><button class="btn red" type="button" id="yes">${yesLabel}</button></div>`);
  $('#no', m).onclick = closeModal; $('#yes', m).onclick = () => { closeModal(); onYes(); };
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

const pill = (text, cls) => `<span class="pill ${cls}">${text}</span>`;
function attBadge(st) {
  const m = { present: ['Present', 'green'], late: ['Late', 'orange'], half: ['Half day', 'purple'], absent: ['Absent', 'red'], leave: ['On leave', 'blue'], off: ['Day off', 'gray'], pending: ['Not checked in', 'gray'], future: ['', 'gray'], na: ['-', 'gray'] };
  const x = m[st] || [st || '-', 'gray']; return pill(x[0], x[1]);
}
const lvBadge = s => {
  if (!s) return '';
  const map = { pending: 'orange', approved: 'green', rejected: 'red' };
  return pill(s[0].toUpperCase() + s.slice(1), map[s] || 'gray');
};

const NAV = {
  admin: [
    ['admin', 'admin.html', 'Dashboard', '\u25A6'],
    ['employees', 'employees.html', 'Employees', '\u263A'],
    ['leaves', 'leaves.html', 'Leave requests', '\u2708'],
    ['payslip', 'payslip.html', 'Payslips', '\u25A4'],
    ['settings', 'settings.html', 'Settings', '\u2699']
  ],
  employee: [
    ['employee', 'employee.html', 'My dashboard', '\u25A6'],
    ['payslip', 'payslip.html', 'My payslip', '\u25A4']
  ]
};

function updateNavBadge() {
  const n = typeof pendingCount === 'function' ? pendingCount() : 0;
  const updateEl = parentSelector => {
    const a = $(parentSelector);
    if (!a) return;
    let b = $('.badge', a);
    if (n > 0) {
      if (b) b.textContent = n;
      else a.insertAdjacentHTML('beforeend', `<b class="badge">${n}</b>`);
    } else if (b) {
      b.remove();
    }
  };
  updateEl('.side nav a[data-view="leaves"], .side nav a[href$="leaves.html"]');
  updateEl('.bottom-nav a[data-view="leaves"]');
}

function setPageTitle(title) {
  const h = $('.top h1');
  if (h) h.textContent = title;
}

function mountShell(me, active, title, onNavigate) {
  const existingLayout = $('.layout');
  if (existingLayout) existingLayout.remove();

  const co = Store.company();
  const pend = me.role === 'admin' && typeof pendingCount === 'function' ? pendingCount() : 0;
  const isSPA = typeof onNavigate === 'function';

  const makeLink = (n, isBottom) => {
    const isActive = n[0] === active || n[1] === active;
    const badgeHtml = n[0] === 'leaves' && pend ? `<b class="badge">${pend}</b>` : '';
    const href = isSPA ? `#${n[0]}` : PAGES(n[1]);
    return `<a href="${href}" data-view="${n[0]}" class="${isActive ? 'on' : ''}"><span class="ico">${n[3]}</span><span>${n[2]}</span>${badgeHtml}</a>`;
  };

  const navLinks = NAV[me.role].map(n => makeLink(n, false)).join('');
  const bottomLinks = NAV[me.role].map(n => makeLink(n, true)).join('');

  const wrap = document.createElement('div');
  wrap.className = 'layout';
  wrap.innerHTML = `
    <aside class="side" id="side">
      <div class="brand">
        <i id="brandIcon">${esc(co.name[0].toUpperCase())}</i>
        <div>
          <b id="brandName">${esc(co.name)}</b>
          <small>HCM Lite</small>
        </div>
      </div>
      <nav>${navLinks}</nav>
      <div class="side-foot">
        <div class="who">
          <i>${esc(me.name[0].toUpperCase())}</i>
          <div>
            <b>${esc(me.name)}</b>
            <small>${me.role === 'admin' ? 'Admin' : esc(me.department)}</small>
          </div>
        </div>
        <button class="btn ghost sm" id="pwBtn" type="button">Change password</button>
        <button class="btn ghost sm" id="loBtn" type="button">Log out</button>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="content">
      <header class="top">
        <button class="burger" id="burger" aria-label="Open menu" type="button">\u2630</button>
        <h1>${title}</h1>
        <span class="date">${D.nice(D.ymd())}</span>
        <button class="icon-btn" id="themeBtn" type="button" aria-label="Toggle dark mode">\u25D1</button>
      </header>
    </div>
    <nav class="bottom-nav" id="bottomNav">${bottomLinks}</nav>
  `;

  let page = $('#page');
  if (!page) {
    page = document.createElement('main');
    page.id = 'page';
  }
  document.body.prepend(wrap);
  $('.content', wrap).appendChild(page);

  const side = $('#side');
  const toggle = open => {
    side.classList.toggle('open', open);
    $('#scrim').classList.toggle('show', open);
  };

  $('#burger').onclick = () => toggle(true);
  $('#scrim').onclick = () => toggle(false);
  $('#loBtn').onclick = Auth.logout;
  $('#pwBtn').onclick = () => Auth.passwordModal(me);
  $('#themeBtn').onclick = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    localStorage.setItem('hcm_theme', t);
    document.dispatchEvent(new Event('themechange'));
  };

  // If in SPA mode, attach navigation listeners
  if (isSPA) {
    wrap.addEventListener('click', e => {
      const a = e.target.closest('a[data-view]');
      if (!a) return;
      e.preventDefault();
      const view = a.dataset.view;
      toggle(false);
      $$('a[data-view]').forEach(el => el.classList.toggle('on', el.dataset.view === view));
      onNavigate(view);
    });
  }
}

// 3D Interactive Card Tilt Effect (Smooth perspective on mouse hover)
function init3DTilt() {
  if (window.matchMedia('(pointer: coarse)').matches) return; // Touch devices keep native smooth feel

  const tiltSelector = '.stat, .hero, .auth-card';

  document.addEventListener('mousemove', e => {
    const card = e.target.closest(tiltSelector);
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -6; // max 6deg
    const rotateY = ((x - centerX) / centerX) * 6;

    card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px) scale3d(1.015, 1.015, 1.015)`;
    card.style.transition = 'transform 0.08s ease-out';
  });

  document.addEventListener('mouseout', e => {
    const card = e.target.closest(tiltSelector);
    if (!card || card.contains(e.relatedTarget)) return;

    card.style.transform = '';
    card.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init3DTilt);
} else {
  init3DTilt();
}
