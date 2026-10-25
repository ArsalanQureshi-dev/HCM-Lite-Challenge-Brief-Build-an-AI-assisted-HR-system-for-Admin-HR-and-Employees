/* attendance.js - check in/out, late / half day / absent rules, monthly stats, payslip page */
const recsOf = id => Store.att().filter(a => a.empId === id);
const approvedOf = id => Store.leaves().filter(l => l.empId === id && l.status === 'approved');
const hoursOf = r => (r && r.out && r.in ? Math.max(0, (D.mins(r.out) - D.mins(r.in)) / 60) : 0);
const fmtH = h => { const m = Math.round(h * 60); return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };

/* Status of one employee on one date: present | late | half | absent | leave | off | pending | future | na */
function statusOf(emp, date, recs, lv) {
  const r = recs.find(a => a.date === date);
  if (r) return r.status;
  if (!D.isWork(date)) return 'off';
  if (lv.some(l => l.from <= date && date <= l.to)) return 'leave';
  const t = D.ymd();
  if (date >= t) return date === t ? 'pending' : 'future';
  if (emp && emp.joined && date < emp.joined) return 'na';
  return 'absent';
}

function monthStats(emp, ym) {
  const recs = recsOf(emp.id), lv = approvedOf(emp.id), days = D.monthDays(ym);
  const s = { present: 0, late: 0, half: 0, absent: 0, leave: 0, wd: days.filter(D.isWork).length, rows: [] };
  days.forEach(d => {
    const st = statusOf(emp, d, recs, lv), r = recs.find(a => a.date === d);
    s.rows.push({ date: d, st, r });
    if (r) {
      s.present++;
      if (r.late) s.late++;
      if (st === 'half') s.half++;
    } else if (st === 'absent') {
      s.absent++;
    } else if (st === 'leave') {
      s.leave++;
    }
  });
  return s;
}

function checkIn(me, position) {
  const t = D.ymd();
  const company = Store.company();
  if (company.officeLat === '' || company.officeLat === null || company.officeLat === undefined ||
      company.officeLon === '' || company.officeLon === null || company.officeLon === undefined ||
      !Number.isFinite(Number(company.officeLat)) || !Number.isFinite(Number(company.officeLon))) {
    toast('Ask your Admin to set the office location before checking in.', 'err');
    return false;
  }
  if (!position || !Number.isFinite(position.latitude) || !Number.isFinite(position.longitude)) {
    toast('Location verification is required to check in.', 'err');
    return false;
  }
  const distance = distanceBetween(position.latitude, position.longitude, Number(company.officeLat), Number(company.officeLon));
  const radius = Number(company.officeRadius) || 100;
  if (!Number.isFinite(position.accuracy) || position.accuracy < 0 || position.accuracy > radius) {
    toast('Location accuracy is too low. Enable precise location and try again.', 'err');
    return false;
  }
  if (distance > radius) {
    toast(`You are outside the office check-in area (${Math.round(distance)}m away; limit ${radius}m).`, 'err');
    return false;
  }
  if (!D.isWork(t)) {
    toast('Today is not an official working day (office closed).', 'warn');
    return false;
  }
  const lv = approvedOf(me.id);
  if (lv.some(l => l.from <= t && t <= l.to)) {
    toast('You are on approved leave today. Enjoy your day off!', 'warn');
    return false;
  }
  const all = Store.att();
  if (all.some(x => x.empId === me.id && x.date === t)) {
    toast('You have already checked in today.', 'err');
    return false;
  }
  const now = D.hm();
  const startMins = D.mins(company.start || '09:00');
  const graceMins = Number(company.grace || 15);
  const late = D.mins(now) > startMins + graceMins;

  all.push({
    empId: me.id, date: t, in: now, out: null,
    status: late ? 'late' : 'present', late,
    location: { distanceMeters: Math.round(distance), accuracyMeters: Math.round(position.accuracy) }
  });
  Store.saveAtt(all);
  toast(late ? `Checked in at ${D.t12(now)} (Late arrival).` : `Checked in at ${D.t12(now)}. On time!`, late ? 'warn' : 'ok');
  return true;
}

function distanceBetween(lat1, lon1, lat2, lon2) {
  const rad = degrees => degrees * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  const boundedA = Math.min(1, Math.max(0, a));
  return 6371000 * 2 * Math.atan2(Math.sqrt(boundedA), Math.sqrt(1 - boundedA));
}

async function cameraCheckIn(me, onDone) {
  const c = Store.company();
  if (c.officeLat === '' || c.officeLat === null || c.officeLat === undefined ||
      c.officeLon === '' || c.officeLon === null || c.officeLon === undefined ||
      !Number.isFinite(Number(c.officeLat)) || !Number.isFinite(Number(c.officeLon))) {
    toast('Ask your Admin to set the office location before checking in.', 'err');
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Camera access needs HTTPS or localhost and a supported browser.', 'err');
    return;
  }
  if (!navigator.geolocation) {
    toast('This browser does not support location verification.', 'err');
    return;
  }

  const modal = openModal('Camera check-in', `
    <p class="muted small">Allow camera and location access. Face detection runs in your browser; no camera image is saved.</p>
    <video id="checkinVideo" class="checkin-video" autoplay muted playsinline></video>
    <p id="checkinStatus" class="small" role="status">Starting camera and face detection…</p>
    <button id="verifyCheckin" class="btn block" type="button" disabled>Verify face, location & check in</button>
  `);
  const video = $('#checkinVideo', modal), status = $('#checkinStatus', modal), verify = $('#verifyCheckin', modal);
  let stream, cancelled = false;
  const stopCamera = () => {
    cancelled = true;
    if (stream) stream.getTracks().forEach(track => track.stop());
  };
  modal.addEventListener('mousedown', event => {
    if (event.target === modal) {
      stopCamera();
      document.removeEventListener('keydown', stopOnEscape);
    }
  });
  const stopOnEscape = event => {
    if (event.key === 'Escape') {
      stopCamera();
      document.removeEventListener('keydown', stopOnEscape);
    }
  };
  document.addEventListener('keydown', stopOnEscape);
  $('.x', modal).addEventListener('mousedown', () => {
    stopCamera();
    document.removeEventListener('keydown', stopOnEscape);
  });

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    if (cancelled || !modal.isConnected) { stopCamera(); document.removeEventListener('keydown', stopOnEscape); return; }
    video.srcObject = stream;
    if (!window.faceapi) throw new Error('Face detection library did not load. Check your internet connection and reload.');
    await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights');
    if (cancelled || !modal.isConnected) { stopCamera(); document.removeEventListener('keydown', stopOnEscape); return; }
    await new Promise(resolve => {
      if (video.readyState >= 2) resolve();
      else video.addEventListener('loadeddata', resolve, { once: true });
    });
    status.textContent = 'Camera ready. Keep your face visible, then verify.';
    verify.disabled = false;
  } catch (error) {
    stopCamera();
    document.removeEventListener('keydown', stopOnEscape);
    status.textContent = error.message || 'Camera could not start. Check browser permissions.';
    toast(error.message || 'Camera could not start. Check browser permissions.', 'err');
    return;
  }

  verify.onclick = () => {
    verify.disabled = true;
    status.textContent = 'Checking face and office location…';
    faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
      .then(faces => {
        if (!faces.length) throw new Error('No face detected. Move into view and try again.');
        return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
          position => resolve(position),
          error => reject(new Error(error.code === 1 ? 'Location permission was denied.' : 'Could not verify your location. Check GPS and try again.')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        ));
      })
      .then(position => {
        const success = checkIn(me, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        if (success) {
          stopCamera();
          document.removeEventListener('keydown', stopOnEscape);
          closeModal();
          if (onDone) onDone();
        } else {
          status.textContent = 'Check-in was not completed. Review the message and try again.';
          verify.disabled = false;
        }
      })
      .catch(error => {
        status.textContent = error.message || 'Face or location verification failed.';
        toast(error.message || 'Face or location verification failed.', 'err');
        verify.disabled = false;
      });
  };
}

function checkOut(me) {
  const t = D.ymd(), all = Store.att(), r = all.find(x => x.empId === me.id && x.date === t);
  if (!r) { toast('Check in first, then check out.', 'err'); return; }
  if (r.out) { toast('You have already checked out today.', 'err'); return; }
  r.out = D.hm();
  if (D.mins(r.out) < D.mins(r.in)) { r.out = r.in; }
  r.status = hoursOf(r) < 5 ? 'half' : (r.late ? 'late' : 'present');
  Store.saveAtt(all);
  toast('Checked out. You worked ' + fmtH(hoursOf(r)) + (r.status === 'half' ? ' - counted as a half day (under 5h).' : '.'), r.status === 'half' ? 'warn' : 'ok');
}

/* Admin can manually correct or record attendance for any employee */
function adminEditAttendance(emp, date, onDone) {
  const all = Store.att();
  const r = all.find(x => x.empId === emp.id && x.date === date) || { in: '09:00', out: '17:00', status: 'present', late: false };
  const m = openModal(`Attendance: ${esc(emp.name)} (${D.nice(date)})`, `
    <form id="attForm" novalidate>
      <div class="two">
        ${fld('Check in time', 'in', 'time', r.in || '09:00')}
        ${fld('Check out time', 'out', 'time', r.out || '17:00')}
      </div>
      ${sel('Status', 'status', ['present', 'late', 'half', 'absent'], r.status || 'present')}
      <div class="row end">
        <button class="btn ghost" type="button" id="attDel">Remove record</button>
        <button class="btn">Save record</button>
      </div>
    </form>
  `);

  $('#attForm', m).onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    const existingIdx = all.findIndex(x => x.empId === emp.id && x.date === date);
    const updated = {
      empId: emp.id,
      date,
      in: d.in || null,
      out: d.out || null,
      status: d.status,
      late: d.status === 'late'
    };
    if (existingIdx >= 0) all[existingIdx] = updated;
    else all.push(updated);
    Store.saveAtt(all);
    closeModal();
    toast('Attendance updated.');
    if (onDone) onDone();
  };

  const delBtn = $('#attDel', m);
  if (delBtn) {
    delBtn.onclick = () => {
      Store.saveAtt(all.filter(x => !(x.empId === emp.id && x.date === date)));
      closeModal();
      toast('Attendance record cleared.');
      if (onDone) onDone();
    };
  }
}

function renderPayslip(root, me, preselectedEmpId) {
  me = me || Store.me();
  if (!me) return;
  const isAdmin = me.role === 'admin';
  const emps = isAdmin ? Store.employees() : [me];
  if (!emps.length) {
    root.innerHTML = '<div class="card empty"><h3>No employees yet</h3><p>Add an employee first, then come back to see their payslip.</p></div>';
    return;
  }
  const paramId = preselectedEmpId || new URLSearchParams(location.search).get('id');
  root.innerHTML = `
    <div class="bar noprint">
      ${isAdmin ? `<select id="who" aria-label="Employee">${emps.map(e => `<option value="${e.id}" ${paramId && String(e.id) === String(paramId) ? 'selected' : ''}>${esc(e.name)} (${esc(e.department)})</option>`).join('')}</select>` : ''}
      <input type="month" id="mon" value="${D.ymd().slice(0, 7)}" aria-label="Month">
      <button class="btn" id="prn" type="button">&#128438; Print or Save as PDF</button>
    </div>
    <div id="slip" class="card slip"></div>`;

  const draw = () => {
    const whoEl = $('#who', root);
    const selectedId = whoEl ? whoEl.value : me.id;
    const e = emps.find(x => String(x.id) === String(selectedId)) || emps[0];
    if (!e) return;
    const ym = $('#mon', root).value || D.ymd().slice(0, 7);
    const s = monthStats(e, ym);
    const per = s.wd ? e.salary / s.wd : 0;
    const ded = per * (s.absent + 0.5 * s.half);
    const net = Math.max(0, e.salary - ded);
    const p = ym.split('-').map(Number);
    const label = new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const co = Store.company();

    $('#slip', root).innerHTML = `
      <div class="slip-h">
        <div>
          <h2>${esc(co.name)}</h2>
          <p class="muted">Official Salary Statement &mdash; ${label}</p>
        </div>
        <div class="slip-net">
          <small>Net Payable Salary</small>
          <b>${money(net)}</b>
        </div>
      </div>
      <div class="slip-who">
        <div><small>Employee Name</small><b>${esc(e.name)}</b></div>
        <div><small>Department</small><b>${esc(e.department)}</b></div>
        <div><small>Email</small><b>${esc(e.email)}</b></div>
        <div><small>Date of Joining</small><b>${D.nice(e.joined || '')}</b></div>
      </div>
      <table class="tbl">
        <tbody>
          <tr><td>Basic Monthly Salary</td><td class="r">${money(e.salary)}</td></tr>
          <tr><td>Official Working Days in Month</td><td class="r">${s.wd} days</td></tr>
          <tr><td>Calculated Rate Per Day</td><td class="r">${money(per)}</td></tr>
          <tr><td>Days Present (includes on-time & late)</td><td class="r">${s.present} days</td></tr>
          <tr><td>Late Arrivals (no deduction)</td><td class="r">${s.late}</td></tr>
          <tr><td>Approved Leave Days</td><td class="r">${s.leave} days</td></tr>
          <tr><td>Absent Days (Unexcused)</td><td class="r">${s.absent} day(s)</td></tr>
          <tr><td>Half Days (worked under 5 hrs)</td><td class="r">${s.half} day(s)</td></tr>
          <tr><td>Total Deductions = Rate &times; (Absent + 0.5 &times; Half Days)</td><td class="r red-t">- ${money(ded)}</td></tr>
          <tr class="total"><td>Final Net Disbursed Salary</td><td class="r">${money(net)}</td></tr>
        </tbody>
      </table>
      <p class="muted small" style="margin-top:1rem">Note: Absences are calculated against working days. Days prior to joining date are excluded from deductions.</p>
      <div class="slip-signatures">
        <div><div class="sig-line"></div><small>Employee Signature</small></div>
        <div><div class="sig-line"></div><small>HR Manager</small></div>
        <div><div class="sig-line"></div><small>Managing Director</small></div>
      </div>
    `;
  };

  root.onchange = draw;
  root.oninput = draw;
  const prnBtn = $('#prn', root);
  if (prnBtn) prnBtn.onclick = () => window.print();
  draw();
}

if (document.body.dataset.page === 'payslip') (function () {
  const me = Auth.guard('any'); if (!me) return;
  const isAdmin = me.role === 'admin';
  mountShell(me, 'payslip.html', isAdmin ? 'Payslips' : 'My payslip');
  renderPayslip($('#page'), me);
})();
