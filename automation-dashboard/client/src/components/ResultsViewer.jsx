import React, { useState } from 'react';

export default function ResultsViewer({ results }) {
  const [filter, setFilter] = useState('');
  const [viewMode, setViewMode] = useState('table'); // table or json

  const filteredResults = (results || []).filter(item => 
    !filter || 
    (item.content && item.content.toLowerCase().includes(filter.toLowerCase())) ||
    (item.type && item.type.toLowerCase().includes(filter.toLowerCase()))
  );

  const handleExport = (format) => {
    window.open(`/api/automation/export?format=${format}`, '_blank');
  };

  return (
    <div className="glass-panel" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '700', fontFamily: 'var(--font-heading)' }}>
            擷取結果數據集 (Extracted Data)
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            目前共收錄 {results ? results.length : 0} 筆結構化網頁元素資料
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={() => setViewMode(viewMode === 'table' ? 'json' : 'table')}>
            切換為 {viewMode === 'table' ? 'JSON 檢視' : '表格檢視'}
          </button>
          <button className="btn-secondary" onClick={() => handleExport('csv')} disabled={!results || results.length === 0}>
            下載 CSV
          </button>
          <button className="btn-secondary" onClick={() => handleExport('json')} disabled={!results || results.length === 0}>
            下載 JSON
          </button>
        </div>
      </div>

      {/* Filter Input */}
      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="搜尋數據內容或標籤類型..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Content Rendering */}
      {viewMode === 'table' ? (
        <div className="table-container">
          {filteredResults.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
              無匹配的資料或尚未進行爬蟲任務
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>編號</th>
                  <th>類型</th>
                  <th>內容</th>
                  <th>目標連結</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>
                      <span className="tag-badge">{item.type || item.tag}</span>
                    </td>
                    <td style={{ fontWeight: '500', maxWidth: '400px' }}>{item.content}</td>
                    <td>
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                          {item.href.substring(0, 45)}...
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <pre style={{
          background: '#050811',
          padding: '16px',
          borderRadius: '10px',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          color: '#e2e8f0',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {JSON.stringify(filteredResults, null, 2)}
        </pre>
      )}
    </div>
  );
}
