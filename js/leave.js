/* leave.js - leave rules (working days, overlap, quota) and the Admin leave requests page */
const quotaDays = () => Number((Store.company() || {}).quota || 20);
const usedDays = (empId, year, statuses = ['approved']) => Store.leaves().filter(l => l.empId === empId && statuses.includes(l.status) && String(l.from || '').slice(0, 4) === String(year)).reduce((s, l) => s + (l.days || 0), 0);
const balance = empId => quotaDays() - usedDays(empId, new Date().getFullYear());
const pendingCount = () => Store.leaves().filter(l => l.status === 'pending').length;

function leavesToday() {
  const t = D.ymd(), seen = new Set(), ids = new Set(Store.employees().map(e => e.id));
  return Store.leaves().filter(l => {
    if (l.status === 'approved' && l.from <= t && t <= l.to && ids.has(l.empId)) {
      if (!seen.has(l.empId)) {
        seen.add(l.empId);
        return true;
      }
    }
    return false;
  });
}

/* Returns { errs, days }. errs empty means valid. */
function validateLeave(me, d) {
  const errs = {}; let days = 0;
  if (!d.from) errs.from = 'Choose a start date.';
  if (!d.to) errs.to = 'Choose an end date.';
  if (d.from && d.to && d.from > d.to) errs.to = '"To" date must be on or after the "From" date.';
  if (!d.reason) errs.reason = 'Please give a reason.';
  if (!errs.from && !errs.to) {
    days = D.workDays(d.from, d.to);
    if (days === 0) errs.from = 'These dates have no working days (weekends are skipped).';
    else if (Store.leaves().some(l => l.empId === me.id && l.status !== 'rejected' && l.from <= d.to && d.from <= l.to)) errs.from = 'These dates overlap another existing leave request.';
    else {
      const q = quotaDays(), taken = usedDays(me.id, d.from.slice(0, 4), ['approved', 'pending']);
      if (taken + days > q) errs.to = `This requires ${days} day(s), but only ${Math.max(0, q - taken)} of your ${q} yearly days are remaining.`;
    }
  }
  return { errs, days };
}

function renderLeaves(root, me) {
  me = me || Store.me();
  if (!me) return;
  let tab = 'pending';
  const nameOf = id => { const u = Store.users().find(x => x.id === id); return u ? u.name : 'Deleted employee'; };

  function draw() {
    const all = Store.leaves().slice().reverse(), list = all.filter(l => tab === 'all' || l.status === tab);
    const pend = pendingCount();
    root.innerHTML = `
      <div class="tabs">
        ${['pending', 'approved', 'rejected', 'all'].map(t => `
          <button class="${t === tab ? 'on' : ''}" data-tab="${t}" type="button">
            ${t[0].toUpperCase() + t.slice(1)}${t === 'pending' && pend ? ` (${pend})` : ''}
          </button>`).join('')}
      </div>
      <div class="card tablewrap">
        ${list.length ? `
          <table class="tbl stack">
            <thead>
              <tr><th>Employee</th><th>Type</th><th>Dates</th><th>Working Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${list.map(l => `<tr>
                <td data-label="Employee"><b>${esc(nameOf(l.empId))}</b></td>
                <td data-label="Type">${esc(l.type)}</td>
                <td data-label="Dates">${D.nice(l.from)}${l.from !== l.to ? ' to ' + D.nice(l.to) : ''}</td>
                <td data-label="Working Days">${l.days}</td>
                <td data-label="Reason">${esc(l.reason)}${l.comment ? `<br><small class="muted">Admin note: ${esc(l.comment)}</small>` : ''}</td>
                <td data-label="Status">${lvBadge(l.status)}</td>
                <td class="acts">
                  ${l.status === 'pending' ? `
                    <button class="btn sm" data-act="approved" data-id="${l.id}" type="button">Approve</button>
                    <button class="btn sm red" data-act="rejected" data-id="${l.id}" type="button">Reject</button>
                  ` : `<span class="muted small">Processed</span>`}
                </td>
              </tr>`).join('')}
            </tbody>
          </table>`
        : `<div class="empty"><h3>Nothing here</h3><p>${tab === 'pending' ? 'No leave requests are waiting for approval.' : 'No leave requests in this category.'}</p></div>`}
      </div>`;
  }

  function decide(l, status) {
    if (!l) return;
    const ok = status === 'approved';
    const m = openModal(ok ? 'Approve leave request' : 'Reject leave request', `
      <p><b>${esc(nameOf(l.empId))}</b> &mdash; ${esc(l.type)}, ${D.nice(l.from)}${l.from !== l.to ? ' to ' + D.nice(l.to) : ''} (${l.days} working day${l.days > 1 ? 's' : ''})</p>
      <form id="df" novalidate>
        ${area(ok ? 'Comment (optional)' : 'Reason for rejection (required)', 'comment')}
        <button class="btn ${ok ? '' : 'red'} block">${ok ? 'Confirm Approval' : 'Confirm Rejection'}</button>
      </form>
    `);

    $('#df', m).onsubmit = e => {
      e.preventDefault();
      const f = e.target, d = formData(f);
      const errs = { comment: !ok && !d.comment && 'Please provide a short explanation for the employee.' };
      if (ok && usedDays(l.empId, (l.from || '').slice(0, 4)) + l.days > quotaDays()) {
        errs.comment = 'Cannot approve: this would exceed the annual leave quota.';
      }
      if (!showErrors(f, errs)) return;
      const all = Store.leaves(), x = all.find(v => v.id === l.id);
      if (x) {
        x.status = status;
        x.comment = d.comment || '';
        Store.saveLeaves(all);
      }
      closeModal();
      toast(ok ? 'Leave approved successfully.' : 'Leave rejected.');
      updateNavBadge();
      draw();
    };
  }

  root.onclick = e => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; draw(); return; }
    const b = e.target.closest('[data-act]');
    if (b) decide(Store.leaves().find(l => l.id === Number(b.dataset.id)), b.dataset.act);
  };

  draw();
}

if (document.body.dataset.page === 'leaves') (function () {
  const me = Auth.guard('admin'); if (!me) return;
  mountShell(me, 'leaves.html', 'Leave requests');
  renderLeaves($('#page'), me);
})();
