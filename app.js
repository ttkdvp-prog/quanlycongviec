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

        const getCleanId = (d) => (d && typeof d === 'object') ? (d.id || d.ID || d.maNV || d) : d;

        if (action === 'getAllData') runner.apiGetAllData();
        else if (action === 'saveTask') runner.apiSaveTask(data);
        else if (action === 'importTasks') runner.apiImportTasks(data);
        else if (action === 'updateTaskInline') runner.apiUpdateTaskInline(data);
        else if (action === 'deleteTask') runner.apiDeleteTask(getCleanId(data));
        else if (action === 'saveTTTask') runner.apiSaveTTTask(data);
        else if (action === 'updateTTTaskInline') runner.apiUpdateTTTaskInline(data);
        else if (action === 'deleteTTTask') runner.apiDeleteTTTask(getCleanId(data));
        else if (action === 'saveDocument') runner.apiSaveDocument(data);
        else if (action === 'deleteDocument') runner.apiDeleteDocument(getCleanId(data));
        else if (action === 'saveUser') runner.apiSaveUser(data);
        else if (action === 'deleteUser') runner.apiDeleteUser(getCleanId(data));
        else if (action === 'saveSpecialTask') runner.apiSaveSpecialTask(data);
        else if (action === 'deleteSpecialTask') runner.apiDeleteSpecialTask(getCleanId(data));
        else reject('Action không được hỗ trợ: ' + action);

      } else {
        // Standalone Web App / Vercel Execution via fetch()
        const apiUrl = state.apiUrl;
        if (!apiUrl) {
          showToast('Vui lòng dán Apps Script Web App URL vào mục Cấu hình bánh răng!', 'warning');
          return resolve({ success: true, localMock: true });
        }

        // For data retrieval actions, use GET query param which is 100% CORS-friendly in GAS
        let fetchPromise;
        const isReadAction = ['getAllData', 'getTasks', 'getUsers', 'getTTTasks', 'getDocuments', 'getSpecialTasks'].includes(action);
        
        if (isReadAction) {
          const sep = apiUrl.includes('?') ? '&' : '?';
          fetchPromise = fetch(`${apiUrl}${sep}action=${action}&_t=${Date.now()}`);
        } else {
          fetchPromise = fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: action, data: data })
          });
        }

        fetchPromise
          .then(res => res.text())
          .then(text => {
            let res;
            try {
              res = JSON.parse(text);
            } catch (e) {
              if (text.trim().startsWith('<')) {
                throw new Error('Apps Script trả về HTML thay vì JSON. Vui lòng kiểm tra lại URL Web App và đảm bảo khi Deploy đã chọn "Who has access" là "Anyone" (Bất kỳ ai).');
              }
              throw new Error('Dữ liệu trả về không đúng định dạng JSON: ' + text.substring(0, 100));
            }
            if (res && res.success === false) {
              reject(res.error || 'Lỗi API');
            } else {
              resolve(res);
            }
          })
          .catch(err => reject('Lỗi kết nối REST API: ' + (err.message || err.toString())));
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

  // Excel Import button & listeners
  const btnImportExcel = document.getElementById('btn-import-excel');
  if (btnImportExcel) {
    btnImportExcel.addEventListener('click', () => {
      excelImportParsedTasks = [];
      document.getElementById('excel-file-input').value = '';
      document.getElementById('excel-preview-container').style.display = 'none';
      document.getElementById('excel-preview-tbody').innerHTML = '';
      const btnConfirm = document.getElementById('btn-confirm-excel-import');
      btnConfirm.disabled = true;
      btnConfirm.style.opacity = '0.5';
      btnConfirm.style.cursor = 'not-allowed';
      openModal('modal-excel-import');
    });
  }

  const btnTemplate = document.getElementById('btn-download-excel-template');
  if (btnTemplate) {
    btnTemplate.addEventListener('click', downloadExcelTemplate);
  }

  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleExcelFileSelect);
  }

  const btnConfirmImport = document.getElementById('btn-confirm-excel-import');
  if (btnConfirmImport) {
    btnConfirmImport.addEventListener('click', confirmExcelImport);
  }

  // Report & Filter listeners
  const btnApplyReportFilter = document.getElementById('btn-apply-report-filter');
  if (btnApplyReportFilter) {
    btnApplyReportFilter.addEventListener('click', renderReportView);
  }

  const btnResetReportFilter = document.getElementById('btn-reset-report-filter');
  if (btnResetReportFilter) {
    btnResetReportFilter.addEventListener('click', () => {
      document.getElementById('report-from-date').value = '';
      document.getElementById('report-to-date').value = '';
      document.getElementById('report-date-type').value = 'start';
      document.getElementById('report-filter-ar').value = '';
      document.getElementById('report-filter-nva').value = '';
      document.getElementById('report-filter-status').value = '';
      renderReportView();
    });
  }

  const btnExportReportExcel = document.getElementById('btn-export-report-excel');
  if (btnExportReportExcel) {
    btnExportReportExcel.addEventListener('click', exportReportExcel);
  }

  // Task Form auto-fill A and prioritize users when AR Team selected
  document.getElementById('task-ar-team').addEventListener('change', (e) => {
    const selectedTeam = e.target.value;
    populateUserSelects(selectedTeam);

    if (selectedTeam) {
      // Find team leader / vice leader for selected team
      const lead = state.users.find(u => 
        (u['Tổ'] || u['Tổ hạ tầng'] || '').toLowerCase().trim() === selectedTeam.toLowerCase().trim() &&
        (u['Chức vụ'] || '').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i)
      ) || state.users.find(u => (u['Tổ'] || '').toLowerCase().trim() === selectedTeam.toLowerCase().trim());

      if (lead) {
        const name = lead['Tên'] || lead['Tên NV'] || lead['Tên nv'] || lead['Họ và tên'] || '';
        document.getElementById('task-nv-a').value = name;
        document.getElementById('task-ma-a').value = lead['Mã NV'] || lead['Mã nv'] || '';
      }
    }
  });

  // Quick search listeners for NV A, R, C personnel selects
  ['search-nv-a', 'search-nv-r', 'search-nv-c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        populateUserSelects();
        const targetSelectId = id.replace('search-', 'task-');
        const targetSelect = document.getElementById(targetSelectId);
        if (targetSelect && el.value.trim() !== '' && targetSelect.options.length > 1) {
          targetSelect.selectedIndex = 1;
        }
      });
    }
  });

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
    'tab-special': 'Công việc Cần Lưu ý',
    'tab-report': 'Lọc chi tiết & Báo cáo số lượng Công việc theo Ngày'
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
      populateUserSelects();
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
    const t = getPersonProp(u, 'team');
    if (t) teams.add(t);
  });
  state.nhanvien.forEach(n => {
    const t = getPersonProp(n, 'team') || n['Tổ hạ tầng'] || n['Tổ'];
    if (t) teams.add(t);
  });
  state.tasks.forEach(task => {
    if (task['Tổ chủ trì (AR)']) teams.add(task['Tổ chủ trì (AR)']);
    if (task['Tổ (R)']) teams.add(task['Tổ (R)']);
  });

  const defaultTeams = [
    'Tổ Tổng hợp',
    'Tổ Hạ tầng Hòa Bình',
    'Tổ Hạ tầng Lương Sơn',
    'Tổ Hạ tầng Phúc Yên',
    'Tổ Hạ tầng Tam Đảo',
    'Tổ Hạ tầng Tân Lạc',
    'Tổ Hạ tầng Thanh Ba',
    'Tổ Hạ tầng Thanh Sơn',
    'Tổ Hạ tầng Việt Trì',
    'Tổ Hạ tầng Vĩnh Yên',
    'Tổ Hỗ trợ Khách hàng Vip site Hoà Bình',
    'Tổ Hỗ trợ Khách hàng Vip site Phú Thọ',
    'Tổ Hỗ trợ Khách hàng Vip site Vĩnh Phúc',
    'Tổ Khai thác Hệ thống Phú Thọ'
  ];

  if (teams.size === 0) {
    defaultTeams.forEach(t => teams.add(t));
  }

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
    case 'tab-report':
      renderReportView();
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
    const leaderCode = t['Mã LĐ'] || '';
    const maA = t['Mã NV (A)'] || '';
    const maR = t['Mã NV (R)'] || '';
    const maC = t['Mã NV (C)'] || '';

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600; min-width: 180px; color: #e2e8f0;">
        <span style="color: #94a3b8;">${idx + 1}.</span> ${escapeHtml(t['Tiêu đề'] || '')}
      </td>
      <td style="min-width: 260px; max-width: 340px; font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">${escapeHtml(t['Mô tả'] || '')}</td>
      <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
      <td>
        <div style="font-weight: 600;">${escapeHtml(t['Lãnh đạo'] || '-')}</div>
        ${leaderCode ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(leaderCode)}</div>` : ''}
      </td>
      <td>
        <span class="badge" style="background: rgba(255, 255, 255, 0.08); color: #e2e8f0; border: 1px solid rgba(255, 255, 255, 0.12); font-weight: 500;">
          ${escapeHtml(t['Tổ chủ trì (AR)'] || '-')}
        </span>
      </td>
      <td>
        <div style="font-weight: 700; color: #fff;">${escapeHtml(t['Tên NV (A)'] || '-')}</div>
        ${maA ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(maA)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(t['Tên NV (R)'] || '-')}</div>
        ${maR ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(maR)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(t['Tên NV (C)'] || '-')}</div>
        ${maC ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(maC)}</div>` : ''}
      </td>
      <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
      <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
      
      <!-- INLINE EDITABLE: Ngày làm xong -->
      <td style="width: 140px;">
        <input type="date" class="inline-edit-input inline-edit-date" value="${formatDateForInput(t['Ngày làm xong'])}" onchange="handleInlineEdit('QLCV', '${t['ID']}', 'Ngày làm xong', this.value)">
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

  const tfootQLCV = document.getElementById('tfoot-qlcv');
  if (tfootQLCV) {
    let sumKH = 0, sumTH = 0, countDone = 0, countOverdue = 0;
    filtered.forEach(t => {
      sumKH += parseFloat(t['Kế hoạch']) || 0;
      sumTH += parseFloat(t['Thực hiện']) || 0;
      const st = (t['Trạng thái'] || '').toLowerCase();
      if (st.includes('hoàn thành')) countDone++;
      if (st.includes('quá hạn')) countOverdue++;
    });
    const avgRatio = sumKH > 0 ? Math.min(Math.round((sumTH / sumKH) * 100), 100) : (sumTH > 0 ? 100 : 0);

    tfootQLCV.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: right; font-weight: 700; color: #a7f3d0;">TỔNG CỘNG (${filtered.length} VIỆC):</td>
        <td colspan="9" style="font-size: 0.8rem; color: #cbd5e1;">Đã hoàn thành: <strong style="color:var(--accent-emerald);">${countDone}</strong> | Quá hạn: <strong style="color:var(--accent-rose);">${countOverdue}</strong></td>
        <td style="font-weight: 800; color: #fff;">${avgRatio}%</td>
        <td style="font-weight: 800; color: #fff;">${sumKH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${sumTH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${avgRatio}%</td>
        <td colspan="2"></td>
      </tr>
    `;
  }
}

// INLINE DEBOUNCED EDIT HANDLER
function handleInlineEdit(sheetName, id, field, value) {
  const key = `${sheetName}_${id}_${field}`;
  if (debounceTimers[key]) clearTimeout(debounceTimers[key]);

  debounceTimers[key] = setTimeout(() => {
    const list = sheetName === 'QLCV' ? state.tasks : state.ttTasks;
    const item = list.find(x => String(x['ID']) === String(id));
    
    if (item) {
      const finalValue = (field === 'Ngày làm xong') ? formatDateDisplay(value) : value;
      item[field] = finalValue;
      const newStatus = computeTaskStatus(item);
      item['Trạng thái'] = newStatus;

      renderCurrentTab();

      const updateObj = { id: id };
      updateObj[field] = finalValue;
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
    const maR = t['Mã NV (R)'] || '';
    const maC = t['Mã NV (C)'] || '';

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td style="font-weight: 600; min-width: 180px; color: #e2e8f0;">
        <span style="color: #94a3b8;">${idx + 1}.</span> ${escapeHtml(t['Tiêu đề'] || '')}
      </td>
      <td style="min-width: 260px; max-width: 340px; font-size: 0.8rem; color: var(--text-muted); white-space: pre-wrap; word-break: break-word;">${escapeHtml(t['Mô tả'] || '')}</td>
      <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(t['Tên NV (R)'] || '-')}</div>
        ${maR ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(maR)}</div>` : ''}
      </td>
      <td>
        <div style="font-weight: 500;">${escapeHtml(t['Tên NV (C)'] || '-')}</div>
        ${maC ? `<div style="font-size: 0.72rem; color: var(--text-sub);">${escapeHtml(maC)}</div>` : ''}
      </td>
      <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
      <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
      <td style="width: 140px;"><input type="date" class="inline-edit-input inline-edit-date" value="${formatDateForInput(t['Ngày làm xong'])}" onchange="handleInlineEdit('TT_giaoviec', '${t['ID']}', 'Ngày làm xong', this.value)"></td>
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

  const tfootTT = document.getElementById('tfoot-tt');
  if (tfootTT) {
    let sumKH = 0, sumTH = 0, countDone = 0, countOverdue = 0;
    state.ttTasks.forEach(t => {
      sumKH += parseFloat(t['Kế hoạch']) || 0;
      sumTH += parseFloat(t['Thực hiện']) || 0;
      const st = (t['Trạng thái'] || '').toLowerCase();
      if (st.includes('hoàn thành')) countDone++;
      if (st.includes('quá hạn')) countOverdue++;
    });
    const avgRatio = sumKH > 0 ? Math.min(Math.round((sumTH / sumKH) * 100), 100) : (sumTH > 0 ? 100 : 0);

    tfootTT.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: right; font-weight: 700; color: #a7f3d0;">TỔNG CỘNG CÔNG VIỆC TỔ (${state.ttTasks.length} VIỆC):</td>
        <td colspan="6" style="font-size: 0.8rem; color: #cbd5e1;">Hoàn thành: <strong style="color:var(--accent-emerald);">${countDone}</strong> | Quá hạn: <strong style="color:var(--accent-rose);">${countOverdue}</strong></td>
        <td style="font-weight: 800; color: #fff;">${avgRatio}%</td>
        <td style="font-weight: 800; color: #fff;">${sumKH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${sumTH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${avgRatio}%</td>
        <td colspan="2"></td>
      </tr>
    `;
  }
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

  let totalTasks = 0;
  let totalDoing = 0;
  let totalDone = 0;
  let totalOverdue = 0;

  teams.forEach((team, idx) => {
    const s = statsMap[team];
    totalTasks += s.total;
    totalDoing += s.doing;
    totalDone += s.done;
    totalOverdue += s.overdue;

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

  const overallRate = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0;
  const tfoot = document.getElementById('tfoot-stats');
  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td colspan="2" style="text-align: right; font-weight: 700; color: #a7f3d0;">TỔNG CỘNG ĐƠN VỊ:</td>
        <td style="font-weight: 800; color: #fff;">${totalTasks}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">${totalDoing}</td>
        <td style="color: var(--accent-emerald); font-weight: 800;">${totalDone}</td>
        <td style="color: var(--accent-rose); font-weight: 700;">${totalOverdue}</td>
        <td>
          <div class="progress-bar-container"><div class="progress-bar-fill" style="width: ${overallRate}%;"></div></div>
          <strong style="color: var(--accent-emerald); font-weight: 800;">${overallRate}%</strong>
        </td>
      </tr>
    `;
  }
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

  let sumTotal = 0;
  let sumLeadA = 0;
  let sumCoR = 0;
  let sumDoing = 0;
  let sumDone = 0;
  let sumOverdue = 0;

  names.forEach((name, idx) => {
    const u = userStats[name];
    sumTotal += u.total;
    sumLeadA += u.leadA;
    sumCoR += u.coR;
    sumDoing += u.doing;
    sumDone += u.done;
    sumOverdue += u.overdue;

    const rate = u.total > 0 ? Math.round((u.done / u.total) * 100) : 0;

    // Rating logic: A >= 90%, B >= 70%, C >= 50%, D < 50%
    let rating = 'D - Chưa đạt';
    let ratingClass = 'rating-d';
    if (rate >= 90) { rating = 'A - Xuất sắc'; ratingClass = 'rating-a'; }
    else if (rate >= 70) { rating = 'B - Tốt'; ratingClass = 'rating-b'; }
    else if (rate >= 50) { rating = 'C - Đạt'; ratingClass = 'rating-c'; }

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

  const overallEvalRate = sumTotal > 0 ? Math.round((sumDone / sumTotal) * 100) : 0;
  let overallRating = 'B - Tốt';
  let overallRatingClass = 'rating-b';
  if (overallEvalRate >= 90) { overallRating = 'A - Xuất sắc'; overallRatingClass = 'rating-a'; }
  else if (overallEvalRate >= 70) { overallRating = 'B - Tốt'; overallRatingClass = 'rating-b'; }
  else if (overallEvalRate >= 50) { overallRating = 'C - Đạt'; overallRatingClass = 'rating-c'; }
  else { overallRating = 'D - Chưa đạt'; overallRatingClass = 'rating-d'; }

  const tfootEval = document.getElementById('tfoot-eval');
  if (tfootEval) {
    tfootEval.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: right; font-weight: 700; color: #a7f3d0;">TỔNG CỘNG TOÀN ĐƠN VỊ (${names.length} NV):</td>
        <td style="font-weight: 800; color: #fff;">${sumTotal}</td>
        <td style="font-weight: 700;">${sumLeadA}</td>
        <td style="font-weight: 700;">${sumCoR}</td>
        <td style="color: var(--accent-cyan); font-weight: 700;">${sumDoing}</td>
        <td style="color: var(--accent-emerald); font-weight: 800;">${sumDone}</td>
        <td style="color: var(--accent-rose); font-weight: 700;">${sumOverdue}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${overallEvalRate}%</td>
        <td><span class="badge ${overallRatingClass}">${overallRating}</span></td>
      </tr>
    `;
  }
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

function getPersonProp(u, type) {
  if (!u) return '';
  if (type === 'name') {
    return u['Tên'] || u['Tên NV'] || u['Tên nv'] || u['Họ và tên'] || u['TÊN'] || u['FullName'] || u['Name'] || '';
  }
  if (type === 'ma') {
    return u['Mã NV'] || u['Mã nv'] || u['MÃ NV'] || u['MaNV'] || u['Code'] || '';
  }
  if (type === 'team') {
    return u['Tổ'] || u['Tổ hạ tầng'] || u['TỔ'] || u['Team'] || '';
  }
  if (type === 'pos') {
    return u['Chức vụ'] || u['chức vụ'] || u['CHỨC VỤ'] || u['Role'] || '';
  }
  return '';
}

function removeVietnameseTones(str) {
  if (!str) return '';
  str = String(str);
  str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
  str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
  str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
  str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
  str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
  str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
  str = str.replace(/đ/g, "d");
  str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
  str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
  str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
  str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
  str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
  str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
  str = str.replace(/Đ/g, "D");
  return str.toLowerCase().trim();
}

function filterUsersByQuery(users, query) {
  if (!query) return users;
  const q = removeVietnameseTones(query);
  return users.filter(u => {
    const name = removeVietnameseTones(getPersonProp(u, 'name'));
    const ma = removeVietnameseTones(getPersonProp(u, 'ma'));
    const team = removeVietnameseTones(getPersonProp(u, 'team'));
    const pos = removeVietnameseTones(getPersonProp(u, 'pos'));
    return name.includes(q) || ma.includes(q) || team.includes(q) || pos.includes(q);
  });
}

function populateUserSelects(selectedTeam = '') {
  const selectA = document.getElementById('task-nv-a');
  const selectR = document.getElementById('task-nv-r');
  const selectC = document.getElementById('task-nv-c');

  if (!selectA) return;

  const currentValA = selectA.value;
  const currentValR = selectR ? selectR.value : '';
  const currentValC = selectC ? selectC.value : '';

  const normTeam = (selectedTeam || document.getElementById('task-ar-team')?.value || '').toLowerCase().trim();

  let rawList = [...state.users];
  if (rawList.length === 0 && state.nhanvien && state.nhanvien.length > 0) {
    rawList = [...state.nhanvien];
  }

  // If rawList is still empty, extract unique names from state.tasks
  if (rawList.length === 0 && state.tasks) {
    const nameMap = new Map();
    state.tasks.forEach(t => {
      ['Tên NV (A)', 'Tên NV (R)', 'Tên NV (C)'].forEach(k => {
        const val = (t[k] || '').trim();
        if (val && !nameMap.has(val)) {
          nameMap.set(val, { 'Tên': val, 'Tổ': t['Tổ chủ trì (AR)'] || 'Đơn vị', 'Chức vụ': 'Nhân viên' });
        }
      });
    });
    rawList = Array.from(nameMap.values());
  }

  // 3-tier Priority Sorting from Sheet User ONLY
  const sortedUsers = rawList.sort((a, b) => {
    const nameA = getPersonProp(a, 'name');
    const nameB = getPersonProp(b, 'name');

    const teamA = getPersonProp(a, 'team').toLowerCase().trim();
    const teamB = getPersonProp(b, 'team').toLowerCase().trim();

    const isLeadA = getPersonProp(a, 'pos').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i);
    const isLeadB = getPersonProp(b, 'pos').toLowerCase().match(/tổ trưởng|tổ phó|key|trưởng/i);

    if (normTeam && teamA === normTeam && teamB !== normTeam) return -1;
    if (normTeam && teamB === normTeam && teamA !== normTeam) return 1;

    if (normTeam && teamA === normTeam && teamB === normTeam) {
      if (isLeadA && !isLeadB) return -1;
      if (isLeadB && !isLeadA) return 1;
    }

    return nameA.localeCompare(nameB, 'vi');
  });

  const queryA = document.getElementById('search-nv-a')?.value || '';
  const queryR = document.getElementById('search-nv-r')?.value || '';
  const queryC = document.getElementById('search-nv-c')?.value || '';

  const filteredA = filterUsersByQuery(sortedUsers, queryA);
  const filteredR = filterUsersByQuery(sortedUsers, queryR);
  const filteredC = filterUsersByQuery(sortedUsers, queryC);

  const generateOptionsHTML = (list, defaultLabel) => {
    let html = `<option value="">${defaultLabel}</option>`;
    list.forEach(u => {
      const name = getPersonProp(u, 'name');
      const ma = getPersonProp(u, 'ma');
      const team = getPersonProp(u, 'team');
      const pos = getPersonProp(u, 'pos');

      if (name) {
        let label = name;
        if (pos) label += ` (${pos})`;
        if (team) label += ` - ${team}`;
        if (ma) label += ` [${ma}]`;

        html += `<option value="${escapeHtml(name)}" data-ma="${escapeHtml(ma)}">${escapeHtml(label)}</option>`;
      }
    });
    return html;
  };

  selectA.innerHTML = generateOptionsHTML(filteredA, '-- Chọn Tên NV (A) --');
  if (selectR) selectR.innerHTML = generateOptionsHTML(filteredR, '-- Chọn Tên NV (R) --');
  if (selectC) selectC.innerHTML = generateOptionsHTML(filteredC, '-- Chọn Tên NV (C) --');

  if (currentValA) selectA.value = currentValA;
  if (selectR && currentValR) selectR.value = currentValR;
  if (selectC && currentValC) selectC.value = currentValC;
}

// ==============================================================================
// MODAL & FORM HANDLERS
// ==============================================================================

function openTaskModal(taskId = null) {
  document.getElementById('form-task').reset();
  document.getElementById('task-id').value = '';
  document.getElementById('modal-task-title').innerText = taskId ? 'Sửa Công việc' : 'Thêm mới Công việc';

  ['search-nv-a', 'search-nv-r', 'search-nv-c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  populateTeamDropdowns();
  populateUserSelects();

  if (taskId) {
    const t = state.tasks.find(x => String(x['ID']) === String(taskId));
    if (t) {
      document.getElementById('task-id').value = t['ID'] || '';
      document.getElementById('task-title').value = t['Tiêu đề'] || '';
      document.getElementById('task-desc').value = t['Mô tả'] || '';
      document.getElementById('task-leader').value = t['Lãnh đạo'] || '';
      document.getElementById('task-ar-team').value = t['Tổ chủ trì (AR)'] || '';
      document.getElementById('task-r-team').value = t['Tổ (R)'] || '';

      populateUserSelects(t['Tổ chủ trì (AR)'] || '');

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
  } else {
    // Default start date to current date (YYYY-MM-DD), while still allowing user edits
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    document.getElementById('task-start-date').value = `${yyyy}-${mm}-${dd}`;
  }

  openModal('modal-task');
}

function handleTaskSubmit(e) {
  e.preventDefault();

  const selA = document.getElementById('task-nv-a');
  const selR = document.getElementById('task-nv-r');
  const selC = document.getElementById('task-nv-c');

  const optA = selA && selA.selectedIndex >= 0 ? selA.options[selA.selectedIndex] : null;
  const optR = selR && selR.selectedIndex >= 0 ? selR.options[selR.selectedIndex] : null;
  const optC = selC && selC.selectedIndex >= 0 ? selC.options[selC.selectedIndex] : null;

  const maA = optA ? (optA.getAttribute('data-ma') || '') : '';
  const maR = optR ? (optR.getAttribute('data-ma') || '') : '';
  const maC = optC ? (optC.getAttribute('data-ma') || '') : '';

  const taskData = {
    ID: document.getElementById('task-id').value || 'TASK_' + new Date().getTime(),
    'Tiêu đề': document.getElementById('task-title').value,
    'Mô tả': document.getElementById('task-desc').value,
    'Lãnh đạo': document.getElementById('task-leader').value,
    'Tổ chủ trì (AR)': document.getElementById('task-ar-team').value,
    'Tổ (R)': document.getElementById('task-r-team').value,
    'Tên NV (A)': selA ? selA.value : '',
    'Mã NV (A)': maA || document.getElementById('task-ma-a').value,
    'Tên NV (R)': selR ? selR.value : '',
    'Mã NV (R)': maR || document.getElementById('task-ma-r').value,
    'Tên NV (C)': selC ? selC.value : '',
    'Mã NV (C)': maC || document.getElementById('task-ma-c').value,
    'Trạng thái': document.getElementById('task-status').value,
    'Mức độ ưu tiên': document.getElementById('task-priority').value,
    'Ngày bắt đầu': formatDateDisplay(document.getElementById('task-start-date').value),
    'Ngày kết thúc': formatDateDisplay(document.getElementById('task-end-date').value),
    'Kế hoạch': document.getElementById('task-plan').value,
    'Thực hiện': document.getElementById('task-actual').value,
    'Ghi chú': document.getElementById('task-note').value
  };

  // Tính toán tự động trạng thái chuẩn xác
  taskData['Trạng thái'] = computeTaskStatus(taskData);

  // 1. Tối ưu trải nghiệm: Cập nhật ngay vào state bộ nhớ (Optimistic UI Update)
  const existingIdx = state.tasks.findIndex(x => String(x['ID']) === String(taskData.ID));
  if (existingIdx >= 0) {
    state.tasks[existingIdx] = { ...state.tasks[existingIdx], ...taskData };
  } else {
    state.tasks.unshift(taskData);
  }

  // 2. Cập nhật giao diện & đóng Modal ngay lập tức (Tốc độ 0ms)
  populateFilterDropdowns();
  populateTeamDropdowns();
  updateBadges();
  renderCurrentTab();
  closeModal('modal-task');
  showToast('Đã lưu công việc thành công!', 'success');

  // 3. Gửi đồng bộ lên Google Sheets ở nền (Async Background Sync)
  gasApi.call('saveTask', taskData)
    .catch(err => {
      console.error('Lỗi đồng bộ Google Sheets:', err);
      showToast('Lỗi đồng bộ backend: ' + err, 'error');
    });
}

function editTask(id) {
  openTaskModal(id);
}

function deleteTask(id) {
  if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
    state.tasks = state.tasks.filter(t => String(t['ID']) !== String(id));
    updateBadges();
    renderCurrentTab();
    showToast('Đã xóa công việc', 'success');

    gasApi.call('deleteTask', id)
      .catch(err => showToast('Lỗi xóa công việc trên Google Sheets: ' + err, 'error'));
  }
}

function deleteTTTask(id) {
  if (confirm('Bạn có chắc muốn xóa công việc nội bộ tổ này?')) {
    state.ttTasks = state.ttTasks.filter(t => String(t['ID']) !== String(id));
    updateBadges();
    renderCurrentTab();
    showToast('Đã xóa công việc tổ', 'success');

    gasApi.call('deleteTTTask', id)
      .catch(err => showToast('Lỗi xóa trên Google Sheets: ' + err, 'error'));
  }
}

function deleteDocument(id) {
  if (confirm('Bạn có chắc muốn xóa tài liệu này?')) {
    state.documents = state.documents.filter(d => String(d['ID']) !== String(id));
    renderCurrentTab();
    showToast('Đã xóa tài liệu', 'success');

    gasApi.call('deleteDocument', id)
      .catch(err => showToast('Lỗi xóa tài liệu trên Google Sheets: ' + err, 'error'));
  }
}

function deleteUser(maNV) {
  if (confirm('Xóa nhân sự khỏi hệ thống?')) {
    state.users = state.users.filter(u => String(u['Mã NV']) !== String(maNV));
    renderCurrentTab();
    showToast('Đã xóa nhân sự', 'success');

    gasApi.call('deleteUser', maNV)
      .catch(err => showToast('Lỗi xóa nhân sự trên Google Sheets: ' + err, 'error'));
  }
}

function deleteSpecialTask(id) {
  if (confirm('Xóa công việc khỏi danh mục lưu ý?')) {
    state.cvluuy = state.cvluuy.filter(c => String(c['ID']) !== String(id));
    renderCurrentTab();
    showToast('Đã xóa', 'success');

    gasApi.call('deleteSpecialTask', id)
      .catch(err => showToast('Lỗi xóa trên Google Sheets: ' + err, 'error'));
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

// ==============================================================================
// EXCEL IMPORT & TEMPLATE EXPORT UTILITIES
// ==============================================================================

let excelImportParsedTasks = [];

function downloadExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    showToast('Thư viện XLSX chưa tải xong, vui lòng tải lại trang', 'error');
    return;
  }

  const sampleData = [
    {
      'Tiêu đề': 'Cung cấp và lắp đặt thiết bị tủ nguồn 3 pha',
      'Mô tả': 'Nâng cấp hệ thống tủ điện khu vực Hòa Bình',
      'Lãnh đạo': 'Nguyễn Công Hoan',
      'Tổ chủ trì (AR)': 'Tổ Hạ tầng Hòa Bình',
      'Tổ (R)': 'Tổ Tổng hợp',
      'Tên NV (A)': 'Lê Minh Thuyết',
      'Mã NV (A)': 'VNPT018248',
      'Tên NV (R)': 'Trần Thị Thúy',
      'Mã NV (R)': 'VNPT018465',
      'Tên NV (C)': '',
      'Mã NV (C)': '',
      'Trạng thái': 'Đang thực hiện',
      'Mức độ ưu tiên': 'Bình thường',
      'Ngày bắt đầu': '01/08/2026',
      'Ngày kết thúc': '15/08/2026',
      'Ngày làm xong': '',
      'Kế hoạch': 1,
      'Thực hiện': 0,
      'Ghi chú': 'Công việc mẫu'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'QLCV_Mau');
  XLSX.writeFile(wb, 'Mau_Nhap_Cong_Viec_QLCV.xlsx');
  showToast('Đã tải xuống file mẫu Excel', 'success');
}

function handleExcelFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (typeof XLSX === 'undefined') {
    showToast('Thư viện XLSX chưa sẵn sàng, vui lòng làm mới trang', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      excelImportParsedTasks = [];
      rawRows.forEach((row, idx) => {
        const task = mapExcelRowToTask(row, idx);
        if (task) {
          excelImportParsedTasks.push(task);
        }
      });

      if (excelImportParsedTasks.length === 0) {
        showToast('Không tìm thấy dòng dữ liệu công việc hợp lệ nào trong file!', 'warning');
        document.getElementById('excel-preview-container').style.display = 'none';
        return;
      }

      // Render Preview Table
      const tbody = document.getElementById('excel-preview-tbody');
      tbody.innerHTML = '';
      excelImportParsedTasks.forEach((t, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td style="font-weight: 600; color: #e2e8f0;">${escapeHtml(t['Tiêu đề'])}</td>
          <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t['Mô tả'])}</td>
          <td>${escapeHtml(t['Lãnh đạo'] || '-')}</td>
          <td>${escapeHtml(t['Tổ chủ trì (AR)'] || '-')}</td>
          <td>${escapeHtml(t['Tổ (R)'] || '-')}</td>
          <td>${escapeHtml(t['Tên NV (A)'] || '-')}</td>
          <td>${escapeHtml(t['Tên NV (R)'] || '-')}</td>
          <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
          <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
          <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
        `;
        tbody.appendChild(tr);
      });

      document.getElementById('excel-preview-count').innerText = excelImportParsedTasks.length;
      document.getElementById('excel-preview-container').style.display = 'block';

      const btnConfirm = document.getElementById('btn-confirm-excel-import');
      btnConfirm.disabled = false;
      btnConfirm.style.opacity = '1';
      btnConfirm.style.cursor = 'pointer';

      showToast(`Đã đọc ${excelImportParsedTasks.length} dòng công việc từ file Excel!`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Lỗi đọc file Excel: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

function mapExcelRowToTask(row, idx) {
  const getVal = (keys) => {
    for (const k of keys) {
      const targetNorm = removeVietnameseTones(k).replace(/[^a-z0-9]/g, '');
      for (const rowKey in row) {
        const rowNorm = removeVietnameseTones(rowKey).replace(/[^a-z0-9]/g, '');
        if (rowNorm === targetNorm) {
          return String(row[rowKey] || '').trim();
        }
      }
    }
    return '';
  };

  const title = getVal(['Tiêu đề', 'Tiêu đề công việc', 'Tên công việc', 'Title']);
  if (!title) return null;

  const desc = getVal(['Mô tả', 'Mô tả chi tiết', 'Nội dung', 'Description']);
  const leader = getVal(['Lãnh đạo', 'Lãnh đạo phụ trách', 'Leader']);
  const arTeam = getVal(['Tổ chủ trì (AR)', 'Tổ chủ trì', 'Tổ AR', 'AR Team']);
  const rTeam = getVal(['Tổ (R)', 'Tổ phối hợp', 'Tổ R']);
  const nvA = getVal(['Tên NV (A)', 'Tên NV A', 'Nhân viên (A)', 'NV A']);
  const maA = getVal(['Mã NV (A)', 'Mã NV A', 'Mã A']);
  const nvR = getVal(['Tên NV (R)', 'Tên NV R', 'Nhân viên (R)', 'NV R']);
  const maR = getVal(['Mã NV (R)', 'Mã NV R', 'Mã R']);
  const nvC = getVal(['Tên NV (C)', 'Tên NV C', 'Nhân viên (C)', 'NV C']);
  const maC = getVal(['Mã NV (C)', 'Mã NV C', 'Mã C']);
  const status = getVal(['Trạng thái', 'Status']) || 'Đang thực hiện';
  const priority = getVal(['Mức độ ưu tiên', 'Ưu tiên', 'Priority']) || 'Bình thường';
  
  let startDate = getVal(['Ngày bắt đầu', 'Start Date', 'Từ ngày']);
  let endDate = getVal(['Ngày kết thúc', 'Hạn hoàn thành', 'End Date', 'Đến ngày']);
  let doneDate = getVal(['Ngày làm xong', 'Done Date']);

  startDate = formatDateDisplay(startDate);
  endDate = formatDateDisplay(endDate);
  doneDate = formatDateDisplay(doneDate);

  const plan = getVal(['Kế hoạch', 'Số lượng kế hoạch', 'Plan']) || 1;
  const actual = getVal(['Thực hiện', 'Số lượng thực hiện', 'Actual']) || 0;
  const note = getVal(['Ghi chú', 'Note']);

  const task = {
    ID: getVal(['ID', 'Mã công việc']) || ('TASK_EXCEL_' + Date.now() + '_' + idx),
    'Tiêu đề': title,
    'Mô tả': desc,
    'Lãnh đạo': leader,
    'Tổ chủ trì (AR)': arTeam,
    'Tổ (R)': rTeam,
    'Tên NV (A)': nvA,
    'Mã NV (A)': maA,
    'Tên NV (R)': nvR,
    'Mã NV (R)': maR,
    'Tên NV (C)': nvC,
    'Mã NV (C)': maC,
    'Trạng thái': status,
    'Mức độ ưu tiên': priority,
    'Ngày bắt đầu': startDate,
    'Ngày kết thúc': endDate,
    'Ngày làm xong': doneDate,
    'Kế hoạch': plan,
    'Thực hiện': actual,
    'Ghi chú': note
  };

  task['Trạng thái'] = computeTaskStatus(task);
  return task;
}

function confirmExcelImport() {
  if (excelImportParsedTasks.length === 0) return;

  const newTasks = [...excelImportParsedTasks];

  // 1. Optimistic local update
  newTasks.forEach(taskData => {
    const existingIdx = state.tasks.findIndex(x => String(x['ID']) === String(taskData.ID));
    if (existingIdx >= 0) {
      state.tasks[existingIdx] = { ...state.tasks[existingIdx], ...taskData };
    } else {
      state.tasks.unshift(taskData);
    }
  });

  // 2. Refresh UI immediately
  populateFilterDropdowns();
  populateTeamDropdowns();
  updateBadges();
  renderCurrentTab();
  closeModal('modal-excel-import');
  showToast(`Đã nhập thành công ${newTasks.length} công việc từ Excel!`, 'success');

  // 3. Background sync to Google Sheets
  gasApi.call('importTasks', newTasks)
    .then(res => {
      showToast(res.message || `Đã đồng bộ ${newTasks.length} công việc lên Google Sheets!`, 'success');
    })
    .catch(err => {
      console.error('Lỗi đồng bộ Excel lên backend:', err);
      showToast('Lỗi đồng bộ Excel lên Google Sheets: ' + err, 'error');
    });
}

// ==============================================================================
// TAB 10: LỌC CHI TIẾT & BÁO CÁO THEO KHOẢNG THỜI GIAN
// ==============================================================================

function renderReportView() {
  populateReportDropdowns();

  const fromDate = document.getElementById('report-from-date')?.value || '';
  const toDate = document.getElementById('report-to-date')?.value || '';
  const dateType = document.getElementById('report-date-type')?.value || 'start';
  const arTeam = document.getElementById('report-filter-ar')?.value || '';
  const nvA = document.getElementById('report-filter-nva')?.value || '';
  const status = document.getElementById('report-filter-status')?.value || '';

  const filtered = state.tasks.filter(t => {
    let targetDateStr = '';
    if (dateType === 'start') targetDateStr = t['Ngày bắt đầu'];
    else if (dateType === 'done') targetDateStr = t['Ngày làm xong'];
    else targetDateStr = t['Ngày kết thúc'] || t['Hạn hoàn thành'];

    if ((fromDate || toDate) && !isDateInRange(targetDateStr, fromDate, toDate)) {
      return false;
    }

    if (arTeam && t['Tổ chủ trì (AR)'] !== arTeam) return false;
    if (nvA && t['Tên NV (A)'] !== nvA) return false;
    if (status) {
      const st = (t['Trạng thái'] || '').toLowerCase();
      if (!st.includes(status.toLowerCase())) return false;
    }

    return true;
  });

  // Calculate stats
  let doing = 0, done = 0, overdue = 0, sumKH = 0, sumTH = 0;
  filtered.forEach(t => {
    sumKH += parseFloat(t['Kế hoạch']) || 0;
    sumTH += parseFloat(t['Thực hiện']) || 0;
    const st = (t['Trạng thái'] || '').toLowerCase();
    if (st.includes('hoàn thành')) done++;
    else if (st.includes('quá hạn')) overdue++;
    else doing++;
  });

  // Update KPI Cards
  document.getElementById('report-kpi-total').innerText = filtered.length;
  document.getElementById('report-kpi-doing').innerText = doing;
  document.getElementById('report-kpi-done').innerText = done;
  document.getElementById('report-kpi-overdue').innerText = overdue;

  // Render Table
  const tbody = document.getElementById('tbody-report');
  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="16" style="text-align: center; color: var(--text-muted); padding: 2rem;">Không tìm thấy công việc phù hợp với bộ lọc ngày</td></tr>`;
  } else {
    filtered.forEach((t, idx) => {
      const kh = parseFloat(t['Kế hoạch']) || 0;
      const th = parseFloat(t['Thực hiện']) || 0;
      const ratio = kh > 0 ? Math.min(Math.round((th / kh) * 100), 100) : (th > 0 ? 100 : 0);

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td style="font-weight: 600; min-width: 180px; color: #e2e8f0;">
          <span style="color: #94a3b8;">${idx + 1}.</span> ${escapeHtml(t['Tiêu đề'] || '')}
        </td>
        <td style="min-width: 220px; font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(t['Mô tả'] || '')}</td>
        <td>${getStatusBadgeHTML(t['Trạng thái'])}</td>
        <td>${escapeHtml(t['Lãnh đạo'] || '-')}</td>
        <td><span class="badge" style="background: rgba(255, 255, 255, 0.08); color: #e2e8f0;">${escapeHtml(t['Tổ chủ trì (AR)'] || '-')}</span></td>
        <td><strong style="color: #fff;">${escapeHtml(t['Tên NV (A)'] || '-')}</strong></td>
        <td>${escapeHtml(t['Tên NV (R)'] || '-')}</td>
        <td>${escapeHtml(t['Tên NV (C)'] || '-')}</td>
        <td>${escapeHtml(t['Ngày bắt đầu'] || '-')}</td>
        <td>${escapeHtml(t['Ngày kết thúc'] || '-')}</td>
        <td>${escapeHtml(t['Ngày làm xong'] || '-')}</td>
        <td>${kh}</td>
        <td>${th}</td>
        <td><strong style="color: var(--accent-emerald);">${ratio}%</strong></td>
        <td style="max-width: 200px;">${escapeHtml(t['Ghi chú'] || '-')}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Footer summary
  const tfoot = document.getElementById('tfoot-report');
  if (tfoot) {
    const avgRatio = sumKH > 0 ? Math.min(Math.round((sumTH / sumKH) * 100), 100) : (sumTH > 0 ? 100 : 0);
    tfoot.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: right; font-weight: 700; color: #a7f3d0;">TỔNG CỘNG (${filtered.length} VIỆC):</td>
        <td colspan="9" style="font-size: 0.8rem; color: #cbd5e1;">Hoàn thành: <strong style="color:var(--accent-emerald);">${done}</strong> | Quá hạn: <strong style="color:var(--accent-rose);">${overdue}</strong></td>
        <td style="font-weight: 800; color: #fff;">${sumKH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${sumTH}</td>
        <td style="font-weight: 800; color: var(--accent-emerald);">${avgRatio}%</td>
        <td></td>
      </tr>
    `;
  }
}

function isDateInRange(dateStr, fromDate, toDate) {
  const d = parseDateStr(dateStr);
  if (!d) return false;
  d.setHours(0, 0, 0, 0);

  if (fromDate) {
    const f = new Date(fromDate);
    f.setHours(0, 0, 0, 0);
    if (d < f) return false;
  }
  if (toDate) {
    const t = new Date(toDate);
    t.setHours(23, 59, 59, 999);
    if (d > t) return false;
  }
  return true;
}

function populateReportDropdowns() {
  const arSelect = document.getElementById('report-filter-ar');
  const nvaSelect = document.getElementById('report-filter-nva');

  if (!arSelect || arSelect.options.length > 1) return;

  const arTeams = new Set();
  const nvASet = new Set();

  state.tasks.forEach(t => {
    if (t['Tổ chủ trì (AR)']) arTeams.add(t['Tổ chủ trì (AR)']);
    if (t['Tên NV (A)']) nvASet.add(t['Tên NV (A)']);
  });

  fillSelect('report-filter-ar', Array.from(arTeams), 'Tất cả Tổ chủ trì');
  fillSelect('report-filter-nva', Array.from(nvASet), 'Tất cả NV (A)');
}

function exportReportExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('Thư viện XLSX chưa sẵn sàng', 'error');
    return;
  }

  const fromDate = document.getElementById('report-from-date')?.value || '';
  const toDate = document.getElementById('report-to-date')?.value || '';
  const dateType = document.getElementById('report-date-type')?.value || 'start';
  const arTeam = document.getElementById('report-filter-ar')?.value || '';
  const nvA = document.getElementById('report-filter-nva')?.value || '';
  const status = document.getElementById('report-filter-status')?.value || '';

  const filtered = state.tasks.filter(t => {
    let targetDateStr = '';
    if (dateType === 'start') targetDateStr = t['Ngày bắt đầu'];
    else if (dateType === 'done') targetDateStr = t['Ngày làm xong'];
    else targetDateStr = t['Ngày kết thúc'] || t['Hạn hoàn thành'];

    if ((fromDate || toDate) && !isDateInRange(targetDateStr, fromDate, toDate)) return false;
    if (arTeam && t['Tổ chủ trì (AR)'] !== arTeam) return false;
    if (nvA && t['Tên NV (A)'] !== nvA) return false;
    if (status && !(t['Trạng thái'] || '').toLowerCase().includes(status.toLowerCase())) return false;
    return true;
  });

  if (filtered.length === 0) {
    showToast('Không có dữ liệu để xuất Excel', 'warning');
    return;
  }

  const exportData = filtered.map((t, idx) => ({
    'STT': idx + 1,
    'Tiêu đề công việc': t['Tiêu đề'] || '',
    'Mô tả': t['Mô tả'] || '',
    'Trạng thái': t['Trạng thái'] || '',
    'Lãnh đạo': t['Lãnh đạo'] || '',
    'Tổ chủ trì (AR)': t['Tổ chủ trì (AR)'] || '',
    'Tên NV (A)': t['Tên NV (A)'] || '',
    'Tên NV (R)': t['Tên NV (R)'] || '',
    'Tên NV (C)': t['Tên NV (C)'] || '',
    'Ngày bắt đầu': t['Ngày bắt đầu'] || '',
    'Hạn hoàn thành': t['Ngày kết thúc'] || '',
    'Ngày làm xong': t['Ngày làm xong'] || '',
    'Kế hoạch': t['Kế hoạch'] || 0,
    'Thực hiện': t['Thực hiện'] || 0,
    'Ghi chú': t['Ghi chú'] || ''
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_Cong_Viec');
  XLSX.writeFile(wb, `Bao_Cao_Cong_Viec_${Date.now()}.xlsx`);
  showToast(`Đã xuất báo cáo ${filtered.length} công việc ra file Excel!`, 'success');
}
