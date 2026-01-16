/**
 * LLM 模型配置
 * 
 * 方案 A：品質優先
 * - 腦力激盪：Gemini 2.5 Flash（創意發散，不需高精度）
 * - 開頭生成：Gemini 2.5 Flash（生成多個候選，用戶選擇）
 * - 正文生成：Claude Sonnet 4（品質關鍵，風格一致性）
 * - 品質檢查：Gemini 2.5 Flash（規則驅動，不需高精度）
 * - AI 對話修改：Claude Sonnet 4（理解用戶意圖，精準修改）
 */

import type { LLMModel } from '../_core/llm';

// 功能類型定義
export type LLMFeature = 
  | 'brainstorm'      // 腦力激盪
  | 'opener'          // 開頭生成
  | 'content'         // 正文生成
  | 'quality_check'   // 品質檢查
  | 'ai_chat'         // AI 對話修改
  | 'analysis';       // 分析功能

// 模型配置
export interface ModelConfig {
  model: LLMModel;
  description: string;
  costMultiplier: number;  // 相對於 Gemini 2.5 Flash 的成本倍數
}

// 方案 A：品質優先（推薦）- 測試版：正文使用 GPT-4o
export const QUALITY_FIRST_CONFIG: Record<LLMFeature, ModelConfig> = {
  brainstorm: {
    model: 'gemini-2.5-flash',
    description: '創意發散，不需高精度',
    costMultiplier: 1,
  },
  opener: {
    model: 'gemini-2.5-flash',
    description: '生成多個候選，用戶選擇',
    costMultiplier: 1,
  },
  content: {
    model: 'gpt-4o',  // 測試：從 Claude Sonnet 4 改為 GPT-4o，測試字數遵守能力
    description: '品質關鍵，字數遵守最佳',
    costMultiplier: 5,
  },
  quality_check: {
    model: 'gemini-2.5-flash',
    description: '規則驅動，不需高精度',
    costMultiplier: 1,
  },
  ai_chat: {
    model: 'claude-sonnet-4',
    description: '理解用戶意圖，精準修改',
    costMultiplier: 6,
  },
  analysis: {
    model: 'gemini-2.5-flash',
    description: '資料分析，不需高精度',
    costMultiplier: 1,
  },
};

// 方案 B：成本優先
export const COST_FIRST_CONFIG: Record<LLMFeature, ModelConfig> = {
  brainstorm: {
    model: 'gemini-2.5-flash-lite',
    description: '最低成本',
    costMultiplier: 0.2,
  },
  opener: {
    model: 'gemini-2.5-flash',
    description: '平衡品質和成本',
    costMultiplier: 1,
  },
  content: {
    model: 'gemini-2.5-pro',
    description: '品質良好，成本適中',
    costMultiplier: 4,
  },
  quality_check: {
    model: 'gemini-2.5-flash-lite',
    description: '規則驅動',
    costMultiplier: 0.2,
  },
  ai_chat: {
    model: 'gemini-2.5-pro',
    description: '品質良好',
    costMultiplier: 4,
  },
  analysis: {
    model: 'gemini-2.5-flash-lite',
    description: '資料分析',
    costMultiplier: 0.2,
  },
};

// 方案 C：極致品質
export const PREMIUM_CONFIG: Record<LLMFeature, ModelConfig> = {
  brainstorm: {
    model: 'gpt-4.1-mini',
    description: '創意多樣',
    costMultiplier: 0.7,
  },
  opener: {
    model: 'claude-sonnet-4',
    description: '開頭品質關鍵',
    costMultiplier: 6,
  },
  content: {
    model: 'claude-sonnet-4',
    description: '最高品質',
    costMultiplier: 6,
  },
  quality_check: {
    model: 'gemini-2.5-flash',
    description: '規則驅動',
    costMultiplier: 1,
  },
  ai_chat: {
    model: 'claude-sonnet-4',
    description: '最佳理解力',
    costMultiplier: 6,
  },
  analysis: {
    model: 'gemini-2.5-flash',
    description: '資料分析',
    costMultiplier: 1,
  },
};

// 當前使用的配置（方案 A：品質優先）
let currentConfig = QUALITY_FIRST_CONFIG;

/**
 * 獲取指定功能應使用的模型
 */
export function getModelForFeature(feature: LLMFeature): LLMModel {
  return currentConfig[feature].model;
}

/**
 * 獲取指定功能的完整配置
 */
export function getConfigForFeature(feature: LLMFeature): ModelConfig {
  return currentConfig[feature];
}

/**
 * 切換配置方案
 */
export function setConfig(config: 'quality_first' | 'cost_first' | 'premium'): void {
  switch (config) {
    case 'quality_first':
      currentConfig = QUALITY_FIRST_CONFIG;
      break;
    case 'cost_first':
      currentConfig = COST_FIRST_CONFIG;
      break;
    case 'premium':
      currentConfig = PREMIUM_CONFIG;
      break;
  }
}

/**
 * 獲取當前配置名稱
 */
export function getCurrentConfigName(): string {
  if (currentConfig === QUALITY_FIRST_CONFIG) return 'quality_first';
  if (currentConfig === COST_FIRST_CONFIG) return 'cost_first';
  if (currentConfig === PREMIUM_CONFIG) return 'premium';
  return 'unknown';
}
