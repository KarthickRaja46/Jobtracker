/* ─── STATE ─── */
let data = [];
let editId = null;
let sortCol = 'date';
let sortDir = -1; // -1 = desc
let filterStatus = '';
let filterRegion = '';
let searchQ = '';

const API_BASE = '/api';

/* ─── LOAD DATA FROM BACKEND ─── */
async function load() {
  try {
    const res = await fetch(`${API_BASE}/applications`);
    if (!res.ok) throw new Error('Failed to fetch applications');
    data = await res.json();
    render();
  } catch (err) {
    toast('Error loading data: ' + err.message, 'error');
    console.error(err);
  }
}

/* ─── STATUS CONFIG ─── */
const STATUS_LABELS = {
  applied:   'Applied',
  screening: 'Phone Screen',
  interview: 'Interviewing',
  offer:     'Offer Received',
  accepted:  'Accepted',
  rejected:  'Rejected',
  ghosted:   'Ghosted',
};

/* ─── STATS ─── */
function renderStats() {
  const total     = data.length;
  const active    = data.filter(d => ['applied','screening','interview'].includes(d.status)).length;
  const interview = data.filter(d => d.status === 'interview').length;
  const offer     = data.filter(d => ['offer','accepted'].includes(d.status)).length;
  const rejected  = data.filter(d => d.status === 'rejected').length;

  const cards = [
    { cls: 'total',     label: 'Total Applied',    value: total },
    { cls: 'active',    label: 'In Progress',       value: active },
    { cls: 'interview', label: 'Interviewing',      value: interview },
    { cls: 'offer',     label: 'Offers',            value: offer },
    { cls: 'rejected',  label: 'Rejected',          value: rejected },
  ];

  document.getElementById('stats').innerHTML = cards.map(c => {
    const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
    const fillPct = c.cls === 'total' ? 100 : pct;
    return `<div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
      <div class="stat-progress"><div class="stat-progress-fill" style="width:${fillPct}%"></div></div>
    </div>`;
  }).join('');
}

/* ─── FILTER / SEARCH / SORT ─── */
function getFiltered() {
  return data
    .filter(d => {
      const q = searchQ.toLowerCase();
      const matchQ = !q || [d.company, d.role, d.domain, d.resume, d.contact].join(' ').toLowerCase().includes(q);
      const matchS = !filterStatus || d.status === filterStatus;
      const matchR = !filterRegion || d.region === filterRegion;
      return matchQ && matchS && matchR;
    })
    .sort((a, b) => {
      let va = a[sortCol] || '', vb = b[sortCol] || '';
      if (sortCol === 'date') { va = new Date(va); vb = new Date(vb); }
      return va < vb ? sortDir : va > vb ? -sortDir : 0;
    });
}

function priorityHTML(p) {
  if (p === 'high')   return '<span class="priority-high">High</span>';
  if (p === 'medium') return '<span class="priority-medium">Medium</span>';
  return '<span class="priority-low">Low</span>';
}

function renderTable() {
  const rows = getFiltered();
  const tbody = document.getElementById('table-body');
  const empty = document.getElementById('empty-state');

  if (!rows.length) {
    tbody.innerHTML = '';
    const hasFilters = searchQ || filterStatus || filterRegion;
    document.querySelector('#empty-state p:last-child').innerHTML = hasFilters
      ? `No results match your filters. <a href="#" onclick="clearFilters();return false;" style="color:var(--accent)">Clear filters</a>`
      : 'Click <strong>Add Application</strong> to log your first job application.';
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = rows.map(d => {
    const daysAgo = d.date ? Math.floor((Date.now() - new Date(d.date)) / 86400000) : 0;
    const isStale = daysAgo > 14 && !d.followupDate && !['accepted','rejected','ghosted'].includes(d.status);
    return `
    <tr class="row-status-${d.status}${isStale ? ' row-stale' : ''}">
      <td class="muted">${d.date || '—'}</td>
      <td class="days-ago${isStale ? ' stale-days' : ''}">${daysSince(d.date)}</td>
      <td><strong>${esc(d.company)}</strong></td>
      <td>${esc(d.role) || '—'}</td>
      <td class="muted col-optional">${esc(d.domain) || '—'}</td>
      <td class="muted col-optional">${esc(d.region) || '—'}</td>
      <td>
        <span class="badge ${d.status} badge-clickable" onclick="cycleStatus('${d._id}')" title="Click to advance status">
          <span class="badge-dot"></span>
          ${STATUS_LABELS[d.status] || d.status}
        </span>
      </td>
      <td>${priorityHTML(d.priority)}</td>
      <td class="muted col-optional" style="max-width:140px;white-space:normal;font-size:0.8rem">
        ${d.contactName ? `<div style="font-weight:500;color:var(--text-sub)">${esc(d.contactName)}</div>` : ''}
        ${esc(d.contact) || '—'}
      </td>
      <td class="muted col-optional" style="max-width:160px;white-space:normal;font-size:0.8rem">
        ${d.link ? `<a href="${esc(d.link)}" target="_blank" style="color:var(--accent);font-size:0.8rem;display:block;margin-bottom:3px">View Job</a>` : ''}
        ${esc(d.next) || '—'}
      </td>
      <td class="muted col-optional" style="font-size:0.8rem;white-space:nowrap">${d.followupDate || '—'}</td>
      <td>
        <div class="row-actions">
          <button class="btn-icon edit" title="Edit" onclick="openEdit('${d._id}')">&#9998;</button>
          <button class="btn-icon delete" title="Delete" onclick="deleteRow('${d._id}')">&#128465;</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Update sort headers styling
  document.querySelectorAll('thead th').forEach(th => {
    const col = th.dataset.col;
    th.classList.toggle('sorted', col === sortCol);
    const icon = th.querySelector('.sort-icon');
    if (icon && col === sortCol) icon.textContent = sortDir === -1 ? '↓' : '↑';
  });
}

function esc(s = '') {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function daysSince(dateStr) {
  if (!dateStr) return '—';
  const days = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (days < 0)  return 'Future';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/* ─── RENDER ALL ─── */
function render() { renderStats(); renderTable(); renderWeeklySummary(); }

/* ─── WEEKLY SUMMARY ─── */
function renderWeeklySummary() {
  const el = document.getElementById('weekly-summary');
  if (!el || !data.length) { if (el) el.innerHTML = ''; return; }
  const today = new Date();
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 7);
  const appliedThisWeek = data.filter(d => new Date(d.date) >= weekStart).length;
  const interviewing = data.filter(d => d.status === 'interview').length;
  const followupsDue = data.filter(d => {
    if (!d.followupDate) return false;
    if (['rejected','accepted','ghosted'].includes(d.status)) return false;
    return new Date(d.followupDate) <= today;
  }).length;
  el.innerHTML =
    `This week: <span class="ws-num">${appliedThisWeek}</span> applied` +
    `<span class="ws-sep">&middot;</span>` +
    `<span class="ws-num">${interviewing}</span> interviewing` +
    `<span class="ws-sep">&middot;</span>` +
    `<span class="${followupsDue > 0 ? 'ws-followup' : ''}">${followupsDue} follow-up${followupsDue !== 1 ? 's' : ''} due</span>`;
}

/* ─── CLEAR FILTERS ─── */
function clearFilters() {
  searchQ = ''; filterStatus = ''; filterRegion = '';
  document.getElementById('search').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-region').value = '';
  renderTable();
}

/* ─── SORT ─── */
document.querySelectorAll('thead th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = -1; }
    renderTable();
  });
});

/* ─── FILTERS ─── */
document.getElementById('search').addEventListener('input', e => { searchQ = e.target.value; renderTable(); });
document.getElementById('filter-status').addEventListener('change', e => { filterStatus = e.target.value; renderTable(); });
document.getElementById('filter-region').addEventListener('change', e => { filterRegion = e.target.value; renderTable(); });

/* ─── KEYBOARD SHORTCUTS ─── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement.tagName;
  if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
  if ((e.key === 'n' || e.key === 'N') && !overlay.classList.contains('open')) openModal();
  if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
});

/* ─── COLUMN TOGGLE ─── */
document.getElementById('btn-toggle-cols').addEventListener('click', () => {
  document.getElementById('main-table').classList.toggle('show-all-cols');
});

/* ─── CUSTOM CONFIRM / ALERT MODAL ─── */
function uiConfirm(title, message, okText = 'OK', okClass = 'btn-primary') {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    
    btnOk.textContent = okText;
    btnOk.className = okClass;
    btnCancel.style.display = '';

    const cleanup = () => {
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      overlay.classList.remove('open');
    };
    const onOk = () => { cleanup(); resolve(true); };
    const onCancel = () => { cleanup(); resolve(false); };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    overlay.classList.add('open');
  });
}

function uiAlert(title, message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm-overlay');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    
    btnOk.textContent = 'OK';
    btnOk.className = 'btn-primary';
    btnCancel.style.display = 'none'; // hide cancel button for alerts

    const cleanup = () => {
      btnOk.removeEventListener('click', onOk);
      overlay.classList.remove('open');
    };
    const onOk = () => { cleanup(); resolve(true); };
    
    btnOk.addEventListener('click', onOk);
    overlay.classList.add('open');
  });
}


/* ─── MODAL ─── */
const overlay = document.getElementById('modal-overlay');
const form    = document.getElementById('app-form');
let formDirty = false;
form.addEventListener('input', () => { formDirty = true; });

function openModal(id = null) {
  formDirty = false;
  editId = id;
  document.getElementById('modal-title').textContent = id ? 'Edit Application' : 'Add Application';
  form.reset();
  document.getElementById('edit-id').value = '';

  if (id) {
    const d = data.find(x => x._id === id);
    if (d) {
      document.getElementById('f-company').value       = d.company      || '';
      document.getElementById('f-date').value          = d.date         || '';
      document.getElementById('f-role').value          = d.role         || '';
      document.getElementById('f-domain').value        = d.domain       || '';
      document.getElementById('f-region').value        = d.region       || 'UAE';
      document.getElementById('f-resume').value        = d.resume       || '';
      document.getElementById('f-status').value        = d.status       || 'applied';
      document.getElementById('f-priority').value      = d.priority     || 'medium';
      document.getElementById('f-next').value          = d.next         || '';
      document.getElementById('f-followup').value      = d.followupDate || '';
      document.getElementById('f-contact-name').value  = d.contactName  || '';
      document.getElementById('f-contact').value       = d.contact      || '';
      document.getElementById('f-link').value          = d.link         || '';
      document.getElementById('edit-id').value         = id;
      // Show status history
      const histSec  = document.getElementById('status-history-section');
      const histList = document.getElementById('status-history-list');
      if (d.statusHistory && d.statusHistory.length > 1) {
        histList.innerHTML = d.statusHistory.map((h, i) => {
          const dt = new Date(h.at).toLocaleDateString('en-GB', { day:'numeric', month:'short' });
          return (i > 0 ? '<span class="history-arrow">&rarr;</span>' : '') +
            `<span class="badge ${h.status}" style="font-size:0.72rem;padding:2px 8px">${STATUS_LABELS[h.status] || h.status} <span style="opacity:0.6;font-size:0.68rem">${dt}</span></span>`;
        }).join('');
        histSec.style.display = '';
      } else {
        histSec.style.display = 'none';
      }
    }
  } else {
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('status-history-section').style.display = 'none';
  }
  overlay.classList.add('open');
}

async function closeModal() {
  if (formDirty) {
    const confirmed = await uiConfirm('Unsaved Changes', 'You have unsaved changes. Discard them?', 'Discard', 'btn-primary');
    if (!confirmed) return;
  }
  overlay.classList.remove('open');
  editId = null;
  formDirty = false;
}

document.getElementById('btn-add').addEventListener('click', () => openModal());
document.getElementById('btn-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

window.openEdit = function(id) { openModal(id); };

/* ─── FORM SUBMIT (POST / PUT) ─── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;

  const confirmed = await uiConfirm(
    id ? 'Update Application' : 'Save Application',
    `Are you sure you want to ${id ? 'update' : 'save'} this application?`,
    id ? 'Update' : 'Save'
  );
  if (!confirmed) return;

  const entry = {
    company:      document.getElementById('f-company').value.trim(),
    date:         document.getElementById('f-date').value,
    role:         document.getElementById('f-role').value,
    domain:       document.getElementById('f-domain').value,
    region:       document.getElementById('f-region').value,
    resume:       document.getElementById('f-resume').value,
    status:       document.getElementById('f-status').value,
    priority:     document.getElementById('f-priority').value,
    next:         document.getElementById('f-next').value.trim(),
    followupDate: document.getElementById('f-followup').value,
    contactName:  document.getElementById('f-contact-name').value.trim(),
    contact:      document.getElementById('f-contact').value.trim(),
    link:         document.getElementById('f-link').value.trim(),
  };

  try {
    let url = `${API_BASE}/applications`;
    let method = 'POST';

    if (id) {
      url += `/${id}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });

    if (!res.ok) throw new Error('Failed to save application');
    
    await uiAlert('Success', id ? 'Application updated successfully.' : 'Application saved successfully.');
    formDirty = false;
    closeModal();
    load(); // Reload table data
  } catch (err) {
    await uiAlert('Error', 'Error saving: ' + err.message);
    console.error(err);
  }
});

/* ─── DELETE ─── */
window.deleteRow = async function(id) {
  const confirmed = await uiConfirm('Delete Application', 'Are you sure you want to delete this application? This cannot be undone.', 'Delete');
  if (!confirmed) return;
  try {
    const res = await fetch(`${API_BASE}/applications/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete application');
    await uiAlert('Deleted', 'Application deleted successfully.');
    load(); // Reload table data
  } catch (err) {
    await uiAlert('Error', 'Error deleting: ' + err.message);
    console.error(err);
  }
};

/* ─── STATUS CYCLE (click badge to advance) ─── */
const STATUS_CYCLE = ['applied', 'screening', 'interview', 'offer', 'accepted', 'rejected', 'ghosted'];

window.cycleStatus = async function(id) {
  const app = data.find(x => x._id === id);
  if (!app) return;
  const idx = STATUS_CYCLE.indexOf(app.status);
  const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  try {
    const res = await fetch(`${API_BASE}/applications/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...app, status: nextStatus })
    });
    if (!res.ok) throw new Error('Failed to update status');
    toast(`Status updated: ${STATUS_LABELS[nextStatus]}`, 'success');
    load();
  } catch(err) {
    toast('Error: ' + err.message, 'error');
  }
};

/* ─── CSV EXPORT ─── */
document.getElementById('btn-export-csv').addEventListener('click', () => {
  const headers = ['Date','Days Since Applied','Company','Role','Domain','Region','Status','Priority','Contact Name','Contact','Next Steps','Follow-up Date','Job Link'];
  const rows = data.map(d => [
    d.date, daysSince(d.date), d.company, d.role, d.domain, d.region,
    STATUS_LABELS[d.status] || d.status, d.priority,
    d.contactName, d.contact, d.next, d.followupDate, d.link
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url;
  a.download = `Job_Tracker_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast('CSV exported.', 'success');
});

/* ─── TOAST ─── */
function toast(msg, type = 'success') {
  const el   = document.getElementById('toast');
  const icon = document.getElementById('toast-icon');
  const text = document.getElementById('toast-msg');
  icon.textContent = type === 'success' ? '\u2713' : '\u2715';
  text.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), 3000);
}

  /* ─── THEME TOGGLE ─── */
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = themeToggleBtn.querySelector('.theme-icon');

  function setTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      themeIcon.innerHTML = '&#9790;';
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      themeIcon.innerHTML = '&#9728;';
      localStorage.setItem('theme', 'light');
    }
  }

  themeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'light' : 'dark');
  });

  const savedTheme = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
    setTheme('dark');
  } else {
    setTheme('light');
  }

  /* ─── INITIALIZE ─── */
  load();
