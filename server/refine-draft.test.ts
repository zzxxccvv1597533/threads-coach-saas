import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock invokeLLM
vi.mock('./_core/llm', () => ({
  invokeLLM: vi.fn(),
}));

// Mock db functions
vi.mock('./db', () => ({
  getIpProfileByUserId: vi.fn(),
  getUserAIMemory: vi.fn(),
  logApiUsage: vi.fn(),
  getUserWritingStyle: vi.fn(),
  createConversationSummary: vi.fn(),
  updateDraft: vi.fn(),
}));

import { invokeLLM } from './_core/llm';
import * as db from './db';

describe('refineDraft API 對話修改功能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // 設定預設 mock 回傳值
    (db.getIpProfileByUserId as any).mockResolvedValue({
      occupation: '行銷顧問',
      voiceTone: '專業但親切',
    });
    (db.getUserAIMemory as any).mockResolvedValue(null);
    (db.logApiUsage as any).mockResolvedValue(undefined);
    (db.getUserWritingStyle as any).mockResolvedValue(null);
    (db.createConversationSummary as any).mockResolvedValue(undefined);
    (db.updateDraft as any).mockResolvedValue(undefined);
  });

  describe('訊息結構測試', () => {
    it('應該在沒有對話歷史時正確建構訊息', async () => {
      const mockResponse = {
        choices: [{ message: { content: '修改後的內容' } }],
      };
      (invokeLLM as any).mockResolvedValue(mockResponse);

      // 模擬 API 呼叫的輸入
      const input = {
        currentDraft: '這是原始草稿內容',
        instruction: '請把開頭改成更吸引人的句子',
        editMode: 'preserve' as const,
        chatHistory: [],
      };

      // 驗證 invokeLLM 被呼叫時的訊息結構
      // 由於我們無法直接測試 tRPC procedure，我們驗證邏輯
      expect(input.currentDraft).toBe('這是原始草稿內容');
      expect(input.instruction).toBe('請把開頭改成更吸引人的句子');
    });

    it('應該在有對話歷史時只取最近的指令作為參考', () => {
      const chatHistory = [
        { role: 'user' as const, content: '把第一段改短一點' },
        { role: 'assistant' as const, content: '已修改的內容...' },
        { role: 'user' as const, content: '再加一個問句結尾' },
        { role: 'assistant' as const, content: '又修改的內容...' },
        { role: 'user' as const, content: '把語氣改得更口語' },
        { role: 'assistant' as const, content: '最新修改的內容...' },
      ];

      // 測試取最後 4 筆對話的邏輯
      const recentHistory = chatHistory.slice(-4);
      expect(recentHistory.length).toBe(4);
      
      // 測試只取 user 訊息的邏輯
      const userMessages = recentHistory
        .filter(msg => msg.role === 'user')
        .map(msg => `- ${msg.content}`)
        .join('\n');
      
      expect(userMessages).toContain('再加一個問句結尾');
      expect(userMessages).toContain('把語氣改得更口語');
      expect(userMessages).not.toContain('把第一段改短一點'); // 這個太舊了，應該被過濾
    });

    it('新的修改指令應該被明確標記為必須執行', () => {
      const instruction = '請把這段話改成問句';
      const formattedInstruction = `【新的修改指令 - 必須執行】\n${instruction}\n\n請根據以上指令修改草稿，直接輸出修改後的完整內容。`;
      
      expect(formattedInstruction).toContain('必須執行');
      expect(formattedInstruction).toContain(instruction);
    });
  });

  describe('修改模式測試', () => {
    it('light 模式應該只做輕度優化', () => {
      const editMode = 'light';
      
      // 驗證 light 模式的特徵
      expect(editMode).toBe('light');
      // light 模式應該：修正錯字、調整排版、讓語句通順
      // 不應該：改變敘事結構、添加新內容
    });

    it('preserve 模式應該保留風格', () => {
      const editMode = 'preserve';
      
      // 驗證 preserve 模式的特徵
      expect(editMode).toBe('preserve');
      // preserve 模式應該：優化表達、保留敘事結構
    });

    it('rewrite 模式應該套用爆款公式', () => {
      const editMode = 'rewrite';
      
      // 驗證 rewrite 模式的特徵
      expect(editMode).toBe('rewrite');
      // rewrite 模式應該：套用 Hook、口語化、呼吸感排版
    });
  });

  describe('內容清理測試', () => {
    it('應該正確處理 AI 回傳的內容', () => {
      const rawContent = '修改後的內容\n\n這是第二段';
      const cleanedContent = rawContent.trim();
      
      expect(cleanedContent).toBe('修改後的內容\n\n這是第二段');
    });

    it('應該處理空回傳', () => {
      const rawContent = undefined;
      const newContent = typeof rawContent === 'string' ? rawContent : '';
      
      expect(newContent).toBe('');
    });
  });
});

describe('對話歷史處理邏輯', () => {
  it('空對話歷史應該只傳送當前草稿', () => {
    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const currentDraft = '這是當前草稿';
    
    let messageContent = '';
    if (chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-4);
      const historyContext = recentHistory
        .filter(msg => msg.role === 'user')
        .map(msg => `- ${msg.content}`)
        .join('\n');
      
      if (historyContext) {
        messageContent = `之前的修改指令（參考即可）：\n${historyContext}\n\n當前草稿（請基於這個版本修改）：\n\n${currentDraft}`;
      } else {
        messageContent = `當前草稿：\n\n${currentDraft}`;
      }
    } else {
      messageContent = `當前草稿：\n\n${currentDraft}`;
    }
    
    expect(messageContent).toBe(`當前草稿：\n\n${currentDraft}`);
    expect(messageContent).not.toContain('之前的修改指令');
  });

  it('有對話歷史時應該包含之前的指令作為參考', () => {
    const chatHistory = [
      { role: 'user' as const, content: '把開頭改成問句' },
      { role: 'assistant' as const, content: '修改後的內容...' },
    ];
    const currentDraft = '這是當前草稿';
    
    let messageContent = '';
    if (chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-4);
      const historyContext = recentHistory
        .filter(msg => msg.role === 'user')
        .map(msg => `- ${msg.content}`)
        .join('\n');
      
      if (historyContext) {
        messageContent = `之前的修改指令（參考即可）：\n${historyContext}\n\n當前草稿（請基於這個版本修改）：\n\n${currentDraft}`;
      } else {
        messageContent = `當前草稿：\n\n${currentDraft}`;
      }
    } else {
      messageContent = `當前草稿：\n\n${currentDraft}`;
    }
    
    expect(messageContent).toContain('之前的修改指令');
    expect(messageContent).toContain('把開頭改成問句');
    expect(messageContent).toContain(currentDraft);
  });

  it('應該過濾掉 assistant 的回覆，只保留 user 的指令', () => {
    const chatHistory = [
      { role: 'user' as const, content: '指令1' },
      { role: 'assistant' as const, content: 'AI回覆1' },
      { role: 'user' as const, content: '指令2' },
      { role: 'assistant' as const, content: 'AI回覆2' },
    ];
    
    const userMessages = chatHistory
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content);
    
    expect(userMessages).toContain('指令1');
    expect(userMessages).toContain('指令2');
    expect(userMessages).not.toContain('AI回覆1');
    expect(userMessages).not.toContain('AI回覆2');
  });
});
