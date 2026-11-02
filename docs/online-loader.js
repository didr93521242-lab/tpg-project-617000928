/**
 * online-loader.js — 線上查詢模式資料載入器
 * =============================================
 * 當儀表板在 GitHub Pages 上運行時（非 localhost），
 * 此腳本自動取代本機 File System API，改由 fetch 載入
 * publish.js 產生的匿名彙總 JSON。
 *
 * 功能：
 *   1. 偵測線上 vs 本機環境
 *   2. 線上環境：隱藏同步/上傳按鈕，顯示「線上查詢模式」提示
 *   3. fetch data/project-data.json → 重建 state 物件 → 驅動全部圖表
 *
 * 此腳本必須在 app.js 之後載入。
 */

(function () {
  'use strict';

  // ── 環境偵測 ──────────────────────────────────────
  // 僅 GitHub Pages 視為公開模式；公司網域/內網頁面仍需保留 API 同步功能。
  const IS_ONLINE = /(^|\.)github\.io$/i.test(window.location.hostname);

  if (!IS_ONLINE) return; // 本機開啟時，全部交給 app.js 原始邏輯

  console.log('[OnlineLoader] 線上查詢模式已啟動');

  // ── 等待 DOM 完成後執行 ───────────────────────────
  document.addEventListener('DOMContentLoaded', function () {

    // 1. 隱藏本機操作按鈕
    // 公開頁面無法連線至公司內網 API（192.168.2.x），因此隱藏所有
    // 需要本機/內網權限的操作，避免使用者誤以為手機可直接同步。
    const hideIds = ['btnSyncFixedFolder', 'btnPickFolder', 'btnPickFiles', 'pathBanner'];
    hideIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    // 2. 替換 "示範數據" 按鈕文字為 "重新整理"
    const btnDemo = document.getElementById('btnLoadDemo');
    if (btnDemo) {
      btnDemo.innerHTML = '<i data-lucide="refresh-cw"></i><span>重新整理</span>';
      btnDemo.title = '重新載入最新線上資料';
      btnDemo.addEventListener('click', loadOnlineData);
    }

    // 3. 在 nav 加入「線上查詢模式」標籤
    const navActions = document.querySelector('.nav-actions');
    if (navActions) {
      const badge = document.createElement('div');
      badge.style.cssText = `
        display:flex; align-items:center; gap:0.4rem;
        padding:0.35rem 0.8rem; border-radius:9999px;
        background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4);
        color:#10b981; font-size:0.75rem; font-weight:700;
        letter-spacing:0.03em;
      `;
      badge.innerHTML = '<span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block;animation:pulse 2s infinite;"></span> 線上查詢模式';
      navActions.insertAdjacentElement('afterbegin', badge);
    }

    // 4. 自動載入線上資料
    loadOnlineData();
  });

  // ── 核心：fetch JSON 並注入 app.js state ─────────
  async function loadOnlineData() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    const loadingSubtext = document.getElementById('loadingSubtext');

    if (loadingOverlay) loadingOverlay.classList.add('active');
    if (loadingText) loadingText.textContent = '正在載入最新公開數據...';
    if (loadingSubtext) loadingSubtext.textContent = '資料來源：GitHub Pages';

    try {
      // 使用相對路徑，相容 GitHub Pages 子路徑
      const basePath = window.location.pathname.replace(/\/[^\/]*$/, '');
      const jsonUrl = `${basePath}/data/project-data.json`.replace('//', '/');
      const res = await fetch(jsonUrl + '?t=' + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();
      console.log('[OnlineLoader] 資料載入成功:', data.meta);

      // 注入資料到 app.js state，觸發全部渲染
      injectDataIntoApp(data);

      // 顯示資料更新時間
      if (data.meta && data.meta.publishedAt) {
        const published = new Date(data.meta.publishedAt);
        const formatted = `${published.getFullYear()}/${String(published.getMonth()+1).padStart(2,'0')}/${String(published.getDate()).padStart(2,'0')} ${String(published.getHours()).padStart(2,'0')}:${String(published.getMinutes()).padStart(2,'0')}`;
        const badge = document.querySelector('.nav-actions > div:first-child');
        if (badge) badge.title = `資料更新時間: ${formatted}`;
        showUpdateToast(formatted);
      }

      // 記錄本次成功載入時間，供手機重新整理時排查快取問題。
      window.__TPG_ONLINE_DATA_META = data.meta || {};

    } catch (err) {
      console.error('[OnlineLoader] 載入失敗:', err);
      if (loadingText) loadingText.textContent = '無法載入資料';
      if (loadingSubtext) loadingSubtext.textContent = `錯誤: ${err.message}`;
      setTimeout(() => {
        if (loadingOverlay) loadingOverlay.classList.remove('active');
        showErrorBanner(err.message);
      }, 2000);
      return;
    }

    if (loadingOverlay) loadingOverlay.classList.remove('active');
  }

  // ── 將 JSON 轉換為 app.js 可使用的 rawRecords 格式 ──
  function injectDataIntoApp(data) {
    // 從 dailyStats 重建輕量版 rawRecords（只含日期與重量，無識別資訊）
    const syntheticRecords = [];
    const dailyStats = data.dailyStats || {};

    Object.entries(dailyStats).forEach(([dateStr, stat]) => {
      // 為每個日期製作 stat.trips 筆合成記錄
      const tripsCount = stat.trips || 0;
      const weightPerTrip = tripsCount > 0 ? (stat.weightTons / tripsCount) : 0;
      for (let i = 0; i < tripsCount; i++) {
        syntheticRecords.push({
          '過磅日期': dateStr,
          '淨重': weightPerTrip,
          '_synthetic': true
        });
      }
    });

    // 呼叫 app.js 內的 processOnlineData（我們在 app.js 加入此接口）
    if (typeof window.__TPG_INJECT_ONLINE_DATA === 'function') {
      window.__TPG_INJECT_ONLINE_DATA(data);
    } else {
      // Fallback：直接觸發 loadDemoData 並替換資料
      console.warn('[OnlineLoader] __TPG_INJECT_ONLINE_DATA 不存在，使用 fallback');
      renderOnlineDashboard(data);
    }
  }

  // ── Fallback 渲染（當 app.js 接口不存在時） ─────────
  function renderOnlineDashboard(data) {
    const kpi = data.kpi || {};
    const voyages = data.voyages || [];

    // 強制更新 KPI 卡片
    setTextIfExists('kpiTotalWeight', `${(kpi.totalWeightTons || 0).toLocaleString()} <span style="font-size:1rem;">噸</span>`);
    setTextIfExists('kpiTotalTrips', `${(kpi.totalTrips || 0).toLocaleString()} <span style="font-size:1rem;">趟</span>`);
    setTextIfExists('kpiAvgWeight', `${kpi.totalTrips > 0 ? (kpi.totalWeightTons / kpi.totalTrips).toFixed(2) : '0'} <span style="font-size:1rem;">噸/趟</span>`);
    setTextIfExists('kpiUniqueTrucks', `-- <span style="font-size:1rem;">輛</span>`);

    // 更新船次總數標識
    const totalVoyagesEl = document.querySelector('[data-kpi="totalVoyages"]');
    if (totalVoyagesEl) totalVoyagesEl.textContent = `${voyages.length} 船次`;

    // 隱藏 loading
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  function setTextIfExists(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  // ── UI 輔助 ──────────────────────────────────────
  function showUpdateToast(timeStr) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem; z-index:9999;
      background:rgba(15,23,42,0.95); border:1px solid rgba(16,185,129,0.4);
      color:#e2e8f0; padding:0.75rem 1.2rem; border-radius:12px;
      font-size:0.8rem; font-weight:600; box-shadow:0 8px 32px rgba(0,0,0,0.4);
      display:flex; align-items:center; gap:0.5rem;
      animation:slideInRight 0.3s ease;
    `;
    toast.innerHTML = `<span style="color:#10b981;">✓</span> 資料已更新：${timeStr}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, 4000);
  }

  function showErrorBanner(msg) {
    const banner = document.createElement('div');
    banner.style.cssText = `
      position:fixed; top:1rem; left:50%; transform:translateX(-50%); z-index:9999;
      background:rgba(239,68,68,0.15); border:1px solid rgba(239,68,68,0.4);
      color:#fca5a5; padding:0.75rem 1.5rem; border-radius:12px;
      font-size:0.85rem; font-weight:600; max-width:90vw; text-align:center;
    `;
    banner.textContent = `⚠ 無法載入資料：${msg}`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 6000);
  }

})();
