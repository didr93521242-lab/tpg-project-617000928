import React from 'react';

export default function Navbar({ status, wsConnected }) {
  const getStatusClass = () => {
    switch (status) {
      case 'RUNNING': return 'running';
      case 'COMPLETED': return 'completed';
      case 'ERROR': return 'error';
      default: return 'idle';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'RUNNING': return '執行自動化中...';
      case 'COMPLETED': return '自動化完成';
      case 'ERROR': return '執行發生錯誤';
      default: return '系統待機中';
    }
  };

  return (
    <header className="glass-panel navbar">
      <div className="brand">
        <div className="brand-icon">A</div>
        <div>
          <h1 className="brand-title">Automation Studio</h1>
          <p className="brand-subtitle">Playwright 瀏覽器自動化與即時資料控制台</p>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '12px', color: wsConnected ? '#34d399' : '#f87171', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: wsConnected ? '#34d399' : '#f87171' }}></span>
          {wsConnected ? '即時連線中' : '連線斷開'}
        </div>
        <div className={`status-pill ${getStatusClass()}`}>
          <span className="dot"></span>
          {getStatusText()}
        </div>
      </div>
    </header>
  );
}
