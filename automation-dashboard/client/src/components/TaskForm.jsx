import React, { useState } from 'react';

export default function TaskForm({ onStartTask, isRunning }) {
  const [url, setUrl] = useState('https://news.ycombinator.com');
  const [action, setAction] = useState('scrape');
  const [customSelector, setCustomSelector] = useState('');
  const [headless, setHeadless] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url) return;
    onStartTask({
      url,
      action,
      customSelector: customSelector.trim() || null,
      headless
    });
  };

  return (
    <div className="glass-panel" style={{ height: '100%' }}>
      <h2 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '20px', fontFamily: 'var(--font-heading)' }}>
        發起自動化任務
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">目標網址 (Target URL)</label>
          <input
            type="url"
            className="form-input"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            disabled={isRunning}
          />
        </div>

        <div className="form-group">
          <label className="form-label">自動化模式 (Action Mode)</label>
          <select
            className="form-select"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            disabled={isRunning}
          >
            <option value="scrape">網頁資料結構化擷取與爬蟲</option>
            <option value="fill_form">表單自動化填寫測試</option>
          </select>
        </div>

        {action === 'scrape' && (
          <div className="form-group">
            <label className="form-label">指定 CSS 選擇器（選填）</label>
            <input
              type="text"
              className="form-input"
              placeholder="例如: .titleline > a, h1, .product-card"
              value={customSelector}
              onChange={(e) => setCustomSelector(e.target.value)}
              disabled={isRunning}
            />
          </div>
        )}

        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
          <input
            type="checkbox"
            id="headless-check"
            checked={headless}
            onChange={(e) => setHeadless(e.target.checked)}
            disabled={isRunning}
            style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
          />
          <label htmlFor="headless-check" style={{ fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>
            開啟無頭模式 (Headless Mode)
          </label>
        </div>

        <button type="submit" className="btn-primary" disabled={isRunning} style={{ marginTop: '24px' }}>
          {isRunning ? (
            <>
              <span className="dot" style={{ background: '#000', animation: 'pulse-glow 1s infinite' }}></span>
              自動化執行中...
            </>
          ) : (
            '啟動 Playwright 自動化引擎'
          )}
        </button>
      </form>
    </div>
  );
}
