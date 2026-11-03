# -*- coding: utf-8 -*-
"""
sync_api.py — 台北港專案 · API 直連數據自動發布與快取彙總工具
=====================================================================
功能：
  1. 透過 X-API-Key 標頭直接請求台北港專案 API (192.168.2.7:8000)
  2. 具備本機磁碟快取機制 (Local Disk Cache)，防止短時間內重複下載 40MB 數據
  3. 自動轉換民國年 (日期A)、淨重 (出貨量A)、時間 (出廠時間A)
  4. 執行跨年度統計、船次分群 (GAP > 4天) 與匿名化處理
  5. 輸出 docs/data/project-data.json 供 GitHub Pages 靜態儀表板查詢
"""

import os
import sys
import json
import time
import datetime
import subprocess
import urllib.request
from pathlib import Path

# 修正 Windows 終端機輸出編碼
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DEFAULT_API_URL = "http://192.168.2.7:8000/api/test/v1/tpdashboard"
DEFAULT_API_KEY = ""

CACHE_DIR = Path(__file__).resolve().parent / ".cache"
CACHE_FILE = CACHE_DIR / "api_raw_cache.json"
CACHE_TTL_SECONDS = 1800  # 本機快取有效期：30 分鐘

DOCS_DATA_DIR = Path(__file__).resolve().parent / "docs" / "data"
OUTPUT_FILE = DOCS_DATA_DIR / "project-data.json"

COLUMN_ALIASES = {
    "date": ["日期A", "過磅日期", "日期", "出場日期", "進場日期", "作業日期", "稱重日期", "出廠日期", "報表日期", "計量日期", "時間", "日期時間", "Date", "date", "DateTime"],
    "net_weight": ["出貨量A", "淨重", "淨重(kg)", "淨重(KG)", "淨重(噸)", "淨重(公噸)", "凈重", "出貨量", "出貨量(噸)", "出貨量(kg)", "裝船量", "裝船淨重", "卡數量", "數量", "NetWeight", "實重", "重量"],
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

    # 民國年 7 碼 "1130312" 或 "1091214"
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

def fetch_api_data_with_cache(url, api_key, force_refresh=False):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # 檢查本機快取有效性
    if not force_refresh and CACHE_FILE.exists():
        cache_mtime = CACHE_FILE.stat().st_mtime
        cache_age = time.time() - cache_mtime
        if cache_age < CACHE_TTL_SECONDS:
            age_min = round(cache_age / 60, 1)
            print(f"⚡ 命中本機快取 (快取年齡: {age_min} 分鐘，有效期: {CACHE_TTL_SECONDS//60} 分鐘)")
            try:
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cached_data = json.load(f)
                    if isinstance(cached_data, dict) and "data" in cached_data:
                        return cached_data["data"], True
                    elif isinstance(cached_data, list):
                        return cached_data, True
            except Exception as e:
                print(f"⚠️ 讀取快取失敗 ({e})，重新向 API 請求...")

    print(f"📡 正在自 API 獲取資料 (X-API-Key: {api_key[:8]}...)...")
    print(f"   URL: {url}")

    headers = {
        "User-Agent": "TPG-Dashboard-Sync/2.0",
        "Accept": "application/json",
        "X-API-Key": api_key
    }

    # 1. 優先使用 urllib
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=35) as resp:
            content = resp.read().decode("utf-8")
            data_json = json.loads(content)

            # 寫入本機快取
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"💾 已建立本機原始快取: {CACHE_FILE}")

            if isinstance(data_json, dict) and "data" in data_json:
                return data_json["data"], False
            elif isinstance(data_json, list):
                return data_json, False
            return data_json, False
    except Exception as e:
        print(f"⚠️ urllib 請求失敗 ({e})，嘗試使用 curl.exe 備援...")

    # 2. 備援使用 curl.exe
    try:
        cmd = [
            "curl.exe", "-s",
            "--connect-timeout", "10",
            "-H", f"X-API-Key: {api_key}",
            "-H", "Accept: application/json",
            url
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        if result.returncode == 0 and result.stdout:
            data_json = json.loads(result.stdout)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                f.write(result.stdout)
            print(f"💾 已建立本機原始快取 (via curl): {CACHE_FILE}")

            if isinstance(data_json, dict) and "data" in data_json:
                return data_json["data"], False
            elif isinstance(data_json, list):
                return data_json, False
            return data_json, False
        else:
            raise RuntimeError(f"curl 執行失敗: {result.stderr}")
    except Exception as e:
        print(f"❌ API 擷取失敗: {e}")

        # 若連線失敗但存在過期快取，允許降級使用過期快取
        if CACHE_FILE.exists():
            print("⚠️ 網絡連線失敗，降級使用既有快取檔案繼續處理...")
            with open(CACHE_FILE, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
                return (cached_data.get("data", cached_data) if isinstance(cached_data, dict) else cached_data), True
        return None, False

def process_raw_data(raw_items):
    if not raw_items:
        return []

    sample = raw_items[0]
    date_key = None
    net_key = None
    time_key = None

    for k in sample.keys():
        k_clean = str(k).strip()
        if not date_key and any(alias.lower() in k_clean.lower() for alias in COLUMN_ALIASES["date"]):
            date_key = k
        if not net_key and any(alias.lower() in k_clean.lower() for alias in COLUMN_ALIASES["net_weight"]):
            net_key = k
        if not time_key and any(alias.lower() in k_clean.lower() for alias in COLUMN_ALIASES["time"]):
            time_key = k

    print(f"🔍 偵測欄位對應 -> 日期: [{date_key}], 淨重: [{net_key}], 時間: [{time_key}]")

    parsed_records = []
    for item in raw_items:
        date_val = item.get(date_key) if date_key else None
        d = robust_parse_date(date_val)
        if not d:
            continue

        net_val = item.get(net_key) if net_key else 0
        net_tons = parse_weight_to_tons(net_val)

        time_val = item.get(time_key) if time_key else None
        hour = parse_hour_from_time(time_val) if time_val else 0

        parsed_records.append({
            "date": d,
            "date_str": d.strftime("%Y-%m-%d"),
            "hour": hour,
            "net_weight_tons": net_tons
        })

    return parsed_records

def generate_dashboard_data(all_records, from_cache=False):
    all_records.sort(key=lambda r: (r["date"], r["hour"]))
    total_trips = len(all_records)
    total_weight = sum(r["net_weight_tons"] for r in all_records)
    total_weight_tons = round(total_weight)

    print(f"✅ 成功處理 {total_trips:,} 筆記錄，累計過磅量 {total_weight_tons:,} 噸")
    print("🔒 執行匿名化彙總運算與船次分群...")

    yearly_stats = {}
    for r in all_records:
        y = str(r["date"].year)
        if y not in yearly_stats:
            yearly_stats[y] = {"trips": 0, "weightTons": 0.0}
        yearly_stats[y]["trips"] += 1
        yearly_stats[y]["weightTons"] += r["net_weight_tons"]
    for y in yearly_stats:
        yearly_stats[y]["weightTons"] = round(yearly_stats[y]["weightTons"])

    monthly_stats = {}
    for r in all_records:
        m_str = r["date"].strftime("%Y-%m")
        if m_str not in monthly_stats:
            monthly_stats[m_str] = {"trips": 0, "weightTons": 0.0}
        monthly_stats[m_str]["trips"] += 1
        monthly_stats[m_str]["weightTons"] += r["net_weight_tons"]
    for m in monthly_stats:
        monthly_stats[m]["weightTons"] = round(monthly_stats[m]["weightTons"])

    daily_stats = {}
    for r in all_records:
        d_str = r["date_str"]
        if d_str not in daily_stats:
            daily_stats[d_str] = {"trips": 0, "weightTons": 0.0}
        daily_stats[d_str]["trips"] += 1
        daily_stats[d_str]["weightTons"] += r["net_weight_tons"]
    for d in daily_stats:
        daily_stats[d]["weightTons"] = round(daily_stats[d]["weightTons"], 1)

    hourly_trips = [0] * 24
    hourly_weight = [0.0] * 24
    for r in all_records:
        h = r["hour"]
        hourly_trips[h] += 1
        hourly_weight[h] += r["net_weight_tons"]
    hourly_weight_rounded = [round(w, 1) for w in hourly_weight]

    # 船次分群：除日期間隔外，利用每小時作業中斷與約 34,000 噸裝載上限
    # 切開同日連續兩船，避免兩船被合併成超過合理裝載量的單一船次。
    hourly_groups = {}
    for r in all_records:
        key = (r["date"], r["hour"])
        hourly_groups.setdefault(key, []).append(r)
    ordered_hours = sorted(hourly_groups, key=lambda k: datetime.datetime.combine(k[0], datetime.time(k[1])))
    voyage_groups = []
    current = []
    current_weight = 0.0
    previous_dt = None
    for key in ordered_hours:
        bucket_dt = datetime.datetime.combine(key[0], datetime.time(key[1]))
        bucket_records = hourly_groups[key]
        bucket_weight = sum(r["net_weight_tons"] for r in bucket_records)
        gap_hours = ((bucket_dt - previous_dt).total_seconds() / 3600) if previous_dt else 0
        if current and ((bucket_dt.date() - previous_dt.date()).days > 4 or
                        (gap_hours >= 1 and current_weight >= 33900)):
            voyage_groups.append(current)
            current = []
            current_weight = 0.0
        current.extend(bucket_records)
        current_weight += bucket_weight
        previous_dt = bucket_dt
    if current:
        voyage_groups.append(current)

    # 容量切分後可能留下少量尾段（例如 20~99 噸）。若其日期與前/後船次連續，
    # 視為同一船的切分誤差並合併，避免產生不合理的小船次。
    merged_groups = []
    for group in voyage_groups:
        group_weight = sum(r["net_weight_tons"] for r in group)
        if group_weight < 100 and merged_groups:
            prev = merged_groups[-1]
            prev_last = max(r["date"] for r in prev)
            group_first = min(r["date"] for r in group)
            if (group_first - prev_last).days <= 1:
                prev.extend(group)
                continue
        merged_groups.append(group)
    # 開頭小段若與下一船日期連續，併入下一船。
    if len(merged_groups) > 1 and sum(r["net_weight_tons"] for r in merged_groups[0]) < 100:
        first = merged_groups[0]
        next_group = merged_groups[1]
        if (max(r["date"] for r in first) - min(r["date"] for r in next_group)).days <= 1:
            next_group[0:0] = first
            merged_groups.pop(0)
    voyage_groups = merged_groups

    voyages = []
    total_v = len(voyage_groups)
    for idx, v_recs in enumerate(voyage_groups):
        v_idx = idx + 1
        v_weight = round(sum(r["net_weight_tons"] for r in v_recs))
        v_trips = len(v_recs)
        date_list = sorted(set(r["date"] for r in v_recs))
        s_date = date_list[0].strftime("%Y-%m-%d")
        e_date = date_list[-1].strftime("%Y-%m-%d")

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
        v_date_hour = {}
        for r in v_recs:
            h = r["hour"]
            v_h_trips[h] += 1
            v_h_weight[h] += r["net_weight_tons"]
            key = f"{r['date_str']} {h:02d}:00"
            if key not in v_date_hour:
                v_date_hour[key] = {"weight": 0.0, "trips": 0, "dateStr": r["date_str"], "hourStr": f"{h:02d}:00"}
            v_date_hour[key]["weight"] += r["net_weight_tons"]
            v_date_hour[key]["trips"] += 1

        active_work_hours = len(set(f"{r['date_str']} {r['hour']}" for r in v_recs)) or 1
        avg_rate_tons = round(v_weight / active_work_hours, 1)
        avg_rate_trips = round(v_trips / active_work_hours, 1)

        voyages.append({
            "index": v_idx,
            "name": f"第 {v_idx} 船次 ({s_date[5:]} ~ {e_date[5:]})",
            "startDate": s_date,
            "endDate": e_date,
            "durationDays": len(date_list),
            "totalWeightTons": v_weight,
            "totalTrips": v_trips,
            "avgHourlyRateTons": avg_rate_tons,
            "avgHourlyTrips": avg_rate_trips,
            "activeHours": active_work_hours,
            "dailyMap": v_daily,
            "hourlyTrips": v_h_trips,
            "hourlyWeight": [round(w, 1) for w in v_h_weight]
            ,"dateHourMap": v_date_hour
        })

    # 保持時間順序：最早船次為第 1 船次，最新船次為最後一船次

    return {
        "meta": {
            "publishedAt": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "projectName": "轉爐石台北港專案 (617000928)",
            "dataNote": "本資料為匿名彙總統計，不含原始車號與磅單明細",
            "totalRecords": total_trips,
            "fromCache": from_cache
        },
        "kpi": {
            "totalWeightTons": total_weight_tons,
            "totalTrips": total_trips,
            "totalVoyages": len(voyages),
            "dateRange": {
                "start": all_records[0]["date_str"] if all_records else "",
                "end": all_records[-1]["date_str"] if all_records else ""
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

def main():
    print("=" * 60)
    print("🚀 台北港專案 · API 直連與快取發布工具 (sync_api.py)")
    print("=" * 60)

    force_refresh = "--force" in sys.argv or "-f" in sys.argv
    api_url = DEFAULT_API_URL
    api_key = os.environ.get("TPG_API_KEY", DEFAULT_API_KEY).strip()
    if not api_key:
        print("❌ 未設定 TPG_API_KEY 環境變數，無法連線台北港 API。")
        print("   請先設定金鑰，或改用 publish.py 從本機 Excel 產生資料。")
        return 1

    # 支援指令參數傳入自訂 URL 或 Key
    for arg in sys.argv[1:]:
        if arg.startswith("http://") or arg.startswith("https://"):
            api_url = arg
        elif arg.startswith("ak_"):
            api_key = arg

    raw_data, from_cache = fetch_api_data_with_cache(api_url, api_key, force_refresh=force_refresh)

    if not raw_data:
        print("❌ 未能獲取任何有效數據")
        sys.exit(1)

    print(f"📦 獲取原始記錄: {len(raw_data):,} 筆 {'(快取)' if from_cache else '(最新 API 請求)'}")
    records = process_raw_data(raw_data)

    if not records:
        print("❌ 資料解析後無有效日期記錄")
        sys.exit(1)

    payload = generate_dashboard_data(records, from_cache=from_cache)

    DOCS_DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    kb_size = round(os.path.getsize(OUTPUT_FILE) / 1024, 1)
    print("=" * 60)
    print(f"🎉 發布數據產出完成！")
    print(f"   📁 檔案路徑: {OUTPUT_FILE}")
    print(f"   📦 檔案大小: {kb_size} KB")
    print(f"   🚢 辨識船次: 共 {len(payload['voyages'])} 船次")
    print(f"   ⚖️  總過磅量: {payload['kpi']['totalWeightTons']:,} 噸")
    print(f"   🚚 總車次數: {payload['kpi']['totalTrips']:,} 車次")
    print("=" * 60)

if __name__ == "__main__":
    sys.exit(main() or 0)
