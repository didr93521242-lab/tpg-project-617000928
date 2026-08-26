/* ----------------------------------------------------
   轉爐石台北港專案 (617000928) - Web Dashboard Engine
   Full Front-End Local Excel Parser, KPI & Chart Manager
   Includes Ship Voyage (船次作業進度) Analytics Engine
   ---------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  if (window.lucide) {
    lucide.createIcons();
  }

  // State Management
  const state = {
    rawWorkbook: null,
    sheetNames: [],
    currentSheet: null,
    rawRecords: [],
    filteredRecords: [],
    voyages: [], // Array of clustered ship voyage objects
    selectedVoyageIndex: 0,
    selectedYear: 'ALL', // Year filter: 'ALL' | '2024' | '2025' ...
    currentView: 'overview', // 'overview' | 'voyage'
    currentPage: 1,
    pageSize: 30,
    charts: {},
    isDarkMode: true,
    columnMap: {
      // 日期欄位別名（按優先順序）—若你的 Excel 或 API 欄位名稱不在此列，請加入
      date: ['日期A', '過磅日期', '日期', '出場日期', '進場日期', '作業日期', '稱重日期', '出廠日期',
             '報表日期', '計量日期', '時間', '日期時間', 'Date', 'date', 'DateTime'],
      truck: ['車號', '車牌', '車牌號碼', '車輛號碼', '車輛', '拖車號', '拖板車號', 'Truck', 'truck'],
      netWeight: ['出貨量A', '淨重', '淨重(kg)', '淨重(KG)', '淨重(噸)', '淨重(公噸)', '凈重',
                  '出貨量', '出貨量(噸)', '出貨量(kg)',
                  '裝船量', '裝船淨重', '卡數量', '數量',
                  'NetWeight', '實重', '重量'],
      grossWeight: ['毛重', '毛重(kg)', '毛重(KG)', '毛重(噸)', 'GrossWeight'],
      tareWeight: ['空重', '皮重', '空重(kg)', '空重(KG)', '空重(噸)', 'TareWeight'],
      ticketNo: ['出廠單號', '過磅單號', '磅單號', '單號', '序號', '編號', 'TicketNo', 'No'],
      customer: ['客戶名稱', '客戶', '廠商', '運送單位', '進貨單位', '收貨單位', '交貨廠', '交貨別', '出貨廠'],
      time: ['出廠時間A', '出廠時間', '出場時間A', '出場時間', '進場時間', '過磅時間', '時間', 'Time', 'time', 'TimeString']
    }
  };

  // DOM Element References
  const elements = {
    loadingOverlay: document.getElementById('loadingOverlay'),
    loadingText: document.getElementById('loadingText'),
    btnApiSync: document.getElementById('btnApiSync'),
    btnApiConfig: document.getElementById('btnApiConfig'),
    apiConfigModal: document.getElementById('apiConfigModal'),
    btnCloseApiModal: document.getElementById('btnCloseApiModal'),
    apiUrlInput: document.getElementById('apiUrlInput'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    apiCacheTtlSelect: document.getElementById('apiCacheTtlSelect'),
    cacheStatusText: document.getElementById('cacheStatusText'),
    btnClearApiCache: document.getElementById('btnClearApiCache'),
    btnForceRefreshApi: document.getElementById('btnForceRefreshApi'),
    btnResetApiUrl: document.getElementById('btnResetApiUrl'),
    btnSaveAndFetchApi: document.getElementById('btnSaveAndFetchApi'),
    btnSyncFixedFolder: document.getElementById('btnSyncFixedFolder'),
    btnPickFolder: document.getElementById('btnPickFolder'),
    btnPickFiles: document.getElementById('btnPickFiles'),
    btnLoadDemo: document.getElementById('btnLoadDemo'),
    folderInput: document.getElementById('folderInput'),
    fileInput: document.getElementById('fileInput'),
    sheetTabs: document.getElementById('sheetTabs'),
    btnThemeToggle: document.getElementById('btnThemeToggle'),
    themeIcon: document.getElementById('themeIcon'),
    searchInput: document.getElementById('searchInput'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    yearSelect: document.getElementById('yearSelect'),
    
    // Page View Switch Tabs
    tabOverview: document.getElementById('tabOverview'),
    tabVoyage: document.getElementById('tabVoyage'),
    tabVoyageRate: document.getElementById('tabVoyageRate'),
    overviewView: document.getElementById('overviewView'),
    voyageView: document.getElementById('voyageView'),
    voyageRateView: document.getElementById('voyageRateView'),

    // Voyage Controls & Badges
    voyageSelect: document.getElementById('voyageSelect'),
    badgeVoyageDates: document.getElementById('badgeVoyageDates'),
    badgeVoyageDuration: document.getElementById('badgeVoyageDuration'),
    badgeVoyageTrips: document.getElementById('badgeVoyageTrips'),
    
    // Overview KPI Elements
    kpiTotalWeight: document.getElementById('kpiTotalWeight'),
    kpiTotalTrips: document.getElementById('kpiTotalTrips'),
    kpiAvgWeight: document.getElementById('kpiAvgWeight'),
    kpiUniqueTrucks: document.getElementById('kpiUniqueTrucks'),
    kpiYearlyWeightList: document.getElementById('kpiYearlyWeightList'),
    kpiSubYearlyWeight: document.getElementById('kpiSubYearlyWeight'),
    
    // Voyage KPI Elements
    vKpiTotalWeight: document.getElementById('vKpiTotalWeight'),
    vKpiPeakDay: document.getElementById('vKpiPeakDay'),
    vKpiPeakDayDate: document.getElementById('vKpiPeakDayDate'),
    vKpiPeakHour: document.getElementById('vKpiPeakHour'),
    vKpiPeakHourTrips: document.getElementById('vKpiPeakHourTrips'),
    vKpiAvgHourlyRate: document.getElementById('vKpiAvgHourlyRate'),
    vKpiSubAvgHourlyRate: document.getElementById('vKpiSubAvgHourlyRate'),
    vKpiTrucksCount: document.getElementById('vKpiTrucksCount'),
    vKpiAvgTripsPerTruck: document.getElementById('vKpiAvgTripsPerTruck'),
    vHourlyDateSelect: document.getElementById('vHourlyDateSelect'),
    vHourlyRateSubtitle: document.getElementById('vHourlyRateSubtitle'),

    // Long-Term Voyage Rate Elements
    btnExportRateCSV: document.getElementById('btnExportRateCSV'),
    vrKpiAvgRate: document.getElementById('vrKpiAvgRate'),
    vrKpiSubAvgRate: document.getElementById('vrKpiSubAvgRate'),
    vrKpiMaxRate: document.getElementById('vrKpiMaxRate'),
    vrKpiSubMaxRate: document.getElementById('vrKpiSubMaxRate'),
    vrKpiPeakHourRate: document.getElementById('vrKpiPeakHourRate'),
    vrKpiSubPeakHour: document.getElementById('vrKpiSubPeakHour'),
    vrKpiTotalVoyages: document.getElementById('vrKpiTotalVoyages'),
    vrKpiSubTotalHours: document.getElementById('vrKpiSubTotalHours'),
    vrTableRowCount: document.getElementById('vrTableRowCount'),
    vrSearchInput: document.getElementById('vrSearchInput'),
    vrTableBody: document.getElementById('vrTableBody'),

    // Table Elements
    tableHeaderRow: document.getElementById('tableHeaderRow'),
    tableBody: document.getElementById('tableBody'),
    tableRowCount: document.getElementById('tableRowCount'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    pageInfo: document.getElementById('pageInfo'),

    // Voyage Table
    vTruckEfficiencyTableBody: document.getElementById('vTruckEfficiencyTableBody'),

    // Media Card
    cardPhotoPreview: document.getElementById('cardPhotoPreview')
  };

  // --- Theme Setup ---
  function setupTheme() {
    elements.btnThemeToggle?.addEventListener('click', () => {
      state.isDarkMode = !state.isDarkMode;
      document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
      elements.themeIcon?.setAttribute('data-lucide', state.isDarkMode ? 'moon' : 'sun');
      if (window.lucide) lucide.createIcons();
      updateChartsTheme();
    });
  }

  // --- View Switcher Setup ---
  function setupViewTabs() {
    elements.tabOverview?.addEventListener('click', () => switchView('overview'));
    elements.tabVoyage?.addEventListener('click', () => switchView('voyage'));
    elements.tabVoyageRate?.addEventListener('click', () => switchView('voyageRate'));
  }

  function switchView(viewName) {
    state.currentView = viewName;

    if (elements.tabOverview) elements.tabOverview.classList.toggle('active', viewName === 'overview');
    if (elements.tabVoyage) elements.tabVoyage.classList.toggle('active', viewName === 'voyage');
    if (elements.tabVoyageRate) elements.tabVoyageRate.classList.toggle('active', viewName === 'voyageRate');

    if (elements.overviewView) elements.overviewView.classList.toggle('hidden', viewName !== 'overview');
    if (elements.voyageView) elements.voyageView.classList.toggle('hidden', viewName !== 'voyage');
    if (elements.voyageRateView) elements.voyageRateView.classList.toggle('hidden', viewName !== 'voyageRate');

    if (viewName === 'overview') {
      updateOverviewCharts();
    } else if (viewName === 'voyage') {
      renderVoyageDashboard();
    } else if (viewName === 'voyageRate') {
      renderVoyageRateDashboard();
    }
  }

  function showLoading(text = '正在讀取數據...') {
    if (elements.loadingOverlay) {
      elements.loadingText.textContent = text;
      elements.loadingOverlay.classList.add('active');
    }
  }

  function hideLoading() {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.remove('active');
    }
  }

  // --- IndexedDB Fixed Folder Persistence Engine ---
  const IDB_NAME = 'TPG_Project_DB';
  const IDB_STORE = 'dir_handles';
  const HANDLE_KEY = 'fixed_project_dir_handle';

  function openIDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function saveDirectoryHandle(handle) {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(handle, HANDLE_KEY);
      return new Promise((resolve) => tx.oncomplete = resolve);
    } catch (err) {
      console.warn('IndexedDB saveDirectoryHandle failed:', err);
    }
  }

  async function getSavedDirectoryHandle() {
    try {
      const db = await openIDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const request = tx.objectStore(IDB_STORE).get(HANDLE_KEY);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('IndexedDB getSavedDirectoryHandle failed:', err);
      return null;
    }
  }

  async function scanFilesFromHandle(dirHandle) {
    showLoading('正在掃描與讀取數據資料夾...');
    try {
      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls') || entry.name.endsWith('.csv'))) {
          if (!entry.name.startsWith('~$')) {
            const file = await entry.getFile();
            files.push(file);
          }
        }
      }
      if (files.length > 0) {
        document.getElementById('pathBannerText').textContent = 'H:\\我的雲端硬碟\\APPsheet\\data\\轉爐石台北港專案-617000928';
        await saveDirectoryHandle(dirHandle);
        await processFiles(files);
      } else {
        alert('所選資料夾內未找到過磅 Excel (.xlsx) 或 CSV 檔案。');
        hideLoading();
      }
    } catch (err) {
      console.error('[scanFilesFromHandle] Error:', err);
      alert('讀取資料夾失敗：' + err.message);
      hideLoading();
    }
  }

  async function syncOrPickFixedFolder() {
    if (!('showDirectoryPicker' in window)) {
      elements.folderInput.click();
      return;
    }
    const savedHandle = await getSavedDirectoryHandle();
    if (savedHandle) {
      try {
        const perm = await savedHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          await scanFilesFromHandle(savedHandle);
          return;
        }
        const reqPerm = await savedHandle.requestPermission({ mode: 'read' });
        if (reqPerm === 'granted') {
          await scanFilesFromHandle(savedHandle);
          return;
        }
      } catch (err) {
        console.warn('Re-using saved handle failed:', err);
      }
    }
    try {
      const dirHandle = await window.showDirectoryPicker();
      await scanFilesFromHandle(dirHandle);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('showDirectoryPicker failed, fallback to input', err);
        elements.folderInput.click();
      } else {
        hideLoading();
      }
    }
  }

  async function initAutoLoadFixedFolder() {
    if (!('showDirectoryPicker' in window)) return;
    const savedHandle = await getSavedDirectoryHandle();
    if (savedHandle) {
      try {
        const perm = await savedHandle.queryPermission({ mode: 'read' });
        if (perm === 'granted') {
          console.log('[AutoLoad] 找到已授權的固定資料夾 Handle，自動讀取中...');
          await scanFilesFromHandle(savedHandle);
        }
      } catch (err) {
        console.warn('[AutoLoad] Auto load handle failed:', err);
      }
    }
  }

  // --- Event Listeners Setup ---
  function setupEvents() {
    // 0. API Sync & Config Modal
    elements.btnApiSync?.addEventListener('click', () => {
      fetchAndLoadApiData(getSavedApiUrl(), getSavedApiKey(), { force: false });
    });

    elements.btnApiConfig?.addEventListener('click', async () => {
      if (elements.apiUrlInput) elements.apiUrlInput.value = getSavedApiUrl();
      if (elements.apiKeyInput) elements.apiKeyInput.value = getSavedApiKey();
      if (elements.apiCacheTtlSelect) elements.apiCacheTtlSelect.value = getSavedCacheTtl();
      await updateCacheStatusUI();
      if (elements.apiConfigModal) elements.apiConfigModal.style.display = 'flex';
    });

    elements.btnCloseApiModal?.addEventListener('click', () => {
      if (elements.apiConfigModal) elements.apiConfigModal.style.display = 'none';
    });

    elements.apiConfigModal?.addEventListener('click', (e) => {
      if (e.target === elements.apiConfigModal) {
        elements.apiConfigModal.style.display = 'none';
      }
    });

    elements.btnResetApiUrl?.addEventListener('click', () => {
      if (elements.apiUrlInput) elements.apiUrlInput.value = DEFAULT_API_URL;
      if (elements.apiKeyInput) elements.apiKeyInput.value = DEFAULT_API_KEY;
      if (elements.apiCacheTtlSelect) elements.apiCacheTtlSelect.value = '1800000';
    });

    elements.btnClearApiCache?.addEventListener('click', async () => {
      await clearApiCache();
      await updateCacheStatusUI();
      alert('✅ 本地 IndexedDB 數據快取已成功清除！');
    });

    elements.btnForceRefreshApi?.addEventListener('click', () => {
      const url = elements.apiUrlInput?.value.trim() || DEFAULT_API_URL;
      const key = elements.apiKeyInput?.value.trim() || DEFAULT_API_KEY;
      const ttl = elements.apiCacheTtlSelect?.value || '1800000';
      localStorage.setItem('TPG_API_URL', url);
      localStorage.setItem('TPG_API_KEY', key);
      localStorage.setItem('TPG_CACHE_TTL', ttl);
      if (elements.apiConfigModal) elements.apiConfigModal.style.display = 'none';
      fetchAndLoadApiData(url, key, { force: true });
    });

    elements.btnSaveAndFetchApi?.addEventListener('click', () => {
      const url = elements.apiUrlInput?.value.trim() || DEFAULT_API_URL;
      const key = elements.apiKeyInput?.value.trim() || DEFAULT_API_KEY;
      const ttl = elements.apiCacheTtlSelect?.value || '1800000';
      localStorage.setItem('TPG_API_URL', url);
      localStorage.setItem('TPG_API_KEY', key);
      localStorage.setItem('TPG_CACHE_TTL', ttl);
      if (elements.apiConfigModal) elements.apiConfigModal.style.display = 'none';
      fetchAndLoadApiData(url, key, { force: false });
    });

    // 1. Sync & Folder Pickers
    elements.btnSyncFixedFolder?.addEventListener('click', syncOrPickFixedFolder);
    elements.btnPickFolder?.addEventListener('click', syncOrPickFixedFolder);

    elements.folderInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files).filter(f => !f.name.startsWith('~$'));
      if (files.length > 0) processFiles(files);
    });

    // 2. Pick Files
    elements.btnPickFiles.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files).filter(f => !f.name.startsWith('~$'));
      if (files.length > 0) processFiles(files);
    });

    // 3. Load Demo Data
    elements.btnLoadDemo.addEventListener('click', () => {
      loadDemoData();
    });

    // 4. Search Input & Year Filter Input
    elements.searchInput?.addEventListener('input', () => {
      filterRecords();
    });

    elements.yearSelect?.addEventListener('change', (e) => {
      state.selectedYear = e.target.value;
      clusterVoyages(); // 年份切換時同步更新船次選單
      filterRecords();
      if (state.currentView === 'voyage') {
        renderVoyageDashboard();
      } else if (state.currentView === 'voyageRate') {
        renderVoyageRateDashboard();
      }
    });

    // 5. Page Size & Pagination
    elements.pageSizeSelect.addEventListener('change', (e) => {
      state.pageSize = parseInt(e.target.value, 10);
      state.currentPage = 1;
      renderTable();
    });

    elements.btnPrevPage.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });

    elements.btnNextPage.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filteredRecords.length / state.pageSize) || 1;
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderTable();
      }
    });

    // 6. CSV Exports
    elements.btnExportCSV.addEventListener('click', exportCSV);
    elements.btnExportRateCSV?.addEventListener('click', exportVoyageRateCSV);

    // 7. Voyage Selection Change & Hourly Rate Date Selector
    elements.voyageSelect.addEventListener('change', (e) => {
      state.selectedVoyageIndex = parseInt(e.target.value, 10) || 0;
      renderVoyageDashboard();
    });

    elements.vHourlyDateSelect?.addEventListener('change', () => {
      const voyage = state.voyages[state.selectedVoyageIndex];
      if (voyage) renderVoyageHourlyAvgRateChart(voyage);
    });

    // 8. Long-Term Voyage Rate Search
    elements.vrSearchInput?.addEventListener('input', () => {
      if (state.currentView === 'voyageRate') {
        renderVoyageRateDashboard();
      }
    });

    // 9. Table Header Sort Listeners for Long-Term Voyage Rate Table
    const setupHeaderSort = (id, field) => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (state.vrSortField === field) {
          state.vrSortAsc = !state.vrSortAsc;
        } else {
          state.vrSortField = field;
          state.vrSortAsc = false;
        }
        renderVoyageRateDashboard();
      });
    };

    setupHeaderSort('thVrName', 'name');
    setupHeaderSort('thVrDates', 'startDate');
    setupHeaderSort('thVrDays', 'durationDays');
    setupHeaderSort('thVrHours', 'activeHours');
    setupHeaderSort('thVrTrips', 'totalTrips');
    setupHeaderSort('thVrWeight', 'totalWeightTons');
    setupHeaderSort('thVrRate', 'avgHourlyRateTons');
    setupHeaderSort('thVrTripsRate', 'avgHourlyTrips');
    setupHeaderSort('thVrPeak', 'peakHourWeight');

    // 10. Photo Preview
    elements.cardPhotoPreview?.addEventListener('click', () => {
      alert('專案相片 208047.jpg: 台北港轉爐石過磅裝船現場紀錄。');
    });
  }

  const MERGED_TAB_NAME = '🌐 跨時期數據合併 (全專案彙總)';

  // --- Process Loaded Files (load ALL files, merge sheets) ---
  // 僅保留含有日期欄位的工作表；其他工作表（如「每日水呎」、「樞紐」等）一律略過
  async function processFiles(files) {
    showLoading('正在解析過磅數據報表...');
    try {
      const allSheets    = {};  // 所有讀到的工作表（含非資料表）
      const allSheetNames = [];

      for (const file of files) {
        if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) continue;
        console.log('[processFiles] Reading:', file.name, 'Size:', file.size);
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        console.log('[processFiles] Sheets in', file.name, ':', wb.SheetNames);

        wb.SheetNames.forEach(sn => {
          const label = files.length > 1 ? `${file.name.replace(/\.xlsx?$/i, '')} - ${sn}` : sn;
          allSheets[label] = wb.Sheets[sn];
          allSheetNames.push(label);
        });
      }

      // --- 過濾：只保留含有日期欄位的工作表 ---
      const mergedSheets    = {};
      const mergedSheetNames = [];

      allSheetNames.forEach(label => {
        const ws    = allSheets[label];
        const probe = smartReadSheet(ws);
        if (probe && probe.length > 0) {
          const dateKey = getColumnKey(probe, state.columnMap.date);
          if (dateKey) {
            mergedSheets[label] = ws;
            mergedSheetNames.push(label);
            console.log('[processFiles] ✅ 保留工作表:', label, '(日期欄位:', dateKey, ')');
          } else {
            console.log('[processFiles] ⏭️ 略過工作表:', label, '(無日期欄位)');
          }
        } else {
          console.log('[processFiles] ⏭️ 略過工作表:', label, '(無有效資料)');
        }
      });

      if (mergedSheetNames.length === 0) {
        alert('⚠️ 此 Excel 檔案中找不到含有日期欄位的工作表。\n\n請確認資料工作表的欄位名稱包含「過磅日期」、「日期」、「日期A」等關鍵字。');
        hideLoading();
        return;
      }

      state.rawWorkbook  = { Sheets: mergedSheets, SheetNames: mergedSheetNames };

      if (mergedSheetNames.length > 1) {
        state.sheetNames = [MERGED_TAB_NAME, ...mergedSheetNames];
        console.log('[processFiles] 啟動跨時期合併模式，工作表清單:', state.sheetNames);
        renderSheetTabs();
        loadSheet(MERGED_TAB_NAME);
      } else {
        state.sheetNames = mergedSheetNames;
        console.log('[processFiles] 有效工作表:', mergedSheetNames);
        renderSheetTabs();
        loadSheet(mergedSheetNames[0]);
      }
    } catch (err) {
      console.error('Failed to parse excel file:', err);
      alert('讀取 Excel 檔案失敗，請確認檔案格式是否正確。\n錯誤: ' + err.message);
    } finally {
      hideLoading();
    }
  }

  // --- Render Sheet Switcher Tabs ---
  function renderSheetTabs() {
    elements.sheetTabs.innerHTML = '';
    state.sheetNames.forEach((name, index) => {
      const tab = document.createElement('div');
      const isActive = (state.currentSheet && state.currentSheet === name) || (!state.currentSheet && index === 0);
      const isMergedTab = (name === MERGED_TAB_NAME);
      tab.className = `sheet-tab ${isActive ? 'active' : ''} ${isMergedTab ? 'sheet-tab-merged' : ''}`;
      tab.textContent = name;
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadSheet(name);
      });
      elements.sheetTabs.appendChild(tab);
    });
  }

  // --- Smart Sheet Reader: 自動偵測正確標题列 ---
  // 解決工作表第一列為合併標題列（__EMPTY欄位）的問題
  // 會自動嘗試從第 0, 1, 2, 3, 4 列發展，直到找到含有日期欄位的誐
  function smartReadSheet(ws) {
    const allAliases = [
      ...state.columnMap.date,
      ...state.columnMap.truck,
      ...state.columnMap.netWeight,
      ...state.columnMap.grossWeight,
      ...state.columnMap.tareWeight
    ];

    // 嘗試從第 0~4 列發展讀取
    for (let offset = 0; offset <= 4; offset++) {
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true, range: offset });
      if (!json || json.length === 0) continue;
      const keys = Object.keys(json[0]);

      // 排除 __EMPTY 欄位占大多數的情況（表示程序拤到標題合併列）
      const emptyRatio = keys.filter(k => k.startsWith('__EMPTY')).length / keys.length;
      if (emptyRatio > 0.5) {
        console.log(`[smartReadSheet] offset=${offset} 標題列為合併列，跳過...`);
        continue;
      }

      // 檢查是否有任何欄位匹配已知別名
      const hasKnownCol = allAliases.some(alias =>
        keys.some(k => k.trim().toLowerCase().includes(alias.toLowerCase()))
      );

      if (hasKnownCol || offset === 0) {
        if (offset > 0) {
          console.log(`[smartReadSheet] 成功跳過 ${offset} 列標題，實際欄位:`, keys);
        }
        return json;
      }
    }

    // 最後備援：從第 0 列讀
    return XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true });
  }

  // --- Load & Parse Selected Sheet ---
  function loadSheet(sheetName) {
    const isMerged = (sheetName === MERGED_TAB_NAME);
    showLoading(isMerged ? '跨時期數據合併計算中...' : `解析工作表: ${sheetName}...`);
    setTimeout(() => {
      state.currentSheet = sheetName;
      let json = [];

      if (isMerged) {
        // 合併所有有效工作表之數據，並標記資料來源
        const validSheetLabels = Object.keys(state.rawWorkbook.Sheets);
        validSheetLabels.forEach(label => {
          const ws = state.rawWorkbook.Sheets[label];
          const rows = smartReadSheet(ws);
          rows.forEach(r => {
            json.push({
              '資料來源': label,
              ...r
            });
          });
        });
        console.log('[loadSheet] 🌐 跨時期數據合併完成，總筆數:', json.length);
      } else {
        const ws = state.rawWorkbook.Sheets[sheetName];
        json = smartReadSheet(ws);
      }

      state.rawRecords = json;
      state.filteredRecords = [...json];
      state.currentPage = 1;

      // --- 偵錯：在 Console 輸出欄位資訊 ---
      const detectedKeys = json.length > 0 ? Object.keys(json[0]) : [];
      const dateKey  = getColumnKey(json, state.columnMap.date);
      const netKey   = getColumnKey(json, state.columnMap.netWeight);
      const truckKey = getColumnKey(json, state.columnMap.truck);
      console.group(`%c[loadSheet] 工作表: ${sheetName}`, 'color:#4CAF50;font-weight:bold');
      console.log('總筆數:', json.length);
      console.log('偵測到欄位:', detectedKeys);
      console.log('日期欄位:', dateKey  || '❌ 未找到');
      console.log('淨重欄位:', netKey   || '❌ 未找到');
      console.log('車號欄位:', truckKey || '❌ 未找到');
      console.log('前 3 筆:', json.slice(0, 3));
      console.groupEnd();

      // 日期欄位未找到 → 警告提示實際欄位名稱
      if (json.length > 0 && !dateKey) {
        alert(`⚠️ 工作表「${sheetName}」無法偵測日期欄位。\n\n` +
              `偵測到的欄位名稱為：\n${detectedKeys.join('、')}\n\n` +
              `請切換到包含過磅資料的工作表，\n` +
              `或告知實際日期欄位名稱以便修正設定。`);
      }

      renderYearSelectOptions();
      filterRecords();
      clusterVoyages();
      switchView(state.currentView || 'overview');
      hideLoading();
    }, 50);
  }

  // --- Dynamic Year Filter Options Generator ---
  function renderYearSelectOptions() {
    if (!elements.yearSelect) return;
    const records = state.rawRecords;
    const dateKey = getColumnKey(records, state.columnMap.date);

    const yearsSet = new Set();
    if (dateKey && records.length > 0) {
      records.forEach(r => {
        if (r[dateKey]) {
          const d = robustParseDate(r[dateKey]);
          if (d) {
            yearsSet.add(d.getFullYear());
          }
        }
      });
    }

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a); // 年份降冪 (最新年份在前)

    elements.yearSelect.innerHTML = '';
    
    // 預設選項：跨年度總覽
    const optAll = document.createElement('option');
    optAll.value = 'ALL';
    optAll.style.background = '#1e293b';
    optAll.style.color = '#f8fafc';
    optAll.textContent = `🗓️ 全部年份 (跨年度總覽 ${records.length.toLocaleString()} 筆)`;
    elements.yearSelect.appendChild(optAll);

    sortedYears.forEach(year => {
      const opt = document.createElement('option');
      opt.value = String(year);
      opt.style.background = '#1e293b';
      opt.style.color = '#f8fafc';
      const rocYear = year - 1911; // 顯示民國年對照
      opt.textContent = `📅 ${year} 年 (民國 ${rocYear} 年)`;
      elements.yearSelect.appendChild(opt);
    });

    if (state.selectedYear && sortedYears.includes(parseInt(state.selectedYear, 10))) {
      elements.yearSelect.value = state.selectedYear;
    } else {
      state.selectedYear = 'ALL';
      elements.yearSelect.value = 'ALL';
    }
  }

  // --- Master Record Filter (Year + Search Text) ---
  function filterRecords() {
    const selectedYear = state.selectedYear || 'ALL';
    const query = (elements.searchInput?.value || '').toLowerCase().trim();
    const dateKey = getColumnKey(state.rawRecords, state.columnMap.date);

    let filtered = state.rawRecords;

    // 1. 按選定年份篩選
    if (selectedYear !== 'ALL') {
      const targetYear = parseInt(selectedYear, 10);
      filtered = filtered.filter(r => {
        if (!dateKey || !r[dateKey]) return false;
        const d = robustParseDate(r[dateKey]);
        return d && d.getFullYear() === targetYear;
      });
    }

    // 2. 按關鍵字過濾
    if (query) {
      filtered = filtered.filter(r =>
        Object.values(r).some(val => {
          if (val === null || val === undefined) return false;
          if (val instanceof Date) {
            const yyyy = val.getFullYear();
            const mm = String(val.getMonth() + 1).padStart(2, '0');
            const dd = String(val.getDate()).padStart(2, '0');
            const str1 = `${yyyy}/${mm}/${dd}`;
            const str2 = `${yyyy}-${mm}-${dd}`;
            const str3 = `${yyyy - 1911}/${mm}/${dd}`;
            return str1.includes(query) || str2.includes(query) || str3.includes(query) || String(val).toLowerCase().includes(query);
          }
          return String(val).toLowerCase().includes(query);
        })
      );
    }

    state.filteredRecords = filtered;
    state.currentPage = 1;

    updateOverviewKPIs();
    updateOverviewCharts();
    renderTable();
  }

  // --- Detect Key Columns ---
  function getColumnKey(records, aliases) {
    if (!records || records.length === 0) return null;
    const keys = Object.keys(records[0]);
    for (const alias of aliases) {
      const matched = keys.find(k => k.trim().toLowerCase().includes(alias.toLowerCase()));
      if (matched) return matched;
    }
    return null;
  }

  // --- Robust Multi-Format Date Parser ---
  // Handles:
  //   JS Date objects, Excel serial numbers,
  //   ROC compact: 1140916 (YYYMMDD = 民國114年09月16日)
  //   ROC with separators: 113/03/12, 113-03-12
  //   Standard: 2024/03/12, 2024-03-12
  //   With optional time: 113/03/12 08:30, 2024-03-12 08:30:00
  function robustParseDate(val) {
    if (!val && val !== 0) return null;

    // 1. Already a JS Date object (from SheetJS cellDates mode)
    if (val instanceof Date && !isNaN(val.getTime())) {
      return val;
    }

    // 2. Numeric value: could be Excel serial OR compact ROC date (YYYMMDD)
    if (typeof val === 'number') {
      // 2a. Compact ROC date: 7-digit YYYMMDD (e.g. 1140916 = 民國114/09/16 = 2025-09-16)
      //     Range: 1000101 ~ 1991231 (ROC 100~199年 = 西元2011~2110)
      if (val >= 1000101 && val <= 1991231) {
        const s = String(Math.floor(val)); // 取整數部分
        if (s.length === 7) {
          const rocYear = parseInt(s.slice(0, 3), 10); // 114
          const month   = parseInt(s.slice(3, 5), 10); // 09
          const day     = parseInt(s.slice(5, 7), 10); // 16
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const d = new Date(rocYear + 1911, month - 1, day);
            if (!isNaN(d.getTime())) return d;
          }
        }
      }
      // 2b. Compact Gregorian 8-digit: 20250916 → 2025-09-16
      if (val >= 19800101 && val <= 21001231) {
        const s = String(Math.floor(val));
        if (s.length === 8) {
          const year  = parseInt(s.slice(0, 4), 10);
          const month = parseInt(s.slice(4, 6), 10);
          const day   = parseInt(s.slice(6, 8), 10);
          if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) return d;
          }
        }
      }
      // 2c. Excel serial number (e.g. 45362)
      if (val > 1 && val < 200000) {
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + val * 86400000);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) {
          return d;
        }
      }
    }

    // 3. String-based parsing
    const str = String(val).trim();
    if (!str) return null;

    // 3a. Compact ROC date string: "1140916" or "114/09/16" style (no separator, 7 digits)
    //     Format: YYYMMDD where YYY = ROC year (100~199)
    const compactRocMatch = str.match(/^(1[0-9]{2})(\d{2})(\d{2})$/);
    if (compactRocMatch) {
      const rocYear = parseInt(compactRocMatch[1], 10);
      const month   = parseInt(compactRocMatch[2], 10);
      const day     = parseInt(compactRocMatch[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(rocYear + 1911, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // 3b. Compact Gregorian string: "20250916" (8 digits, YYYYMMDD)
    const compactGregMatch = str.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactGregMatch) {
      const year  = parseInt(compactGregMatch[1], 10);
      const month = parseInt(compactGregMatch[2], 10);
      const day   = parseInt(compactGregMatch[3], 10);
      if (year > 1980 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) return d;
      }
    }

    // 3c. ROC / 民國年 with separators: 113/03/12, 113-03-12, 113.03.12
    //     Also handles with time: 113/03/12 08:30
    const rocMatch = str.match(/^(\d{2,3})[/\-\.](\d{1,2})[/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (rocMatch) {
      let year = parseInt(rocMatch[1], 10);
      const month = parseInt(rocMatch[2], 10);
      const day = parseInt(rocMatch[3], 10);
      if (year < 200) year += 1911;
      const hour = rocMatch[4] ? parseInt(rocMatch[4], 10) : 0;
      const min  = rocMatch[5] ? parseInt(rocMatch[5], 10) : 0;
      const sec  = rocMatch[6] ? parseInt(rocMatch[6], 10) : 0;
      const d = new Date(year, month - 1, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    // 3d. Standard date formats: 2024/03/12, 2024-03-12, 2024.03.12 (with optional time)
    const stdMatch = str.match(/^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (stdMatch) {
      const d = new Date(
        parseInt(stdMatch[1], 10),
        parseInt(stdMatch[2], 10) - 1,
        parseInt(stdMatch[3], 10),
        stdMatch[4] ? parseInt(stdMatch[4], 10) : 0,
        stdMatch[5] ? parseInt(stdMatch[5], 10) : 0,
        stdMatch[6] ? parseInt(stdMatch[6], 10) : 0
      );
      if (!isNaN(d.getTime())) return d;
    }

    // 3e. Fallback: native Date.parse
    const fallback = new Date(str);
    if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1980) {
      return fallback;
    }

    return null;
  }

  // --- Apply Time (HHMMSS, HH:MM:SS, etc.) to JS Date ---
  function applyTimeToDate(d, timeVal) {
    if (!d || !(d instanceof Date) || isNaN(d.getTime())) return d;
    if (timeVal === undefined || timeVal === null || timeVal === '') return d;

    let str = String(timeVal).trim();
    if (!str) return d;

    // 1. 含冒號格式：16:51:37, 16:51
    const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (colonMatch) {
      const h = parseInt(colonMatch[1], 10);
      const m = parseInt(colonMatch[2], 10);
      const s = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
      if (h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60) {
        d.setHours(h, m, s);
      }
      return d;
    }

    // 2. 純數字 HHMMSS 格式：例如 165137 -> 16:51:37，074040 或 74040 -> 07:40:40
    if (/^\d{5,6}$/.test(str)) {
      const padded = str.padStart(6, '0');
      const h = parseInt(padded.slice(0, 2), 10);
      const m = parseInt(padded.slice(2, 4), 10);
      const s = parseInt(padded.slice(4, 6), 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60 && s >= 0 && s < 60) {
        d.setHours(h, m, s);
      }
      return d;
    }

    // 3. 純數字 HHMM 格式：例如 1651 -> 16:51:00，830 -> 08:30:00
    if (/^\d{3,4}$/.test(str)) {
      const padded = str.padStart(4, '0');
      const h = parseInt(padded.slice(0, 2), 10);
      const m = parseInt(padded.slice(2, 4), 10);
      if (h >= 0 && h < 24 && m >= 0 && m < 60) {
        d.setHours(h, m, 0);
      }
      return d;
    }

    return d;
  }

  // --- Ship Voyage Auto-Clustering Engine (船次自動分群演算法) ---
  function clusterVoyages() {
    let records = state.rawRecords;
    if (!records || records.length === 0) {
      state.voyages = [];
      return;
    }

    // 若指定年份，船次分群亦同步過濾該年份
    if (state.selectedYear && state.selectedYear !== 'ALL') {
      const targetYear = parseInt(state.selectedYear, 10);
      const dKey = getColumnKey(records, state.columnMap.date);
      if (dKey) {
        records = records.filter(r => {
          if (!r[dKey]) return false;
          const d = robustParseDate(r[dKey]);
          return d && d.getFullYear() === targetYear;
        });
      }
    }

    const dateKey = getColumnKey(records, state.columnMap.date);
    const timeKey = getColumnKey(records, state.columnMap.time);
    const netKey = getColumnKey(records, state.columnMap.netWeight);
    const truckKey = getColumnKey(records, state.columnMap.truck);

    console.log('[clusterVoyages] Detected columns -> date:', dateKey, 'time:', timeKey, 'net:', netKey, 'truck:', truckKey);
    console.log('[clusterVoyages] Total raw records:', records.length);

    if (!dateKey) {
      console.warn('[clusterVoyages] No date column found! Column keys:', records.length > 0 ? Object.keys(records[0]) : []);
      state.voyages = [];
      return;
    }

    // Sample first few date values for debugging
    const sampleDates = records.slice(0, 5).map(r => ({ raw: r[dateKey], type: typeof r[dateKey] }));
    console.log('[clusterVoyages] Sample date values:', sampleDates);

    // Filter and parse valid dates using robust parser
    const parsedRecords = [];
    let parseFails = 0;
    records.forEach((r, idx) => {
      const rawDateVal = r[dateKey];
      const rawTimeVal = timeKey ? r[timeKey] : null;
      let d = robustParseDate(rawDateVal);
      if (d) {
        if (rawTimeVal !== null && rawTimeVal !== undefined) {
          applyTimeToDate(d, rawTimeVal);
        }
        let net = netKey ? parseWeightToTons(r[netKey]) : 0;
        let truck = truckKey && r[truckKey] ? String(r[truckKey]).trim() : '未知車號';
        parsedRecords.push({
          date: d,
          dateStr: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          netWeightTons: net,
          truck: truck,
          rawRow: r
        });
      } else {
        parseFails++;
        if (parseFails <= 3) {
          console.warn('[clusterVoyages] Failed to parse date at row', idx, ':', rawDateVal, typeof rawDateVal);
        }
      }
    });

    console.log('[clusterVoyages] Successfully parsed dates:', parsedRecords.length, 'Failed:', parseFails);

    // Sort chronologically
    parsedRecords.sort((a, b) => a.date - b.date);

    if (parsedRecords.length === 0) {
      console.warn('[clusterVoyages] No records with valid dates!');
      state.voyages = [];
      return;
    }

    // --- Unique-Date Gap Clustering ---
    // Step 1: Collect all unique work dates, sorted
    const uniqueDateStrs = [...new Set(parsedRecords.map(r => r.dateStr))].sort();
    console.log('[clusterVoyages] Unique work dates found:', uniqueDateStrs.length, uniqueDateStrs.slice(0, 20));

    // Step 2: Find gaps between consecutive unique dates > 1 day
    // This is more robust than record-level gap detection
    // GAP_THRESHOLD_DAYS: 連續作業日之間的間隔門檻（天）
    // 設為 4 → 容許週末休假（最多 3 天空窗）；若間隔 > 4 天才算新船次
    // 若你的作業有多天連假或非連續作業，可調大此值（例如 7）
    const GAP_THRESHOLD_DAYS = 4;
    const voyageDateGroups = []; // each group is an array of dateStr belonging to one voyage
    let currentGroup = [uniqueDateStrs[0]];

    for (let i = 1; i < uniqueDateStrs.length; i++) {
      const prevDate = new Date(uniqueDateStrs[i - 1] + 'T00:00:00');
      const currDate = new Date(uniqueDateStrs[i] + 'T00:00:00');
      const diffDays = (currDate - prevDate) / (1000 * 60 * 60 * 24);

      if (diffDays > GAP_THRESHOLD_DAYS) {
        voyageDateGroups.push([...currentGroup]);
        currentGroup = [uniqueDateStrs[i]];
      } else {
        currentGroup.push(uniqueDateStrs[i]);
      }
    }
    if (currentGroup.length > 0) {
      voyageDateGroups.push([...currentGroup]);
    }

    console.log('[clusterVoyages] Identified voyage groups:', voyageDateGroups.length);
    voyageDateGroups.forEach((g, idx) => {
      console.log(`  Voyage ${idx + 1}: ${g[0]} ~ ${g[g.length - 1]} (${g.length} days)`);
    });

    // Step 3: Assign records to their voyage group
    const voyages = [];
    voyageDateGroups.forEach((dateGroup, groupIdx) => {
      const dateSet = new Set(dateGroup);
      const voyageRecords = parsedRecords.filter(r => dateSet.has(r.dateStr));
      if (voyageRecords.length > 0) {
        voyages.push(buildVoyageObject(voyageRecords, groupIdx + 1));
      }
    });

    // Sort voyages descending (newest voyage first)
    voyages.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    state.voyages = voyages;
    state.selectedVoyageIndex = 0;

    console.log('[clusterVoyages] Final voyages:', state.voyages.length);
    renderVoyageSelectOptions();
    saveSyncedDataSnapshot();
  }

  // --- Auto-Save Synced Data Snapshot for Mobile App (mobile.html) ---
  function saveSyncedDataSnapshot() {
    try {
      if (!state.rawRecords || state.rawRecords.length === 0) return;
      const dateKey = getColumnKey(state.rawRecords, state.columnMap.date);
      const netKey = getColumnKey(state.rawRecords, state.columnMap.netWeight);
      const truckKey = getColumnKey(state.rawRecords, state.columnMap.truck);
      const ticketKey = getColumnKey(state.rawRecords, state.columnMap.ticketNo);
      const timeKey = getColumnKey(state.rawRecords, state.columnMap.time);

      const compactRecords = [];
      state.rawRecords.forEach(r => {
        if (!dateKey || !r[dateKey]) return;
        const d = robustParseDate(r[dateKey]);
        if (d) {
          if (timeKey && r[timeKey] !== undefined) applyTimeToDate(d, r[timeKey]);
          compactRecords.push({
            d: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
            n: netKey ? parseWeightToTons(r[netKey]) : 0,
            t: truckKey && r[truckKey] ? String(r[truckKey]).trim() : '未知車號',
            tk: ticketKey && r[ticketKey] ? String(r[ticketKey]).trim() : ''
          });
        }
      });

      const snapshot = {
        timestamp: new Date().toISOString(),
        sheetName: state.currentSheet || '轉爐石過磅數據',
        recordsCount: compactRecords.length,
        voyages: (state.voyages || []).map(v => ({
          name: v.name,
          index: v.index,
          startDate: v.startDate,
          endDate: v.endDate,
          durationDays: v.durationDays,
          totalWeightTons: v.totalWeightTons,
          totalTrips: v.totalTrips,
          uniqueTrucks: v.uniqueTrucks,
          dailyMap: v.dailyMap,
          hourlyMap: v.hourlyMap,
          hourlyWeightMap: v.hourlyWeightMap,
          dateHourMap: v.dateHourMap,
          truckStatsMap: Object.fromEntries(
            Object.entries(v.truckStatsMap || {}).map(([trk, stat]) => [
              trk,
              { trips: stat.trips, weight: stat.weight, activeDaysCount: stat.days ? stat.days.size : 1 }
            ])
          )
        })),
        compactRecords: compactRecords
      };

      localStorage.setItem('tpg_synced_data', JSON.stringify(snapshot));
      console.log('[Mobile Sync] Snapshot auto-saved to localStorage (tpg_synced_data):', compactRecords.length, 'records');
    } catch (err) {
      console.warn('[Mobile Sync] Failed to save snapshot:', err);
    }
  }

  function buildVoyageObject(records, index) {
    const startDate = records[0].dateStr;
    const endDate = records[records.length - 1].dateStr;
    const uniqueDays = new Set(records.map(r => r.dateStr)).size;
    
    let totalWeightTons = 0;
    const trucksSet = new Set();
    const dailyMap = {};
    const hourlyMap = Array(24).fill(0);
    const hourlyWeightMap = Array(24).fill(0);
    const dateHourMap = {};
    const truckStatsMap = {};

    records.forEach(r => {
      totalWeightTons += r.netWeightTons;
      trucksSet.add(r.truck);

      // Daily
      dailyMap[r.dateStr] = (dailyMap[r.dateStr] || 0) + r.netWeightTons;

      // Hourly
      const h = r.date.getHours();
      hourlyMap[h]++;
      hourlyWeightMap[h] += r.netWeightTons;

      // Specific Date-Hour Breakdown
      const hourStr = `${String(h).padStart(2, '0')}:00`;
      const dhKey = `${r.dateStr} ${hourStr}`;
      if (!dateHourMap[dhKey]) {
        dateHourMap[dhKey] = { weight: 0, trips: 0, dateStr: r.dateStr, hourStr: hourStr };
      }
      dateHourMap[dhKey].weight += r.netWeightTons;
      dateHourMap[dhKey].trips++;

      // Truck Stats
      if (!truckStatsMap[r.truck]) {
        truckStatsMap[r.truck] = { trips: 0, weight: 0, days: new Set() };
      }
      truckStatsMap[r.truck].trips++;
      truckStatsMap[r.truck].weight += r.netWeightTons;
      truckStatsMap[r.truck].days.add(r.dateStr);
    });

    return {
      name: `第 ${index} 船次 (${startDate.slice(5)} ~ ${endDate.slice(5)})`,
      index: index,
      startDate: startDate,
      endDate: endDate,
      durationDays: uniqueDays,
      records: records,
      totalWeightTons: Math.round(totalWeightTons),
      totalTrips: records.length,
      uniqueTrucks: trucksSet.size,
      dailyMap: dailyMap,
      hourlyMap: hourlyMap,
      hourlyWeightMap: hourlyWeightMap,
      dateHourMap: dateHourMap,
      truckStatsMap: truckStatsMap
    };
  }

  function renderVoyageSelectOptions() {
    if (!elements.voyageSelect) return;
    elements.voyageSelect.innerHTML = '';

    if (state.voyages.length === 0) {
      elements.voyageSelect.innerHTML = '<option value="">未找到船次數據</option>';
      return;
    }

    state.voyages.forEach((v, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `🚢 ${v.name} • 累計 ${v.totalWeightTons.toLocaleString()} 噸 (${v.totalTrips} 趟)`;
      elements.voyageSelect.appendChild(opt);
    });
  }

  // --- Render Voyage Analytics Dashboard (船次專屬儀表板) ---
  function renderVoyageDashboard() {
    const voyage = state.voyages[state.selectedVoyageIndex];
    if (!voyage) return;

    // Badges & Header
    elements.badgeVoyageDates.innerHTML = `<i data-lucide="calendar" style="width:14px;"></i> ${voyage.startDate} ~ ${voyage.endDate}`;
    elements.badgeVoyageDuration.innerHTML = `<i data-lucide="clock" style="width:14px;"></i> 作業歷時 ${voyage.durationDays} 天`;
    elements.badgeVoyageTrips.innerHTML = `<i data-lucide="truck" style="width:14px;"></i> 總車次 ${voyage.totalTrips.toLocaleString()} 趟`;

    // Voyage KPIs
    elements.vKpiTotalWeight.innerHTML = `${voyage.totalWeightTons.toLocaleString()} <span style="font-size:1rem;">噸</span>`;
    
    // Peak Day calculation
    const sortedDays = Object.entries(voyage.dailyMap).sort((a, b) => b[1] - a[1]);
    const peakDay = sortedDays[0] || ['無', 0];
    elements.vKpiPeakDay.innerHTML = `${Math.round(peakDay[1]).toLocaleString()} <span style="font-size:1rem;">噸 / 日</span>`;
    elements.vKpiPeakDayDate.textContent = `最高運量日: ${peakDay[0]}`;

    // Peak Specific Date & Hour calculation (特定日期的特定小時)
    const sortedDateHours = Object.entries(voyage.dateHourMap || {}).sort((a, b) => b[1].weight - a[1].weight);
    const peakDateHour = sortedDateHours[0] || ['無', { weight: 0, trips: 0, dateStr: '無', hourStr: '00:00' }];
    const peakWeight = Math.round(peakDateHour[1].weight);
    const peakTrips = peakDateHour[1].trips;
    const peakTimeLabel = `${peakDateHour[1].dateStr.slice(5)} ${peakDateHour[1].hourStr}`;

    elements.vKpiPeakHour.innerHTML = `${peakWeight.toLocaleString()} <span style="font-size:1rem;">噸 / 小時</span>`;
    elements.vKpiPeakHourTrips.textContent = `創峰值時段: ${peakTimeLabel} (${peakTrips} 車次)`;

    // Average Hourly Rate calculation (本船次平均每小時作業速率)
    const activeWorkHours = Object.keys(voyage.dateHourMap || {}).length || 1;
    const avgHourlyTons = (voyage.totalWeightTons / activeWorkHours).toFixed(1);
    const avgHourlyTrips = (voyage.totalTrips / activeWorkHours).toFixed(1);

    if (elements.vKpiAvgHourlyRate) {
      elements.vKpiAvgHourlyRate.innerHTML = `${parseFloat(avgHourlyTons).toLocaleString()} <span style="font-size:1rem;">噸 / 小時</span>`;
    }
    if (elements.vKpiSubAvgHourlyRate) {
      elements.vKpiSubAvgHourlyRate.textContent = `實際作業 ${activeWorkHours} 小時 (平均單時 ${avgHourlyTrips} 車次)`;
    }

    // Truck Stats KPI
    const avgTrips = (voyage.totalTrips / (voyage.uniqueTrucks || 1)).toFixed(1);
    elements.vKpiTrucksCount.innerHTML = `${voyage.uniqueTrucks} <span style="font-size:1rem;">輛</span>`;
    elements.vKpiAvgTripsPerTruck.textContent = `平均單車運轉 ${avgTrips} 趟`;

    // Render 5 Voyage Charts
    renderVoyageSCurveChart(voyage);
    renderVoyageDailyChart(voyage);
    renderVoyageHourlyChart(voyage);
    renderVoyageHourlyAvgRateChart(voyage);
    renderVoyageTrucksChart(voyage);

    // Render Vehicle Efficiency Table
    renderVoyageTruckEfficiencyTable(voyage);

    if (window.lucide) lucide.createIcons();
  }

  // 1. Voyage Chart S-Curve (累計進度 S-曲線)
  function renderVoyageSCurveChart(voyage) {
    let runningTotal = 0;
    const labels = [];
    const cumulativeData = [];

    // Group cumulative tonnage by 2-hour slots or timestamps
    voyage.records.forEach((r, idx) => {
      runningTotal += r.netWeightTons;
      if (idx % Math.max(1, Math.floor(voyage.records.length / 25)) === 0 || idx === voyage.records.length - 1) {
        const timeStr = `${r.dateStr.slice(5)} ${String(r.date.getHours()).padStart(2, '0')}:${String(r.date.getMinutes()).padStart(2, '0')}`;
        labels.push(timeStr);
        cumulativeData.push(Math.round(runningTotal));
      }
    });

    renderChart('chartVoyageSCurve', 'line', {
      labels: labels,
      datasets: [{
        label: '本船次累計過磅噸數 (噸)',
        data: cumulativeData,
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.18)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#3b82f6'
      }]
    });
  }

  // 2. Voyage Chart Daily Breakdown
  function renderVoyageDailyChart(voyage) {
    const days = Object.keys(voyage.dailyMap).sort();
    const weights = days.map(d => Math.round(voyage.dailyMap[d]));

    renderChart('chartVoyageDaily', 'bar', {
      labels: days.map(d => d.slice(5)),
      datasets: [{
        label: '當日裝載噸數',
        data: weights,
        backgroundColor: '#10b981',
        borderRadius: 6
      }]
    });
  }

  // 3. Voyage Chart Hourly Throughput
  function renderVoyageHourlyChart(voyage) {
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);
    const hourlyWeights = voyage.hourlyWeightMap.map(w => Math.round(w));

    renderChart('chartVoyageHourly', 'bar', {
      labels: hours,
      datasets: [{
        label: '裝載噸數 (噸)',
        data: hourlyWeights,
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    });
  }

  // 3b. Voyage Chart Hourly Rate by Date (各日期每小時作業速率線圖)
  function renderVoyageHourlyAvgRateChart(voyage) {
    if (!voyage) return;
    const select = elements.vHourlyDateSelect;
    const subtitle = elements.vHourlyRateSubtitle;

    // Dynamically populate date options in select dropdown
    const dates = Object.keys(voyage.dailyMap || {}).sort();

    if (select) {
      const currentVal = select.value || 'ALL_COMPARE';
      select.innerHTML = `
        <option value="ALL_COMPARE">🌐 各日期對比 (All Dates)</option>
        <option value="TIMELINE">📈 連續時間軸 (Timeline)</option>
        <option value="AVG">📊 船次總平均 (Average)</option>
      `;
      dates.forEach((dStr, idx) => {
        const opt = document.createElement('option');
        opt.value = dStr;
        opt.textContent = `📅 ${dStr.slice(5)} (Day ${idx + 1})`;
        select.appendChild(opt);
      });
      select.value = currentVal;
    }

    const selectedMode = select ? select.value : 'ALL_COMPARE';
    const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

    // Palette for distinct dates
    const colors = [
      '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6',
      '#3b82f6', '#14b8a6', '#f97316', '#a855f7', '#6366f1'
    ];

    if (selectedMode === 'ALL_COMPARE') {
      if (subtitle) subtitle.textContent = `區分該船次 ${dates.length} 個作業日之各鐘點 (00:00~23:00) 噸數速率`;

      const datasets = dates.map((dStr, idx) => {
        const color = colors[idx % colors.length];
        const data = hours.map((_, h) => {
          const dhKey = `${dStr} ${String(h).padStart(2, '0')}:00`;
          return voyage.dateHourMap[dhKey] ? Math.round(voyage.dateHourMap[dhKey].weight) : 0;
        });
        return {
          label: `${dStr.slice(5)} (Day ${idx + 1})`,
          data: data,
          borderColor: color,
          backgroundColor: 'transparent',
          tension: 0.35,
          pointRadius: 3,
          borderWidth: 2
        };
      });

      // Calculate average dataset as a reference line
      const activeDaysPerHour = Array(24).fill(0);
      Object.values(voyage.dateHourMap || {}).forEach(dh => {
        const h = parseInt(dh.hourStr.split(':')[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) activeDaysPerHour[h]++;
      });
      const avgData = voyage.hourlyWeightMap.map((w, h) => {
        const activeDays = activeDaysPerHour[h] || 1;
        return parseFloat((w / activeDays).toFixed(1));
      });

      datasets.push({
        label: '全船次平均 (噸)',
        data: avgData,
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        pointRadius: 0,
        borderWidth: 1.5,
        fill: false
      });

      renderChart('chartVoyageHourlyAvgRate', 'line', {
        labels: hours,
        datasets: datasets
      });

    } else if (selectedMode === 'TIMELINE') {
      if (subtitle) subtitle.textContent = `開工至完工之連續時段過磅噸數時序圖`;

      const dhKeys = Object.keys(voyage.dateHourMap || {}).sort();
      const labels = dhKeys.map(k => `${k.slice(5, 10)} ${k.slice(11)}`);
      const weights = dhKeys.map(k => Math.round(voyage.dateHourMap[k].weight));

      renderChart('chartVoyageHourlyAvgRate', 'line', {
        labels: labels,
        datasets: [{
          label: '當小時裝載淨重 (噸)',
          data: weights,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.35,
          pointRadius: 3
        }]
      });

    } else if (selectedMode === 'AVG') {
      if (subtitle) subtitle.textContent = `全船次 00:00~23:00 之平均噸數與過磅車次`;

      const activeDaysPerHour = Array(24).fill(0);
      Object.values(voyage.dateHourMap || {}).forEach(dh => {
        const h = parseInt(dh.hourStr.split(':')[0], 10);
        if (!isNaN(h) && h >= 0 && h < 24) activeDaysPerHour[h]++;
      });

      const avgHourlyTons = voyage.hourlyWeightMap.map((w, h) => parseFloat((w / (activeDaysPerHour[h] || 1)).toFixed(1)));
      const avgHourlyTrips = voyage.hourlyMap.map((t, h) => parseFloat((t / (activeDaysPerHour[h] || 1)).toFixed(1)));

      renderChart('chartVoyageHourlyAvgRate', 'line', {
        labels: hours,
        datasets: [
          {
            label: '平均作業噸數 (噸/小時)',
            data: avgHourlyTons,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.18)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6',
            yAxisID: 'y'
          },
          {
            label: '平均過磅車次 (車次/小時)',
            data: avgHourlyTrips,
            borderColor: '#8b5cf6',
            backgroundColor: 'transparent',
            borderDash: [4, 4],
            pointRadius: 3,
            pointBackgroundColor: '#8b5cf6',
            yAxisID: 'y1'
          }
        ]
      }, {
        scales: {
          x: { ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { color: state.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' } },
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '噸 / 小時', color: '#06b6d4' }, ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { color: state.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' } },
          y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '車次 / 小時', color: '#8b5cf6' }, ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { drawOnChartArea: false } }
        }
      });

    } else {
      // Specific Date selected
      const targetDate = selectedMode;
      const dayIdx = dates.indexOf(targetDate) + 1;
      if (subtitle) subtitle.textContent = `單日詳細作業速率: ${targetDate} (Day ${dayIdx})`;

      const tons = hours.map((_, h) => {
        const dhKey = `${targetDate} ${String(h).padStart(2, '0')}:00`;
        return voyage.dateHourMap[dhKey] ? Math.round(voyage.dateHourMap[dhKey].weight) : 0;
      });
      const trips = hours.map((_, h) => {
        const dhKey = `${targetDate} ${String(h).padStart(2, '0')}:00`;
        return voyage.dateHourMap[dhKey] ? voyage.dateHourMap[dhKey].trips : 0;
      });

      renderChart('chartVoyageHourlyAvgRate', 'line', {
        labels: hours,
        datasets: [
          {
            label: `${targetDate.slice(5)} 裝載噸數 (噸)`,
            data: tons,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.18)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            yAxisID: 'y'
          },
          {
            label: `${targetDate.slice(5)} 過磅車次 (趟)`,
            data: trips,
            borderColor: '#f59e0b',
            borderDash: [4, 4],
            pointRadius: 3,
            yAxisID: 'y1'
          }
        ]
      }, {
        scales: {
          x: { ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { color: state.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' } },
          y: { type: 'linear', display: true, position: 'left', title: { display: true, text: '噸 / 小時', color: '#10b981' }, ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { color: state.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)' } },
          y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: '車次 / 小時', color: '#f59e0b' }, ticks: { color: state.isDarkMode ? '#94a3b8' : '#475569' }, grid: { drawOnChartArea: false } }
        }
      });
    }
  }

  // 4. Voyage Chart Trucks Top Performance
  function renderVoyageTrucksChart(voyage) {
    const sortedTrucks = Object.entries(voyage.truckStatsMap)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 8);

    renderChart('chartVoyageTrucks', 'bar', {
      labels: sortedTrucks.map(t => t[0]),
      datasets: [{
        label: '累計載運噸數',
        data: sortedTrucks.map(t => Math.round(t[1].weight)),
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    }, { indexAxis: 'y' });
  }

  // 5. Voyage Vehicle Efficiency Table
  function renderVoyageTruckEfficiencyTable(voyage) {
    const sortedTrucks = Object.entries(voyage.truckStatsMap)
      .sort((a, b) => b[1].weight - a[1].weight);

    const rowsHtml = sortedTrucks.map(([truck, stat]) => {
      const avgLoad = (stat.weight / stat.trips).toFixed(2);
      const activeDays = stat.days.size;
      const tripsPerDay = (stat.trips / activeDays).toFixed(1);
      
      let badgeClass = 'badge-purple';
      let badgeText = '⚡ 良好';
      if (stat.trips >= 25) {
        badgeClass = 'badge-emerald';
        badgeText = '🌟 高效';
      } else if (stat.trips < 10) {
        badgeClass = 'badge-amber';
        badgeText = '一般';
      }

      return `
        <tr>
          <td><strong>${truck}</strong></td>
          <td>${stat.trips} 趟</td>
          <td>${Math.round(stat.weight).toLocaleString()} 噸</td>
          <td>${avgLoad} 噸/車</td>
          <td>${activeDays} 天</td>
          <td>${tripsPerDay} 趟/日</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        </tr>
      `;
    }).join('');

    elements.vTruckEfficiencyTableBody.innerHTML = rowsHtml;
  }

  // --- Render Long-Term Voyage Hourly Rate Analytics Dashboard (長期船次速率分析工作表) ---
  function renderVoyageRateDashboard() {
    if (!state.voyages || state.voyages.length === 0) {
      if (elements.vrTableBody) {
        elements.vrTableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem; color: var(--text-muted);">無可分析之船次數據。請開啟資料夾或選擇 Excel 檔案。</td></tr>';
      }
      return;
    }

    // Build rate summary for every voyage
    const rateData = state.voyages.map(v => {
      const activeHours = Object.keys(v.dateHourMap || {}).length || 1;
      const avgHourlyRateTons = parseFloat((v.totalWeightTons / activeHours).toFixed(1));
      const avgHourlyTrips = parseFloat((v.totalTrips / activeHours).toFixed(1));

      let peakHourWeight = 0;
      Object.values(v.dateHourMap || {}).forEach(item => {
        if (item.weight > peakHourWeight) peakHourWeight = item.weight;
      });
      peakHourWeight = Math.round(peakHourWeight);

      return {
        name: v.name,
        index: v.index,
        startDate: v.startDate,
        endDate: v.endDate,
        durationDays: v.durationDays,
        activeHours: activeHours,
        totalTrips: v.totalTrips,
        totalWeightTons: v.totalWeightTons,
        avgHourlyRateTons: avgHourlyRateTons,
        avgHourlyTrips: avgHourlyTrips,
        peakHourWeight: peakHourWeight
      };
    });

    // 1. Overall KPIs
    let totalTonsAll = 0;
    let totalHoursAll = 0;
    let maxRateVoyage = rateData[0];
    let peakHourAll = 0;

    rateData.forEach(r => {
      totalTonsAll += r.totalWeightTons;
      totalHoursAll += r.activeHours;
      if (r.avgHourlyRateTons > maxRateVoyage.avgHourlyRateTons) {
        maxRateVoyage = r;
      }
      if (r.peakHourWeight > peakHourAll) {
        peakHourAll = r.peakHourWeight;
      }
    });

    const overallAvgHourlyRate = totalHoursAll > 0 ? (totalTonsAll / totalHoursAll).toFixed(1) : '0';

    if (elements.vrKpiAvgRate) {
      elements.vrKpiAvgRate.innerHTML = `${parseFloat(overallAvgHourlyRate).toLocaleString()} <span style="font-size:1rem;">噸 / 小時</span>`;
    }
    if (elements.vrKpiSubAvgRate) {
      elements.vrKpiSubAvgRate.textContent = `全專案 ${rateData.length} 船次總體平均產能`;
    }

    if (elements.vrKpiMaxRate) {
      elements.vrKpiMaxRate.innerHTML = `${maxRateVoyage.avgHourlyRateTons.toLocaleString()} <span style="font-size:1rem;">噸 / 小時</span>`;
    }
    if (elements.vrKpiSubMaxRate) {
      elements.vrKpiSubMaxRate.textContent = `創最高速率船次: ${maxRateVoyage.name}`;
    }

    if (elements.vrKpiPeakHourRate) {
      elements.vrKpiPeakHourRate.innerHTML = `${peakHourAll.toLocaleString()} <span style="font-size:1rem;">噸 / 小時</span>`;
    }
    if (elements.vrKpiSubPeakHour) {
      elements.vrKpiSubPeakHour.textContent = `全專案極限過磅峰值`;
    }

    if (elements.vrKpiTotalVoyages) {
      elements.vrKpiTotalVoyages.innerHTML = `${rateData.length} <span style="font-size:1rem;">船次</span>`;
    }
    if (elements.vrKpiSubTotalHours) {
      elements.vrKpiSubTotalHours.textContent = `累積過磅 ${totalHoursAll} 小時 (${totalTonsAll.toLocaleString()} 噸)`;
    }

    // 2. Render Long-Term Rate Charts
    renderVoyageRateTrendChart(rateData, parseFloat(overallAvgHourlyRate));
    renderVoyageRateTripsChart(rateData);

    // 3. Render Master Analysis Table
    renderVoyageRateTable(rateData);

    if (window.lucide) lucide.createIcons();
  }

  function renderVoyageRateTrendChart(rateData, overallAvg) {
    const sortedChrono = [...rateData].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const labels = sortedChrono.map(r => r.name.replace('船次 ', ''));
    const rateValues = sortedChrono.map(r => r.avgHourlyRateTons);
    const avgBenchmark = Array(rateData.length).fill(overallAvg);

    renderChart('chartVoyageRateTrend', 'line', {
      labels: labels,
      datasets: [
        {
          label: '本船次平均每小時作業速率 (噸/小時)',
          data: rateValues,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.18)',
          fill: true,
          tension: 0.35,
          pointRadius: 5,
          pointBackgroundColor: '#3b82f6'
        },
        {
          label: '歷史平均基準線',
          data: avgBenchmark,
          borderColor: '#f59e0b',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    });
  }

  function renderVoyageRateTripsChart(rateData) {
    const sortedChrono = [...rateData].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const labels = sortedChrono.map(r => r.name.replace('船次 ', ''));
    const tripsValues = sortedChrono.map(r => r.avgHourlyTrips);

    renderChart('chartVoyageRateTrips', 'bar', {
      labels: labels,
      datasets: [{
        label: '每小時平均過磅車數 (車/小時)',
        data: tripsValues,
        backgroundColor: '#8b5cf6',
        borderRadius: 6
      }]
    });
  }

  function renderVoyageRateTable(rateData) {
    if (!elements.vrTableBody) return;

    const query = (elements.vrSearchInput?.value || '').toLowerCase().trim();
    let filtered = rateData;
    if (query) {
      filtered = filtered.filter(r => r.name.toLowerCase().includes(query) || r.startDate.includes(query) || r.endDate.includes(query));
    }

    if (elements.vrTableRowCount) {
      elements.vrTableRowCount.textContent = `(共 ${filtered.length} 船次)`;
    }

    const sortField = state.vrSortField || 'avgHourlyRateTons';
    const sortAsc = state.vrSortAsc || false;

    filtered.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    const rowsHtml = filtered.map(r => {
      let gradeClass = 'badge-purple';
      let gradeText = '⚡ 良好';
      if (r.avgHourlyRateTons >= 220) {
        gradeClass = 'badge-emerald';
        gradeText = '🌟 高效';
      } else if (r.avgHourlyRateTons < 150) {
        gradeClass = 'badge-amber';
        gradeText = '偏低';
      }

      return `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${r.startDate} ~ ${r.endDate}</td>
          <td>${r.durationDays} 天</td>
          <td>${r.activeHours} 小時</td>
          <td>${r.totalTrips.toLocaleString()} 趟</td>
          <td>${r.totalWeightTons.toLocaleString()} 噸</td>
          <td style="font-weight:700; color:var(--accent-cyan); font-size:0.95rem;">${r.avgHourlyRateTons.toLocaleString()} 噸/小時</td>
          <td>${r.avgHourlyTrips} 車/小時</td>
          <td>${r.peakHourWeight.toLocaleString()} 噸/小時</td>
          <td><span class="badge ${gradeClass}">${gradeText}</span></td>
        </tr>
      `;
    }).join('');

    elements.vrTableBody.innerHTML = rowsHtml || '<tr><td colspan="10" style="text-align:center; padding:2rem; color:var(--text-muted);">無符合關鍵字之船次數據</td></tr>';
  }

  function exportVoyageRateCSV() {
    if (!state.voyages || state.voyages.length === 0) {
      alert('無可供匯出的船次速率數據。');
      return;
    }

    const rateData = state.voyages.map(v => {
      const activeHours = Object.keys(v.dateHourMap || {}).length || 1;
      const avgHourlyRateTons = parseFloat((v.totalWeightTons / activeHours).toFixed(1));
      const avgHourlyTrips = parseFloat((v.totalTrips / activeHours).toFixed(1));
      let peakHourWeight = 0;
      Object.values(v.dateHourMap || {}).forEach(item => {
        if (item.weight > peakHourWeight) peakHourWeight = item.weight;
      });

      return {
        '船次名稱': v.name,
        '開工日期': v.startDate,
        '完工日期': v.endDate,
        '作業天數': v.durationDays,
        '實際作業小時數': activeHours,
        '過磅總車次': v.totalTrips,
        '總裝載淨重(噸)': v.totalWeightTons,
        '本船次平均每小時作業速率(噸/小時)': avgHourlyRateTons,
        '平均每小時過磅車數(車/小時)': avgHourlyTrips,
        '單小時最高作業速率(噸/小時)': Math.round(peakHourWeight),
        '速率評等': avgHourlyRateTons >= 220 ? '高效' : (avgHourlyRateTons < 150 ? '偏低' : '良好')
      };
    });

    const csv = Papa.unparse(rateData);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `轉爐石台北港各船次平均每小時作業速率分析彙總_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  // --- Weight Parser (Unified Kg -> Tons Converter) ---
  function parseWeightToTons(val) {
    if (val === undefined || val === null || val === '') return 0;
    let num = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return 0;
    // 若單筆記錄 > 1000（例如 23500 kg），轉為公噸 (23.5 tons)
    // 若單筆記錄 <= 1000（例如 23.2 tons），保持原單位公噸
    if (num > 1000) return num / 1000;
    return num;
  }

  // --- Update Overview KPIs & Charts ---
  function updateOverviewKPIs() {
    const records = state.filteredRecords;
    if (records.length === 0) {
      elements.kpiTotalWeight.textContent = '0 噸';
      elements.kpiTotalTrips.textContent = '0 車次';
      elements.kpiAvgWeight.textContent = '0 噸';
      elements.kpiUniqueTrucks.textContent = '0 輛';
      if (elements.kpiYearlyWeightList) elements.kpiYearlyWeightList.innerHTML = '<span style="font-size:0.85rem; color:var(--text-muted);">無年份數據</span>';
      return;
    }

    const dateKey = getColumnKey(records, state.columnMap.date);
    const netKey = getColumnKey(records, state.columnMap.netWeight);
    const truckKey = getColumnKey(records, state.columnMap.truck);

    let totalTons = 0;
    const uniqueTrucks = new Set();
    const yearWeightMap = {};

    records.forEach(r => {
      let weight = 0;
      if (netKey && r[netKey] !== undefined) {
        weight = parseWeightToTons(r[netKey]);
        totalTons += weight;
      }
      if (truckKey && r[truckKey]) {
        uniqueTrucks.add(String(r[truckKey]).trim());
      }
      if (dateKey && r[dateKey]) {
        const d = robustParseDate(r[dateKey]);
        if (d) {
          const y = d.getFullYear();
          yearWeightMap[y] = (yearWeightMap[y] || 0) + weight;
        }
      }
    });

    const avgLoadTons = records.length > 0 ? (totalTons / records.length).toFixed(2) : '0';

    elements.kpiTotalWeight.innerHTML = `${Math.round(totalTons).toLocaleString()} <span style="font-size:1rem;">噸</span>`;
    elements.kpiTotalTrips.innerHTML = `${records.length.toLocaleString()} <span style="font-size:1rem;">車次</span>`;
    elements.kpiAvgWeight.innerHTML = `${avgLoadTons} <span style="font-size:1rem;">噸 / 車</span>`;
    elements.kpiUniqueTrucks.innerHTML = `${uniqueTrucks.size} <span style="font-size:1rem;">輛</span>`;

    // 歷年載運重量彙總 KPI 卡片渲染
    if (elements.kpiYearlyWeightList) {
      const sortedYears = Object.keys(yearWeightMap).sort((a, b) => b - a);
      if (sortedYears.length > 0) {
        const yearItemsHtml = sortedYears.map(y => {
          const rocYear = parseInt(y, 10) - 1911;
          const tons = Math.round(yearWeightMap[y]).toLocaleString();
          return `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.88rem; padding: 2px 0;">
              <span style="color:var(--accent-rose); font-weight:600;">📅 ${y} 年 (民國 ${rocYear} 年)</span>
              <span style="font-weight:700; color:var(--text-main);">${tons} <span style="font-size:0.75rem; color:var(--text-muted);">噸</span></span>
            </div>
          `;
        }).join('');
        elements.kpiYearlyWeightList.innerHTML = yearItemsHtml;
        if (elements.kpiSubYearlyWeight) {
          elements.kpiSubYearlyWeight.innerHTML = `<i data-lucide="calendar-range" style="width:14px; vertical-align:middle;"></i> 共涵蓋 ${sortedYears.length} 個作業年份`;
        }
      } else {
        elements.kpiYearlyWeightList.innerHTML = `<span style="font-size:0.85rem; color:var(--text-muted);">無年份數據</span>`;
      }
    }
  }

  function updateOverviewCharts() {
    const records = state.filteredRecords;
    if (records.length === 0) return;

    const dateKey = getColumnKey(records, state.columnMap.date);
    const netKey = getColumnKey(records, state.columnMap.netWeight);
    const truckKey = getColumnKey(records, state.columnMap.truck);
    const grossKey = getColumnKey(records, state.columnMap.grossWeight);
    const tareKey = getColumnKey(records, state.columnMap.tareWeight);

    // Chart Trend
    const monthlyWeightMap = {};
    records.forEach(r => {
      let dateStr = '未知日期';
      if (dateKey && r[dateKey]) {
        let d = robustParseDate(r[dateKey]);
        if (d) {
          dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        } else {
          dateStr = String(r[dateKey]).substring(0, 7);
        }
      }
      let weight = netKey ? parseWeightToTons(r[netKey]) : 0;
      monthlyWeightMap[dateStr] = (monthlyWeightMap[dateStr] || 0) + weight;
    });

    const sortedMonths = Object.keys(monthlyWeightMap).sort();
    const monthWeights = sortedMonths.map(m => Math.round(monthlyWeightMap[m]));

    renderChart('chartTrend', 'line', {
      labels: sortedMonths,
      datasets: [{
        label: '載運總淨重 (噸)',
        data: monthWeights,
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#06b6d4'
      }]
    });

    // Chart Top Trucks
    const truckWeightMap = {};
    records.forEach(r => {
      const truck = truckKey && r[truckKey] ? String(r[truckKey]).trim() : '未知車號';
      let weight = netKey ? parseWeightToTons(r[netKey]) : 0;
      truckWeightMap[truck] = (truckWeightMap[truck] || 0) + weight;
    });

    const sortedTrucks = Object.entries(truckWeightMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    renderChart('chartTopTrucks', 'bar', {
      labels: sortedTrucks.map(t => t[0]),
      datasets: [{
        label: '總載運噸數',
        data: sortedTrucks.map(t => Math.round(t[1])),
        backgroundColor: [
          '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b',
          '#10b981', '#06b6d4', '#3b82f6', '#94a3b8', '#64748b'
        ],
        borderRadius: 6
      }]
    }, { indexAxis: 'y' });

    // Chart Hourly (時段裝載淨重分佈)
    const timeKey = getColumnKey(records, state.columnMap.time);
    const hourlyWeights = Array(24).fill(0);
    records.forEach(r => {
      if (dateKey && r[dateKey]) {
        let d = robustParseDate(r[dateKey]);
        if (d) {
          if (timeKey && r[timeKey] !== undefined) {
            applyTimeToDate(d, r[timeKey]);
          }
          let weight = netKey ? parseWeightToTons(r[netKey]) : 0;
          hourlyWeights[d.getHours()] += weight;
        }
      }
    });

    renderChart('chartHourly', 'bar', {
      labels: Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`),
      datasets: [{
        label: '裝載淨重 (噸)',
        data: hourlyWeights.map(w => Math.round(w)),
        backgroundColor: '#f59e0b',
        borderRadius: 4
      }]
    });

    // Chart Weight Structure
    let sumGross = 0, sumTare = 0, sumNet = 0, count = 0;
    records.forEach(r => {
      let g = grossKey ? parseWeightToTons(r[grossKey]) : 0;
      let t = tareKey ? parseWeightToTons(r[tareKey]) : 0;
      let n = netKey ? parseWeightToTons(r[netKey]) : 0;
      if (g > 0 || n > 0) {
        sumGross += g; sumTare += t; sumNet += n; count++;
      }
    });

    const avgTare = count ? (sumTare / count).toFixed(2) : 15;
    const avgNet = count ? (sumNet / count).toFixed(2) : 20;

    renderChart('chartWeightStructure', 'doughnut', {
      labels: ['空重 (車重)', '淨重 (轉爐石載重)'],
      datasets: [{
        data: [avgTare, avgNet],
        backgroundColor: ['#64748b', '#10b981'],
        borderWidth: 0
      }]
    });
  }

  // --- Helper to Render / Update Chart.js Instance ---
  function renderChart(canvasId, type, data, extraOptions = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (state.charts[canvasId]) {
      state.charts[canvasId].destroy();
    }

    const textColor = state.isDarkMode ? '#94a3b8' : '#475569';
    const gridColor = state.isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

    state.charts[canvasId] = new Chart(ctx, {
      type: type,
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: textColor, font: { family: 'Outfit, Noto Sans TC' } }
          }
        },
        scales: type !== 'doughnut' ? {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
        } : {},
        ...extraOptions
      }
    });
  }

  function updateChartsTheme() {
    updateOverviewCharts();
    renderVoyageDashboard();
  }

  // --- Render Data Table ---
  function renderTable() {
    const records = state.filteredRecords;
    elements.tableRowCount.textContent = `(共 ${records.length.toLocaleString()} 筆)`;

    if (records.length === 0) {
      elements.tableHeaderRow.innerHTML = '<th>無資料</th>';
      elements.tableBody.innerHTML = '<tr><td style="text-align:center; padding:2rem; color:var(--text-muted);">無符合條件的數據</td></tr>';
      elements.pageInfo.textContent = '第 0 / 0 頁';
      elements.btnPrevPage.disabled = true;
      elements.btnNextPage.disabled = true;
      return;
    }

    const headers = Object.keys(records[0]);
    elements.tableHeaderRow.innerHTML = headers.map(h => `<th>${h}</th>`).join('');

    const totalPages = Math.ceil(records.length / state.pageSize) || 1;
    state.currentPage = Math.min(state.currentPage, totalPages);
    
    const startIdx = (state.currentPage - 1) * state.pageSize;
    const pageRecords = records.slice(startIdx, startIdx + state.pageSize);

    const rowsHtml = pageRecords.map(row => {
      const tds = headers.map(h => {
        let val = row[h];
        if (val instanceof Date) val = val.toISOString().split('T')[0];
        if (h === '資料來源' && val) {
          return `<td><span class="badge badge-purple" style="font-size:0.75rem; padding:3px 8px;">${val}</span></td>`;
        }
        return `<td>${val !== undefined ? val : ''}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    elements.tableBody.innerHTML = rowsHtml;
    elements.pageInfo.textContent = `第 ${state.currentPage} / ${totalPages} 頁`;
    elements.btnPrevPage.disabled = state.currentPage === 1;
    elements.btnNextPage.disabled = state.currentPage === totalPages;
  }

  // --- Export CSV ---
  function exportCSV() {
    if (state.filteredRecords.length === 0) {
      alert('無可供匯出的數據。');
      return;
    }
    const csv = Papa.unparse(state.filteredRecords);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `轉爐石台北港過磅數據_${state.currentSheet || 'Export'}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  }

  // --- Load Built-in Demo Data ---
  function loadDemoData() {
    showLoading('正在載入中聯資台北港轉爐石專案示範數據...');
    
    const generateRecords = (yearStr, voyageBatches) => {
      const records = [];
      const trucks = ['359-WB', '821-KE', 'KL-9082', '772-TG', 'AA-3091', '552-UQ', '881-ZZ', '902-TX', '109-WB', '662-KC'];
      const customers = ['中聯資源股份有限公司', '台北港填海造陸專案組', '國光客運台北港區'];
      
      let seq = 1;
      voyageBatches.forEach(batch => {
        const startDate = new Date(batch.start);
        for (let day = 0; day < batch.days; day++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + day);
          const dateBaseStr = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, '0')}/${String(currentDate.getDate()).padStart(2, '0')}`;

          const dayTrips = 80 + Math.floor(Math.random() * 40);
          for (let i = 0; i < dayTrips; i++) {
            const hour = Math.floor(Math.random() * 10) + 7;
            const minute = Math.floor(Math.random() * 60);
            const dateStr = `${dateBaseStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            
            const tare = parseFloat((14.5 + Math.random() * 2).toFixed(2));
            const net = parseFloat((20.0 + Math.random() * 6).toFixed(2));
            const gross = parseFloat((tare + net).toFixed(2));

            records.push({
              '過磅單號': `TPG-${yearStr}-${String(seq++).padStart(5, '0')}`,
              '過磅日期': dateStr,
              '車號': trucks[Math.floor(Math.random() * trucks.length)],
              '毛重(噸)': gross,
              '空重(噸)': tare,
              '淨重(噸)': net,
              '客戶名稱': customers[Math.floor(Math.random() * customers.length)],
              '品名': '轉爐石 (Basic Oxygen Furnace Slag)',
              '進場地點': '台北港填築區門口過磅站'
            });
          }
        }
      });
      return records;
    };

    setTimeout(() => {
      const demo113 = generateRecords('113', [
        { start: '2024-03-12', days: 4 },
        { start: '2024-02-15', days: 3 },
        { start: '2024-01-10', days: 4 }
      ]);

      const demo109_112 = generateRecords('112', [
        { start: '2023-11-05', days: 4 },
        { start: '2023-09-18', days: 3 },
        { start: '2023-06-22', days: 4 }
      ]);

      state.rawWorkbook = {
        Sheets: {
          '113年過磅資料': XLSX.utils.json_to_sheet(demo113),
          '109-112年過磅資料': XLSX.utils.json_to_sheet(demo109_112)
        },
        SheetNames: ['113年過磅資料', '109-112年過磅資料']
      };

      state.sheetNames = [MERGED_TAB_NAME, '113年過磅資料', '109-112年過磅資料'];
      renderSheetTabs();
      loadSheet(MERGED_TAB_NAME);
    }, 300);
  }

  // --- API Fetching & IndexedDB Caching Engine ---
  const DEFAULT_API_URL = 'http://192.168.2.7:8000/api/test/v1/tpdashboard';
  const DEFAULT_API_KEY = '';
  const CACHE_DB_NAME = 'TPG_API_CACHE_DB';
  const CACHE_STORE_NAME = 'api_cache_store';
  const CACHE_KEY = 'tpdashboard_raw_cache_v2';

  function getSavedApiUrl() {
    return localStorage.getItem('TPG_API_URL') || DEFAULT_API_URL;
  }

  function getSavedApiKey() {
    return localStorage.getItem('TPG_API_KEY') || DEFAULT_API_KEY;
  }

  function getSavedCacheTtl() {
    return localStorage.getItem('TPG_CACHE_TTL') || '1800000'; // 預設 30 分鐘
  }

  // --- IndexedDB Cache Storage Engine ---
  function openCacheDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CACHE_DB_NAME, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
          db.createObjectStore(CACHE_STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function getApiCache(key = CACHE_KEY) {
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
      const store = tx.objectStore(CACHE_STORE_NAME);
      const request = store.get(key);
      return new Promise((resolve) => {
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('[CacheDB] getApiCache error:', err);
      return null;
    }
  }

  async function setApiCache(key = CACHE_KEY, data, meta = {}) {
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CACHE_STORE_NAME);
      const cacheObj = {
        data: data,
        count: data.length,
        timestamp: Date.now(),
        savedAt: new Date().toLocaleString(),
        ...meta
      };
      store.put(cacheObj, key);
      return new Promise((resolve) => tx.oncomplete = resolve);
    } catch (err) {
      console.warn('[CacheDB] setApiCache error:', err);
    }
  }

  async function clearApiCache(key = CACHE_KEY) {
    try {
      const db = await openCacheDB();
      const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
      const store = tx.objectStore(CACHE_STORE_NAME);
      store.delete(key);
      return new Promise((resolve) => tx.oncomplete = resolve);
    } catch (err) {
      console.warn('[CacheDB] clearApiCache error:', err);
    }
  }

  async function updateCacheStatusUI() {
    if (!elements.cacheStatusText) return;
    const cache = await getApiCache();
    if (!cache || !cache.data) {
      elements.cacheStatusText.textContent = '無本地快取 (尚未載入)';
      elements.cacheStatusText.style.color = 'var(--text-muted)';
      elements.cacheStatusText.style.background = 'rgba(255,255,255,0.04)';
      elements.cacheStatusText.style.borderColor = 'var(--border)';
    } else {
      const ageMinutes = Math.round((Date.now() - cache.timestamp) / 60000);
      elements.cacheStatusText.innerHTML = `⚡ 已快取 <strong>${cache.count?.toLocaleString() || 0}</strong> 筆<br><span style="font-size:0.75rem;opacity:0.85;">(${ageMinutes} 分鐘前建立 · ${cache.savedAt || ''})</span>`;
      elements.cacheStatusText.style.color = '#10b981';
      elements.cacheStatusText.style.background = 'rgba(16,185,129,0.1)';
      elements.cacheStatusText.style.borderColor = 'rgba(16,185,129,0.3)';
    }
  }

  async function fetchAndLoadApiData(url, apiKey, options = {}) {
    const forceRefresh = options.force === true;
    const cacheTtlMs = parseInt(getSavedCacheTtl(), 10);
    const startTime = performance.now();

    // 1. 檢查 IndexedDB 快取
    if (!forceRefresh && cacheTtlMs !== 0) {
      const cached = await getApiCache();
      if (cached && cached.data && Array.isArray(cached.data) && cached.data.length > 0) {
        const cacheAge = Date.now() - cached.timestamp;
        const isNotExpired = (cacheTtlMs === -1) || (cacheAge < cacheTtlMs);

        if (isNotExpired) {
          const loadSec = ((performance.now() - startTime) / 1000).toFixed(2);
          console.log(`[API Cache] ⚡ 命中本地 IndexedDB 快取: ${cached.count.toLocaleString()} 筆 (載入耗時: ${loadSec} 秒)`);

          showLoading('正在自本地 IndexedDB 快取載入數據...');
          state.rawRecords = cached.data;
          state.filteredRecords = [...cached.data];
          state.sheetNames = ['⚡ 本地快取數據 (154,590+筆)'];
          state.currentSheet = '⚡ 本地快取數據 (154,590+筆)';
          state.currentPage = 1;

          const pathBannerText = document.getElementById('pathBannerText');
          if (pathBannerText) {
            pathBannerText.innerHTML = `⚡ <strong>本地快取載入:</strong> ${cached.count.toLocaleString()} 筆作業資料 (快取時間: ${cached.savedAt} · 耗時 ${loadSec}s)`;
          }

          renderSheetTabs();
          renderYearSelectOptions();
          filterRecords();
          clusterVoyages();
          switchView(state.currentView || 'overview');
          hideLoading();
          return;
        }
      }
    }

    // 2. 向 API 發出請求
    showLoading('正在自 API 連線下載台北港作業數據 (192.168.2.7:8000)...');
    try {
      console.log('[fetchAndLoadApiData] Fetching from API with X-API-Key:', url);
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-API-Key': apiKey || DEFAULT_API_KEY
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      showLoading('數據下載完成，正在解析並寫入本地快取...');
      const responseData = await res.json();
      const rawRecords = Array.isArray(responseData) ? responseData : (responseData.data || []);

      if (!rawRecords || rawRecords.length === 0) {
        throw new Error('API 回傳的資料內容為空');
      }

      const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(1);
      console.log(`[fetchAndLoadApiData] 成功下載 ${rawRecords.length.toLocaleString()} 筆記錄 (耗時 ${elapsedSec} 秒)`);

      // 儲存至 IndexedDB 快取
      if (cacheTtlMs !== 0) {
        await setApiCache(CACHE_KEY, rawRecords, { url, apiKey: apiKey ? `${apiKey.slice(0, 6)}...` : '' });
        console.log('[fetchAndLoadApiData] 💾 數據已存入 IndexedDB 快取');
      }

      // 載入至 state
      state.rawRecords = rawRecords;
      state.filteredRecords = [...rawRecords];
      state.sheetNames = ['📡 API 即時連線數據 (全量)'];
      state.currentSheet = '📡 API 即時連線數據 (全量)';
      state.currentPage = 1;

      // 更新路徑指示條
      const pathBannerText = document.getElementById('pathBannerText');
      if (pathBannerText) {
        pathBannerText.innerHTML = `📡 <strong>API 即時連線:</strong> 192.168.2.7 (${rawRecords.length.toLocaleString()} 筆作業資料 · 耗時 ${elapsedSec}s)`;
      }

      renderSheetTabs();
      renderYearSelectOptions();
      filterRecords();
      clusterVoyages();
      switchView(state.currentView || 'overview');

      console.log('[fetchAndLoadApiData] ✅ 儀表板圖表與船次運算完成');
    } catch (err) {
      console.error('[fetchAndLoadApiData] 連線失敗:', err);

      // 連線失敗時嘗試降級讀取任何現存本地快取
      const fallbackCache = await getApiCache();
      if (fallbackCache && fallbackCache.data && fallbackCache.data.length > 0) {
        alert(`⚠️ API 即時連線失敗 (${err.message})。\n\n系統已自動降級使用現存的本地快取資料 (${fallbackCache.data.length.toLocaleString()} 筆 · ${fallbackCache.savedAt})。`);
        state.rawRecords = fallbackCache.data;
        state.filteredRecords = [...fallbackCache.data];
        state.sheetNames = ['⚡ 離線快取數據 (備援)'];
        state.currentSheet = '⚡ 離線快取數據 (備援)';
        state.currentPage = 1;
        renderSheetTabs();
        renderYearSelectOptions();
        filterRecords();
        clusterVoyages();
        switchView(state.currentView || 'overview');
      } else {
        alert(`⚠️ API 即時連線失敗：\n${err.message}\n\n可能原因：\n1. 目前裝置未處於公司內部區域網路 (192.168.2.x)。\n2. 瀏覽器跨來源資源共享 (CORS) 限制。\n\n建議解法：\n• 確認已連線至公司內網或 VPN。\n• 或執行本機 publish_api.bat 批次檔產出靜態資料。`);
      }
    } finally {
      hideLoading();
    }
  }

  // --- Initialization ---
  setupTheme();
  setupViewTabs();
  setupEvents();

  // 自動開啟與載入已儲存的固定資料夾數據 (H:\我的雲端硬碟\APPsheet\data\轉爐石台北港專案-617000928)
  initAutoLoadFixedFolder();

  // --- Online Mode Data Injection Interface ---
  // 供 online-loader.js 呼叫，將 GitHub Pages 上的 JSON 資料注入 state 並觸發全部渲染
  window.__TPG_INJECT_ONLINE_DATA = function(data) {
    try {
      console.log('[OnlineInject] 開始注入線上資料...');
      const kpi = data.kpi || {};
      const dailyStats = data.dailyStats || {};
      const voyagesData = (data.voyages || []).slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
      const yearlyStats = data.yearlyStats || {};

      // 1. 從 dailyStats 重建合成 rawRecords（只含日期+重量，無識別資訊）
      const syntheticRows = [];
      Object.entries(dailyStats).forEach(([dateStr, stat]) => {
        const tripsCount = stat.trips || 0;
        const weightPerTrip = tripsCount > 0 ? (stat.weightTons / tripsCount) : 0;
        for (let i = 0; i < tripsCount; i++) {
          syntheticRows.push({ '過磅日期': dateStr, '淨重': weightPerTrip });
        }
      });
      syntheticRows.sort((a, b) => new Date(a['過磅日期']) - new Date(b['過磅日期']));

      state.rawRecords = syntheticRows;
      state.filteredRecords = [...syntheticRows];
      state.currentSheet = data.meta?.projectName || '台北港專案 (線上)';
      state.currentPage = 1;
      state.selectedYear = 'ALL';

      // 2. 重建 voyages（保留所有彙總分析欄位，但無原始識別資訊）
      state.voyages = voyagesData.map((v, sortedIndex) => {
         const displayIndex = sortedIndex + 1;
        // 重建 dateHourMap（只用小時分布，非逐筆）
         const dateHourMap = {};
         const dailyEntries = Object.entries(v.dailyMap || {});
         const voyageWeight = Number(v.totalWeightTons) || 1;
         const voyageTrips = Number(v.totalTrips) || 1;
         if (dailyEntries.length > 0) {
           dailyEntries.forEach(([dateStr, dailyStat]) => {
             const dailyWeightShare = (Number(dailyStat.weightTons) || 0) / voyageWeight;
             const dailyTripsShare = (Number(dailyStat.trips) || 0) / voyageTrips;
             for (let h = 0; h < 24; h++) {
              const w = (v.hourlyWeight || [])[h] || 0;
              const t = (v.hourlyTrips || [])[h] || 0;
              if (t > 0 || w > 0) {
                const hourStr = `${String(h).padStart(2, '0')}:00`;
                const dhKey = `${dateStr} ${hourStr}`;
                if (!dateHourMap[dhKey]) {
                   dateHourMap[dhKey] = {
                     weight: w * dailyWeightShare,
                     trips: t * dailyTripsShare,
                     dateStr,
                     hourStr
                   };
                }
              }
            }
          });
        }

        return {
           name: `第 ${displayIndex} 船次 (${v.startDate.slice(5)} ~ ${v.endDate.slice(5)})`,
           index: displayIndex,
          startDate: v.startDate,
          endDate: v.endDate,
          durationDays: v.durationDays,
          totalWeightTons: v.totalWeightTons,
          totalTrips: v.totalTrips,
          uniqueTrucks: 0, // 匿名化，不公開車輛數
          records: [], // 不存原始記錄
          dailyMap: Object.fromEntries(
            Object.entries(v.dailyMap || {}).map(([k, s]) => [k, s.weightTons])
          ),
          hourlyMap: v.hourlyTrips || Array(24).fill(0),
          hourlyWeightMap: v.hourlyWeight || Array(24).fill(0),
          dateHourMap: dateHourMap,
          truckStatsMap: {} // 匿名化，不公開
        };
      });

      state.selectedVoyageIndex = 0;

      // 3. 更新年份選單
      const yearsFromData = Object.keys(yearlyStats).map(Number).sort((a, b) => b - a);
      if (elements.yearSelect) {
        elements.yearSelect.innerHTML = '<option value="ALL">🗓️ 全部年份 (跨年度總覽)</option>';
        yearsFromData.forEach(year => {
          const opt = document.createElement('option');
          opt.value = String(year);
          opt.textContent = `📅 ${year} 年 (民國 ${year - 1911} 年)`;
          elements.yearSelect.appendChild(opt);
        });
      }

      // 4. 更新工作表選單（顯示「線上資料」）
      state.sheetNames = [data.meta?.projectName || '線上彙總資料'];
      renderSheetTabs();

      // 5. 更新船次選單
      renderVoyageSelectOptions();

      // 6. 觸發全部渲染
      filterRecords();
      switchView('overview');

      // 7. 更新 KPI 中「獨立車輛數」（線上模式匿名，僅顯示「－」）
      if (elements.kpiUniqueTrucks) {
        elements.kpiUniqueTrucks.innerHTML = `<span style="font-size:1.5rem;color:var(--text-muted);">—</span>`;
      }
      const kpiSubUniqueTrucks = document.getElementById('kpiSubUniqueTrucks');
      if (kpiSubUniqueTrucks) kpiSubUniqueTrucks.textContent = '（線上模式不公開）';

      console.log('[OnlineInject] 注入完成 ✅', {
        records: syntheticRows.length,
        voyages: state.voyages.length
      });
    } catch (err) {
      console.error('[OnlineInject] 注入失敗:', err);
    }
  };
});
