import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { automationService } from './services/automationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 靜態檔案託管：截圖與目錄
const publicDir = path.join(__dirname, 'public');
app.use('/screenshots', express.static(path.join(publicDir, 'screenshots')));

// 整合 API 路由
app.use('/api/automation', apiRouter);

const server = http.createServer(app);

// 建立 WebSocket 伺服器
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('前端控制台已連線至 WebSocket');
  
  // 連線成功時發送當前狀態
  ws.send(JSON.stringify({ type: 'INIT', payload: automationService.getStatus() }));

  const unsubscribe = automationService.onLog((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });

  ws.on('close', () => {
    unsubscribe();
  });
});

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`後端自動化伺服器已啟動: http://localhost:${PORT}`);
  console.log(`=================================`);
});
