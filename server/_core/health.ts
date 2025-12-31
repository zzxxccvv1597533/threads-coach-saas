import { Express, Request, Response } from 'express';
import { getDb } from '../db';
import { sql } from 'drizzle-orm';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: 'connected' | 'disconnected' | 'error';
  databaseLatency?: number;
  error?: string;
  version: string;
}

/**
 * 檢查資料庫連線狀態
 */
async function checkDatabaseHealth(): Promise<{ 
  status: 'connected' | 'disconnected' | 'error'; 
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const db = await getDb();
    
    if (!db) {
      return {
        status: 'disconnected',
        error: 'Database not initialized'
      };
    }

    // 設定 10 秒超時
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Database connection timeout')), 10000);
    });

    const queryPromise = db.execute(sql`SELECT 1 as health_check`);
    
    await Promise.race([queryPromise, timeoutPromise]);
    
    const latency = Date.now() - startTime;
    
    return {
      status: 'connected',
      latency
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // 檢查是否為 Region unavailable 錯誤
    if (errorMessage.includes('Region is unavailable')) {
      return {
        status: 'disconnected',
        error: 'Database region is temporarily unavailable'
      };
    }
    
    return {
      status: 'error',
      error: errorMessage
    };
  }
}

/**
 * 註冊健康檢查路由
 */
export function registerHealthRoutes(app: Express) {
  // 基本健康檢查（不檢查資料庫）
  app.get('/api/health/ping', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  // 完整健康檢查（包含資料庫）
  app.get('/api/health', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    
    const healthStatus: HealthStatus = {
      status: dbHealth.status === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      database: dbHealth.status,
      databaseLatency: dbHealth.latency,
      version: '1.0.0'
    };

    if (dbHealth.error) {
      healthStatus.error = dbHealth.error;
    }

    // 根據狀態設定 HTTP 狀態碼
    const statusCode = dbHealth.status === 'connected' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
  });

  // 詳細狀態頁面（給管理員看）
  app.get('/api/health/details', async (_req: Request, res: Response) => {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      service: '幕創行銷 Threads AI 教練',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: dbHealth.status,
        latency: dbHealth.latency,
        error: dbHealth.error
      }
    });
  });
}
