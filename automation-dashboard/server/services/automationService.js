import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '../public');
const SCREENSHOT_DIR = path.join(PUBLIC_DIR, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

class AutomationService {
  constructor() {
    this.currentTask = null;
    this.logs = [];
    this.results = [];
    this.status = 'IDLE'; // IDLE, RUNNING, COMPLETED, ERROR
    this.listeners = new Set();
  }

  onLog(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  log(message, level = 'INFO', data = null) {
    const logItem = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      data
    };
    this.logs.push(logItem);
    this.listeners.forEach(cb => cb({ type: 'LOG', payload: logItem, status: this.status }));
  }

  updateStatus(status) {
    this.status = status;
    this.listeners.forEach(cb => cb({ type: 'STATUS', status: this.status }));
  }

  getStatus() {
    return {
      status: this.status,
      logs: this.logs,
      results: this.results,
      currentTask: this.currentTask
    };
  }

  async runTask(config) {
    if (this.status === 'RUNNING') {
      throw new Error('自動化任務已在執行中');
    }

    const { url, action = 'scrape', customSelector, formData, headless = true } = config;
    this.logs = [];
    this.results = [];
    this.currentTask = { url, action, startTime: new Date().toISOString() };
    this.updateStatus('RUNNING');
    this.log(`準備啟動 Playwright 瀏覽器引擎（${headless ? '無頭模式' : '視窗模式'}）...`, 'INFO');

    let browser = null;
    try {
      browser = await chromium.launch({
        headless: Boolean(headless),
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      this.log(`正在開啟目標網址：${url}`, 'INFO');

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      this.log(`網頁載入完成：${await page.title()}`, 'SUCCESS');

      // 擷取畫面截圖
      const screenshotFileName = `screenshot-${Date.now()}.png`;
      const screenshotPath = path.join(SCREENSHOT_DIR, screenshotFileName);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const screenshotUrl = `/screenshots/${screenshotFileName}`;
      this.log(`已成功拍攝頁面截圖`, 'SUCCESS', { screenshotUrl });

      if (action === 'scrape') {
        this.log(`開始進行網頁資料結構化擷取...`, 'INFO');

        let scrapedItems = [];
        if (customSelector) {
          this.log(`套用自訂 CSS 選擇器：${customSelector}`, 'INFO');
          const elements = await page.$$(customSelector);
          for (let i = 0; i < elements.length; i++) {
            const text = (await elements[i].innerText()).trim();
            if (text) {
              scrapedItems.push({ id: i + 1, selector: customSelector, content: text, type: 'Custom Element' });
            }
          }
        } else {
          // 預設擷取標題與主要連結
          const headings = await page.$$eval('h1, h2, h3', els => 
            els.map((e, idx) => ({ id: idx + 1, tag: e.tagName, content: e.innerText.trim(), type: 'Heading' }))
          );
          const links = await page.$$eval('a[href]', els => 
            els.slice(0, 15).map((e, idx) => ({ id: idx + 100, tag: 'A', content: e.innerText.trim() || e.href, href: e.href, type: 'Link' }))
          );
          scrapedItems = [...headings.filter(h => h.content), ...links.filter(l => l.content)];
        }

        this.results = scrapedItems;
        this.log(`資料擷取完成，共取得 ${scrapedItems.length} 筆項目`, 'SUCCESS', { itemCount: scrapedItems.length });

      } else if (action === 'fill_form') {
        this.log(`開始執行表單自動化填寫測試...`, 'INFO');
        if (formData && Array.isArray(formData)) {
          for (const item of formData) {
            if (item.selector && item.value) {
              await page.fill(item.selector, item.value);
              this.log(`在元素 ${item.selector} 填入資料：${item.value}`, 'INFO');
            }
          }
        }
        this.log(`自動化表單填寫已完成`, 'SUCCESS');
      }

      await browser.close();
      this.updateStatus('COMPLETED');
      this.log(`自動化任務順利執行完畢`, 'SUCCESS');
      return this.getStatus();

    } catch (error) {
      if (browser) await browser.close();
      this.log(`自動化執行過程發生錯誤：${error.message}`, 'ERROR');
      this.updateStatus('ERROR');
      throw error;
    }
  }

  exportData(format = 'json') {
    if (format === 'csv') {
      if (!this.results || this.results.length === 0) return 'id,type,content\n';
      const headers = ['id', 'type', 'content', 'href'];
      const rows = this.results.map(r => 
        `"${r.id}","${r.type || ''}","${(r.content || '').replace(/"/g, '""')}","${r.href || ''}"`
      );
      return [headers.join(','), ...rows].join('\n');
    }
    return JSON.stringify(this.results, null, 2);
  }
}

export const automationService = new AutomationService();
