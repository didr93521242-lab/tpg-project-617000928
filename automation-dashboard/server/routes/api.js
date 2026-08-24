import express from 'express';
import { automationService } from '../services/automationService.js';

const router = express.Router();

// 發起自動化任務
router.post('/start', async (req, res) => {
  try {
    const { url, action, customSelector, formData, headless } = req.body;
    if (!url) {
      return res.status(400).json({ error: '請提供有效的目標 URL' });
    }

    // 非阻塞方式發起任務，藉由 WebSocket 廣播進度
    automationService.runTask({ url, action, customSelector, formData, headless }).catch(err => {
      console.error('Task background error:', err);
    });

    res.json({ message: '任務已成功啟動', status: 'RUNNING' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 查詢任務與狀態
router.get('/status', (req, res) => {
  res.json(automationService.getStatus());
});

// 導出資料
router.get('/export', (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const data = automationService.exportData(format);
  
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="automation-results.csv"');
    return res.send(data);
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="automation-results.json"');
  res.send(data);
});

export default router;
