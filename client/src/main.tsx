import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";

import { isDatabaseError, getUserFriendlyErrorMessage } from "./lib/errorUtils";
import "./index.css";

// 資料庫錯誤計數器（用於判斷是否需要顯示維護頁面）
let databaseErrorCount = 0;
const DATABASE_ERROR_THRESHOLD = 3;

/**
 * 檢查是否應該顯示維護頁面
 */
function shouldShowMaintenancePage(): boolean {
  return databaseErrorCount >= DATABASE_ERROR_THRESHOLD;
}

/**
 * 重置資料庫錯誤計數
 */
function resetDatabaseErrorCount() {
  databaseErrorCount = 0;
}

/**
 * 處理資料庫錯誤
 */
function handleDatabaseError(error: unknown) {
  if (isDatabaseError(error)) {
    databaseErrorCount++;
    console.warn(`[Database Error] Count: ${databaseErrorCount}/${DATABASE_ERROR_THRESHOLD}`);
    
    if (shouldShowMaintenancePage()) {
      // 導向維護頁面
      if (window.location.pathname !== '/maintenance') {
        window.location.href = '/maintenance';
      }
    }
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 自動重試配置
      retry: (failureCount, error) => {
        // 資料庫錯誤最多重試 3 次
        if (isDatabaseError(error)) {
          return failureCount < 3;
        }
        // 認證錯誤不重試
        if (error instanceof TRPCClientError && error.message === UNAUTHED_ERR_MSG) {
          return false;
        }
        // 其他錯誤重試 1 次
        return failureCount < 1;
      },
      // 重試延遲（指數退避）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // 10 秒超時
      staleTime: 0,
      // 錯誤時不自動重新獲取
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Mutation 也加入重試
      retry: (failureCount, error) => {
        if (isDatabaseError(error)) {
          return failureCount < 2;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = '/login';
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    handleDatabaseError(error);
    
    // 使用友善的錯誤訊息記錄
    const friendlyMessage = getUserFriendlyErrorMessage(error);
    console.error("[API Query Error]", friendlyMessage, error);
  }
  
  // 成功時重置錯誤計數
  if (event.type === "updated" && event.action.type === "success") {
    resetDatabaseErrorCount();
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    handleDatabaseError(error);
    
    const friendlyMessage = getUserFriendlyErrorMessage(error);
    console.error("[API Mutation Error]", friendlyMessage, error);
  }
  
  // 成功時重置錯誤計數
  if (event.type === "updated" && event.action.type === "success") {
    resetDatabaseErrorCount();
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
