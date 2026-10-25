/* pages.js - Admin dashboard, Employee dashboard, Settings, announcements */
const page = document.body.dataset.page;
const statCard = (label, val, cls, href, view) => {
  const isSPA = document.body.dataset.page === 'app';
  const targetHref = isSPA && view ? `#${view}` : (href || '#');
  const viewAttr = isSPA && view ? `data-view="${view}"` : '';
  return `<${href ? `a href="${targetHref}" ${viewAttr}` : 'div'} class="stat ${cls}"><b>${val}</b><span>${label}</span></${href ? 'a' : 'div'}>`;
};

function annList(canDelete) {
  const a = Store.ann().slice().reverse();
  return a.length ? a.map(x => `
    <div class="ann">
      <div>
        <b>${esc(x.title)}</b>
        <p>${esc(x.body)}</p>
        <small class="muted">${D.nice(x.date)}</small>
      </div>
      ${canDelete ? `<button class="btn sm ghost" data-del="${x.id}" type="button">Delete</button>` : ''}
    </div>`).join('') : '<p class="muted">No announcements posted yet.</p>';
}

let attendanceChart;

document.addEventListener('themechange', () => {
  if (!attendanceChart) return;
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  attendanceChart.options.scales.x.ticks.color = textColor;
  attendanceChart.options.scales.y.ticks.color = textColor;
  attendanceChart.options.plugins.title.color = textColor;
  attendanceChart.options.plugins.legend.labels.color = textColor;
  attendanceChart.update();
});

function renderAttendanceReport(root) {
  const report = $('#attendanceReport', root);
  if (!report) return;
  if (attendanceChart) {
    attendanceChart.destroy();
    attendanceChart = null;
  }

  const existingMonth = $('#reportMonth', report);
  const month = existingMonth && existingMonth.value || D.ymd().slice(0, 7);
  report.innerHTML = `
    <div class="row report-heading">
      <div><h3>Monthly Attendance Report</h3><p class="muted small">Attendance trends and employee totals for the selected month.</p></div>
      <div class="row noprint report-actions">
        <label class="small" for="reportMonth">Month</label>
        <input id="reportMonth" type="month" value="${month}" aria-label="Report month">
        <button class="btn ghost sm" id="exportAttendance" type="button">Export CSV</button>
        <button class="btn sm" id="printAttendance" type="button">Print report</button>
      </div>
    </div>
    <div id="reportChartHost" class="report-chart"></div>
    <div id="reportSummary" class="tablewrap report-summary"></div>`;

  const draw = () => {
    const ym = $('#reportMonth', report).value;
    if (!/^\d{4}-\d{2}$/.test(ym)) return;
    if (attendanceChart) {
      attendanceChart.destroy();
      attendanceChart = null;
    }
    $('#reportChartHost', report).innerHTML = '<canvas id="attendanceChart" role="img" aria-label="Monthly attendance chart"></canvas>';
    const employees = Store.employees();
    const today = D.ymd();
    const days = D.monthDays(ym).filter(date => D.isWork(date) && date <= today);
    const stats = employees.map(emp => ({ emp, stats: monthStats(emp, ym) }));
    const series = {
      present: days.map(date => stats.reduce((n, item) => n + Number(item.stats.rows.some(row => row.date === date && row.r && row.r.status === 'present')), 0)),
      late: days.map(date => stats.reduce((n, item) => n + Number(item.stats.rows.some(row => row.date === date && row.r && row.r.late && row.st !== 'half')), 0)),
      half: days.map(date => stats.reduce((n, item) => n + Number(item.stats.rows.some(row => row.date === date && row.st === 'half')), 0)),
      absent: days.map(date => stats.reduce((n, item) => n + Number(item.stats.rows.some(row => row.date === date && row.st === 'absent')), 0))
    };

    if (typeof Chart === 'undefined') {
      $('#reportChartHost', report).innerHTML = '<p class="notice" role="status">Chart.js could not load. Check your internet connection and reload to view the chart.</p>';
    } else {
      const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
      attendanceChart = new Chart($('#attendanceChart', report), {
        type: 'bar',
        data: {
          labels: days.map(date => date.slice(8)),
          datasets: [
            { label: 'Present', data: series.present, backgroundColor: '#1f9d63' },
            { label: 'Late', data: series.late, backgroundColor: '#e8962b' },
            { label: 'Half day', data: series.half, backgroundColor: '#5b4fcf' },
            { label: 'Absent', data: series.absent, backgroundColor: '#dc4a4f' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: { ticks: { color: textColor }, grid: { color: 'rgba(120,130,150,.15)' } },
            y: { beginAtZero: true, ticks: { precision: 0, color: textColor }, grid: { color: 'rgba(120,130,150,.15)' } }
          },
          plugins: {
            title: { display: true, text: `Daily attendance — ${ym}`, color: textColor },
            legend: { labels: { color: textColor } }
          }
        }
      });
    }

    $('#reportSummary', report).innerHTML = employees.length ? `
      <table class="tbl">
        <thead><tr><th>Employee</th><th>Department</th><th>Attended</th><th>Late</th><th>Half days</th><th>Absent</th><th>Leave</th></tr></thead>
        <tbody>${stats.map(({ emp, stats: s }) => `<tr>
          <td>${esc(emp.name)}</td><td>${esc(emp.department)}</td><td>${s.present}</td>
          <td>${s.late}</td><td>${s.half}</td><td>${s.absent}</td><td>${s.leave}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<p class="muted">No employees to report.</p>';
  };

  const csvCell = value => {
    let text = String(value === null || value === undefined ? '' : value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const downloadCsv = () => {
    const ym = $('#reportMonth', report).value;
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      toast('Choose a valid report month.', 'err');
      return;
    }
    const rows = [['Date', 'Employee', 'Department', 'Check in', 'Check out', 'Status', 'Distance from office (m)', 'GPS accuracy (m)']];
    Store.employees().forEach(emp => {
      monthStats(emp, ym).rows.forEach(({ date, st, r }) => {
        if (!D.isWork(date) || date > D.ymd() || st === 'na') return;
        rows.push([
          date, emp.name, emp.department, r ? r.in : '', r ? r.out : '',
          st, r && r.location ? r.location.distanceMeters : '',
          r && r.location ? r.location.accuracyMeters : ''
        ]);
      });
    });
    try {
      const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-${ym}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast('Attendance CSV exported.');
    } catch (error) {
      toast('Could not export the CSV file.', 'err');
    }
  };

  $('#reportMonth', report).onchange = draw;
  $('#exportAttendance', report).onclick = downloadCsv;
  $('#printAttendance', report).onclick = () => {
    const clearPrintMode = () => document.body.classList.remove('print-attendance-report');
    document.body.classList.add('print-attendance-report');
    window.addEventListener('afterprint', clearPrintMode, { once: true });
    window.print();
    setTimeout(clearPrintMode, 1000);
  };
  draw();
}

function renderAdmin(root, me) {
  me = me || Store.me();
  if (!me) return;
  root.innerHTML = '<div class="stats" id="stats"></div><div class="grid"><div class="col"><div class="card" id="today"></div><div class="card" id="attendanceReport"></div><div class="card" id="ann"></div></div><div id="helper"></div></div>';
  mountHelper(me, $('#helper', root));

  function draw() {
    const t = D.ymd(), emps = Store.employees(), recs = Store.att().filter(a => a.date === t && emps.some(e => e.id === a.empId)), lv = leavesToday();
    const pend = pendingCount();
    $('#stats', root).innerHTML =
      statCard('Total Employees', emps.length, 'teal', 'employees.html', 'employees') +
      statCard('Present Today', recs.length, 'green') +
      statCard('On Leave Today', lv.length, 'blue') +
      statCard('Late Arrivals', recs.filter(r => r.late).length, 'orange') +
      statCard('Pending Leaves', pend, 'purple', 'leaves.html', 'leaves');

    $('#today', root).innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:0.8rem">
        <h3 style="margin-bottom:0">Today's Attendance (${D.nice(t)})</h3>
        <small class="muted">${D.isWork(t) ? 'Official Working Day' : 'Office Closed / Weekend'}</small>
      </div>
      ` + (emps.length ? `
        <div class="tablewrap">
          <table class="tbl stack">
            <thead>
              <tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Hours</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              ${emps.map(e => {
                const r = recs.find(x => x.empId === e.id);
                const st = statusOf(e, t, r ? [r] : [], approvedOf(e.id));
                const h = r && r.out ? fmtH(hoursOf(r)) : (r && r.in ? 'Shift active' : '-');
                return `<tr>
                  <td data-label="Employee">
                    <div class="av-row">
                      <i class="av">${esc(e.name[0].toUpperCase())}</i>
                      <div><b>${esc(e.name)}</b><br><small class="muted">${esc(e.department)}</small></div>
                    </div>
                  </td>
                  <td data-label="Check in">${r && r.in ? D.t12(r.in) : '-'}</td>
                  <td data-label="Check out">${r && r.out ? D.t12(r.out) : '-'}</td>
                  <td data-label="Hours">${h}</td>
                  <td data-label="Status">${attBadge(st)}</td>
                  <td class="acts">
                    <button class="btn sm ghost" data-editatt="${e.id}" type="button">Edit / Adjust</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`
      : '<div class="empty"><h3>No employees yet</h3><p>Add employees to start tracking attendance.</p><button class="btn" data-view="employees" type="button">+ Add Employees</button></div>');
    renderAttendanceReport(root);

    $('#ann', root).innerHTML = `
      <h3>Post Announcement</h3>
      <form id="af" novalidate>
        ${fld('Title', 'title')}
        ${area('Announcement message', 'body')}
        <button class="btn">Broadcast Announcement</button>
      </form>
      <div class="anns">
        <h3 style="margin-top:1.2rem;margin-bottom:0.5rem">Recent Announcements</h3>
        ${annList(true)}
      </div>`;
  }

  root.onsubmit = e => {
    if (e.target.id !== 'af') return;
    e.preventDefault();
    const f = e.target, d = formData(f);
    if (!showErrors(f, { title: !d.title && 'Title is required.', body: !d.body && 'Message is required.' })) return;
    const a = Store.ann();
    a.push({ id: Date.now(), title: d.title, body: d.body, date: D.ymd() });
    Store.saveAnn(a);
    toast('Announcement posted to all staff.');
    draw();
  };

  root.onclick = e => {
    const delBtn = e.target.closest('[data-del]');
    if (delBtn) {
      Store.saveAnn(Store.ann().filter(x => x.id !== Number(delBtn.dataset.del)));
      toast('Announcement deleted.');
      draw();
      return;
    }
    const editAttBtn = e.target.closest('[data-editatt]');
    if (editAttBtn) {
      const emp = Store.employees().find(x => x.id === Number(editAttBtn.dataset.editatt));
      if (emp) adminEditAttendance(emp, D.ymd(), draw);
      return;
    }
    const navBtn = e.target.closest('[data-view]');
    if (navBtn && typeof App !== 'undefined' && App.navigate) {
      e.preventDefault();
      App.navigate(navBtn.dataset.view);
    }
  };

  draw();
}

function renderEmployee(root, me) {
  me = me || Store.me();
  if (!me) return;
  root.innerHTML = '<div class="grid"><div class="col" id="area"></div><div class="col" id="side2"><div id="helper"></div></div></div>';
  mountHelper(me, $('#helper', root));
  const area_ = $('#area', root);

  function draw() {
    const c = Store.company(), t = D.ymd(), rec = recsOf(me.id).find(a => a.date === t), s = monthStats(me, t.slice(0, 7));
    const pend = Store.leaves().filter(l => l.empId === me.id && l.status === 'pending').reduce((n, l) => n + l.days, 0);
    const isWorkingDay = D.isWork(t);
    const onLeave = approvedOf(me.id).some(l => l.from <= t && t <= l.to);

    let info = '';
    let badgeHtml = '';
    let canCheckIn = false;
    let canCheckOut = false;

    if (!isWorkingDay) {
      info = 'Today is an official non-working day (Office is closed).';
      badgeHtml = attBadge('off');
    } else if (onLeave) {
      info = 'You are on approved leave today. Enjoy your day off!';
      badgeHtml = attBadge('leave');
    } else if (!rec) {
      info = 'You have not checked in yet today.';
      badgeHtml = attBadge('pending');
      canCheckIn = true;
    } else if (!rec.out) {
      const liveMins = Math.max(0, D.mins(D.hm()) - D.mins(rec.in));
      const liveHours = Math.floor(liveMins / 60) + 'h ' + (liveMins % 60) + 'm';
      info = `Checked in at ${D.t12(rec.in)}. Current shift: ${liveHours} active.`;
      badgeHtml = attBadge(rec.status);
      canCheckOut = true;
    } else {
      info = `Checked in at ${D.t12(rec.in)}, out at ${D.t12(rec.out)}. Total shift: ${fmtH(hoursOf(rec))}.`;
      badgeHtml = attBadge(rec.status);
    }

    const rows = s.rows.filter(r => r.date <= t && !['off', 'future', 'na'].includes(r.st)).reverse();
    const mine = Store.leaves().filter(l => l.empId === me.id).reverse();

    area_.innerHTML = `
      <div class="card hero">
        <div>
          <small>Today, ${D.nice(t)}</small>
          <div class="clock" id="clock">${new Date().toLocaleTimeString()}</div>
          <p style="margin:0.5rem 0">${info} ${badgeHtml}</p>
          <p class="muted small">Office start: ${D.t12(c.start)} (${c.grace}m grace). Shifts under 5 hours are marked as half day.</p>
        </div>
        <div class="row">
          <button class="btn big" data-act="in" type="button" ${canCheckIn ? '' : 'disabled'}>&#10003; Check in</button>
          <button class="btn big ghost" data-act="out" type="button" ${canCheckOut ? '' : 'disabled'}>&#10006; Check out</button>
        </div>
      </div>
      <div class="stats">
        ${statCard('Annual Leave Balance', balance(me.id), 'teal')}
        ${statCard('Days Present (Month)', s.present, 'green')}
        ${statCard('Late Arrivals (Month)', s.late, 'orange')}
        ${statCard('Absent (Month)', s.absent, 'red')}
      </div>
      <div class="card">
        <h3>Company Announcements</h3>
        ${annList(false)}
      </div>
      <div class="card">
        <h3>My Attendance This Month</h3>
        ${rows.length ? `
          <div class="tablewrap">
            <table class="tbl stack">
              <thead>
                <tr><th>Date</th><th>Check in</th><th>Check out</th><th>Hours Worked</th><th>Status</th></tr>
              </thead>
              <tbody>
                ${rows.map(r => `<tr>
                  <td data-label="Date">${D.nice(r.date)}</td>
                  <td data-label="Check in">${r.r && r.r.in ? D.t12(r.r.in) : '-'}</td>
                  <td data-label="Check out">${r.r && r.r.out ? D.t12(r.r.out) : '-'}</td>
                  <td data-label="Hours Worked">${r.r && r.r.out ? fmtH(hoursOf(r.r)) : (r.r && r.r.in ? 'Active' : '-')}</td>
                  <td data-label="Status">${attBadge(r.st)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`
        : '<p class="muted">No attendance recorded yet this month.</p>'}
      </div>
      <div class="card">
        <h3>Apply for Leave</h3>
        <p class="muted small">Annual leave quota: ${c.quota} days. ${pend ? `${pend} day(s) currently awaiting approval. ` : ''}Weekends and holidays are skipped.</p>
        <form id="lf" novalidate>
          ${sel('Leave type', 'type', ['Casual', 'Sick', 'Annual'])}
          <div class="two">
            ${fld('From date', 'from', 'date')}
            ${fld('To date', 'to', 'date')}
          </div>
          <div id="liveLeaveDays" class="small muted" style="margin-bottom:0.6rem"></div>
          ${area('Reason for leave', 'reason')}
          <button class="btn">Submit Leave Request</button>
        </form>
      </div>
      <div class="card">
        <h3>My Leave History</h3>
        ${mine.length ? `
          <div class="tablewrap">
            <table class="tbl stack">
              <thead>
                <tr><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Admin Response</th></tr>
              </thead>
              <tbody>
                ${mine.map(l => `<tr>
                  <td data-label="Type"><b>${esc(l.type)}</b></td>
                  <td data-label="Dates">${D.nice(l.from)}${l.from !== l.to ? ' to ' + D.nice(l.to) : ''}</td>
                  <td data-label="Days">${l.days} day(s)</td>
                  <td data-label="Status">${lvBadge(l.status)}</td>
                  <td data-label="Admin Response">${esc(l.comment) || '<span class="muted">-</span>'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`
        : '<p class="muted">You have not submitted any leave requests yet.</p>'}
      </div>`;

    const updateLeaveCalc = () => {
      const fromVal = $('#f_from', area_) ? $('#f_from', area_).value : '';
      const toVal = $('#f_to', area_) ? $('#f_to', area_).value : '';
      const calcEl = $('#liveLeaveDays', area_);
      if (!calcEl) return;
      if (fromVal && toVal) {
        if (fromVal > toVal) {
          calcEl.textContent = 'End date cannot be earlier than start date.';
          calcEl.style.color = 'var(--red)';
        } else {
          const wd = D.workDays(fromVal, toVal);
          calcEl.textContent = `Calculated: ${wd} working day(s) selected (weekends excluded).`;
          calcEl.style.color = 'var(--teal-dark)';
        }
      } else {
        calcEl.textContent = '';
      }
    };

    const fromInp = $('#f_from', area_);
    const toInp = $('#f_to', area_);
    if (fromInp) fromInp.onchange = updateLeaveCalc;
    if (toInp) toInp.onchange = updateLeaveCalc;
  }

  area_.onclick = e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'in') cameraCheckIn(me, draw);
    else if (b.dataset.act === 'out') { checkOut(me); draw(); }
  };

  area_.onsubmit = e => {
    if (e.target.id !== 'lf') return;
    e.preventDefault();
    const f = e.target, d = formData(f), v = validateLeave(me, d);
    if (!showErrors(f, v.errs)) return;
    const all = Store.leaves();
    all.push({ id: Date.now(), empId: me.id, type: d.type, from: d.from, to: d.to, days: v.days, reason: d.reason, status: 'pending', comment: '' });
    Store.saveLeaves(all);
    toast('Leave request submitted for Admin approval.');
    draw();
  };

  draw();
}

function renderSettings(root, me) {
  me = me || Store.me();
  if (!me) return;
  const c = Store.company();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  root.innerHTML = `
    <div class="card narrow">
      <h3>Attendance & Leave Rules</h3>
      <p class="muted small">Configure office check-in timing, check-in location, grace periods, yearly leave quotas, and working days.</p>
      <form id="sf" novalidate>
        ${fld('Company name', 'name', 'text', c.name)}
        <div class="two">
          ${fld('Office start time', 'start', 'time', c.start)}
          ${fld('Grace minutes', 'grace', 'number', c.grace, 'min="0" step="1"')}
        </div>
        ${fld('Annual leave quota (days)', 'quota', 'number', c.quota, 'min="1" step="1"')}
        <div class="two">
          ${fld('Office latitude', 'officeLat', 'number', c.officeLat === null || c.officeLat === undefined ? '' : c.officeLat, 'min="-90" max="90" step="any"')}
          ${fld('Office longitude', 'officeLon', 'number', c.officeLon === null || c.officeLon === undefined ? '' : c.officeLon, 'min="-180" max="180" step="any"')}
        </div>
        ${fld('Allowed check-in radius (meters)', 'officeRadius', 'number', c.officeRadius, 'min="1" step="1"')}
        <p class="muted small">Employees must allow precise location and check in within this radius. Camera images are not saved.</p>
        <div class="field">
          <label>Working days</label>
          <div class="days">
            ${days.map((n, i) => `
              <label class="day">
                <input type="checkbox" name="wd" value="${i}" ${c.workDays.includes(i) ? 'checked' : ''}>
                <span>${n.slice(0, 3)}</span>
              </label>`).join('')}
          </div>
          <small class="err" id="wdErr"></small>
        </div>
        <button class="btn">Save Settings</button>
      </form>
    </div>

    <div class="card narrow">
      <h3>Demo & Testing Tools</h3>
      <p class="muted small">Quickly populate or reset sample records for evaluation.</p>
      <div class="row">
        <button class="btn ghost sm" type="button" id="seedBtn">&#9889; Reload Complete Demo Data</button>
        <button class="btn sm red" type="button" id="resetBtn">Reset All Data (Clear)</button>
      </div>
    </div>`;

  $('#sf', root).onsubmit = e => {
    e.preventDefault();
    const f = e.target, d = formData(f), wd = $$('[name=wd]:checked', f).map(x => Number(x.value));
    const errs = {
      name: !d.name && 'Company name is required.',
      start: !d.start && 'Choose an office start time.',
      grace: (d.grace === '' || Number(d.grace) < 0) && 'Enter 0 or more grace minutes.',
      quota: !(Number(d.quota) > 0) && 'Quota must be greater than 0.',
      officeLat: (d.officeLat === '') !== (d.officeLon === '') ? 'Enter both office coordinates, or leave both blank.' :
        (d.officeLat !== '' && (!Number.isFinite(Number(d.officeLat)) || Number(d.officeLat) < -90 || Number(d.officeLat) > 90)) && 'Latitude must be between -90 and 90.',
      officeLon: d.officeLon !== '' && (!Number.isFinite(Number(d.officeLon)) || Number(d.officeLon) < -180 || Number(d.officeLon) > 180) && 'Longitude must be between -180 and 180.',
      officeRadius: !(Number(d.officeRadius) > 0) && 'Enter an allowed radius greater than 0 meters.'
    };
    const ok = showErrors(f, errs);
    $('#wdErr', root).textContent = wd.length ? '' : 'Select at least one working day.';
    if (!ok || !wd.length) return;

    Store.saveCompany({
      name: d.name, start: d.start, grace: Number(d.grace), quota: Number(d.quota), workDays: wd,
      officeLat: d.officeLat === '' ? null : Number(d.officeLat),
      officeLon: d.officeLon === '' ? null : Number(d.officeLon),
      officeRadius: Number(d.officeRadius)
    });

    const bi = $('#brandIcon'), bn = $('#brandName');
    if (bi) bi.textContent = d.name[0].toUpperCase();
    if (bn) bn.textContent = d.name;

    toast('Settings saved successfully.');
  };

  $('#seedBtn', root).onclick = () => {
    Store.seedDemo();
    toast('Demo data refreshed!');
    setTimeout(() => location.reload(), 400);
  };

  $('#resetBtn', root).onclick = () => {
    askConfirm('Are you sure you want to delete all company data, users, and attendance records?', 'Reset Everything', () => {
      localStorage.clear();
      toast('All data cleared.');
      setTimeout(() => location.href = (location.pathname.includes('/pages/') ? '../' : '') + 'index.html', 400);
    });
  };
}

// Standalone page mounting for multi-page mode
if (page === 'admin') (function () {
  const me = Auth.guard('admin'); if (!me) return;
  mountShell(me, 'admin.html', 'Admin Dashboard');
  renderAdmin($('#page'), me);
})();

if (page === 'employee') (function () {
  const me = Auth.guard('employee'); if (!me) return;
  mountShell(me, 'employee.html', 'My Dashboard');
  renderEmployee($('#page'), me);
})();

if (page === 'settings') (function () {
  const me = Auth.guard('admin'); if (!me) return;
  mountShell(me, 'settings.html', 'Company Settings');
  renderSettings($('#page'), me);
})();
