import React, { useEffect, useRef } from 'react';

export default function LiveConsole({ logs, latestScreenshot }) {
  const consoleRef = useRef(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
          即時執行控制台 & 瀏覽器畫面
        </h2>
        <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          {logs.length} 筆紀錄
        </span>
      </div>

      {/* Terminal Log Console */}
      <div className="console-window" ref={consoleRef}>
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', paddingTop: '40px' }}>
            尚未執行任何任務，點擊左側「啟動 Playwright 自動化引擎」開始
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="log-entry">
              <span className="log-time">[{log.timestamp}]</span>
              <span className={`log-level ${log.level}`}>{log.level}</span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Live Screenshot Preview */}
      {latestScreenshot && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>
            網頁執行畫面截圖 (Latest Screenshot)
          </div>
          <div className="screenshot-container">
            <img src={latestScreenshot} alt="Playwright Screenshot" className="screenshot-img" />
          </div>
        </div>
      )}
    </div>
  );
}
