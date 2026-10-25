/* helper.js - smart helper chat: answers from the app's own data (English & Roman Urdu) */
function getWorkDayNames(days) {
  const all = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return (days || [1, 2, 3, 4, 5]).map(i => all[i]).join(', ');
}

function adminAnswer(t) {
  const emps = Store.employees(), today = D.ymd(), recs = Store.att().filter(a => a.date === today && emps.some(e => e.id === a.empId));
  const c = Store.company();
  const nm = id => (emps.find(e => e.id === id) || {}).name || 'Unknown';

  // Help / questions
  if (/\b(help|madad|kya pooch|what can i ask|commands)\b/.test(t)) {
    return 'You can ask me about:\n- Headcount ("How many employees?")\n- Today\'s attendance ("Who is present / absent?")\n- Late arrivals ("Who was late today?")\n- Approved leaves ("Who is on leave?")\n- Pending requests ("Any pending leaves?")\n- Office rules ("Office timing / working days")';
  }

  // Office timing & rules
  if (/\b(office time|timing|start time|grace|rules|working days|schedule|shuru)\b/.test(t)) {
    return `Office starts at ${D.t12(c.start)} with ${c.grace} mins grace period. Working days: ${getWorkDayNames(c.workDays)}. Annual leave quota: ${c.quota} days.`;
  }

  // Pending leaves
  if (/\b(pending|waiting|request|darDarkhwast)\b/.test(t)) {
    const n = pendingCount();
    return n ? `${n} leave request${n > 1 ? 's are' : ' is'} waiting for approval in "Leave requests".` : 'No leave requests are currently pending.';
  }

  // Late today
  if (/\b(late|der|dair)\b/.test(t)) {
    const l = recs.filter(r => r.late);
    return l.length ? `${l.length} employee${l.length > 1 ? 's were' : ' was'} late today: ${l.map(r => nm(r.empId) + ' (' + D.t12(r.in) + ')').join(', ')}.` : 'Nobody has been marked late today.';
  }

  // On leave today
  if (/\b(leave|chutti|chhutti|vacation)\b/.test(t)) {
    const l = leavesToday();
    if (!l.length) return 'Nobody is on approved leave today.';
    const by = {}; l.forEach(x => by[x.type.toLowerCase()] = (by[x.type.toLowerCase()] || 0) + 1);
    return `${l.length} employee${l.length > 1 ? 's' : ''} on leave today: ${Object.keys(by).map(k => by[k] + ' ' + k).join(', ')} (${l.map(x => nm(x.empId)).join(', ')}).`;
  }

  // Absent today
  if (/\b(absent|ghair hazir|not checked|missing|nahi aya|na aya)\b/.test(t)) {
    const onL = leavesToday().map(x => x.empId);
    const w = emps.filter(e => !recs.some(r => r.empId === e.id) && !onL.includes(e.id));
    return !D.isWork(today) ? 'Today is not an official working day.' : w.length ? `${w.length} employee${w.length > 1 ? 's have' : ' has'} not checked in yet: ${w.map(e => e.name).join(', ')}.` : 'Everyone has either checked in or is on approved leave.';
  }

  // Present / Attendance
  if (/\b(present|hazir|checked in|attendance|aaj ka record)\b/.test(t)) {
    return `${recs.length} of ${emps.length} employee${emps.length === 1 ? '' : 's'} have checked in today.`;
  }

  // Announcements
  if (/\b(announcement|announcements|notice|notices|update|updates|khabar)\b/.test(t)) {
    const a = Store.ann();
    return a.length ? `Latest announcement: "${a[a.length - 1].title}" - ${a[a.length - 1].body}` : 'No announcements have been posted yet.';
  }

  // Employee headcount / list
  if (/\b(employee|employees|staff|headcount|how many people|kitne log|team|mulazmeen)\b/.test(t)) {
    return `Company currently has ${emps.length} employee${emps.length === 1 ? '' : 's'}: ${emps.map(e => e.name).join(', ')}.`;
  }

  return null;
}

function employeeAnswer(me, t) {
  const today = D.ymd(), recs = recsOf(me.id), q = quotaDays();
  const c = Store.company();

  // Privacy protection
  if (/\b(everyone|colleague|colleagues|dusre|sab ki salary|other employee)\b/.test(t)) {
    return 'I can only share your own personal data and general company rules, not other employees\' private records.';
  }

  // Help
  if (/\b(help|madad|kya pooch|what can i ask)\b/.test(t)) {
    return 'You can ask me:\n- "How many leaves do I have left?"\n- "Was I late today?"\n- "How many hours did I work this week?"\n- "My salary details"\n- "Office timings & working days"\n- "Recent announcements"';
  }

  // Office timing & rules
  if (/\b(office time|timing|start time|grace|rules|working days|schedule|shuru|kab)\b/.test(t)) {
    return `Office starts at ${D.t12(c.start)} with ${c.grace} minutes grace period. Official working days: ${getWorkDayNames(c.workDays)}.`;
  }

  // Leave balance
  if (/\b(left|balance|remaining|quota|chutti|chhutti|kitni leave|leaves)\b/.test(t)) {
    const u = usedDays(me.id, new Date().getFullYear());
    const rem = Math.max(0, q - u);
    return `You have ${rem} leave day${rem === 1 ? '' : 's'} left for this year (${u} approved out of your ${q} annual quota).`;
  }

  // Pending leave requests
  if (/\b(pending|status|request|darkhwast)\b/.test(t)) {
    const p = Store.leaves().filter(l => l.empId === me.id && l.status === 'pending');
    return p.length ? `You have ${p.length} pending leave request${p.length > 1 ? 's' : ''} awaiting Admin review.` : 'You have no pending leave requests.';
  }

  // Was I late today
  if (/\b(late|der|dair|on time|waqt)\b/.test(t)) {
    const r = recs.find(a => a.date === today);
    return !r ? 'You have not checked in today yet.' : r.late ? `Yes, you were marked late (checked in at ${D.t12(r.in)}).` : `No, you were on time! Checked in at ${D.t12(r.in)}.`;
  }

  // Hours worked
  if (/\b(hours|hour|worked|kitne ghante|ghantay)\b/.test(t)) {
    const ws = D.weekStart(), wk = recs.filter(a => a.date >= ws && a.date <= today), h = wk.reduce((s, r) => s + hoursOf(r), 0), open = wk.some(r => !r.out);
    return `You have worked ${fmtH(h)} so far this week.` + (open ? ' Today\'s active shift will be added once you check out.' : '');
  }

  // Salary & payslip
  if (/\b(salary|payslip|tankhwah|pay|tankha|kamai)\b/.test(t)) {
    return `Your base monthly salary is ${money(me.salary)}. You can view and print your detailed salary slip anytime under "My payslip".`;
  }

  // Attendance summary
  if (/\b(present|attendance|absent|hazir|record)\b/.test(t)) {
    const s = monthStats(me, today.slice(0, 7));
    return `This month: ${s.present} day(s) present, ${s.late} late arrival(s), ${s.half} half day(s), and ${s.absent} absent.`;
  }

  // Announcements
  if (/\b(announcement|announcements|notice|notices|update|updates|khabar)\b/.test(t)) {
    const a = Store.ann();
    return a.length ? `Latest announcement: "${a[a.length - 1].title}" - ${a[a.length - 1].body}` : 'No announcements posted yet.';
  }

  return null;
}

function mountHelper(me, el) {
  const chips = me.role === 'admin'
    ? ['How many employees do we have?', 'Who is on leave today?', 'Who was late today?', 'Office timing & rules']
    : ['How many leaves do I have left?', 'Was I late today?', 'How many hours did I work this week?', 'Office timing & rules'];

  el.innerHTML = `
    <div class="card chat">
      <div class="chat-h">
        <span class="bot">&#10024;</span>
        <div><b>Smart helper (AI)</b><small>Live answers from your HCM system</small></div>
      </div>
      <div class="msgs" id="msgs" aria-live="polite"></div>
      <div class="chips">${chips.map(c => `<button type="button" class="chip">${c}</button>`).join('')}</div>
      <form id="chatf" autocomplete="off">
        <input name="q" placeholder="Ask in English or Urdu..." aria-label="Ask the helper">
        <button class="btn">Send</button>
      </form>
    </div>`;

  const box = $('#msgs', el);
  const add = (who, txt) => {
    box.insertAdjacentHTML('beforeend', `<div class="m ${who}">${esc(txt).replace(/\n/g, '<br>')}</div>`);
    box.scrollTop = box.scrollHeight;
  };

  const ask = q => {
    add('u', q);
    const t = q.toLowerCase();
    const a = me.role === 'admin' ? adminAnswer(t) : employeeAnswer(me, t);
    setTimeout(() => {
      add('b', a || 'I didn\'t quite catch that. Try asking about leave balance, attendance, late arrivals, or office timings.');
    }, 200);
  };

  add('b', `Hi ${esc(me.name.split(' ')[0])}! I can answer questions about ${me.role === 'admin' ? 'employees, attendance, leaves, and office rules.' : 'your attendance, leave balance, work hours, and payslips.'}`);

  el.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) ask(e.target.textContent);
  });

  $('#chatf', el).onsubmit = e => {
    e.preventDefault();
    const i = e.target.q, v = i.value.trim();
    if (v) { ask(v); i.value = ''; }
  };
}
