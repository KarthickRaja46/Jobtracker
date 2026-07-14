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

  document.getElementById('stats').innerHTML = cards.map(c =>
    `<div class="stat-card ${c.cls}">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value">${c.value}</div>
    </div>`
  ).join('');
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
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = rows.map(d => `
    <tr>
      <td class="muted">${d.date || '—'}</td>
      <td>
        <strong>${esc(d.company)}</strong>
      </td>
      <td>${esc(d.role) || '—'}</td>
      <td class="muted">${esc(d.domain) || '—'}</td>
      <td class="muted">${esc(d.region) || '—'}</td>
      <td>
        <span class="badge ${d.status}">
          <span class="badge-dot"></span>
          ${STATUS_LABELS[d.status] || d.status}
        </span>
      </td>
      <td>${priorityHTML(d.priority)}</td>
      <td class="muted" style="max-width:140px;white-space:normal;font-size:0.8rem">
        ${d.contactName ? `<div style="font-weight:500;color:var(--text-sub)">${esc(d.contactName)}</div>` : ''}
        ${esc(d.contact) || '—'}
      </td>
      <td class="muted" style="max-width:160px;white-space:normal;font-size:0.8rem">
        ${d.link ? `<a href="${esc(d.link)}" target="_blank" style="color:var(--accent);font-size:0.8rem;display:block;margin-bottom:3px">View Job</a>` : ''}
        ${esc(d.next) || '—'}
      </td>
      <td>
        <div class="row-actions">
          <button class="btn-icon edit" title="Edit" onclick="openEdit('${d._id}')">&#9998;</button>
          <button class="btn-icon delete" title="Delete" onclick="deleteRow('${d._id}')">&#128465;</button>
        </div>
      </td>
    </tr>
  `).join('');

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

/* ─── RENDER ALL ─── */
function render() { renderStats(); renderTable(); }

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

/* ─── MODAL ─── */
const overlay = document.getElementById('modal-overlay');
const form    = document.getElementById('app-form');

function openModal(id = null) {
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
      document.getElementById('f-contact-name').value  = d.contactName  || '';
      document.getElementById('f-contact').value       = d.contact      || '';
      document.getElementById('f-link').value          = d.link         || '';
      document.getElementById('edit-id').value         = id;
    }
  } else {
    document.getElementById('f-date').value = new Date().toISOString().split('T')[0];
  }
  overlay.classList.add('open');
}

function closeModal() { overlay.classList.remove('open'); editId = null; }

document.getElementById('btn-add').addEventListener('click', () => openModal());
document.getElementById('btn-close').addEventListener('click', closeModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

window.openEdit = function(id) { openModal(id); };

/* ─── FORM SUBMIT (POST / PUT) ─── */
form.addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('edit-id').value;
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
    
    toast(id ? 'Application updated.' : 'Application saved.', 'success');
    closeModal();
    load(); // Reload table data
  } catch (err) {
    toast('Error saving: ' + err.message, 'error');
    console.error(err);
  }
});

/* ─── DELETE ─── */
window.deleteRow = async function(id) {
  if (!confirm('Are you sure you want to delete this application?')) return;
  try {
    const res = await fetch(`${API_BASE}/applications/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete application');
    toast('Application deleted.', 'error');
    load(); // Reload table data
  } catch (err) {
    toast('Error deleting: ' + err.message, 'error');
    console.error(err);
  }
};

/* ─── CSV EXPORT ─── */
document.getElementById('btn-export-csv').addEventListener('click', () => {
  const headers = ['Date','Company','Role','Domain','Region','Resume','Status','Priority','Next Steps','Contact','Link'];
  const rows = data.map(d => [
    d.date, d.company, d.role, d.domain, d.region, d.resume,
    STATUS_LABELS[d.status] || d.status, d.priority, d.next, d.contact, d.link
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
