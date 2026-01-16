/**
 * Feature Flags 控制模組
 * 用於控制新功能的啟用/停用，支援漸進式發布和快速回滾
 */

export interface FeatureFlagConfig {
  enabled: boolean;
  description: string;
  rolloutPercentage?: number; // 0-100，用於 A/B 測試
}

/**
 * 所有 Feature Flags 定義
 */
export const FEATURE_FLAGS: Record<string, FeatureFlagConfig> = {
  // 自適應品質門檻（混合方案）
  ADAPTIVE_THRESHOLD: {
    enabled: true,
    description: '根據用戶成長階段動態調整品質門檻',
  },

  // 三層品質檢查機制
  QUALITY_CHECKER: {
    enabled: true,
    description: '三層品質檢查：禁止句式、AI Detector、品質分數',
  },

  // 開頭 DNA 提取
  OPENER_DNA: {
    enabled: true,
    description: '從用戶爆款貼文中提取開頭結構特徵',
  },

  // 快取機制
  CACHE_ENABLED: {
    enabled: true,
    description: '快取常用計算結果以提升效能',
  },

  // 最近使用避免
  RECENT_USAGE_TRACKER: {
    enabled: true,
    description: '追蹤最近使用的開頭模式，避免重複',
  },

  // 動態權重機制
  DYNAMIC_WEIGHTS: {
    enabled: true,
    description: '根據用戶資料量動態調整系統/用戶範例權重',
  },

  // Prompt 長度控制
  PROMPT_LENGTH_CONTROL: {
    enabled: true,
    description: '智能截斷過長的 Prompt 內容',
  },

  // 品質自動重試
  QUALITY_AUTO_RETRY: {
    enabled: true,
    description: '品質檢查失敗時自動重試生成',
  },
};

/**
 * 檢查功能是否啟用
 */
export function isFeatureEnabled(featureName: string): boolean {
  const flag = FEATURE_FLAGS[featureName];
  if (!flag) {
    console.warn(`[FeatureFlags] Unknown feature: ${featureName}`);
    return false;
  }
  return flag.enabled;
}

/**
 * 檢查功能是否對特定用戶啟用（支援 A/B 測試）
 */
export function isFeatureEnabledForUser(
  featureName: string,
  userId: string
): boolean {
  const flag = FEATURE_FLAGS[featureName];
  if (!flag || !flag.enabled) {
    return false;
  }

  // 如果沒有設定 rolloutPercentage，則對所有用戶啟用
  if (flag.rolloutPercentage === undefined) {
    return true;
  }

  // 使用 userId 的 hash 來決定是否啟用（確保同一用戶總是得到相同結果）
  const hash = hashString(userId);
  const percentage = hash % 100;
  return percentage < flag.rolloutPercentage;
}

/**
 * 簡單的字串 hash 函數
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * 取得所有 Feature Flags 狀態（用於管理後台）
 */
export function getAllFeatureFlags(): Record<string, FeatureFlagConfig> {
  return { ...FEATURE_FLAGS };
}

/**
 * 動態更新 Feature Flag（運行時）
 */
export function updateFeatureFlag(
  featureName: string,
  enabled: boolean
): boolean {
  if (!FEATURE_FLAGS[featureName]) {
    console.warn(`[FeatureFlags] Cannot update unknown feature: ${featureName}`);
    return false;
  }
  FEATURE_FLAGS[featureName].enabled = enabled;
  console.log(`[FeatureFlags] ${featureName} set to ${enabled}`);
  return true;
}
