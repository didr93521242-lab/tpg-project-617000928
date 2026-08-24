import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar.jsx';
import TaskForm from './components/TaskForm.jsx';
import LiveConsole from './components/LiveConsole.jsx';
import ResultsViewer from './components/ResultsViewer.jsx';

export default function App() {
  const [status, setStatus] = useState('IDLE');
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [latestScreenshot, setLatestScreenshot] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  useEffect(() => {
    // 建立 WebSocket 即時連線
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:${window.location.port || '3001'}/ws`;
    
    let ws = null;

    function connect() {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'INIT') {
            setStatus(data.payload.status || 'IDLE');
            setLogs(data.payload.logs || []);
            setResults(data.payload.results || []);
          } else if (data.type === 'LOG') {
            setLogs((prev) => [...prev, data.payload]);
            if (data.payload.data && data.payload.data.screenshotUrl) {
              setLatestScreenshot(data.payload.data.screenshotUrl);
            }
          } else if (data.type === 'STATUS') {
            setStatus(data.status);
            if (data.status === 'COMPLETED' || data.status === 'ERROR') {
              // 重新同步最新結果
              fetchStatus();
            }
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // 2 秒後重新連線
          setTimeout(connect, 2000);
        };
      } catch (err) {
        console.error('WebSocket connection error:', err);
      }
    }

    connect();

    return () => {
      if (ws) ws.close();
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/automation/status');
      const data = await res.json();
      setStatus(data.status);
      setLogs(data.logs || []);
      setResults(data.results || []);
    } catch (err) {
      console.error('Fetch status error:', err);
    }
  };

  const handleStartTask = async (taskConfig) => {
    try {
      setStatus('RUNNING');
      setLatestScreenshot(null);
      
      const res = await fetch('/api/automation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskConfig)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '啟動任務失敗');
      }
    } catch (err) {
      alert(`啟動任務錯誤：${err.message}`);
      setStatus('ERROR');
    }
  };

  return (
    <div className="app-container">
      <Navbar status={status} wsConnected={wsConnected} />
      
      <main className="dashboard-grid">
        <section>
          <TaskForm onStartTask={handleStartTask} isRunning={status === 'RUNNING'} />
        </section>

        <section>
          <LiveConsole logs={logs} latestScreenshot={latestScreenshot} />
        </section>
      </main>

      <ResultsViewer results={results} />
    </div>
  );
}
