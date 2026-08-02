/**
 * ==============================================================================
 * QLCV TTHT - SPA Application Logic & Dual-Mode API Adapter
 * ==============================================================================
 */

// CENTRAL LEADERS FIXED CONSTANT
const CENTER_LEADERS = [
  'Nguyễn Công Hoan',
  'Nguyễn Minh Cường',
  'Nguyễn Trung Kiên'
];

// STATE MANAGEMENT
const state = {
  tasks: [],       // Sheet QLCV
  users: [],       // Sheet user / Nguoidung
  ttTasks: [],     // Sheet TT_giaoviec
  nhanvien: [],    // Sheet nhanvien
  cvluuy: [],      // Sheet cvluuy
  documents: [],   // Sheet hoso / Documents
  activeTab: 'tab-dashboard',
  filters: {
    search: '',
    arTeam: '',
    rTeam: '',
    nvA: '',
    nvR: '',
    nvC: ''
  },
  apiUrl: localStorage.getItem('QLCV_API_URL') || ''
};

let donutChartInstance = null;
let debounceTimers = {};

// ==============================================================================
// DUAL-MODE API ADAPTER (GAS google.script.run VS VERCEL / REST FETCH)
// ==============================================================================

const gasApi = {
  isGas: function() {
    return typeof google !== 'undefined' && google.script && google.script.run;
  },

  call: function(action, data) {
    const self = this;
    return new Promise((resolve, reject) => {
      if (self.isGas()) {
        // Direct Google Apps Script HTML Service Execution
        const runner = google.script.run
          .withSuccessHandler((res) => {
            if (res && res.success === false) {
              reject(res.error || 'Thao tác thất bại');
            } else {
              resolve(res);
            }
          })
          .withFailureHandler((err) => {
            reject(err ? err.toString() : 'Lỗi hệ thống Apps Script');
          });

        if (action === 'getAllData') runner.apiGetAllData();
        else if (action === 'saveTask') runner.apiSaveTask(data);
        else if (action === 'updateTaskInline') runner.apiUpdateTaskInline(data);
        else if (action === 'deleteTask') runner.apiDeleteTask(data);
        else if (action === 'saveTTTask') runner.apiSaveTTTask(data);
        else if (action === 'updateTTTaskInline') runner.apiUpdateTTTaskInline(data);
        else if (action === 'deleteTTTask') runner.apiDeleteTTTask(data);
        else if (action === 'saveDocument') runner.apiSaveDocument(data);
        else if (action === 'deleteDocument') runner.apiDeleteDocument(data);
        else if (action === 'saveUser') runner.apiSaveUser(data);
        else if (action === 'deleteUser') runner.apiDeleteUser(data);
        else if (action === 'saveSpecialTask') runner.apiSaveSpecialTask(data);
        else if (action === 'deleteSpecialTask') runner.apiDeleteSpecialTask(data);
        else reject('Action không được hỗ trợ: ' + action);

      } else {
        // Standalone Web App / Vercel Execution via fetch()
        const apiUrl = state.apiUrl;
        if (!apiUrl) {
          showToast('Vui lòng cài đặt Apps Script Web App URL trong mục Cấu hình!', 'warning');
          // Return local mockup fallback if API URL is empty
          return resolve({ success: true, localMock: true });
        }

        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: action, data: data })
        })
        .then(res => res.json())
        .then(res => {
          if (res && res.success === false) {
            reject(res.error || 'Lỗi API');
          } else {
            resolve(res);
          }
        })
        .catch(err => reject('Lỗi kết nối REST API: ' + err.toString()));
      }
    });
  }
};

// ==============================================================================
// INITIALIZATION & EVENT LISTENERS
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  initUI();
  loadAllData();
});

function initUI() {
  // Sidebar tab switching
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const tabId = item.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Global filters
  document.getElementById('global-search-input').addEventListener('input', (e) => {
    state.filters.search = e.target.value.toLowerCase().trim();
    renderCurrentTab();
  });

  ['filter-ar-team', 'filter-r-team', 'filter-nv-a', 'filter-nv-r', 'filter-nv-c'].forEach(id => {
    document.getElementById(id).addEventListener('change', (e) => {
      const keyMap = {
        'filter-ar-team': 'arTeam',
        'filter-r-team': 'rTeam',
        'filter-nv-a': 'nvA',
        'filter-nv-r': 'nvR',
        'filter-nv-c': 'nvC'
      };
      state.filters[keyMap[id]] = e.target.value;
      renderCurrentTab();
    });
  });

  // Buttons
  document.getElementById('btn-sync').addEventListener('click', () => {
    loadAllData();
    showToast('Đã bắt đầu đồng bộ dữ liệu từ Google Sheets', 'info');
  });

  document.getElementById('btn-settings').addEventListener('click', () => {
    document.getElementById('setting-api-url').value = state.apiUrl;
    openModal('modal-settings');
  });

  document.getElementById('btn-add-task').addEventListener('click', () => {
    openTaskModal();
  });

  // Task Form auto-fill A when AR Team selected
  document.getElementById('task-ar-team').addEventListener('change', (e) => {
    const selectedTeam = e.target.value;
    if (selectedTeam) {
      // Find team leader / vice leader for selected team
      const lead = state.users.find(u => 
        (u['Tổ'] || u['Tổ hạ tầng'] || '').toLowerCase().trim() === selectedTeam.toLowerCase().trim() &&
        (u['Chức vụ'] || '').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i)
      ) || state.users.find(u => (u['Tổ'] || '').toLowerCase().trim() === selectedTeam.toLowerCase().trim());

      if (lead) {
        document.getElementById('task-nv-a').value = lead['Tên'] || lead['Tên NV'] || '';
        document.getElementById('task-ma-a').value = lead['Mã NV'] || '';
      }
    }
  });

  // Autocomplete setup for A, R, C personnel inputs
  setupPersonnelAutocomplete('task-nv-a', 'task-ma-a', 'sug-nv-a');
  setupPersonnelAutocomplete('task-nv-r', 'task-ma-r', 'sug-nv-r');
  setupPersonnelAutocomplete('task-nv-c', 'task-ma-c', 'sug-nv-c');

  // Form submission
  document.getElementById('form-task').addEventListener('submit', handleTaskSubmit);

  // Setup Drag and Drop for Kanban
  setupKanbanDragAndDrop();
}

function switchTab(tabId) {
  state.activeTab = tabId;

  // Update active sidebar item
  document.querySelectorAll('.nav-item').forEach(el => {
    if (el.getAttribute('data-tab') === tabId) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });

  // Update active tab pane
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.add('active');
    } else {
      pane.classList.remove('active');
    }
  });

  // Update Title
  const titles = {
    'tab-dashboard': 'Tổng quan',
    'tab-kanban': 'Bảng Kanban',
    'tab-list': 'Danh sách Công việc (Sheet QLCV)',
    'tab-tt': 'Tổ trưởng giao việc (Nội bộ tổ)',
    'tab-docs': 'Quản lý Tài liệu & Hợp đồng',
    'tab-users': 'Danh mục Người dùng',
    'tab-stats': 'Thống kê Tiến độ theo Tổ',
    'tab-evaluation': 'Đánh giá & Xếp loại Cá nhân',
    'tab-special': 'Công việc Cần Lưu ý'
  };
  document.getElementById('current-page-title').innerText = titles[tabId] || 'QLCV TTHT';

  renderCurrentTab();
}

// ==============================================================================
// DATA LOADING & POPULATION
// ==============================================================================

function computeTaskStatus(t) {
  const currentSt = t['Trạng thái'] || '';
  if (currentSt === 'Đã hủy') return 'Đã hủy';

  const doneDate = parseDateStr(t['Ngày làm xong']);
  const endDate = parseDateStr(t['Ngày kết thúc'] || t['Hạn hoàn thành']);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (doneDate) {
    doneDate.setHours(0, 0, 0, 0);
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
      if (doneDate <= endDate) {
        return 'Hoàn thành';
      } else {
        return 'Hoàn thành quá hạn';
      }
    } else {
      return 'Hoàn thành';
    }
  } else {
    if (endDate) {
      endDate.setHours(0, 0, 0, 0);
      if (today > endDate) {
        return 'Quá hạn';
      }
    }
    return currentSt && currentSt !== 'Quá hạn' ? currentSt : 'Đang thực hiện';
  }
}

function parseDateStr(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;

  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
  }
  if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m, d);
    }
  }
  const p = new Date(str);
  return isNaN(p.getTime()) ? null : p;
}

function loadAllData() {
  gasApi.call('getAllData')
    .then(res => {
      if (res.tasks) {
        state.tasks = res.tasks.map(t => {
          t['Trạng thái'] = computeTaskStatus(t);
          return t;
        });
      }
      if (res.users) state.users = res.users;
      if (res.ttTasks) {
        state.ttTasks = res.ttTasks.map(t => {
          t['Trạng thái'] = computeTaskStatus(t);
          return t;
        });
      }
      if (res.nhanvien) state.nhanvien = res.nhanvien;
      if (res.cvluuy) state.cvluuy = res.cvluuy;
      if (res.documents) state.documents = res.documents;

      populateFilterDropdowns();
      populateTeamDropdowns();
      updateBadges();
      renderCurrentTab();

      showToast('Đã tải thành công toàn bộ dữ liệu từ Google Sheets', 'success');
    })
    .catch(err => {
      console.error(err);
      showToast('Lỗi tải dữ liệu: ' + err, 'error');
    });
}

function populateFilterDropdowns() {
  const arTeams = new Set();
  const rTeams = new Set();
  const nvASet = new Set();
  const nvRSet = new Set();
  const nvCSet = new Set();

  state.tasks.forEach(t => {
    if (t['Tổ chủ trì (AR)']) arTeams.add(t['Tổ chủ trì (AR)']);
    if (t['Tổ (R)']) rTeams.add(t['Tổ (R)']);
    if (t['Tên NV (A)']) nvASet.add(t['Tên NV (A)']);
    if (t['Tên NV (R)']) nvRSet.add(t['Tên NV (R)']);
    if (t['Tên NV (C)']) nvCSet.add(t['Tên NV (C)']);
  });

  fillSelect('filter-ar-team', Array.from(arTeams), 'Tất cả Tổ chủ trì (AR)');
  fillSelect('filter-r-team', Array.from(rTeams), 'Tất cả Tổ (R)');
  fillSelect('filter-nv-a', Array.from(nvASet), 'Tất cả Tên NV (A)');
  fillSelect('filter-nv-r', Array.from(nvRSet), 'Tất cả Tên NV (R)');
  fillSelect('filter-nv-c', Array.from(nvCSet), 'Tất cả Tên NV (C)');
}

function populateTeamDropdowns() {
  const teams = new Set();
  state.users.forEach(u => {
    const t = u['Tổ'] || u['Tổ hạ tầng'];
    if (t) teams.add(t);
  });
  state.nhanvien.forEach(n => {
    const t = n['Tổ hạ tầng'] || n['Tổ'];
    if (t) teams.add(t);
  });

  fillSelect('task-ar-team', Array.from(teams), '-- Chọn Tổ chủ trì --');
  fillSelect('task-r-team', Array.from(teams), '-- Chọn Tổ phối hợp --');
}

function fillSelect(elementId, items, defaultText) {
  const select = document.getElementById(elementId);
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = `<option value="">${defaultText}</option>`;
  items.sort().forEach(item => {
    if (item) {
      select.innerHTML += `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`;
    }
  });
  select.value = currentVal;
}

function updateBadges() {
  document.getElementById('badge-total-tasks').innerText = state.tasks.length;
  document.getElementById('badge-tt-tasks').innerText = state.ttTasks.length;
}

// ==============================================================================
// RENDER ROUTER FOR TABS
// ==============================================================================

function renderCurrentTab() {
  switch (state.activeTab) {
    case 'tab-dashboard':
      renderDashboard();
      break;
    case 'tab-kanban':
      renderKanban();
      break;
    case 'tab-list':
      renderListView();
      break;
    case 'tab-tt':
      renderTTView();
      break;
    case 'tab-docs':
      renderDocsView();
      break;
    case 'tab-users':
      renderUsersView();
      break;
    case 'tab-stats':
      renderStatsView();
      break;
    case 'tab-evaluation':
      renderEvaluationView();
      break;
    case 'tab-special':
      renderSpecialView();
      break;
  }
}

// ==============================================================================
// TAB 1: DASHBOARD RENDERER
// ==============================================================================

function renderDashboard() {
  const filtered = getFilteredTasks(state.tasks);

  let doing = 0, done = 0, overdue = 0, canceled = 0;
  filtered.forEach(t => {
    const st = (t['Trạng thái'] || '').toLowerCase();
    if (st.includes('hoàn thành')) done++;
    else if (st.includes('quá hạn')) overdue++;
    else if (st.includes('hủy')) canceled++;
    else doing++;
  });

  document.getElementById('dash-total').innerText = filtered.length;
  document.getElementById('dash-doing').innerText = doing;
  document.getElementById('dash-done').innerText = done;
  document.getElementById('dash-overdue').innerText = overdue;
  document.getElementById('dash-canceled').innerText = canceled;

  // Donut Chart
  const ctx = document.getElementById('statusDonutChart').getContext('2d');
  if (donutChartInstance) donutChartInstance.destroy();

  donutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Đang thực hiện', 'Hoàn thành', 'Quá hạn', 'Đã hủy'],
      datasets: [{
        data: [doing, done, overdue, canceled],
        backgroundColor: ['#22d3ee', '#34d399', '#f87171', '#fbbf24'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } } }
      },
      cutout: '72%'
    }
  });

  // Recent & High Priority tasks list
  const recentListEl = document.getElementById('dashboard-recent-list');
  recentListEl.innerHTML = '';
  const highPriority = filtered.filter(t => (t['Mức độ ưu tiên'] || '').toLowerCase().match(/cao|khẩn/i)).slice(0, 5);
  const displayTasks = highPriority.length > 0 ? highPriority : filtered.slice(0, 5);

  if (displayTasks.length === 0) {
    recentListEl.innerHTML = '<div class="text-sub" style="padding: 1rem; text-align: center;">Chưa có dữ liệu công việc</div>';
    return;
  }

  displayTasks.forEach(t => {
    recentListEl.innerHTML += `
      <div class="recent-item">
        <div>
          <div class="recent-title">${escapeHtml(t['Tiêu đề'] || 'Công việc không tên')}</div>
          <div class="recent-desc">
            <span><i class="fa-solid fa-users-gear"></i> ${escapeHtml(t['Tổ chủ trì (AR)'] || '-')}</span> &bull; 
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(t['Tên NV (A)'] || '-')}</span>
          </div>
        </div>
        <div>
          ${getStatusBadgeHTML(t['Trạng thái'])}
        </div>
      </div>
    `;
  });
}

// ==============================================================================
// TAB 2: KANBAN BOARD RENDERER
// ==============================================================================

function renderKanban() {
  const filtered = getFilteredTasks(state.tasks);

  const cols = {
    'doing': document.getElementById('kanban-cards-doing'),
    'done': document.getElementById('kanban-cards-done'),
    'overdue': document.getElementById('kanban-cards-overdue'),
    'canceled': document.getElementById('kanban-cards-canceled')
  };

  Object.values(cols).forEach(c => c.innerHTML = '');

  const counts = { doing: 0, done: 0, overdue: 0, canceled: 0 };

  filtered.forEach(t => {
    const st = (t['Trạng thái'] || '').toLowerCase();
    let colKey = 'doing';
    if (st.includes('hoàn thành')) colKey = 'done';
    else if (st.includes('quá hạn')) colKey = 'overdue';
    else if (st.includes('hủy')) colKey = 'canceled';

    counts[colKey]++;

    const card = document.createElement('div');
    card.className = 'kanban-card';
    card.setAttribute('draggable', 'true');
    card.setAttribute('data-id', t['ID']);

    card.innerHTML = `
      <div class="kanban-card-title">${escapeHtml(t['Tiêu đề'] || '')}</div>
      <div class="kanban-card-desc">${escapeHtml(t['Mô tả'] || '')}</div>
      <div class="kanban-card-meta">
        <span class="avatar-chip"><i class="fa-solid fa-user-check"></i> ${escapeHtml(t['Tên NV (A)'] || 'Chưa gán')}</span>
        <span><i class="fa-regular fa-clock"></i> ${escapeHtml(t['Ngày kết thúc'] || '-')}</span>
      </div>
    `;

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', t['ID']);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
    });

    cols[colKey].appendChild(card);
  });

  document.getElementById('count-kanban-doing').innerText = counts.doing;
  document.getElementById('count-kanban-done').innerText = counts.done;
  document.getElementById('count-kanban-overdue').innerText = counts.overdue;
  document.getElementById('count-kanban-canceled').innerText = counts.canceled;
}

function setupKanbanDragAndDrop() {
  const dropZones = document.querySelectorAll('.kanban-cards');
  dropZones.forEach(zone => {
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain');
      const newStatus = zone.getAttribute('data-status');

      if (taskId && newStatus) {
        // Optimistic UI update
        const task = state.tasks.find(t => String(t['ID']) === String(taskId));
        if (task) {
          task['Trạng thái'] = newStatus;
          renderKanban();
          // Backend sync
          gasApi.call('updateTaskInline', { id: taskId, 'Trạng thái': newStatus })
            .then(() => showToast(`Đã chuyển trạng thái sang "${newStatus}"`, 'success'))
            .catch(err => showToast('Lỗi cập nhật trạng thái: ' + err, 'error'));
        }
      }
    });
  });
}

// ==============================================================================
// TAB 3: DANH SÁCH (LIST VIEW - 100% QLCV SHEET)
// ==============================================================================

function renderListView() {
  const filtered = getFilteredTasks(state.tasks);
  const tbody = document.getElementById('tbody-qlcv');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="18" style="text-align: center; color: var(--text-muted); padding: 2rem;">Không tìm thấy dữ liệu công việc phù hợp</td></tr>`;
    return;
  }

  filtered.forEach((t, idx) => {
    const kh = parseFloat(t['Kế hoạch']) || 0;
    const th = parseFloat(t['Thực hiện']) || 0;
    const ratio = kh > 0 ? Math.min(Math.round((th / kh) * 100), 100) : (th > 0 ? 100 : 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600; min-width: 180px;">${escapeHtml(t['Tiêu đề'] || '')}</td>
      <td style="max-width: 220px; font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">${escapeHtml(t['Mô tả'] || '')}</td>
      <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
      <td>${escapeHtml(t['Lãnh đạo'] || '-')}</td>
      <td>${escapeHtml(t['Tổ chủ trì (AR)'] || '-')}</td>
      <td><strong>${escapeHtml(t['Tên NV (A)'] || '-')}</strong></td>
      <td>${escapeHtml(t['Tên NV (R)'] || '-')}</td>
      <td>${escapeHtml(t['Tên NV (C)'] || '-')}</td>
      <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
      <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
      
      <!-- INLINE EDITABLE: Ngày làm xong -->
      <td style="width: 120px;">
        <input type="text" class="inline-edit-input" value="${escapeHtml(t['Ngày làm xong'] || '')}" placeholder="dd/mm/yyyy" onchange="handleInlineEdit('QLCV', '${t['ID']}', 'Ngày làm xong', this.value)">
      </td>

      <!-- Progress bar -->
      <td>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${ratio}%;"></div></div>
        <span>${ratio}%</span>
      </td>

      <td>${kh}</td>

      <!-- INLINE EDITABLE: Số lượng thực hiện -->
      <td style="width: 80px;">
        <input type="number" class="inline-edit-input" value="${th}" min="0" onchange="handleInlineEdit('QLCV', '${t['ID']}', 'Thực hiện', this.value)">
      </td>

      <td><strong style="color: var(--accent-emerald);">${ratio}%</strong></td>

      <!-- INLINE EDITABLE: Ghi chú (Styling & text wrapping matching Mô tả) -->
      <td style="max-width: 240px;">
        <textarea class="inline-edit-textarea" placeholder="Nhập ghi chú..." onchange="handleInlineEdit('QLCV', '${t['ID']}', 'Ghi chú', this.value)">${escapeHtml(t['Ghi chú'] || '')}</textarea>
      </td>

      <td style="text-align: center; white-space: nowrap;">
        <button class="btn btn-secondary btn-icon" onclick="editTask('${t['ID']}')" title="Sửa"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-secondary btn-icon" style="color: var(--accent-rose);" onclick="deleteTask('${t['ID']}')" title="Xóa"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// INLINE DEBOUNCED EDIT HANDLER
function handleInlineEdit(sheetName, id, field, value) {
  const key = `${sheetName}_${id}_${field}`;
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);

  debounceTimers[key] = setTimeout(() => {
    const list = sheetName === 'QLCV' ? state.tasks : state.ttTasks;
    const item = list.find(x => String(x['ID']) === String(id));
    
    if (item) {
      item[field] = value;
      const newStatus = computeTaskStatus(item);
      item['Trạng thái'] = newStatus;

      renderCurrentTab();

      const updateObj = { id: id };
      updateObj[field] = value;
      updateObj['Trạng thái'] = newStatus;

      const action = sheetName === 'QLCV' ? 'updateTaskInline' : 'updateTTTaskInline';
      gasApi.call(action, updateObj)
        .then(() => {
          showToast(`Đã lưu ${field} & cập nhật Trạng thái: "${newStatus}"`, 'success');
        })
        .catch(err => showToast('Lỗi lưu tự động: ' + err, 'error'));
    }
  }, 500);
}

// ==============================================================================
// TAB 4: TỔ TRƯỜNG GIAO VIỆC (ISOLATED SHEET TT_giaoviec)
// ==============================================================================

function renderTTView() {
  const tbody = document.getElementById('tbody-tt');
  tbody.innerHTML = '';

  if (state.ttTasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu công việc giao riêng nội bộ tổ</td></tr>`;
    return;
  }

  state.ttTasks.forEach((t, idx) => {
    const kh = parseFloat(t['Kế hoạch']) || 0;
    const th = parseFloat(t['Thực hiện']) || 0;
    const ratio = kh > 0 ? Math.min(Math.round((th / kh) * 100), 100) : (th > 0 ? 100 : 0);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600;">${escapeHtml(t['Tiêu đề'] || '')}</td>
      <td style="max-width: 220px; font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">${escapeHtml(t['Mô tả'] || '')}</td>
      <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
      <td>${escapeHtml(t['Tên NV (R)'] || '-')}</td>
      <td>${escapeHtml(t['Tên NV (C)'] || '-')}</td>
      <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
      <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
      <td><input type="text" class="inline-edit-input" value="${escapeHtml(t['Ngày làm xong'] || '')}" onchange="handleInlineEdit('TT_giaoviec', '${t['ID']}', 'Ngày làm xong', this.value)"></td>
      <td>${ratio}%</td>
      <td>${kh}</td>
      <td><input type="number" class="inline-edit-input" value="${th}" min="0" onchange="handleInlineEdit('TT_giaoviec', '${t['ID']}', 'Thực hiện', this.value)"></td>
      <td><strong>${ratio}%</strong></td>
      <td style="max-width: 240px;">
        <textarea class="inline-edit-textarea" placeholder="Nhập ghi chú..." onchange="handleInlineEdit('TT_giaoviec', '${t['ID']}', 'Ghi chú', this.value)">${escapeHtml(t['Ghi chú'] || '')}</textarea>
      </td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-icon" style="color: var(--accent-rose);" onclick="deleteTTTask('${t['ID']}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// TAB 5: QUẢN LÝ TÀI LIỆU (hoso / Documents)
// ==============================================================================

function renderDocsView() {
  const tbody = document.getElementById('tbody-docs');
  tbody.innerHTML = '';

  if (state.documents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có tài liệu / hợp đồng</td></tr>`;
    return;
  }

  state.documents.forEach((d, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><strong>${escapeHtml(d['Mã tài liệu'] || d['ID'] || '-')}</strong></td>
      <td style="font-weight: 600;">${escapeHtml(d['Tên tài liệu'] || d['Tiêu đề'] || '-')}</td>
      <td>${escapeHtml(d['Loại hồ sơ'] || '-')}</td>
      <td>${escapeHtml(d['Đơn vị ban hành'] || '-')}</td>
      <td>${escapeHtml(d['Ngày ban hành'] || '-')}</td>
      <td style="color: var(--accent-cyan); font-weight: 600;">${d['Giá trị'] ? Number(d['Giá trị']).toLocaleString('vi-VN') : '-'}</td>
      <td><span class="badge badge-done">${escapeHtml(d['Trạng thái'] || 'Còn hiệu lực')}</span></td>
      <td>
        ${d['Liên kết file'] ? `<a href="${escapeHtml(d['Liên kết file'])}" target="_blank" class="btn btn-secondary" style="padding: 0.2rem 0.6rem; font-size: 0.75rem;"><i class="fa-solid fa-download"></i> Tải về</a>` : '-'}
      </td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-icon" style="color: var(--accent-rose);" onclick="deleteDocument('${d['ID']}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// TAB 6: QUẢN LÝ NGƯỜI DÙNG
// ==============================================================================

function renderUsersView() {
  const tbody = document.getElementById('tbody-users');
  tbody.innerHTML = '';

  if (state.users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu danh mục nhân sự</td></tr>`;
    return;
  }

  state.users.forEach((u, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="badge" style="background: rgba(99, 102, 241, 0.2); color: #818cf8;">${escapeHtml(u['Tổ'] || u['Tổ hạ tầng'] || '-')}</span></td>
      <td><strong>${escapeHtml(u['Mã NV'] || '-')}</strong></td>
      <td style="font-weight: 600;">${escapeHtml(u['Tên'] || u['Tên NV'] || '-')}</td>
      <td>${escapeHtml(u['Chức vụ'] || 'Nhân viên')}</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-icon" style="color: var(--accent-rose);" onclick="deleteUser('${u['Mã NV']}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// TAB 7: THỐNG KÊ THEO TỔ
// ==============================================================================

function renderStatsView() {
  const tbody = document.getElementById('tbody-stats');
  tbody.innerHTML = '';

  // Aggregate by AR Team
  const statsMap = {};
  state.tasks.forEach(t => {
    const team = t['Tổ chủ trì (AR)'] || 'Chưa phân tổ';
    if (!statsMap[team]) {
      statsMap[team] = { total: 0, doing: 0, done: 0, overdue: 0 };
    }
    statsMap[team].total++;
    const st = (t['Trạng thái'] || '').toLowerCase();
    if (st.includes('hoàn thành')) statsMap[team].done++;
    else if (st.includes('quá hạn')) statsMap[team].overdue++;
    else statsMap[team].doing++;
  });

  const teams = Object.keys(statsMap).sort();
  if (teams.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu thống kê</td></tr>`;
    return;
  }

  teams.forEach((team, idx) => {
    const s = statsMap[team];
    const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600;">${escapeHtml(team)}</td>
      <td>${s.total}</td>
      <td style="color: var(--accent-cyan);">${s.doing}</td>
      <td style="color: var(--accent-emerald); font-weight: 600;">${s.done}</td>
      <td style="color: var(--accent-rose);">${s.overdue}</td>
      <td>
        <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${rate}%;"></div></div>
        <strong style="color: var(--accent-emerald);">${rate}%</strong>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// TAB 8: ĐÁNH GIÁ CÁ NHÂN & AUTO XẾP LOẠI
// ==============================================================================

function renderEvaluationView() {
  const tbody = document.getElementById('tbody-eval');
  tbody.innerHTML = '';

  const userStats = {};

  // Initialize with all users
  state.users.forEach(u => {
    const name = u['Tên'] || u['Tên NV'];
    if (name) {
      userStats[name] = {
        team: u['Tổ'] || u['Tổ hạ tầng'] || '-',
        total: 0,
        leadA: 0,
        coR: 0,
        doing: 0,
        done: 0,
        overdue: 0
      };
    }
  });

  // Calculate task counts
  state.tasks.forEach(t => {
    const nameA = t['Tên NV (A)'];
    const nameR = t['Tên NV (R)'];
    const st = (t['Trạng thái'] || '').toLowerCase();

    if (nameA) {
      if (!userStats[nameA]) userStats[nameA] = { team: t['Tổ chủ trì (AR)'] || '-', total: 0, leadA: 0, coR: 0, doing: 0, done: 0, overdue: 0 };
      userStats[nameA].total++;
      userStats[nameA].leadA++;
      if (st.includes('hoàn thành')) userStats[nameA].done++;
      else if (st.includes('quá hạn')) userStats[nameA].overdue++;
      else userStats[nameA].doing++;
    }

    if (nameR && nameR !== nameA) {
      if (!userStats[nameR]) userStats[nameR] = { team: t['Tổ (R)'] || '-', total: 0, leadA: 0, coR: 0, doing: 0, done: 0, overdue: 0 };
      userStats[nameR].total++;
      userStats[nameR].coR++;
      if (st.includes('hoàn thành')) userStats[nameR].done++;
      else if (st.includes('quá hạn')) userStats[nameR].overdue++;
      else userStats[nameR].doing++;
    }
  });

  const names = Object.keys(userStats).sort();
  if (names.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có dữ liệu đánh giá nhân sự</td></tr>`;
    return;
  }

  names.forEach((name, idx) => {
    const u = userStats[name];
    const rate = u.total > 0 ? Math.round((u.done / u.total) * 100) : 0;

    // Rating logic: A >= 90%, B >= 70%, C >= 50%, D < 50%
    let rating = 'D - Chưa đạt';
    let ratingClass = 'rating-d';
    if (rate >= 90) { rating = 'A - Xuất sắc'; ratingClass = 'rating-a'; }
    else if (rate >= 70) { rating = 'B - Tốt'; ratingClass = 'rating-b'; }
    else if (rate >= 50) { rating = 'C - Dat'; ratingClass = 'rating-c'; }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600;">${escapeHtml(name)}</td>
      <td>${escapeHtml(u.team)}</td>
      <td><strong>${u.total}</strong></td>
      <td>${u.leadA}</td>
      <td>${u.coR}</td>
      <td>${u.doing}</td>
      <td style="color: var(--accent-emerald); font-weight: 600;">${u.done}</td>
      <td style="color: var(--accent-rose);">${u.overdue}</td>
      <td><strong>${rate}%</strong></td>
      <td><span class="badge ${ratingClass}">${rating}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// TAB 9: CÔNG VIỆC LƯU Ý (cvluuy)
// ==============================================================================

function renderSpecialView() {
  const tbody = document.getElementById('tbody-special');
  tbody.innerHTML = '';

  if (state.cvluuy.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">Chưa có công việc cần theo dõi đặc biệt</td></tr>`;
    return;
  }

  state.cvluuy.forEach((c, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600; color: #fca5a5;"><i class="fa-solid fa-star text-amber-400"></i> ${escapeHtml(c['Tiêu đề'] || '')}</td>
      <td style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(c['Mô tả'] || '')}</td>
      <td>${escapeHtml(c['Tổ chủ trì'] || '-')}</td>
      <td>${escapeHtml(c['Tên NV'] || '-')}</td>
      <td><span class="badge priority-high">Khẩn cấp</span></td>
      <td>${escapeHtml(c['Ngày kết thúc'] || '-')}</td>
      <td>${escapeHtml(c['Ghi chú'] || '-')}</td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-icon" style="color: var(--accent-rose);" onclick="deleteSpecialTask('${c['ID']}')"><i class="fa-solid fa-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// PERSONNEL 3-TIER PRIORITY AUTOCOMPLETE
// Priority 1: Team Lead / Vice Lead of selected team
// Priority 2: Members of selected team
// Priority 3: All remaining personnel in Unit
// ==============================================================================

function setupPersonnelAutocomplete(inputId, hiddenMaId, sugBoxId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenMaId);
  const sugBox = document.getElementById(sugBoxId);

  if (!input || !sugBox) return;

  input.addEventListener('focus', () => renderSuggestions());
  input.addEventListener('input', () => renderSuggestions());

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !sugBox.contains(e.target)) {
      sugBox.style.display = 'none';
    }
  });

  function renderSuggestions() {
    const query = input.value.toLowerCase().trim();
    const selectedTeam = (document.getElementById('task-ar-team').value || '').toLowerCase().trim();

    // 3-tier Priority Sorting
    const sortedUsers = [...state.users].sort((a, b) => {
      const teamA = (a['Tổ'] || a['Tổ hạ tầng'] || '').toLowerCase().trim();
      const teamB = (b['Tổ'] || b['Tổ hạ tầng'] || '').toLowerCase().trim();

      const isLeadA = (a['Chức vụ'] || '').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i);
      const isLeadB = (b['Chức vụ'] || '').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i);

      if (teamA === selectedTeam && teamB !== selectedTeam) return -1;
      if (teamB === selectedTeam && teamA !== selectedTeam) return 1;

      if (teamA === selectedTeam && teamB === selectedTeam) {
        if (isLeadA && !isLeadB) return -1;
        if (isLeadB && !isLeadA) return 1;
      }

      return 0;
    });

    const filtered = sortedUsers.filter(u => {
      const name = (u['Tên'] || u['Tên NV'] || '').toLowerCase();
      const ma = (u['Mã NV'] || '').toLowerCase();
      const team = (u['Tổ'] || u['Tổ hạ tầng'] || '').toLowerCase();
      return name.includes(query) || ma.includes(query) || team.includes(query);
    });

    if (filtered.length === 0) {
      sugBox.style.display = 'none';
      return;
    }

    sugBox.innerHTML = '';
    filtered.forEach(u => {
      const name = u['Tên'] || u['Tên NV'] || '';
      const ma = u['Mã NV'] || '';
      const team = u['Tổ'] || u['Tổ hạ tầng'] || '';
      const pos = u['Chức vụ'] || 'NV';

      const div = document.createElement('div');
      div.className = 'suggestion-item';
      div.innerHTML = `
        <div><strong>${escapeHtml(name)}</strong> <span style="font-size: 0.75rem; color: var(--text-muted);">(${escapeHtml(pos)})</span></div>
        <div class="staff-team">${escapeHtml(team)}</div>
      `;

      div.addEventListener('click', () => {
        input.value = name;
        if (hidden) hidden.value = ma;
        sugBox.style.display = 'none';
      });

      sugBox.appendChild(div);
    });

    sugBox.style.display = 'block';
  }
}

// ==============================================================================
// MODAL & FORM HANDLERS
// ==============================================================================

function openTaskModal(taskId = null) {
  document.getElementById('form-task').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('modal-task-title').innerText = taskId ? 'Sửa Công việc' : 'Thêm mới Công việc';

  if (taskId) {
    const t = state.tasks.find(x => String(x['ID']) === String(taskId));
    if (t) {
      document.getElementById('task-id').value = t['ID'] || '';
      document.getElementById('task-title').value = t['Tiêu đề'] || '';
      document.getElementById('task-desc').value = t['Mô tả'] || '';
      document.getElementById('task-leader').value = t['Lãnh đạo'] || '';
      document.getElementById('task-ar-team').value = t['Tổ chủ trì (AR)'] || '';
      document.getElementById('task-r-team').value = t['Tổ (R)'] || '';
      document.getElementById('task-nv-a').value = t['Tên NV (A)'] || '';
      document.getElementById('task-ma-a').value = t['Mã NV (A)'] || '';
      document.getElementById('task-nv-r').value = t['Tên NV (R)'] || '';
      document.getElementById('task-ma-r').value = t['Mã NV (R)'] || '';
      document.getElementById('task-nv-c').value = t['Tên NV (C)'] || '';
      document.getElementById('task-ma-c').value = t['Mã NV (C)'] || '';
      document.getElementById('task-status').value = t['Trạng thái'] || 'Đang thực hiện';
      document.getElementById('task-priority').value = t['Mức độ ưu tiên'] || 'Bình thường';
      document.getElementById('task-start-date').value = formatDateForInput(t['Ngày bắt đầu']);
      document.getElementById('task-end-date').value = formatDateForInput(t['Ngày kết thúc']);
      document.getElementById('task-plan').value = t['Kế hoạch'] || 1;
      document.getElementById('task-actual').value = t['Thực hiện'] || 0;
      document.getElementById('task-note').value = t['Ghi chú'] || '';
    }
  }

  openModal('modal-task');
}

function handleTaskSubmit(e) {
  e.preventDefault();

  const taskData = {
    ID: document.getElementById('task-id').value || 'TASK_' + new Date().getTime(),
    'Tiêu đề': document.getElementById('task-title').value,
    'Mô tả': document.getElementById('task-desc').value,
    'Lãnh đạo': document.getElementById('task-leader').value,
    'Tổ chủ trì (AR)': document.getElementById('task-ar-team').value,
    'Tổ (R)': document.getElementById('task-r-team').value,
    'Tên NV (A)': document.getElementById('task-nv-a').value,
    'Mã NV (A)': document.getElementById('task-ma-a').value,
    'Tên NV (R)': document.getElementById('task-nv-r').value,
    'Mã NV (R)': document.getElementById('task-ma-r').value,
    'Tên NV (C)': document.getElementById('task-nv-c').value,
    'Mã NV (C)': document.getElementById('task-ma-c').value,
    'Trạng thái': document.getElementById('task-status').value,
    'Mức độ ưu tiên': document.getElementById('task-priority').value,
    'Ngày bắt đầu': formatDateDisplay(document.getElementById('task-start-date').value),
    'Ngày kết thúc': formatDateDisplay(document.getElementById('task-end-date').value),
    'Kế hoạch': document.getElementById('task-plan').value,
    'Thực hiện': document.getElementById('task-actual').value,
    'Ghi chú': document.getElementById('task-note').value
  };

  gasApi.call('saveTask', taskData)
    .then(() => {
      showToast('Đã lưu công việc thành công!', 'success');
      closeModal('modal-task');
      loadAllData();
    })
    .catch(err => showToast('Lỗi lưu công việc: ' + err, 'error'));
}

function editTask(id) {
  openTaskModal(id);
}

function deleteTask(id) {
  if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
    gasApi.call('deleteTask', id)
      .then(() => {
        showToast('Đã xóa công việc', 'success');
        loadAllData();
      })
      .catch(err => showToast('Lỗi xóa công việc: ' + err, 'error'));
  }
}

function deleteTTTask(id) {
  if (confirm('Bạn có chắc muốn xóa công việc nội bộ tổ này?')) {
    gasApi.call('deleteTTTask', id)
      .then(() => {
        showToast('Đã xóa công việc tổ', 'success');
        loadAllData();
      })
      .catch(err => showToast('Lỗi xóa: ' + err, 'error'));
  }
}

function deleteDocument(id) {
  if (confirm('Bạn có chắc muốn xóa tài liệu này?')) {
    gasApi.call('deleteDocument', id)
      .then(() => {
        showToast('Đã xóa tài liệu', 'success');
        loadAllData();
      })
      .catch(err => showToast('Lỗi xóa: ' + err, 'error'));
  }
}

function deleteUser(maNV) {
  if (confirm('Xóa nhân sự khỏi hệ thống?')) {
    gasApi.call('deleteUser', maNV)
      .then(() => {
        showToast('Đã xóa nhân sự', 'success');
        loadAllData();
      })
      .catch(err => showToast('Lỗi xóa: ' + err, 'error'));
  }
}

function deleteSpecialTask(id) {
  if (confirm('Xóa công việc khỏi danh mục lưu ý?')) {
    gasApi.call('deleteSpecialTask', id)
      .then(() => {
        showToast('Đã xóa', 'success');
        loadAllData();
      })
      .catch(err => showToast('Lỗi xóa: ' + err, 'error'));
  }
}

function saveSettings() {
  const url = document.getElementById('setting-api-url').value.trim();
  state.apiUrl = url;
  localStorage.setItem('QLCV_API_URL', url);
  showToast('Đã lưu cấu hình API', 'success');
  closeModal('modal-settings');
  loadAllData();
}

// ==============================================================================
// UTILITIES
// ==============================================================================

function getFilteredTasks(taskList) {
  return taskList.filter(t => {
    const q = state.filters.search;
    const matchSearch = !q || 
      (t['Tiêu đề'] || '').toLowerCase().includes(q) ||
      (t['Mô tả'] || '').toLowerCase().includes(q) ||
      (t['Tên NV (A)'] || '').toLowerCase().includes(q) ||
      (t['Tên NV (R)'] || '').toLowerCase().includes(q);

    const matchAr = !state.filters.arTeam || t['Tổ chủ trì (AR)'] === state.filters.arTeam;
    const matchR = !state.filters.rTeam || t['Tổ (R)'] === state.filters.rTeam;
    const matchNvA = !state.filters.nvA || t['Tên NV (A)'] === state.filters.nvA;
    const matchNvR = !state.filters.nvR || t['Tên NV (R)'] === state.filters.nvR;
    const matchNvC = !state.filters.nvC || t['Tên NV (C)'] === state.filters.nvC;

    return matchSearch && matchAr && matchR && matchNvA && matchNvR && matchNvC;
  });
}

function getStatusBadgeHTML(status) {
  const st = (status || 'Đang thực hiện').trim();
  if (st.toLowerCase() === 'hoàn thành quá hạn') {
    return `<span class="badge badge-done-overdue"><i class="fa-solid fa-clock-rotate-left"></i> Hoàn thành quá hạn</span>`;
  }
  if (st.toLowerCase().includes('hoàn thành')) return `<span class="badge badge-done"><i class="fa-solid fa-circle-check"></i> Hoàn thành</span>`;
  if (st.toLowerCase().includes('quá hạn')) return `<span class="badge badge-overdue"><i class="fa-solid fa-triangle-exclamation"></i> Quá hạn</span>`;
  if (st.toLowerCase().includes('hủy')) return `<span class="badge badge-canceled"><i class="fa-solid fa-ban"></i> Đã hủy</span>`;
  return `<span class="badge badge-doing"><i class="fa-solid fa-spinner"></i> Đang thực hiện</span>`;
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-info'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateForInput(str) {
  if (!str) return '';
  if (str.includes('-')) return str;
  const parts = str.split('/');
  if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return '';
}

function formatDateDisplay(str) {
  if (!str) return '';
  if (str.includes('/')) return str;
  const parts = str.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
}
