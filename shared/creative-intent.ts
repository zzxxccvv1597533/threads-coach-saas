/**
 * 創作意圖類型定義
 * 用於控制 AI 教練的引導程度和資料注入策略
 */

/**
 * 創作意圖類型
 * - pure_personal: 純粹分享，不連結專業
 * - light_connection: 順便帶點專業，自然連結
 * - full_professional: 推廣專業或產品，完整導入
 */
export type CreativeIntent = 'pure_personal' | 'light_connection' | 'full_professional';

/**
 * 寫作模式類型
 * - guided: 引導模式（教練模式），適合新手
 * - advanced: 進階模式（助手模式），適合成熟創作者
 */
export type WritingMode = 'guided' | 'advanced';

/**
 * Prompt 配置介面
 * 控制各種資料的注入策略
 */
export interface PromptConfig {
  /** 是否注入 IP 地基資料（職業、人設三支柱等） */
  injectIpBase: boolean;
  /** 是否注入爆款公式（成功因素、Hook 策略） */
  injectViralFormula: boolean;
  /** 是否注入 Few-Shot 範例 */
  injectFewShot: boolean;
  /** 是否注入成功因素分析 */
  injectSuccessFactors: boolean;
  /** IP 地基是否僅作為參考（不強制注入） */
  ipBaseAsReference: boolean;
}

/**
 * 各創作意圖對應的 Prompt 配置
 */
export const PROMPT_CONFIGS: Record<CreativeIntent, PromptConfig> = {
  pure_personal: {
    injectIpBase: false,
    injectViralFormula: false,
    injectFewShot: false,
    injectSuccessFactors: false,
    ipBaseAsReference: false,
  },
  light_connection: {
    injectIpBase: true,
    injectViralFormula: false,
    injectFewShot: false,
    injectSuccessFactors: false,
    ipBaseAsReference: true, // 僅作為參考，用於專業連結建議
  },
  full_professional: {
    injectIpBase: true,
    injectViralFormula: true,
    injectFewShot: true,
    injectSuccessFactors: true,
    ipBaseAsReference: false, // 完整注入
  },
};

/**
 * 創作意圖的顯示資訊
 */
export const CREATIVE_INTENT_INFO: Record<CreativeIntent, {
  icon: string;
  title: string;
  description: string;
  shortDescription: string;
}> = {
  pure_personal: {
    icon: '📝',
    title: '純粹分享',
    description: '分享生活觀察、個人感受，不刻意連結專業',
    shortDescription: '不連結專業',
  },
  light_connection: {
    icon: '🔗',
    title: '順便帶點專業',
    description: '分享故事後，自然地連結到你的專業觀點',
    shortDescription: '自然連結',
  },
  full_professional: {
    icon: '💼',
    title: '推廣專業或產品',
    description: '明確以專業角度出發，建立權威形象',
    shortDescription: '完整導入',
  },
};

/**
 * 根據創作意圖獲取 Prompt 配置
 */
export function getPromptConfig(intent: CreativeIntent): PromptConfig {
  return PROMPT_CONFIGS[intent];
}

/**
 * 判斷是否需要顯示專業連結建議
 */
export function shouldShowProfessionalSuggestions(intent: CreativeIntent): boolean {
  return intent === 'light_connection';
}

/**
 * 判斷是否需要完整的 IP 地基注入
 */
export function shouldInjectFullIpBase(intent: CreativeIntent): boolean {
  return intent === 'full_professional';
}
