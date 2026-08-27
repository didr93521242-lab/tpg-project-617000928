/**
 * publish.js — 台北港專案 · 本機資料發布工具
 * =====================================================
 * 功能：
 *   讀取本機 Excel/CSV 過磅資料 → 轉換為匿名彙總 JSON
 *   → 輸出至 docs/data/project-data.json（供 GitHub Pages 使用）
 *
 * 資料保護：
 *   ✅ 輸出：KPI 彙總、每日統計、船次摘要、小時分布
 *   ❌ 不輸出：原始車號、磅單號、逐筆明細記錄
 *
 * 執行方式：
 *   npm run publish
 * =====================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── 設定：Excel 資料夾路徑 ──────────────────────────────
const SOURCE_DIR = 'H:\\我的雲端硬碟\\APPsheet\\data\\轉爐石台北港專案-617000928';
const OUTPUT_DIR = path.join(__dirname, 'docs', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'project-data.json');

// ── 欄位別名對照表（與 app.js 同步） ────────────────────
const COLUMN_MAP = {
  date: ['過磅日期', '日期', '出場日期', '進場日期', '作業日期', '稱重日期', '出廠日期',
         '報表日期', '計量日期', '時間', '日期時間', 'Date', 'date', 'DateTime'],
  netWeight: ['淨重', '淨重(kg)', '淨重(KG)', '淨重(噸)', '淨重(公噸)', '凈重',
              '出貨量A', '出貨量', '出貨量(噸)', '出貨量(kg)',
              '裝船量', '裝船淨重', '卡數量', '數量',
              'NetWeight', '實重', '重量'],
  time: ['出廠時間A', '出廠時間', '出場時間A', '出場時間', '進場時間', '過磅時間', '時間', 'Time', 'time', 'TimeString']
};

// ── 工具函數 ──────────────────────────────────────────

function getColumnKey(records, aliases) {
  if (!records || records.length === 0) return null;
  const keys = Object.keys(records[0]);
  for (const alias of aliases) {
    const matched = keys.find(k => k.trim().toLowerCase().includes(alias.toLowerCase()));
    if (matched) return matched;
  }
  return null;
}

function parseWeightToTons(val) {
  if (val === null || val === undefined || val === '') return 0;
  const n = parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(n)) return 0;
  // 若數值 > 1000，判斷為 kg，轉換為噸
  return n > 1000 ? n / 1000 : n;
}

function robustParseDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  if (typeof val === 'number') {
    // ROC compact: 1140916
    if (val >= 1000101 && val <= 1991231) {
      const s = String(Math.floor(val));
      if (s.length === 7) {
        const rocYear = parseInt(s.slice(0, 3), 10);
        const month = parseInt(s.slice(3, 5), 10);
        const day = parseInt(s.slice(5, 7), 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const d = new Date(rocYear + 1911, month - 1, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    // Gregorian compact: 20250916
    if (val >= 19800101 && val <= 21001231) {
      const s = String(Math.floor(val));
      if (s.length === 8) {
        const year = parseInt(s.slice(0, 4), 10);
        const month = parseInt(s.slice(4, 6), 10);
        const day = parseInt(s.slice(6, 8), 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const d = new Date(year, month - 1, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
    }
    // Excel serial
    if (val > 1 && val < 200000) {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + val * 86400000);
      if (!isNaN(d.getTime()) && d.getFullYear() > 1980 && d.getFullYear() < 2100) return d;
    }
  }

  const str = String(val).trim();
  if (!str) return null;

  const compactRocMatch = str.match(/^(1[0-9]{2})(\d{2})(\d{2})$/);
  if (compactRocMatch) {
    const rocYear = parseInt(compactRocMatch[1], 10);
    const month = parseInt(compactRocMatch[2], 10);
    const day = parseInt(compactRocMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(rocYear + 1911, month - 1, day);
      if (!isNaN(d.getTime())) return d;
    }
  }

  const rocMatch = str.match(/^(\d{2,3})[/\-\.](\d{1,2})[/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (rocMatch) {
    let year = parseInt(rocMatch[1], 10);
    const month = parseInt(rocMatch[2], 10);
    const day = parseInt(rocMatch[3], 10);
    if (year < 200) year += 1911;
    const hour = rocMatch[4] ? parseInt(rocMatch[4], 10) : 0;
    const min = rocMatch[5] ? parseInt(rocMatch[5], 10) : 0;
    const sec = rocMatch[6] ? parseInt(rocMatch[6], 10) : 0;
    const d = new Date(year, month - 1, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d;
  }

  const stdMatch = str.match(/^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (stdMatch) {
    const d = new Date(
      parseInt(stdMatch[1], 10), parseInt(stdMatch[2], 10) - 1, parseInt(stdMatch[3], 10),
      stdMatch[4] ? parseInt(stdMatch[4], 10) : 0,
      stdMatch[5] ? parseInt(stdMatch[5], 10) : 0,
      stdMatch[6] ? parseInt(stdMatch[6], 10) : 0
    );
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  if (!isNaN(fallback.getTime()) && fallback.getFullYear() > 1980) return fallback;
  return null;
}

function applyTimeToDate(d, timeVal) {
  if (!d || isNaN(d.getTime())) return d;
  if (timeVal === undefined || timeVal === null || timeVal === '') return d;
  const str = String(timeVal).trim();
  const colonMatch = str.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10);
    const m = parseInt(colonMatch[2], 10);
    const s = colonMatch[3] ? parseInt(colonMatch[3], 10) : 0;
    if (h >= 0 && h < 24 && m >= 0 && m < 60) d.setHours(h, m, s);
    return d;
  }
  if (/^\d{5,6}$/.test(str)) {
    const padded = str.padStart(6, '0');
    const h = parseInt(padded.slice(0, 2), 10);
    const m = parseInt(padded.slice(2, 4), 10);
    const s = parseInt(padded.slice(4, 6), 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) d.setHours(h, m, s);
  }
  return d;
}

function formatDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function smartReadSheet(ws) {
  const allAliases = [...COLUMN_MAP.date, ...COLUMN_MAP.netWeight];
  for (let offset = 0; offset <= 4; offset++) {
    const json = XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true, range: offset });
    if (!json || json.length === 0) continue;
    const keys = Object.keys(json[0]);
    const emptyRatio = keys.filter(k => k.startsWith('__EMPTY')).length / keys.length;
    if (emptyRatio > 0.5) continue;
    const hasKnownCol = allAliases.some(alias =>
      keys.some(k => k.trim().toLowerCase().includes(alias.toLowerCase()))
    );
    if (hasKnownCol || offset === 0) return json;
  }
  return XLSX.utils.sheet_to_json(ws, { defval: '', cellDates: true });
}

// ── 主流程 ────────────────────────────────────────────

async function main() {
  console.log('🚀 台北港專案 · 資料發布工具');
  console.log('='.repeat(50));
  console.log(`📂 來源資料夾: ${SOURCE_DIR}`);
  console.log(`📄 輸出檔案:  ${OUTPUT_FILE}`);
  console.log('');

  // 1. 掃描 Excel/CSV 檔案
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`❌ 資料夾不存在: ${SOURCE_DIR}`);
    console.error('   請確認 Google Drive 已同步，或手動修改 SOURCE_DIR 路徑。');
    process.exit(1);
  }

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => (f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) && !f.startsWith('~$'))
    .map(f => path.join(SOURCE_DIR, f));

  if (files.length === 0) {
    console.error('❌ 資料夾內無 Excel/CSV 檔案');
    process.exit(1);
  }

  console.log(`📊 找到 ${files.length} 個資料檔案:`);
  files.forEach(f => console.log(`   • ${path.basename(f)}`));
  console.log('');

  // 2. 讀取並解析所有檔案
  let allRecords = [];

  for (const filePath of files) {
    const fileName = path.basename(filePath);
    process.stdout.write(`   解析 ${fileName}...`);

    try {
      const buffer = fs.readFileSync(filePath);
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = smartReadSheet(ws);
        if (!rows || rows.length === 0) continue;

        const dateKey = getColumnKey(rows, COLUMN_MAP.date);
        if (!dateKey) continue; // 略過無日期欄位的工作表

        const netKey = getColumnKey(rows, COLUMN_MAP.netWeight);
        const timeKey = getColumnKey(rows, COLUMN_MAP.time);

        let count = 0;
        rows.forEach(r => {
          if (!r[dateKey]) return;
          const d = robustParseDate(r[dateKey]);
          if (!d) return;
          if (timeKey && r[timeKey] !== undefined) applyTimeToDate(d, r[timeKey]);
          const net = netKey ? parseWeightToTons(r[netKey]) : 0;
          allRecords.push({
            date: d,
            dateStr: formatDate(d),
            hour: d.getHours(),
            netWeightTons: net
          });
          count++;
        });

        if (count > 0) process.stdout.write(` ${sheetName}(${count}筆)`);
      }
      console.log(' ✅');
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  if (allRecords.length === 0) {
    console.error('\n❌ 沒有解析到任何有效記錄');
    process.exit(1);
  }

  console.log(`\n✅ 共解析 ${allRecords.length.toLocaleString()} 筆記錄`);
  console.log('');
  console.log('🔒 匿名化處理中（移除原始車號/磅單號）...');

  // 3. 計算彙總統計（不含任何原始識別資訊）
  allRecords.sort((a, b) => a.date - b.date);

  const totalWeightTons = Math.round(allRecords.reduce((s, r) => s + r.netWeightTons, 0));
  const totalTrips = allRecords.length;

  // 年度統計
  const yearlyMap = {};
  allRecords.forEach(r => {
    const year = r.date.getFullYear();
    if (!yearlyMap[year]) yearlyMap[year] = { trips: 0, weightTons: 0 };
    yearlyMap[year].trips++;
    yearlyMap[year].weightTons += r.netWeightTons;
  });
  Object.keys(yearlyMap).forEach(y => {
    yearlyMap[y].weightTons = Math.round(yearlyMap[y].weightTons);
  });

  // 月度統計
  const monthlyMap = {};
  allRecords.forEach(r => {
    const key = `${r.date.getFullYear()}-${String(r.date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[key]) monthlyMap[key] = { trips: 0, weightTons: 0 };
    monthlyMap[key].trips++;
    monthlyMap[key].weightTons += r.netWeightTons;
  });
  Object.keys(monthlyMap).forEach(k => {
    monthlyMap[k].weightTons = Math.round(monthlyMap[k].weightTons);
  });

  // 每日統計
  const dailyMap = {};
  allRecords.forEach(r => {
    if (!dailyMap[r.dateStr]) dailyMap[r.dateStr] = { trips: 0, weightTons: 0 };
    dailyMap[r.dateStr].trips++;
    dailyMap[r.dateStr].weightTons += r.netWeightTons;
  });
  Object.keys(dailyMap).forEach(k => {
    dailyMap[k].weightTons = Math.round(dailyMap[k].weightTons * 10) / 10;
  });

  // 小時分布（全專案）
  const hourlyTrips = Array(24).fill(0);
  const hourlyWeight = Array(24).fill(0);
  allRecords.forEach(r => {
    hourlyTrips[r.hour]++;
    hourlyWeight[r.hour] += r.netWeightTons;
  });
  const hourlyWeightRounded = hourlyWeight.map(w => Math.round(w * 10) / 10);

  // 4. 船次分群（GAP > 4 天 = 新船次）
  const GAP_THRESHOLD_DAYS = 4;
  const uniqueDateStrs = [...new Set(allRecords.map(r => r.dateStr))].sort();

  const voyageDateGroups = [];
  let currentGroup = [uniqueDateStrs[0]];
  for (let i = 1; i < uniqueDateStrs.length; i++) {
    const prev = new Date(uniqueDateStrs[i - 1] + 'T00:00:00');
    const curr = new Date(uniqueDateStrs[i] + 'T00:00:00');
    const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);
    if (diffDays > GAP_THRESHOLD_DAYS) {
      voyageDateGroups.push([...currentGroup]);
      currentGroup = [uniqueDateStrs[i]];
    } else {
      currentGroup.push(uniqueDateStrs[i]);
    }
  }
  if (currentGroup.length > 0) voyageDateGroups.push([...currentGroup]);

  // 為每個船次建立匿名彙總
  const voyages = voyageDateGroups.map((dateGroup, idx) => {
    const dateSet = new Set(dateGroup);
    const voyageRecs = allRecords.filter(r => dateSet.has(r.dateStr));
    const voyageWeight = Math.round(voyageRecs.reduce((s, r) => s + r.netWeightTons, 0));
    const voyageTrips = voyageRecs.length;
    const startDate = dateGroup[0];
    const endDate = dateGroup[dateGroup.length - 1];

    // 每日彙總
    const vDailyMap = {};
    voyageRecs.forEach(r => {
      if (!vDailyMap[r.dateStr]) vDailyMap[r.dateStr] = { trips: 0, weightTons: 0 };
      vDailyMap[r.dateStr].trips++;
      vDailyMap[r.dateStr].weightTons += r.netWeightTons;
    });
    Object.keys(vDailyMap).forEach(k => {
      vDailyMap[k].weightTons = Math.round(vDailyMap[k].weightTons * 10) / 10;
    });

    // 小時分布
    const vHourlyTrips = Array(24).fill(0);
    const vHourlyWeight = Array(24).fill(0);
    const vDateHourMap = {};
    voyageRecs.forEach(r => {
      vHourlyTrips[r.hour]++;
      vHourlyWeight[r.hour] += r.netWeightTons;
      const key = `${r.dateStr} ${String(r.hour).padStart(2, '0')}:00`;
      if (!vDateHourMap[key]) vDateHourMap[key] = { weight: 0, trips: 0, dateStr: r.dateStr, hourStr: `${String(r.hour).padStart(2, '0')}:00` };
      vDateHourMap[key].weight += r.netWeightTons;
      vDateHourMap[key].trips++;
    });

    // 計算速率
    const activeHours = Object.keys(
      voyageRecs.reduce((acc, r) => {
        const hk = `${r.dateStr} ${String(r.hour).padStart(2, '0')}`;
        acc[hk] = 1;
        return acc;
      }, {})
    ).length || 1;

    return {
      index: idx + 1,
      name: `第 ${idx + 1} 船次`,
      startDate,
      endDate,
      durationDays: dateGroup.length,
      totalWeightTons: voyageWeight,
      totalTrips: voyageTrips,
      avgHourlyRateTons: Math.round((voyageWeight / activeHours) * 10) / 10,
      avgHourlyTrips: Math.round((voyageTrips / activeHours) * 10) / 10,
      activeHours,
      dailyMap: vDailyMap,
      hourlyTrips: vHourlyTrips,
      hourlyWeight: vHourlyWeight.map(w => Math.round(w * 10) / 10),
      dateHourMap: vDateHourMap
    };
  });

  // 5. 組裝輸出 JSON
  const outputData = {
    meta: {
      publishedAt: new Date().toISOString(),
      projectName: '轉爐石台北港專案 (617000928)',
      dataNote: '本資料為匿名彙總統計，不含原始車號或磅單號',
      totalRecords: totalTrips
    },
    kpi: {
      totalWeightTons,
      totalTrips,
      totalVoyages: voyages.length,
      dateRange: {
        start: allRecords[0].dateStr,
        end: allRecords[allRecords.length - 1].dateStr
      }
    },
    yearlyStats: yearlyMap,
    monthlyStats: monthlyMap,
    dailyStats: dailyMap,
    hourlyStats: {
      trips: hourlyTrips,
      weightTons: hourlyWeightRounded
    },
    voyages
  };

  // 6. 寫出檔案
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 建立目錄: ${OUTPUT_DIR}`);
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2), 'utf8');
  const fileSizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);

  console.log('');
  console.log('='.repeat(50));
  console.log(`✅ 發布完成！`);
  console.log(`   📄 ${OUTPUT_FILE}`);
  console.log(`   📦 檔案大小: ${fileSizeKB} KB`);
  console.log(`   📊 總船次數: ${voyages.length} 船次`);
  console.log(`   ⚖️  總重量:   ${totalWeightTons.toLocaleString()} 噸`);
  console.log(`   🚚 總車次數: ${totalTrips.toLocaleString()} 趟`);
  console.log('');
  console.log('📋 下一步：');
  console.log('   git add docs/data/project-data.json');
  console.log('   git commit -m "Update: 同步最新作業數據"');
  console.log('   git push');
  console.log('='.repeat(50));
}

main().catch(err => {
  console.error('\n❌ 發布失敗:', err.message);
  process.exit(1);
});
