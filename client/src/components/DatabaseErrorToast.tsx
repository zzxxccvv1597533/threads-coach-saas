import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DatabaseErrorToastProps {
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  autoRetrySeconds?: number;
}

export function DatabaseErrorToast({
  message = '系統連線中斷，正在嘗試重新連線...',
  onRetry,
  onDismiss,
  autoRetrySeconds = 10
}: DatabaseErrorToastProps) {
  const [countdown, setCountdown] = useState(autoRetrySeconds);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRetry();
          return autoRetrySeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRetrySeconds]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      if (onRetry) {
        await onRetry();
      } else {
        // 預設重試行為：檢查健康狀態
        const response = await fetch('/api/health');
        if (response.ok) {
          const data = await response.json();
          if (data.database === 'connected') {
            window.location.reload();
          }
        }
      }
    } catch (error) {
      console.log('Retry failed');
    }
    setIsRetrying(false);
    setCountdown(autoRetrySeconds);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <div className="bg-amber-50 border border-amber-200 rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">{message}</p>
            <p className="text-xs text-amber-600 mt-1">
              {isRetrying ? '正在重新連線...' : `${countdown} 秒後自動重試`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-8 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
            >
              <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
            </Button>
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="h-8 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-100"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 用於在 API 錯誤時顯示友善提示的 Hook
 */
export function useDatabaseErrorHandler() {
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleError = (error: unknown) => {
    const errorStr = error instanceof Error ? error.message : String(error);
    
    // 檢查是否為資料庫錯誤
    const isDatabaseError = 
      errorStr.includes('Region is unavailable') ||
      errorStr.includes('ECONNREFUSED') ||
      errorStr.includes('Failed query') ||
      errorStr.includes('database');

    if (isDatabaseError) {
      setErrorMessage('系統暫時無法連線，請稍後再試');
      setShowError(true);
    }
  };

  const dismissError = () => {
    setShowError(false);
    setErrorMessage('');
  };

  return {
    showError,
    errorMessage,
    handleError,
    dismissError,
    DatabaseErrorToastComponent: showError ? (
      <DatabaseErrorToast
        message={errorMessage}
        onDismiss={dismissError}
      />
    ) : null
  };
}
