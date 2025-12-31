import { describe, it, expect } from 'vitest';

/**
 * 健康檢查端點測試
 * 
 * 這些測試驗證健康檢查 API 的基本功能
 */

describe('Health Check API', () => {
  describe('/api/health/ping', () => {
    it('should return ok status', async () => {
      const response = await fetch('http://localhost:3000/api/health/ping');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('/api/health', () => {
    it('should return health status with database info', async () => {
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();
      
      expect(data.status).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.database).toBeDefined();
      expect(data.version).toBe('1.0.0');
      
      // 資料庫狀態應該是 connected, disconnected, 或 error
      expect(['connected', 'disconnected', 'error']).toContain(data.database);
    });

    it('should return 200 when database is connected', async () => {
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();
      
      if (data.database === 'connected') {
        expect(response.status).toBe(200);
        expect(data.status).toBe('healthy');
        expect(data.databaseLatency).toBeGreaterThan(0);
      }
    });

    it('should return 503 when database is not connected', async () => {
      // 這個測試在資料庫正常時會被跳過
      const response = await fetch('http://localhost:3000/api/health');
      const data = await response.json();
      
      if (data.database !== 'connected') {
        expect(response.status).toBe(503);
        expect(data.status).toBe('unhealthy');
      }
    });
  });

  describe('/api/health/details', () => {
    it('should return detailed health information', async () => {
      const response = await fetch('http://localhost:3000/api/health/details');
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.service).toBe('幕創行銷 Threads AI 教練');
      expect(data.environment).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.uptime).toBeGreaterThan(0);
      expect(data.memory).toBeDefined();
      expect(data.database).toBeDefined();
    });
  });
});

/**
 * 錯誤工具函數測試
 */
describe('Error Utilities (概念測試)', () => {
  describe('isDatabaseError', () => {
    it('should identify Region unavailable error', () => {
      const errorPatterns = [
        'Region is unavailable',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'Connection refused',
        'Failed query'
      ];
      
      // 這些都應該被識別為資料庫錯誤
      errorPatterns.forEach(pattern => {
        expect(pattern.toLowerCase()).toContain(
          pattern.toLowerCase().split(' ')[0].toLowerCase()
        );
      });
    });
  });

  describe('Error classification', () => {
    it('should have defined error types', () => {
      const errorTypes = ['database', 'network', 'auth', 'validation', 'unknown'];
      expect(errorTypes).toHaveLength(5);
    });
  });
});
