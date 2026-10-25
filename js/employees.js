/* employees.js - Admin: add (creates login), edit, delete, search, department filter */
function renderEmployees(root, me) {
  me = me || Store.me();
  if (!me) return;
  let q = '', dep = '';
  const isSPA = document.body.dataset.page === 'app';
  const DEFAULT_DEPS = ['Engineering', 'Design', 'Marketing', 'Finance', 'Operations', 'HR', 'Sales'];
  const deps = () => [...new Set(Store.employees().map(e => e.department))].sort();

  root.innerHTML = `
    <div class="bar">
      <input id="q" class="search" type="search" placeholder="Search by name, email, or department" aria-label="Search employees">
      <select id="dep" aria-label="Filter by department"></select>
      <button class="btn" data-act="add" type="button">+ Add employee</button>
    </div>
    <div class="card tablewrap" id="list"></div>`;

  function fillDeps() {
    if (dep && !deps().includes(dep)) dep = '';
    $('#dep', root).innerHTML = '<option value="">All departments</option>' + deps().map(d => `<option ${d === dep ? 'selected' : ''}>${esc(d)}</option>`).join('');
  }

  function drawList() {
    const list = Store.employees().filter(e => (!dep || e.department === dep) && (e.name + ' ' + e.email + ' ' + e.department).toLowerCase().includes(q.toLowerCase()));
    $('#list', root).innerHTML = list.length ? `
      <table class="tbl stack">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Department</th>
            <th>Monthly Salary</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(e => `<tr>
            <td data-label="Name">
              <div class="av-row">
                <i class="av">${esc(e.name[0].toUpperCase())}</i>
                <b>${esc(e.name)}</b>
              </div>
            </td>
            <td data-label="Email">${esc(e.email)}</td>
            <td data-label="Department">${esc(e.department)}</td>
            <td data-label="Salary">${money(e.salary)}</td>
            <td data-label="Joined">${D.nice(e.joined || '')}</td>
            <td class="acts">
              ${isSPA
                ? `<button class="btn sm ghost" data-act="payslip" data-id="${e.id}" type="button">Payslip</button>`
                : `<a class="btn sm ghost" href="payslip.html?id=${e.id}">Payslip</a>`}
              <button class="btn sm ghost" data-act="edit" data-id="${e.id}" type="button">Edit</button>
              <button class="btn sm red" data-act="del" data-id="${e.id}" type="button">Delete</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`
      : `<div class="empty">
          <h3>${Store.employees().length ? 'No matches found' : 'No employees yet'}</h3>
          <p>${Store.employees().length ? 'Try a different search term or department filter.' : 'Add your first employee. This also generates their employee login.'}</p>
          ${!Store.employees().length ? `<button class="btn sm" data-act="add" type="button">+ Add Employee Now</button>` : ''}
        </div>`;
  }

  function form(e) {
    const dl = [...new Set([...DEFAULT_DEPS, ...deps()])];
    const m = openModal(e ? 'Edit employee' : 'Add employee', `
      <form id="ef" novalidate>
        ${fld('Full name', 'name', 'text', e ? e.name : '')}
        ${fld('Email (used to log in)', 'email', 'email', e ? e.email : '', 'autocomplete="email"')}
        ${fld(e ? 'New password (leave blank to keep current)' : 'Password (min 6 characters)', 'password', 'password', '', 'autocomplete="new-password"')}
        ${fld('Department', 'department', 'text', e ? e.department : '', 'list="dl"')}
        <datalist id="dl">${dl.map(d => `<option value="${esc(d)}">`).join('')}</datalist>
        ${fld('Monthly salary (Rs)', 'salary', 'number', e ? e.salary : '', 'min="1" step="any"')}
        <button class="btn block">${e ? 'Save changes' : 'Add employee'}</button>
      </form>
    `);

    $('#ef', m).onsubmit = ev => {
      ev.preventDefault();
      const f = ev.target, d = formData(f), users = Store.users(), sal = Number(d.salary);
      const dup = users.some(u => u.email && u.email.toLowerCase() === (d.email || '').toLowerCase() && (!e || u.id !== e.id));
      const errs = {
        name: !d.name && 'Name is required.',
        email: !d.email ? 'Email is required.' : !isEmail(d.email) ? 'Enter a valid email address.' : dup && 'This email is already registered.',
        password: (!e && !d.password) ? 'Password is required.' : (d.password && d.password.length < 6) && 'Use at least 6 characters.',
        department: !d.department && 'Department is required.',
        salary: !d.salary ? 'Salary is required.' : !(sal > 0) && 'Salary must be greater than 0.'
      };
      if (!showErrors(f, errs)) return;
      if (e) {
        const target = users.find(u => u.id === e.id);
        if (target) {
          Object.assign(target, { name: d.name, email: d.email, department: d.department, salary: sal });
          if (d.password) target.password = d.password;
        }
        toast('Employee updated.');
      } else {
        users.push({ id: Date.now(), name: d.name, email: d.email, password: d.password, role: 'employee', department: d.department, salary: sal, joined: D.ymd() });
        toast('Employee added. Their login is active.');
      }
      Store.saveUsers(users);
      closeModal();
      fillDeps();
      drawList();
    };
  }

  root.onclick = ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const emp = Store.employees().find(x => x.id === Number(b.dataset.id));
    if (b.dataset.act === 'add') form(null);
    else if (b.dataset.act === 'edit') form(emp);
    else if (b.dataset.act === 'payslip') {
      if (isSPA && typeof App !== 'undefined' && App.navigate) App.navigate('payslip', b.dataset.id);
    }
    else if (b.dataset.act === 'del') {
      if (!emp) return;
      askConfirm(`Delete <b>${esc(emp.name)}</b>? Their login account, attendance history, and leave records will also be removed.`, 'Delete employee', () => {
        Store.saveUsers(Store.users().filter(u => u.id !== emp.id));
        Store.saveAtt(Store.att().filter(a => a.empId !== emp.id));
        Store.saveLeaves(Store.leaves().filter(l => l.empId !== emp.id));
        toast('Employee deleted.');
        fillDeps();
        drawList();
      });
    }
  };

  $('#q', root).oninput = ev => { q = ev.target.value; drawList(); };
  $('#dep', root).onchange = ev => { dep = ev.target.value; drawList(); };
  fillDeps();
  drawList();
}

if (document.body.dataset.page === 'employees') (function () {
  const me = Auth.guard('admin'); if (!me) return;
  mountShell(me, 'employees.html', 'Employees');
  renderEmployees($('#page'), me);
})();
