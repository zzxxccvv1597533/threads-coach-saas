import { AlertTriangle, RefreshCw, Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";

export default function Maintenance() {
  const [countdown, setCountdown] = useState(30);
  const [isRetrying, setIsRetrying] = useState(false);

  // 自動倒數重試
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          handleRetry();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // 嘗試呼叫健康檢查端點
      const response = await fetch('/api/health', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.database === 'connected') {
          // 資料庫恢復，重新載入頁面
          window.location.reload();
          return;
        }
      }
    } catch (error) {
      console.log('Health check failed, system still under maintenance');
    }
    setIsRetrying(false);
    setCountdown(30);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0F345B] to-[#1a4a7a] flex items-center justify-center p-4">
      <Card className="max-w-lg w-full bg-white/95 backdrop-blur shadow-2xl">
        <CardContent className="pt-8 pb-8 px-8">
          {/* 圖標 */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-600" />
            </div>
          </div>

          {/* 標題 */}
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">
            系統維護中
          </h1>
          <p className="text-gray-600 text-center mb-6">
            我們正在進行系統維護，請稍後再試
          </p>

          {/* 狀態卡片 */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-gray-500" />
              <span className="text-sm text-gray-600">
                預計恢復時間：通常在 5-30 分鐘內
              </span>
            </div>
            <div className="flex items-center gap-3">
              <RefreshCw className={`w-5 h-5 text-gray-500 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="text-sm text-gray-600">
                {isRetrying ? '正在檢查系統狀態...' : `${countdown} 秒後自動重試`}
              </span>
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="space-y-3">
            <Button 
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full bg-[#0F345B] hover:bg-[#1a4a7a]"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  檢查中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  立即重試
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              返回首頁
            </Button>
          </div>

          {/* 聯繫資訊 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              如果問題持續超過 30 分鐘，請聯繫我們
            </p>
            <div className="flex justify-center mt-2">
              <a 
                href="mailto:support@example.com" 
                className="text-xs text-[#0F345B] hover:underline flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                聯繫客服
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
