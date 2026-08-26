# -*- coding: utf-8 -*-
"""
publish.py — 台北港專案 · 本機資料自動發布與匿名化彙總工具
=====================================================================
功能：
  1. 掃描 Google Drive / 本機過磅資料夾中的 Excel / CSV 檔案
  2. 智慧解析跨年度數據、自動辨識日期與淨重欄位、自動分群船次
  3. 進行完整匿名化彙總（去除車號、磅單號、明細）
  4. 產出 docs/data/project-data.json 供 GitHub Pages 靜態儀表板查詢
"""

import os
import sys
import glob
import json
import datetime
from pathlib import Path
import openpyxl

# 修正 Windows 終端機輸出編碼
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

SOURCE_DIR = r"H:\我的雲端硬碟\APPsheet\data\轉爐石台北港專案-617000928"
DOCS_DATA_DIR = Path(__file__).resolve().parent / "docs" / "data"
OUTPUT_FILE = DOCS_DATA_DIR / "project-data.json"

COLUMN_ALIASES = {
    "date": ["過磅日期", "日期", "出場日期", "進場日期", "作業日期", "稱重日期", "出廠日期", "報表日期", "計量日期", "時間", "日期時間", "Date", "date", "DateTime"],
    "net_weight": ["淨重", "淨重(kg)", "淨重(KG)", "淨重(噸)", "淨重(公噸)", "凈重", "出貨量A", "出貨量", "出貨量(噸)", "出貨量(kg)", "裝船量", "裝船淨重", "卡數量", "數量", "NetWeight", "實重", "重量"],
    "time": ["出廠時間A", "出廠時間", "出場時間A", "出場時間", "進場時間", "過磅時間", "時間", "Time", "time", "TimeString"]
}

def parse_weight_to_tons(val):
    if val is None or val == "":
        return 0.0
    try:
        if isinstance(val, (int, float)):
            n = float(val)
        else:
            s = str(val).replace(",", "").strip()
            n = float(s)
        if n > 1000:
            return n / 1000.0
        return n
    except Exception:
        return 0.0

def robust_parse_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, datetime.datetime):
        return val.date()
    if isinstance(val, datetime.date):
        return val

    # 數值型處理（民國年緊湊碼如 1140916 或 西元 20250916 或 Excel serial）
    if isinstance(val, (int, float)):
        val_int = int(val)
        if 1000101 <= val_int <= 1991231:
            s = str(val_int)
            roc_y = int(s[:3])
            m = int(s[3:5])
            d = int(s[5:7])
            if 1 <= m <= 12 and 1 <= d <= 31:
                return datetime.date(roc_y + 1911, m, d)
        elif 19800101 <= val_int <= 21001231:
            s = str(val_int)
            y = int(s[:4])
            m = int(s[4:6])
            d = int(s[6:8])
            if 1 <= m <= 12 and 1 <= d <= 31:
                return datetime.date(y, m, d)
        elif 1 < val_int < 200000:
            epoch = datetime.datetime(1899, 12, 30)
            target = epoch + datetime.timedelta(days=val)
            if 1980 <= target.year <= 2100:
                return target.date()

    s = str(val).strip()
    if not s:
        return None

    # 民國年 7 碼 "1130312"
    if len(s) == 7 and s.isdigit():
        roc_y = int(s[:3])
        m = int(s[3:5])
        d = int(s[5:7])
        if 1 <= m <= 12 and 1 <= d <= 31:
            return datetime.date(roc_y + 1911, m, d)

    # 西元 8 碼 "20240312"
    if len(s) == 8 and s.isdigit():
        y = int(s[:4])
        m = int(s[4:6])
        d = int(s[6:8])
        if 1 <= m <= 12 and 1 <= d <= 31:
            return datetime.date(y, m, d)

    # 帶分隔號民國年 113/03/12 或 113-03-12
    import re
    m_roc = re.match(r"^(\d{2,3})[/\-\.](\d{1,2})[/\-\.](\d{1,2})", s)
    if m_roc:
        y = int(m_roc.group(1))
        m = int(m_roc.group(2))
        d = int(m_roc.group(3))
        if y < 200:
            y += 1911
        if 1980 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
            return datetime.date(y, m, d)

    # 西元年 2024/03/12
    m_std = re.match(r"^(\d{4})[/\-\.](\d{1,2})[/\-\.](\d{1,2})", s)
    if m_std:
        y = int(m_std.group(1))
        m = int(m_std.group(2))
        d = int(m_std.group(3))
        if 1980 <= y <= 2100 and 1 <= m <= 12 and 1 <= d <= 31:
            return datetime.date(y, m, d)

    return None

def parse_hour_from_time(val):
    if val is None or val == "":
        return 0
    if isinstance(val, (datetime.time, datetime.datetime)):
        return val.hour
    s = str(val).strip()
    import re
    m = re.match(r"^(\d{1,2}):(\d{1,2})", s)
    if m:
        h = int(m.group(1))
        if 0 <= h < 24:
            return h
    if re.match(r"^\d{5,6}$", s):
        padded = s.zfill(6)
        h = int(padded[:2])
        if 0 <= h < 24:
            return h
    if re.match(r"^\d{3,4}$", s):
        padded = s.zfill(4)
        h = int(padded[:2])
        if 0 <= h < 24:
            return h
    return 0

def find_column_indices(headers):
    mapping = {}
    for standard_col, aliases in COLUMN_ALIASES.items():
        found_idx = None
        for alias in aliases:
            for idx, h in enumerate(headers):
                if h and alias.lower() in str(h).strip().lower():
                    found_idx = idx
                    break
            if found_idx is not None:
                break
        mapping[standard_col] = found_idx
    return mapping

def read_sheet_data(sheet):
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return []

    # 嘗試前 5 列找到含 date 的 header
    for header_offset in range(min(5, len(rows))):
        header_row = rows[header_offset]
        col_map = find_column_indices(header_row)
        if col_map["date"] is not None:
            records = []
            for r in rows[header_offset + 1:]:
                if not r or len(r) <= col_map["date"]:
                    continue
                date_val = r[col_map["date"]]
                d = robust_parse_date(date_val)
                if not d:
                    continue
                
                net_val = r[col_map["net_weight"]] if col_map["net_weight"] is not None and len(r) > col_map["net_weight"] else 0
                time_val = r[col_map["time"]] if col_map["time"] is not None and len(r) > col_map["time"] else None

                net_tons = parse_weight_to_tons(net_val)
                hour = parse_hour_from_time(time_val) if time_val else 0

                records.append({
                    "date": d,
                    "date_str": d.strftime("%Y-%m-%d"),
                    "hour": hour,
                    "net_weight_tons": net_tons
                })
            return records
    return []

def main():
    print("=" * 60)
    print("🚀 台北港專案 · 資料發布工具 (publish.py)")
    print("=" * 60)
    print(f"📂 來源資料夾: {SOURCE_DIR}")
    print(f"📄 輸出檔案:  {OUTPUT_FILE}")
    print()

    if not os.path.exists(SOURCE_DIR):
        print(f"❌ 錯誤: 找不到資料夾 {SOURCE_DIR}")
        sys.exit(1)

    files = [
        os.path.join(SOURCE_DIR, f) for f in os.listdir(SOURCE_DIR)
        if (f.endswith(".xlsx") or f.endswith(".xls") or f.endswith(".csv")) and not f.startswith("~$")
    ]

    if not files:
        print("❌ 錯誤: 資料夾內無可讀取的 Excel 檔案")
        sys.exit(1)

    print(f"📊 找到 {len(files)} 個資料檔案:")
    for f in files:
        print(f"   • {os.path.basename(f)}")
    print()

    all_records = []
    for fpath in files:
        fname = os.path.basename(fpath)
        print(f"   正在解析 {fname}...", end="", flush=True)
        try:
            wb = openpyxl.load_workbook(fpath, read_only=True, data_only=True)
            for sheetname in wb.sheetnames:
                ws = wb[sheetname]
                sheet_records = read_sheet_data(ws)
                if sheet_records:
                    all_records.extend(sheet_records)
                    print(f" [{sheetname}: {len(sheet_records)}筆]", end="", flush=True)
            wb.close()
            print(" ✅")
        except Exception as e:
            print(f" ❌ {e}")

    if not all_records:
        print("\n❌ 未能解析出任何有效數據記錄")
        sys.exit(1)

    all_records.sort(key=lambda r: (r["date"], r["hour"]))
    total_trips = len(all_records)
    total_weight = sum(r["net_weight_tons"] for r in all_records)
    total_weight_tons = round(total_weight)

    print(f"\n✅ 成功解析 {total_trips:,} 筆記錄，累計過磅量 {total_weight_tons:,} 噸")
    print("🔒 執行匿名化彙總運算...")

    # 年度統計
    yearly_stats = {}
    for r in all_records:
        y = str(r["date"].year)
        if y not in yearly_stats:
            yearly_stats[y] = {"trips": 0, "weightTons": 0.0}
        yearly_stats[y]["trips"] += 1
        yearly_stats[y]["weightTons"] += r["net_weight_tons"]
    for y in yearly_stats:
        yearly_stats[y]["weightTons"] = round(yearly_stats[y]["weightTons"])

    # 月度統計
    monthly_stats = {}
    for r in all_records:
        m_str = r["date"].strftime("%Y-%m")
        if m_str not in monthly_stats:
            monthly_stats[m_str] = {"trips": 0, "weightTons": 0.0}
        monthly_stats[m_str]["trips"] += 1
        monthly_stats[m_str]["weightTons"] += r["net_weight_tons"]
    for m in monthly_stats:
        monthly_stats[m]["weightTons"] = round(monthly_stats[m]["weightTons"])

    # 每日統計
    daily_stats = {}
    for r in all_records:
        d_str = r["date_str"]
        if d_str not in daily_stats:
            daily_stats[d_str] = {"trips": 0, "weightTons": 0.0}
        daily_stats[d_str]["trips"] += 1
        daily_stats[d_str]["weightTons"] += r["net_weight_tons"]
    for d in daily_stats:
        daily_stats[d]["weightTons"] = round(daily_stats[d]["weightTons"], 1)

    # 24 小時分布
    hourly_trips = [0] * 24
    hourly_weight = [0.0] * 24
    for r in all_records:
        h = r["hour"]
        hourly_trips[h] += 1
        hourly_weight[h] += r["net_weight_tons"]
    hourly_weight_rounded = [round(w, 1) for w in hourly_weight]

    # 船次分群（GAP > 4 天為新船次）
    unique_dates = sorted(list(set(r["date"] for r in all_records)))
    voyage_date_groups = []
    curr_group = [unique_dates[0]]
    for i in range(1, len(unique_dates)):
        prev = unique_dates[i - 1]
        curr = unique_dates[i]
        diff_days = (curr - prev).days
        if diff_days > 4:
            voyage_date_groups.append(curr_group)
            curr_group = [curr]
        else:
            curr_group.append(curr)
    if curr_group:
        voyage_date_groups.append(curr_group)

    voyages = []
    total_v = len(voyage_date_groups)
    for idx, date_group in enumerate(voyage_date_groups):
        v_idx = total_v - idx  # 倒序
        v_date_set = set(date_group)
        v_recs = [r for r in all_records if r["date"] in v_date_set]
        v_weight = round(sum(r["net_weight_tons"] for r in v_recs))
        v_trips = len(v_recs)
        s_date = date_group[0].strftime("%Y-%m-%d")
        e_date = date_group[-1].strftime("%Y-%m-%d")

        v_daily = {}
        for r in v_recs:
            ds = r["date_str"]
            if ds not in v_daily:
                v_daily[ds] = {"trips": 0, "weightTons": 0.0}
            v_daily[ds]["trips"] += 1
            v_daily[ds]["weightTons"] += r["net_weight_tons"]
        for ds in v_daily:
            v_daily[ds]["weightTons"] = round(v_daily[ds]["weightTons"], 1)

        v_h_trips = [0] * 24
        v_h_weight = [0.0] * 24
        for r in v_recs:
            h = r["hour"]
            v_h_trips[h] += 1
            v_h_weight[h] += r["net_weight_tons"]

        active_work_hours = len(set(f"{r['date_str']} {r['hour']}" for r in v_recs)) or 1
        avg_rate_tons = round(v_weight / active_work_hours, 1)
        avg_rate_trips = round(v_trips / active_work_hours, 1)

        voyages.append({
            "index": v_idx,
            "name": f"第 {v_idx} 船次 ({s_date[5:]} ~ {e_date[5:]})",
            "startDate": s_date,
            "endDate": e_date,
            "durationDays": len(date_group),
            "totalWeightTons": v_weight,
            "totalTrips": v_trips,
            "avgHourlyRateTons": avg_rate_tons,
            "avgHourlyTrips": avg_rate_trips,
            "activeHours": active_work_hours,
            "dailyMap": v_daily,
            "hourlyTrips": v_h_trips,
            "hourlyWeight": [round(w, 1) for w in v_h_weight]
        })

    # 保持時間順序：最早船次為第 1 船次，最新船次為最後一船次

    output_payload = {
        "meta": {
            "publishedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "projectName": "轉爐石台北港專案 (617000928)",
            "dataNote": "本資料為匿名彙總統計，不含原始車號與磅單明細",
            "totalRecords": total_trips
        },
        "kpi": {
            "totalWeightTons": total_weight_tons,
            "totalTrips": total_trips,
            "totalVoyages": len(voyages),
            "dateRange": {
                "start": all_records[0]["date_str"],
                "end": all_records[-1]["date_str"]
            }
        },
        "yearlyStats": yearly_stats,
        "monthlyStats": monthly_stats,
        "dailyStats": daily_stats,
        "hourlyStats": {
            "trips": hourly_trips,
            "weightTons": hourly_weight_rounded
        },
        "voyages": voyages
    }

    DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_payload, f, ensure_ascii=False, indent=2)

    kb_size = round(os.path.getsize(OUTPUT_FILE) / 1024, 1)
    print("=" * 60)
    print(f"🎉 匿名化發布數據產出完成！")
    print(f"   📁 檔案路徑: {OUTPUT_FILE}")
    print(f"   📦 檔案大小: {kb_size} KB")
    print(f"   🚢 辨識船次: 共 {len(voyages)} 船次")
    print(f"   ⚖️  總過磅量: {total_weight_tons:,} 噸")
    print(f"   🚚 總車次數: {total_trips:,} 車次")
    print("=" * 60)

if __name__ == "__main__":
    main()
