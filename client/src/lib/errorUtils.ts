import { TRPCClientError } from "@trpc/client";

/**
 * 資料庫相關錯誤的關鍵字
 */
const DATABASE_ERROR_PATTERNS = [
  'Region is unavailable',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'Connection refused',
  'Connection timed out',
  'Database connection',
  'Failed query',
  'ER_ACCESS_DENIED',
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_CONNECTION_LOST',
  'ENOTFOUND',
  'getaddrinfo',
  'TiDB',
  'MySQL',
  'database',
  'INTERNAL_SERVER_ERROR'
];

/**
 * 檢查錯誤是否為資料庫連線錯誤
 */
export function isDatabaseError(error: unknown): boolean {
  if (!error) return false;

  let errorMessage = '';

  if (error instanceof TRPCClientError) {
    errorMessage = error.message || '';
  } else if (error instanceof Error) {
    errorMessage = error.message || '';
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (typeof error === 'object' && error !== null) {
    errorMessage = JSON.stringify(error);
  }

  const lowerMessage = errorMessage.toLowerCase();
  
  return DATABASE_ERROR_PATTERNS.some(pattern => 
    lowerMessage.includes(pattern.toLowerCase())
  );
}

/**
 * 獲取用戶友善的錯誤訊息
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (isDatabaseError(error)) {
    return '系統暫時無法連線，請稍後再試';
  }

  if (error instanceof TRPCClientError) {
    // 隱藏技術細節
    if (error.message.includes('Failed query')) {
      return '操作失敗，請稍後再試';
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '發生未知錯誤，請稍後再試';
}

/**
 * 錯誤類型枚舉
 */
export enum ErrorType {
  DATABASE = 'database',
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

/**
 * 分類錯誤類型
 */
export function classifyError(error: unknown): ErrorType {
  if (!error) return ErrorType.UNKNOWN;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lowerMessage = errorMessage.toLowerCase();

  if (isDatabaseError(error)) {
    return ErrorType.DATABASE;
  }

  if (lowerMessage.includes('network') || 
      lowerMessage.includes('fetch') ||
      lowerMessage.includes('timeout')) {
    return ErrorType.NETWORK;
  }

  if (lowerMessage.includes('unauthorized') || 
      lowerMessage.includes('unauthenticated') ||
      lowerMessage.includes('forbidden')) {
    return ErrorType.AUTH;
  }

  if (lowerMessage.includes('validation') || 
      lowerMessage.includes('invalid')) {
    return ErrorType.VALIDATION;
  }

  return ErrorType.UNKNOWN;
}
