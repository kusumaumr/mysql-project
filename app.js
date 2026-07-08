// ============================================================
//  Job Tracker — Frontend Application Controller
// ============================================================

/* ── DOM SHORTCUTS ───────────────────────────────────────── */
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};

/* ── STATE ───────────────────────────────────────────────── */
let currentPage = 'dashboard';
let searchTerm  = '';

/* ── INIT ────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  DB.seed();
  updateNavBadges();
  renderDashboard();

  // Register DB callbacks
  window._onSqlLog     = entry => appendSqlLog(entry);
  window._onTriggerFired = entry => showToast('⚡ SQL Trigger Fired!', entry.detail, 'trigger');
});



/* ── NAVIGATION ──────────────────────────────────────────── */
function navigate(page) {
  currentPage = page;

  // Hide all pages explicitly
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show the target page explicitly
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) {
    pageEl.classList.add('active');
    pageEl.style.display = 'block';
  }
  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  const headerTitle = document.getElementById('header-title');
  if (headerTitle) headerTitle.textContent = pageTitles[page] || 'Job Tracker';

  // Render page content
  const renders = {
    dashboard:    renderDashboard,
    users:        renderUsers,
    companies:    renderCompanies,
    jobs:         renderJobs,
    applications: renderApplications,
    interviews:   renderInterviews,
    offers:       renderOffers,
    rejections:   renderRejections,
    workflow:     renderWorkflow,
    sql:          renderSqlConsole,
  };
  try {
    if (renders[page]) renders[page]();
  } catch(err) {
    console.error('Navigation render error on page [' + page + ']:', err);
  }
  updateNavBadges();
}

const pageTitles = {
  dashboard:    '📊 Dashboard',
  users:        '👥 Users',
  companies:    '🏢 Companies',
  jobs:         '💼 Jobs',
  applications: '📋 Applications',
  interviews:   '🎯 Interview Rounds',
  offers:       '🎉 Offers',
  rejections:   '❌ Rejections',
  workflow:     '🔄 Workflow Diagram',
  sql:          '🖥️ SQL Console',
};

function updateNavBadges() {
  const map = {
    'badge-users':    DB.users.length,
    'badge-companies':DB.companies.length,
    'badge-jobs':     DB.jobs.length,
    'badge-apps':     DB.applications.length,
    'badge-interviews':DB.interview_rounds.length,
    'badge-offers':   DB.offers.length,
    'badge-rejections':DB.rejection.length,
  };
  Object.entries(map).forEach(([id,val]) => {
    const el = $(id); if (el) el.textContent = val;
  });
}

/* ── SEARCH ──────────────────────────────────────────────── */
function onSearch(term) {
  searchTerm = term.toLowerCase();
  const renders = { users: renderUsers, companies: renderCompanies, jobs: renderJobs, applications: renderApplications };
  if (renders[currentPage]) renders[currentPage]();
}

/* ── BADGE HELPER ────────────────────────────────────────── */
function badge(status) {
  if (!status || status === '-') return `<span style="color:var(--text-dim)">—</span>`;
  const cls = {
    'Selected': 'badge-selected', 'selected': 'badge-selected',
    'Rejected': 'badge-rejected', 'rejected': 'badge-rejected',
    'Applied':  'badge-applied',  'applied': 'badge-applied',
    'Pending':  'badge-pending',  'pending': 'badge-pending',
    'Offer Released': 'badge-offer-released',
    'Application Rejected': 'badge-application-rejected',
    'TRIGGER': 'badge-trigger',
  }[status] || 'badge-applied';
  return `<span class="badge ${cls}">${status}</span>`;
}

/* ────────────────────────────────────────────────────────── */
/*  DASHBOARD                                                 */
/* ────────────────────────────────────────────────────────── */
function renderDashboard() {
  const selected   = DB.applications.filter(a => a.status === 'Selected').length;
  const rejected   = DB.applications.filter(a => a.status === 'Rejected').length;
  const applied    = DB.applications.filter(a => a.status === 'Applied').length;
  const offers     = DB.offers.length;

  $('dash-users').textContent    = DB.users.length;
  $('dash-companies').textContent= DB.companies.length;
  $('dash-jobs').textContent     = DB.jobs.length;
  $('dash-apps').textContent     = DB.applications.length;
  $('dash-selected').textContent = selected;
  $('dash-rejected').textContent = rejected;
  $('dash-interviews').textContent = DB.interview_rounds.length;
  $('dash-offers').textContent   = offers;

  // Bar chart
  const total = DB.applications.length || 1;
  renderBar('bar-applied',  applied,  total, '#2563EB');
  renderBar('bar-selected', selected, total, '#22C55E');
  renderBar('bar-rejected', rejected, total, '#EF4444');
  renderBar('bar-offers',   offers,   total, '#F59E0B');

  // Recent applications table
  const tbody = $('dash-recent-tbody');
  tbody.innerHTML = '';
  DB.applications.slice(-5).reverse().forEach(a => {
    const user = DB.users.find(u => u.user_id === a.user_id);
    const job  = DB.jobs.find(j => j.job_id === a.job_id);
    const comp = DB.companies.find(c => c.companie_id === job?.company_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${a.application_id}</td>
      <td>${user?.name || '-'}</td>
      <td>${comp?.companie_name || '-'}</td>
      <td>${job?.job_title || '-'}</td>
      <td>${badge(a.status)}</td>
      <td>${a.apply_date}</td>
    </tr>`;
  });
}

function renderBar(id, val, total, color) {
  const el = $(id);
  if (!el) return;
  el.style.width = Math.round((val / total) * 100) + '%';
  el.style.background = color;
}

/* ────────────────────────────────────────────────────────── */
/*  USERS                                                     */
/* ────────────────────────────────────────────────────────── */
function renderUsers() {
  const tbody = $('users-tbody');
  tbody.innerHTML = '';
  const rows = DB.users.filter(u =>
    !searchTerm ||
    u.name.toLowerCase().includes(searchTerm) ||
    u.email.toLowerCase().includes(searchTerm)
  );
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">👤</div><p>No users found.</p></div></td></tr>`; return; }
  rows.forEach(u => {
    tbody.innerHTML += `<tr>
      <td class="td-id">#${u.user_id}</td>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.user_id})">🗑 Delete</button>
      </td>
    </tr>`;
  });
}

function openAddUserModal() { openModal('modal-user'); }

function submitAddUser() {
  const name  = $('u-name').value.trim();
  const email = $('u-email').value.trim();
  const phone = $('u-phone').value.trim();
  if (!name || !email || !phone) { showToast('⚠️', 'All fields are required.', 'error'); return; }
  DB.insert_user(name, email, phone);
  closeModal('modal-user');
  clearForm('user-form');
  showToast('✅ User Added', `CALL insert_user('${name}', ...) executed successfully.`, 'success');
  renderUsers(); updateNavBadges();
}

function deleteUser(id) {
  const idx = DB.users.findIndex(u => u.user_id === id);
  if (idx > -1) { DB.users.splice(idx, 1); DB._log(`DELETE FROM users WHERE user_id = ${id};`); }
  showToast('🗑 Deleted', `User #${id} removed.`, 'success');
  renderUsers(); updateNavBadges();
}

/* ────────────────────────────────────────────────────────── */
/*  COMPANIES                                                 */
/* ────────────────────────────────────────────────────────── */
function renderCompanies() {
  const tbody = $('companies-tbody');
  tbody.innerHTML = '';
  const rows = DB.companies.filter(c =>
    !searchTerm ||
    c.companie_name.toLowerCase().includes(searchTerm) ||
    c.location.toLowerCase().includes(searchTerm) ||
    c.industry.toLowerCase().includes(searchTerm)
  );
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">🏢</div><p>No companies found.</p></div></td></tr>`; return; }
  rows.forEach(c => {
    tbody.innerHTML += `<tr>
      <td class="td-id">#${c.companie_id}</td>
      <td><strong>${c.companie_name}</strong></td>
      <td>📍 ${c.location}</td>
      <td>${c.industry}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteCompany(${c.companie_id})">🗑</button></td>
    </tr>`;
  });
}

function openAddCompanyModal() {
  openModal('modal-company');
}

function submitAddCompany() {
  const name = $('c-name').value.trim();
  const loc  = $('c-location').value.trim();
  const ind  = $('c-industry').value.trim();
  if (!name || !loc || !ind) { showToast('⚠️', 'All fields required.', 'error'); return; }
  DB.insert_company(name, loc, ind);
  closeModal('modal-company');
  clearForm('company-form');
  showToast('✅ Company Added', `CALL insert_company('${name}', ...) executed.`, 'success');
  renderCompanies(); updateNavBadges();
}

function deleteCompany(id) {
  const idx = DB.companies.findIndex(c => c.companie_id === id);
  if (idx > -1) { DB.companies.splice(idx, 1); DB._log(`DELETE FROM companies WHERE companie_id = ${id};`); }
  showToast('🗑 Deleted', `Company #${id} removed.`, 'success');
  renderCompanies(); updateNavBadges();
}

/* ────────────────────────────────────────────────────────── */
/*  JOBS                                                      */
/* ────────────────────────────────────────────────────────── */
function renderJobs() {
  const tbody = $('jobs-tbody');
  tbody.innerHTML = '';
  const rows = DB.jobs.filter(j =>
    !searchTerm ||
    j.job_title.toLowerCase().includes(searchTerm)
  );
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">💼</div><p>No jobs found.</p></div></td></tr>`; return; }
  rows.forEach(j => {
    const comp = DB.companies.find(c => c.companie_id === j.company_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${j.job_id}</td>
      <td>${comp?.companie_name || '-'}</td>
      <td><strong>${j.job_title}</strong></td>
      <td>₹${Number(j.package).toLocaleString('en-IN')} <small style="color:var(--text-dim)">/ yr</small></td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteJob(${j.job_id})">🗑</button></td>
    </tr>`;
  });
}

function openAddJobModal() {
  const sel = $('j-company');
  sel.innerHTML = '<option value="">Select Company</option>';
  DB.companies.forEach(c => { sel.innerHTML += `<option value="${c.companie_id}">${c.companie_name}</option>`; });
  openModal('modal-job');
}

function submitAddJob() {
  const cid   = parseInt($('j-company').value);
  const title = $('j-title').value.trim();
  const pkg   = parseFloat($('j-package').value);
  if (!cid || !title || isNaN(pkg)) { showToast('⚠️', 'All fields required.', 'error'); return; }
  try { DB.insert_job(cid, title, pkg); }
  catch(e) { showToast('❌ Error', e.message, 'error'); return; }
  closeModal('modal-job');
  clearForm('job-form');
  showToast('✅ Job Added', `CALL insert_job(${cid}, '${title}', ...) executed.`, 'success');
  renderJobs(); updateNavBadges();
}

function deleteJob(id) {
  const idx = DB.jobs.findIndex(j => j.job_id === id);
  if (idx > -1) { DB.jobs.splice(idx, 1); DB._log(`DELETE FROM jobs WHERE job_id = ${id};`); }
  showToast('🗑 Deleted', `Job #${id} removed.`, 'success');
  renderJobs(); updateNavBadges();
}

/* ────────────────────────────────────────────────────────── */
/*  APPLICATIONS                                              */
/* ────────────────────────────────────────────────────────── */
function renderApplications() {
  const tbody = $('apps-tbody');
  tbody.innerHTML = '';
  const rows = DB.applications.filter(a => {
    if (!searchTerm) return true;
    const user = DB.users.find(u => u.user_id === a.user_id);
    return user?.name.toLowerCase().includes(searchTerm) || a.status.toLowerCase().includes(searchTerm);
  });
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><p>No applications found.</p></div></td></tr>`; return; }
  rows.forEach(a => {
    const user = DB.users.find(u => u.user_id === a.user_id);
    const job  = DB.jobs.find(j => j.job_id === a.job_id);
    const comp = DB.companies.find(c => c.companie_id === job?.company_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${a.application_id}</td>
      <td><strong>${user?.name || '-'}</strong></td>
      <td>${comp?.companie_name || '-'}</td>
      <td>${job?.job_title || '-'}</td>
      <td>${badge(a.status)}</td>
      <td>${a.apply_date}</td>
      <td>${a.rejection_reason ? `<span style="color:var(--danger);font-size:.8rem">${a.rejection_reason}</span>` : '—'}</td>
    </tr>`;
  });
}

function openAddAppModal() {
  const userSel = $('a-user');
  const jobSel  = $('a-job');
  userSel.innerHTML = '<option value="">Select User</option>';
  jobSel.innerHTML  = '<option value="">Select Job</option>';
  DB.users.forEach(u => { userSel.innerHTML += `<option value="${u.user_id}">${u.name}</option>`; });
  DB.jobs.forEach(j => {
    const comp = DB.companies.find(c => c.companie_id === j.company_id);
    jobSel.innerHTML += `<option value="${j.job_id}">${j.job_title} @ ${comp?.companie_name || ''}</option>`;
  });
  $('a-date').value = new Date().toISOString().split('T')[0];
  openModal('modal-application');
}

function toggleRejectionReason() {
  const status = $('a-status').value;
  $('rejection-group').style.display = status === 'Rejected' ? 'block' : 'none';
}

function submitAddApp() {
  const uid    = parseInt($('a-user').value);
  const jid    = parseInt($('a-job').value);
  const date   = $('a-date').value;
  const status = $('a-status').value;
  const reason = $('a-reason').value.trim() || null;
  if (!uid || !jid || !date || !status) { showToast('⚠️', 'All required fields must be filled.', 'error'); return; }
  try { DB.add_application(uid, jid, date, status, reason); }
  catch(e) { showToast('❌ Error', e.message, 'error'); return; }
  closeModal('modal-application');
  clearForm('app-form');
  showToast('✅ Application Added', `Status: ${status}${status === 'Selected' ? ' — Trigger fired!' : ''}`, 'success');
  renderApplications(); updateNavBadges();
}

/* ────────────────────────────────────────────────────────── */
/*  INTERVIEW ROUNDS                                          */
/* ────────────────────────────────────────────────────────── */
function renderInterviews() {
  const tbody = $('interviews-tbody');
  tbody.innerHTML = '';
  if (!DB.interview_rounds.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🎯</div><p>No interview rounds yet. Add a 'Selected' application to trigger one automatically!</p></div></td></tr>`;
    return;
  }
  DB.interview_rounds.forEach(r => {
    const app  = DB.applications.find(a => a.application_id === r.application_id);
    const user = DB.users.find(u => u.user_id === app?.user_id);
    const job  = DB.jobs.find(j => j.job_id === app?.job_id);
    const is_  = DB.interview_status.find(s => s.round_id === r.round_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${r.round_id}</td>
      <td class="td-id">#${r.application_id}</td>
      <td>${user?.name || '-'}</td>
      <td>${job?.job_title || '-'}</td>
      <td>${r.round_name}</td>
      <td>${badge(is_ ? is_.status : r.results)}</td>
      <td>${r.round_date}</td>
      <td>
        ${!is_ ? `<button class="btn btn-primary btn-sm" onclick="openAddInterviewStatusModal(${r.round_id})">+ Update Status</button>` : '<span style="color:var(--text-dim);font-size:.8rem">Done</span>'}
      </td>
    </tr>`;
  });
}

function openAddInterviewStatusModal(roundId) {
  $('is-round-id').value = roundId;
  $('is-round-display').textContent = `Round #${roundId}`;
  openModal('modal-interview-status');
}

function submitInterviewStatus() {
  const roundId = parseInt($('is-round-id').value);
  const status  = $('is-status').value;
  if (!status) { showToast('⚠️', 'Please select a status.', 'error'); return; }
  try { DB.add_interview_status(roundId, status); }
  catch(e) { showToast('❌ Error', e.message, 'error'); return; }
  closeModal('modal-interview-status');
  showToast('✅ Status Updated', `Round #${roundId} → ${status}${status === 'Selected' ? ' — Offer trigger fired!' : status === 'Rejected' ? ' — Rejection trigger fired!' : ''}`, 'success');
  renderInterviews(); updateNavBadges();
}

/* ────────────────────────────────────────────────────────── */
/*  OFFERS                                                    */
/* ────────────────────────────────────────────────────────── */
function renderOffers() {
  const tbody = $('offers-tbody');
  tbody.innerHTML = '';
  if (!DB.offers.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🎉</div><p>No offers yet. Mark an interview as 'Selected' to auto-generate an offer!</p></div></td></tr>`;
    return;
  }
  DB.offers.forEach(o => {
    const is_ = DB.interview_status.find(s => s.int_st_id === o.int_st_id);
    const ir  = DB.interview_rounds.find(r => r.round_id === is_?.round_id);
    const app = DB.applications.find(a => a.application_id === ir?.application_id);
    const user = DB.users.find(u => u.user_id === app?.user_id);
    const job  = DB.jobs.find(j => j.job_id === app?.job_id);
    const comp = DB.companies.find(c => c.companie_id === job?.company_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${o.offer_id}</td>
      <td class="td-id">#${o.int_st_id}</td>
      <td>${user?.name || '-'}</td>
      <td>${comp?.companie_name || '-'}</td>
      <td>${badge(o.status)}</td>
      <td>${o.join_date}</td>
    </tr>`;
  });
}

/* ────────────────────────────────────────────────────────── */
/*  REJECTIONS                                                */
/* ────────────────────────────────────────────────────────── */
function renderRejections() {
  const tbody = $('rejections-tbody');
  tbody.innerHTML = '';
  if (!DB.rejection.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">❌</div><p>No rejections yet.</p></div></td></tr>`;
    return;
  }
  DB.rejection.forEach(r => {
    const is_ = DB.interview_status.find(s => s.int_st_id === r.int_st_id);
    const ir  = DB.interview_rounds.find(rr => rr.round_id === is_?.round_id);
    const app = DB.applications.find(a => a.application_id === ir?.application_id);
    const user= DB.users.find(u => u.user_id === app?.user_id);
    const job = DB.jobs.find(j => j.job_id === app?.job_id);
    tbody.innerHTML += `<tr>
      <td class="td-id">#${r.rejection_id}</td>
      <td class="td-id">#${r.int_st_id}</td>
      <td>${user?.name || '-'}</td>
      <td>${job?.job_title || '-'}</td>
      <td>${badge(r.status)}</td>
    </tr>`;
  });
}

/* ────────────────────────────────────────────────────────── */
/*  WORKFLOW DIAGRAM                                          */
/* ────────────────────────────────────────────────────────── */
function renderWorkflow() {
  // Static — already in HTML
}

/* ────────────────────────────────────────────────────────── */
/*  SQL CONSOLE                                               */
/* ────────────────────────────────────────────────────────── */
function renderSqlConsole() {
  renderSqlLog();
}

function runConsoleQuery() {
  const sql = $('console-input').value.trim();
  if (!sql) return;
  const result = DB.executeQuery(sql);
  const out = $('console-output');
  if (result.error) {
    out.innerHTML = `<div style="color:var(--danger);font-size:.88rem;padding:12px">❌ ${result.error}</div>`;
    return;
  }
  if (!result.rows.length) {
    out.innerHTML = `<div class="empty" style="color:var(--text-muted);text-align:center;padding:20px">✅ Query executed. 0 rows returned.</div>`;
    return;
  }
  const cols = Object.keys(result.rows[0]);
  let html = `<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>`;
  result.rows.forEach(row => {
    html += `<tr>${cols.map(c => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>`;
  });
  html += '</tbody></table></div>';
  out.innerHTML = html;
  showToast('✅ Query OK', `${result.rows.length} row(s) returned.`, 'success');
}

function appendSqlLog(entry) {
  const container = $('sql-log-list');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'log-entry';
  div.innerHTML = `
    <span class="log-type ${entry.type}">${entry.type}</span>
    <pre>${entry.sql}</pre>
    <span class="log-time">${entry.timestamp}</span>
  `;
  container.prepend(div);
}

function renderSqlLog() {
  const container = $('sql-log-list');
  if (!container) return;
  container.innerHTML = '';
  DB.sqlLog.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
      <span class="log-type ${entry.type}">${entry.type}</span>
      <pre>${entry.sql}</pre>
      <span class="log-time">${entry.timestamp}</span>
    `;
    container.appendChild(div);
  });
}

function clearSqlLog() {
  DB.sqlLog = [];
  renderSqlLog();
  showToast('🗑 Cleared', 'SQL log cleared.', 'success');
}

/* ────────────────────────────────────────────────────────── */
/*  QUICK QUERIES                                             */
/* ────────────────────────────────────────────────────────── */
function quickQuery(sql) {
  $('console-input').value = sql;
  navigate('sql');
  setTimeout(runConsoleQuery, 100);
}

/* ────────────────────────────────────────────────────────── */
/*  MODAL HELPERS                                             */
/* ────────────────────────────────────────────────────────── */
function openModal(id) {
  const ov = $('overlay-' + id);
  if (ov) ov.classList.add('open');
}
function closeModal(id) {
  const ov = $('overlay-' + id);
  if (ov) ov.classList.remove('open');
}
function clearForm(id) {
  const f = $(id); if (f) f.reset();
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

/* ────────────────────────────────────────────────────────── */
/*  TOAST NOTIFICATIONS                                       */
/* ────────────────────────────────────────────────────────── */
function showToast(title, msg, type = 'success') {
  const container = $('toast-container');
  const icons = { success: '✅', error: '❌', trigger: '⚡' };
  const classes = { success: 'success-toast', error: 'error-toast', trigger: 'trigger-toast' };

  const toast = document.createElement('div');
  toast.className = `toast ${classes[type] || ''}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || '💬'}</span>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

/* ────────────────────────────────────────────────────────── */
/*  RESET DATABASE                                            */
/* ────────────────────────────────────────────────────────── */
function resetDatabase() {
  if (!confirm('Reset the entire database to initial seed data? All custom entries will be lost.')) return;
  DB.reset();
  navigate(currentPage);
  showToast('🔄 Database Reset', 'All tables restored to seed data.', 'success');
}
