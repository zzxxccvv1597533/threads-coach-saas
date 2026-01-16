/**
 * GuidedWritingFlow - 完整引導式發文流程
 * 
 * 流程：選目標 → 選題 → 選受眾 → 選類型 → 填資料 → 選開頭 → 生成全文 → 對話修改 → 人味潤飾
 * 
 * 2026-01-17 更新：新增「選目標」步驟（目的導向選擇器）
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Users,
  PenTool,
  Check,
  MessageSquare,
  Wand2,
  Copy,
  ArrowRight,
  Info,
  Target,
} from "lucide-react";
import { ALL_CONTENT_TYPES_V2 } from "@shared/content-types-v2";

interface GuidedWritingFlowProps {
  ipProfile: {
    occupation?: string;
    personaExpertise?: string;
    personaEmotion?: string;
    personaViewpoint?: string;
    voiceTone?: string;
  } | null;
  initialTopic?: string;
  initialMaterial?: string;
  onComplete: (draftId: number | null, content: string) => void;
  onNavigateToIp: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// 目標選項定義
const GOAL_OPTIONS = [
  {
    id: 'connect',
    name: '讓人更懂我',
    description: '建立情感連結，讓讀者感受到你是真實的人',
    icon: '💝',
    subText: '分享故事、心情、生活',
    recommendedTypes: ['story', 'casual', 'dialogue'],
    color: 'from-pink-500/10 to-rose-500/10 border-pink-200',
  },
  {
    id: 'trust',
    name: '讓人信任我',
    description: '建立專業權威，讓讀者相信你的專業能力',
    icon: '🎯',
    subText: '分享知識、整理、教學',
    recommendedTypes: ['knowledge', 'summary', 'viewpoint'],
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200',
  },
  {
    id: 'engage',
    name: '有人留言互動',
    description: '提升互動率，讓讀者想要留言回應',
    icon: '💬',
    subText: '問問題、投票、對話',
    recommendedTypes: ['question', 'poll', 'dialogue'],
    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200',
  },
  {
    id: 'sell',
    name: '慢慢賣產品',
    description: '軟性銷售，讓讀者對你的產品/服務產生興趣',
    icon: '🛒',
    subText: '故事帶產品、知識分享',
    recommendedTypes: ['story', 'knowledge', 'contrast'],
    color: 'from-amber-500/10 to-orange-500/10 border-amber-200',
  },
];

// 流程步驟定義（新增目標選擇步驟）
const FLOW_STEPS = [
  { id: 1, name: "選目標", description: "你想達成什麼？" },
  { id: 2, name: "選題", description: "AI 根據你的人設推薦主題" },
  { id: 3, name: "選受眾", description: "選擇這篇文章要對誰說" },
  { id: 4, name: "選類型", description: "選擇貼文呈現方式" },
  { id: 5, name: "填資料", description: "填寫關鍵資訊" },
  { id: 6, name: "選開頭", description: "選擇最吸引人的開頭" },
  { id: 7, name: "生成全文", description: "AI 生成完整貼文" },
  { id: 8, name: "對話修改", description: "與 AI 對話調整" },
  { id: 9, name: "人味潤飾", description: "加入個人風格" },
];

export function GuidedWritingFlow({ ipProfile, initialTopic, initialMaterial, onComplete, onNavigateToIp }: GuidedWritingFlowProps) {
  // 流程狀態
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: 選目標（目的導向）
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  
  // Step 2: 選題
  const [topicHint, setTopicHint] = useState(initialTopic || "");
  const [selectedTopic, setSelectedTopic] = useState<{ title: string; audience: string; contentType: string; hook: string } | null>(null);
  const [topicSuggestions, setTopicSuggestions] = useState<Array<{ title: string; audience: string; contentType: string; hook: string }>>([]);
  
  // Step 2: 選受眾
  const [selectedAudienceId, setSelectedAudienceId] = useState<number | null>(null);
  
  // Step 3: 選類型
  const [selectedContentType, setSelectedContentType] = useState("");
  
  // Step 4: 填寫專屬欄位
  const [typeInputs, setTypeInputs] = useState<Record<string, string | string[]>>({});
  
  // Step 5: Hook 選項 - 整合新的 Opener Generator
  
  // Hook 選項狀態
  const [hookOptions, setHookOptions] = useState<Array<{ 
    style: string; 
    styleName: string; 
    content: string; 
    reason: string;
    aiScore?: number;
    aiLevel?: string;
    candidateId?: number;
    templateCategory?: string;
  }>>([]);
  const [selectedHook, setSelectedHook] = useState("");
  
  // Step 6: 生成全文
  const [draftContent, setDraftContent] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  
  // Step 7: 對話修改
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  
  // Step 8: 人味潤飾
  const [catchphrases, setCatchphrases] = useState("");
  const [speakingStyle, setSpeakingStyle] = useState("");
  const [finalContent, setFinalContent] = useState("");
  
  // 診斷結果
  const [diagnosis, setDiagnosis] = useState<{
    strengths: Array<{ label: string; description: string }>;
    improvements: Array<{ label: string; description: string; action?: string }>;
    score: number;
  } | null>(null);
  
  // 風格匹配度
  const [styleMatch, setStyleMatch] = useState<{
    score: number;
    breakdown: {
      toneMatch: number;
      phraseUsage: number;
      audienceAlignment: number;
      pillarConsistency: number;
    };
    details: string[];
    suggestions: string[];
  } | null>(null);

  // 查詢用戶的受眾設定
  const { data: audienceSegments } = trpc.audience.list.useQuery();

  // API mutations
  const brainstorm = trpc.ai.brainstorm.useMutation({
    onSuccess: (data) => {
      setTopicSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      toast.success("主題建議已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  // 使用新的 Opener Generator API
  const generateOpeners = trpc.opener.generate.useMutation({
    onSuccess: (data) => {
      console.log('[generateOpeners] API Response:', JSON.stringify(data, null, 2));
      // 轉換新的 API 回應格式到現有的 hookOptions 格式
      // 注意：API 返回的欄位是 openerText 不是 content，scoreLevel 不是 aiLevel
      const transformedHooks = data.candidates.map((candidate: any) => ({
        style: String(candidate.templateId) || 'custom',
        styleName: candidate.templateCategory || '自訂風格',
        content: candidate.openerText || candidate.content || '', // 使用 openerText 欄位
        reason: `AI 痕跡分數：${Math.round((1 - (candidate.aiScore || 0)) * 100)}% 自然度`,
        aiScore: candidate.aiScore || 0,
        aiLevel: candidate.scoreLevel || candidate.aiLevel || 'natural', // 使用 scoreLevel 欄位
        candidateId: candidate.id,
        templateCategory: candidate.templateCategory,
      }));
      console.log('[generateOpeners] Transformed hooks:', transformedHooks);
      setHookOptions(transformedHooks);
      setCurrentStep(6);
      toast.success(`已生成 ${data.candidates.length} 個開頭選項！`);
    },
    onError: (error) => {
      console.error('[generateOpeners] Error:', error);
      toast.error("生成 Hook 失敗，請稍後再試");
    },
  });

  // 標記選中的 Hook
  const selectOpener = trpc.opener.select.useMutation({
    onSuccess: () => {
      console.log('Opener selection recorded');
    },
  });

  // 學習式 Selector - 記錄用戶選擇
  const recordSelection = trpc.selector.recordSelection.useMutation({
    onSuccess: () => {
      console.log('Selection recorded for learning');
    },
  });

  // 保留舊的 generateHooks 作為 fallback
  const generateHooks = trpc.ai.generateHooks.useMutation({
    onSuccess: (data) => {
      setHookOptions(Array.isArray(data.hooks) ? data.hooks.map(h => ({
        ...h,
        aiScore: undefined,
        aiLevel: undefined,
        candidateId: undefined,
        templateCategory: undefined,
      })) : []);
      setCurrentStep(6);
      toast.success("Hook 選項已生成！");
    },
    onError: () => {
      toast.error("生成 Hook 失敗，請稍後再試");
    },
  });

  const generateDraft = trpc.ai.generateDraft.useMutation({
    onSuccess: (data) => {
      setDraftContent(typeof data.content === 'string' ? data.content : '');
      setDraftId(data.draftId || null);
      // 設定診斷結果
      if (data.diagnosis) {
        setDiagnosis(data.diagnosis);
      }
      // 設定風格匹配度
      if (data.styleMatch) {
        setStyleMatch(data.styleMatch);
      }
      setCurrentStep(7);
      toast.success("草稿已生成！");
    },
    onError: (error) => {
      console.error('[generateDraft] Error:', error);
      toast.error(`生成失敗：${error.message || '請稍後再試'}`);
    },
  });

  const refineDraft = trpc.ai.refineDraft.useMutation({
    onSuccess: (data) => {
      const newContent = typeof data.content === 'string' ? data.content : '';
      setDraftContent(newContent);
      setChatMessages(prev => [...prev, { role: "assistant", content: newContent }]);
      setIsChatting(false);
    },
    onError: () => {
      toast.error("修改失敗，請稍後再試");
      setIsChatting(false);
    },
  });

  // 自動滾動到對話底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // 處理主題生成
  const handleGenerateTopics = () => {
    brainstorm.mutate({ topic: topicHint || undefined });
  };

  // 處理選擇主題
  const handleSelectTopic = (topic: typeof selectedTopic) => {
    console.log('[handleSelectTopic] topic:', topic);
    setSelectedTopic(topic);
    if (topic) {
      // 驗證 contentType 是否在 ALL_CONTENT_TYPES_V2 中
      console.log('[handleSelectTopic] topic.contentType:', topic.contentType);
      const validContentType = ALL_CONTENT_TYPES_V2.find(t => t.id === topic.contentType);
      console.log('[handleSelectTopic] validContentType:', validContentType);
      if (validContentType) {
        console.log('[handleSelectTopic] Setting selectedContentType to:', topic.contentType);
        setSelectedContentType(topic.contentType);
      } else {
        // 如果 contentType 無效，嘗試根據名稱匹配
        const matchedType = ALL_CONTENT_TYPES_V2.find(t => 
          t.name === topic.contentType || 
          t.name.includes(topic.contentType) ||
          topic.contentType.includes(t.name)
        );
        if (matchedType) {
          setSelectedContentType(matchedType.id);
        } else {
          // 預設為 story
          setSelectedContentType('story');
        }
      }
    }
    setCurrentStep(3);
  };

  // 處理生成 Hook - 使用新的 Opener Generator
  const handleGenerateHooks = () => {
    if (!selectedTopic || !selectedContentType) {
      toast.error("請先完成前面的步驟");
      return;
    }

    // 使用新的 Opener Generator API
    generateOpeners.mutate({
      topic: selectedTopic.title,
      contentType: selectedContentType,
      // hookStyle 已移除，讓 AI 自動生成多種風格
      userContext: Object.entries(typeInputs)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : (v as string || '')}`)
        .join('\n'),
      count: 5, // 生成 5 個候選
      // 傳遞目標受眾 ID
      targetAudienceId: selectedAudienceId || undefined,
    });
  };

  // 處理生成全文
  const handleGenerateFullDraft = () => {
    console.log('[handleGenerateFullDraft] typeInputs:', typeInputs);
    console.log('[handleGenerateFullDraft] selectedContentType:', selectedContentType);
    
    if (!selectedTopic || !selectedHook) {
      toast.error("請先選擇 Hook");
      return;
    }

    // 組合素材 - 安全處理 typeInputs
    const safeTypeInputs = typeInputs || {};
    const materialParts = [
      `主題：${selectedTopic.title}`,
      `開頭 Hook：${selectedHook}`,
      ...Object.entries(safeTypeInputs).map(([key, value]) => {
        const field = ALL_CONTENT_TYPES_V2.find(t => t.id === selectedContentType)?.inputFields?.find(f => f.key === key);
        if (!field) return '';
        const display = Array.isArray(value) ? value.join(' / ') : String(value || '');
        return `${field.label}：${display}`;
      }).filter(Boolean),
    ];

    // 只傳遞有內容的欄位，並保留陣列（例如 poll 的 options）
    const filledFlexibleInputs: Record<string, any> = {};
    for (const [key, value] of Object.entries(safeTypeInputs)) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        const arr = value.map(v => String(v).trim()).filter(Boolean);
        if (arr.length > 0) filledFlexibleInputs[key] = arr;
      } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) filledFlexibleInputs[key] = trimmed;
      } else {
        const coerced = String(value).trim();
        if (coerced) filledFlexibleInputs[key] = coerced;
      }
    }

    console.log('[handleGenerateFullDraft] filledFlexibleInputs to send:', filledFlexibleInputs);

    generateDraft.mutate({
      material: materialParts.join('\n'),
      contentType: selectedContentType,
      angle: selectedHook,
      flexibleInput: Object.keys(filledFlexibleInputs).length > 0 ? filledFlexibleInputs : undefined,
      // 傳遞目標受眾 ID
      targetAudienceId: selectedAudienceId || undefined,
    });
  };

  // 處理對話提交
  const handleChatSubmit = () => {
    if (!chatInput.trim() || !draftContent) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setIsChatting(true);

    refineDraft.mutate({
      currentDraft: draftContent,
      instruction: userMessage,
      draftId: draftId || undefined,
      chatHistory: chatMessages,
    });
  };

  // 處理人味潤飾
  const handlePolish = () => {
    if (!catchphrases && !speakingStyle) {
      setFinalContent(draftContent);
      toast.success("已完成！");
      return;
    }

    const polishInstruction = `請幫我潤飾這篇文章，加入以下個人風格：
${catchphrases ? `口頭禪：${catchphrases}` : ''}
${speakingStyle ? `說話風格：${speakingStyle}` : ''}
保持原本的內容結構，只是讓語氣更有我的個人特色。`;

    setChatMessages(prev => [...prev, { role: "user", content: polishInstruction }]);
    setIsChatting(true);

    refineDraft.mutate({
      currentDraft: draftContent,
      instruction: polishInstruction,
      draftId: draftId || undefined,
      chatHistory: chatMessages,
    });
  };

  // 處理複製
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  // 處理完成
  const handleComplete = () => {
    onComplete(draftId, finalContent || draftContent);
  };

  // 取得當前類型的輸入欄位
  const currentTypeInputFields = ALL_CONTENT_TYPES_V2.find(t => t.id === selectedContentType)?.inputFields || [];

  return (
    <div className="space-y-6">
      {/* 進度指示器 */}
      <div className="bg-muted/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">創作進度</span>
          <span className="text-sm text-muted-foreground">
            Step {currentStep} / {FLOW_STEPS.length}
          </span>
        </div>
        <div className="flex gap-1">
          {FLOW_STEPS.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                // 只允許跳回已完成的步驟
                if (step.id < currentStep) {
                  setCurrentStep(step.id);
                }
              }}
              disabled={step.id > currentStep}
              className={`flex-1 h-2 rounded-full transition-colors ${
                step.id < currentStep
                  ? "bg-emerald-500 hover:bg-emerald-400 cursor-pointer"
                  : step.id === currentStep
                  ? "bg-primary"
                  : "bg-muted cursor-not-allowed"
              }`}
              title={step.id < currentStep ? `跳回 ${step.name}` : step.name}
            />
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{FLOW_STEPS[currentStep - 1]?.name}</span>
            ：{FLOW_STEPS[currentStep - 1]?.description}
          </div>
          {currentStep > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(currentStep - 1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一步
            </Button>
          )}
        </div>
      </div>

      {/* Step 1: 選目標（目的導向選擇器） */}
      {currentStep === 1 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-2xl">🎯</span>
              你想達成什麼？
            </CardTitle>
            <CardDescription>
              選擇你這篇文章的目標，AI 會根據目標推薦最適合的寫法
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 提示訊息 */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <span className="font-medium">小提醒：</span>
                  <span className="text-amber-700">
                    不需要每篇都追求爆款，真實的內容比完美的公式更重要
                  </span>
                </div>
              </div>
            </div>

            {/* 目標選項 */}
            <div className="grid gap-3">
              {GOAL_OPTIONS.map((goal) => (
                <div
                  key={goal.id}
                  className={`relative border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedGoal === goal.id
                      ? `bg-gradient-to-r ${goal.color} border-2`
                      : "hover:bg-muted/30 border-muted"
                  }`}
                  onClick={() => setSelectedGoal(goal.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* 選中指示器 */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      selectedGoal === goal.id 
                        ? "border-primary bg-primary" 
                        : "border-muted-foreground/30"
                    }`}>
                      {selectedGoal === goal.id && (
                        <Check className="w-4 h-4 text-primary-foreground" />
                      )}
                    </div>

                    {/* 目標內容 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{goal.icon}</span>
                        <span className="font-semibold text-lg">{goal.name}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {goal.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {goal.subText}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 確認按鈕 */}
            <Button 
              className="w-full mt-4"
              disabled={!selectedGoal}
              onClick={() => setCurrentStep(2)}
            >
              確認目標
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>

            {/* 跳過選項 */}
            <div className="text-center">
              <button
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setSelectedGoal(null);
                  setCurrentStep(2);
                }}
              >
                我只是想發文，跳過這步
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: 選題 */}
      {currentStep === 2 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                2
              </span>
              選擇主題
            </CardTitle>
            <CardDescription>
              AI 會根據你的人設、受眾痛點、專業領域，給你今天可以發的主題
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* IP 地基提示 */}
            {ipProfile && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5" />
                  <div className="text-sm">
                    <span className="text-amber-800">AI 將參考：</span>
                    <span className="text-amber-700">
                      {ipProfile.occupation || '未設定職業'}
                      {ipProfile.personaExpertise && ` · ${ipProfile.personaExpertise.slice(0, 15)}...`}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>參考方向（選填）</Label>
              <Textarea
                placeholder="例如：最近想聊聊關於自我懷疑的話題..."
                value={topicHint}
                onChange={(e) => setTopicHint(e.target.value)}
                rows={2}
              />
            </div>

            <Button 
              onClick={handleGenerateTopics}
              disabled={brainstorm.isPending}
              className="w-full"
            >
              {brainstorm.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  根據你的人設思考中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  給我主題建議
                </>
              )}
            </Button>

            {/* 主題建議列表 */}
            {topicSuggestions.length > 0 && (
              <div className="space-y-3 mt-4">
                <Label>選擇一個主題</Label>
                {topicSuggestions.map((topic, index) => (
                  <div
                    key={index}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedTopic?.title === topic.title
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50 hover:bg-primary/5"
                    }`}
                    onClick={() => handleSelectTopic(topic)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="font-medium">{topic.title}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Users className="w-3 h-3" />
                          {topic.audience}
                          <Badge variant="secondary" className="text-xs">
                            {ALL_CONTENT_TYPES_V2.find(t => t.id === topic.contentType)?.name || topic.contentType}
                          </Badge>
                        </div>
                        <div className="text-sm italic text-muted-foreground">
                          「{topic.hook}」
                        </div>
                      </div>
                      <Button 
                        size="sm" 
                        variant={selectedTopic?.title === topic.title ? "default" : "outline"}
                      >
                        {selectedTopic?.title === topic.title ? (
                          <><Check className="w-4 h-4 mr-1" /> 已選</>
                        ) : (
                          <>選擇</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: 選擇目標受眾 */}
      {currentStep === 3 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                3
              </span>
              這篇文章要對誰說？
            </CardTitle>
            <CardDescription>
              選擇目標受眾，AI 會針對他們的痛點和渴望寫作
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTopic && (
              <div className="bg-muted/30 rounded-lg p-3 mb-4">
                <div className="text-sm text-muted-foreground">已選主題：</div>
                <div className="font-medium">{selectedTopic.title}</div>
              </div>
            )}

            {/* 受眾選擇列表 */}
            {audienceSegments && audienceSegments.length > 0 ? (
              <div className="space-y-3">
                {/* 通用受眾選項 */}
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedAudienceId === null
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedAudienceId(null)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedAudienceId === null ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}>
                      {selectedAudienceId === null && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">🌍 通用受眾</div>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI 會參考所有受眾的痛點，寫出更廣泛的內容
                      </p>
                    </div>
                  </div>
                </div>

                {/* 具體受眾選項 */}
                {audienceSegments.map((audience) => (
                  <div
                    key={audience.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      selectedAudienceId === audience.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedAudienceId(audience.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedAudienceId === audience.id ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selectedAudienceId === audience.id && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">🎯 {audience.segmentName}</div>
                        {audience.painPoint && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="text-red-500">🔥 痛點：</span>{audience.painPoint.substring(0, 80)}{audience.painPoint.length > 80 ? '...' : ''}
                          </p>
                        )}
                        {audience.desiredOutcome && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <span className="text-green-500">🌟 渴望：</span>{audience.desiredOutcome.substring(0, 80)}{audience.desiredOutcome.length > 80 ? '...' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>你還沒有設定受眾</p>
                <p className="text-sm mt-1">請先到 IP 地基設定你的目標受眾</p>
                <Button variant="outline" className="mt-4" onClick={onNavigateToIp}>
                  前往設定受眾
                </Button>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(2)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setCurrentStep(4)}
              >
                下一步
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: 選擇文章類型（根據目標篩選） */}
      {currentStep === 4 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                4
              </span>
              選擇文章類型
            </CardTitle>
            <CardDescription>
              根據你的目標「{GOAL_OPTIONS.find(g => g.id === selectedGoal)?.name || ''}」，推薦以下類型
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTopic && (
              <div className="bg-muted/30 rounded-lg p-3 mb-4">
                <div className="text-sm text-muted-foreground">已選主題：</div>
                <div className="font-medium">{selectedTopic.title}</div>
                {selectedAudienceId && audienceSegments && (
                  <div className="text-sm text-muted-foreground mt-1">
                    目標受眾：{audienceSegments.find(a => a.id === selectedAudienceId)?.segmentName || '通用受眾'}
                  </div>
                )}
              </div>
            )}

            {/* 目標提示 */}
            {selectedGoal && (
              <div className={`bg-gradient-to-r ${GOAL_OPTIONS.find(g => g.id === selectedGoal)?.color || ''} rounded-lg p-3 mb-2`}>
                <div className="flex items-center gap-2 text-sm">
                  <span>{GOAL_OPTIONS.find(g => g.id === selectedGoal)?.icon}</span>
                  <span className="font-medium">目標：{GOAL_OPTIONS.find(g => g.id === selectedGoal)?.name}</span>
                </div>
              </div>
            )}

            <RadioGroup
              value={selectedContentType}
              onValueChange={setSelectedContentType}
              className="grid gap-3"
            >
              {/* 根據目標篩選類型 */}
              {ALL_CONTENT_TYPES_V2
                .filter(type => {
                  const goalOption = GOAL_OPTIONS.find(g => g.id === selectedGoal);
                  return goalOption ? goalOption.recommendedTypes.includes(type.id) : true;
                })
                .map((type) => (
                <div
                  key={type.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedContentType === type.id
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedContentType(type.id)}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value={type.id} id={type.id} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={type.id} className="font-medium cursor-pointer">
                        {type.name}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {type.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        例如：{type.example}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </RadioGroup>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(3)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
              <Button 
                className="flex-1"
                disabled={!selectedContentType}
                onClick={() => setCurrentStep(5)}
              >
                下一步
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: 填寫專屬欄位 */}
      {currentStep === 5 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                5
              </span>
              填寫關鍵資訊
            </CardTitle>
            <CardDescription>
              {ALL_CONTENT_TYPES_V2.find(t => t.id === selectedContentType)?.name}需要以下資訊
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentTypeInputFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {field.label}
                  {field.required && <span className="text-red-500 text-xs">*必填</span>}
                </Label>
                {field.type === 'textarea' ? (
                  <Textarea
                    placeholder={field.placeholder}
                    value={typeInputs[field.key] || ''}
                    onChange={(e) => setTypeInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <Input
                    placeholder={field.placeholder}
                    value={typeInputs[field.key] || ''}
                    onChange={(e) => setTypeInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                  />
                )}
                <p className="text-xs text-muted-foreground">{field.description}</p>
              </div>
            ))}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(4)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
              <Button 
                className="flex-1"
                disabled={generateOpeners.isPending}
                onClick={handleGenerateHooks}
              >
                {generateOpeners.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    AI 正在生成開頭選項...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成開頭選項
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Hook 選項（已優化：直接生成多種風格供選擇） */}
      {currentStep === 6 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                6
              </span>
              選擇開頭
            </CardTitle>
            <CardDescription>
              AI 生成了 {hookOptions.length} 個開頭選項，選擇最吸引你的那個
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI 痕跡分數說明 */}
            <div className="bg-muted/30 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">自然度分數說明</span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  80%+ 非常自然
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  60-80% 較自然
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                  40-60% 有 AI 痕跡
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  &lt;40% AI 感明顯
                </span>
              </div>
            </div>

            {hookOptions.map((hook, index) => {
              // 計算自然度分數（100 - AI分數）
              const naturalScore = hook.aiScore !== undefined ? Math.round((1 - hook.aiScore) * 100) : null;
              
              // 類別中文映射
              const categoryLabels: Record<string, { emoji: string; label: string }> = {
                'mirror': { emoji: '🪞', label: '鏡像心理' },
                'contrast': { emoji: '⚡', label: '反差型' },
                'scene': { emoji: '🎬', label: '情境化帶入' },
                'question': { emoji: '❓', label: '提問型' },
                'data': { emoji: '📊', label: '數據型' },
                'story': { emoji: '📖', label: '故事型' },
                'emotion': { emoji: '💫', label: '情緒型' },
                'dialogue': { emoji: '💬', label: '對話型' },
                'casual': { emoji: '💭', label: '閒聊型' },
              };
              
              const getCategoryDisplay = (category: string) => {
                return categoryLabels[category] || { emoji: '✨', label: category || '自訂風格' };
              };
              
              const getScoreStyle = (score: number | null) => {
                if (score === null) return { bg: 'bg-gray-100', text: 'text-gray-600', label: '未檢測' };
                if (score >= 80) return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '非常自然' };
                if (score >= 60) return { bg: 'bg-blue-100', text: 'text-blue-700', label: '較自然' };
                if (score >= 40) return { bg: 'bg-amber-100', text: 'text-amber-700', label: '有 AI 痕跡' };
                return { bg: 'bg-red-100', text: 'text-red-700', label: 'AI 感明顯' };
              };
              
              const categoryDisplay = getCategoryDisplay(hook.templateCategory || hook.styleName || '');
              const scoreStyle = getScoreStyle(naturalScore);
              const isSelected = selectedHook === hook.content;

              return (
                <div
                  key={index}
                  className={`relative border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01] ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20"
                      : "border-transparent bg-card hover:border-muted-foreground/20"
                  }`}
                  onClick={() => {
                    setSelectedHook(hook.content);
                    // 記錄選擇
                    if (hook.candidateId) {
                      selectOpener.mutate({ candidateId: hook.candidateId });
                    }
                    // 學習式 Selector - 記錄用戶選擇
                    if (hook.templateCategory) {
                      recordSelection.mutate({ 
                        templateCategory: hook.templateCategory, 
                        wasSelected: true 
                      });
                      // 同時記錄其他未被選中的選項
                      hookOptions.forEach(otherHook => {
                        if (otherHook.templateCategory && otherHook.templateCategory !== hook.templateCategory) {
                          recordSelection.mutate({ 
                            templateCategory: otherHook.templateCategory, 
                            wasSelected: false 
                          });
                        }
                      });
                    }
                  }}
                >
                  {/* 頂部：風格標籤和自然度 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm font-medium px-3 py-1 bg-background">
                        <span className="mr-1.5">{categoryDisplay.emoji}</span>
                        {categoryDisplay.label}
                      </Badge>
                    </div>
                    {naturalScore !== null && (
                      <Badge 
                        variant="secondary" 
                        className={`text-xs font-medium px-3 py-1 ${scoreStyle.bg} ${scoreStyle.text}`}
                      >
                        {naturalScore}% {scoreStyle.label}
                      </Badge>
                    )}
                  </div>
                  
                  {/* 開頭文字 - 更好的排版 */}
                  <div className={`relative rounded-lg p-4 bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}>
                    <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">
                      {hook.content}
                    </p>
                    
                    {/* 選中標記 */}
                    {isSelected && (
                      <div className="absolute top-3 right-3">
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* AI 痕跡提示 */}
                  {hook.aiLevel && naturalScore !== null && naturalScore < 60 && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                      <span>⚠️</span>
                      <span>
                        {hook.aiLevel === 'has_ai_traces' && '有一些 AI 痕跡，建議微調後使用'}
                        {hook.aiLevel === 'obvious_ai' && 'AI 感較重，建議選擇其他選項或進行修改'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(5)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                上一步
              </Button>
              <Button 
                className="flex-1"
                disabled={!selectedHook || generateDraft.isPending}
                onClick={handleGenerateFullDraft}
              >
                {generateDraft.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    生成全文中...
                  </>
                ) : (
                  <>
                    <PenTool className="w-4 h-4 mr-2" />
                    生成完整貼文
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 7 & 8: 生成結果與對話修改 */}
      {(currentStep === 7 || currentStep === 8) && draftContent && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                {currentStep}
              </span>
              {currentStep === 7 ? "生成結果" : "對話修改"}
            </CardTitle>
            <CardDescription>
              {currentStep === 7 ? "這是 AI 生成的草稿，你可以進行對話修改" : "告訴 AI 你想怎麼調整"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 診斷結果卡片 */}
            {diagnosis && (
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="font-medium">生成診斷</span>
                  </div>
                  <Badge variant="outline" className="bg-primary/10">
                    預估分數 {diagnosis.score}分
                  </Badge>
                </div>
                
                {/* 優勢 */}
                {diagnosis.strengths.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs text-muted-foreground mb-1">✅ 優勢</div>
                    <div className="flex flex-wrap gap-2">
                      {diagnosis.strengths.map((s, i) => (
                        <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400">
                          {s.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 可加強 */}
                {diagnosis.improvements.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">⚠️ 可加強</div>
                    <div className="flex flex-wrap gap-2">
                      {diagnosis.improvements.map((imp, i) => (
                        <Badge 
                          key={i} 
                          variant="outline" 
                          className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 cursor-pointer hover:bg-yellow-500/20"
                          onClick={() => {
                            if (imp.action) {
                              setChatInput(`請幫我${imp.action}`);
                            }
                          }}
                        >
                          {imp.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      💡 點擊標籤可快速填入修改指令
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* 風格匹配度卡片 */}
            {styleMatch && (
              <div className="bg-gradient-to-r from-blue-500/5 to-blue-500/10 rounded-lg p-4 border border-blue-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span className="font-medium">風格匹配度</span>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`${
                      styleMatch.score >= 70 
                        ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
                        : styleMatch.score >= 50 
                          ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                          : 'bg-red-500/10 text-red-700 dark:text-red-400'
                    }`}
                  >
                    {styleMatch.score >= 70 ? '高度匹配' : styleMatch.score >= 50 ? '部分匹配' : '建議優化'} {styleMatch.score}分
                  </Badge>
                </div>
                
                {/* 分項分數 */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="text-xs">
                    <span className="text-muted-foreground">語氣風格：</span>
                    <span className="font-medium">{styleMatch.breakdown.toneMatch}/30</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">慣用詞彙：</span>
                    <span className="font-medium">{styleMatch.breakdown.phraseUsage}/25</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">受眾對齊：</span>
                    <span className="font-medium">{styleMatch.breakdown.audienceAlignment}/25</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">人設一致：</span>
                    <span className="font-medium">{styleMatch.breakdown.pillarConsistency}/20</span>
                  </div>
                </div>
                
                {/* 詳細說明 */}
                {styleMatch.details.length > 0 && (
                  <div className="mb-2">
                    <div className="flex flex-wrap gap-1">
                      {styleMatch.details.map((detail, i) => (
                        <Badge key={i} variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 text-xs">
                          {detail}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 建議 */}
                {styleMatch.suggestions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    💡 {styleMatch.suggestions[0]}
                  </div>
                )}
              </div>
            )}
            
            {/* 草稿內容 */}
            <div className="bg-muted/30 rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <Label>草稿內容</Label>
                <Button size="sm" variant="ghost" onClick={() => handleCopy(draftContent)}>
                  <Copy className="w-4 h-4 mr-1" />
                  複製
                </Button>
              </div>
              <div className="whitespace-pre-wrap text-sm">
                {draftContent}
              </div>
            </div>

            {/* 對話區域 */}
            {chatMessages.length > 0 && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      msg.role === "user"
                        ? "bg-primary/10 ml-8"
                        : "bg-muted mr-8"
                    }`}
                  >
                    <div className="text-xs text-muted-foreground mb-1">
                      {msg.role === "user" ? "你" : "AI"}
                    </div>
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.content.slice(0, 200)}
                      {msg.content.length > 200 && "..."}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            {/* 對話輸入 */}
            <div className="flex gap-2">
              <Textarea
                placeholder="告訴 AI 你想怎麼修改，例如：把開頭改得更有衝擊力..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                rows={2}
                className="flex-1"
              />
              <Button 
                onClick={handleChatSubmit}
                disabled={!chatInput.trim() || isChatting}
              >
                {isChatting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
              </Button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(6)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                重新選開頭
              </Button>
              <Button 
                className="flex-1"
                onClick={() => setCurrentStep(9)}
              >
                下一步：人味潤飾
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 9: 人味潤飾 */}
      {currentStep === 9 && (
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                9
              </span>
              人味潤飾
            </CardTitle>
            <CardDescription>
              加入你的口頭禪和說話風格，讓文章更有你的個人特色
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>你的口頭禪（選填）</Label>
              <Input
                placeholder="例如：「說真的」「我跟你說」「這很重要」..."
                value={catchphrases}
                onChange={(e) => setCatchphrases(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                AI 會在適當的地方加入這些口頭禪
              </p>
            </div>

            <div className="space-y-2">
              <Label>說話風格描述（選填）</Label>
              <Textarea
                placeholder="例如：比較直接、喜歡用問句、會加一些幽默感..."
                value={speakingStyle}
                onChange={(e) => setSpeakingStyle(e.target.value)}
                rows={2}
              />
            </div>

            {/* 當前草稿預覽 */}
            <div className="bg-muted/30 rounded-lg p-4">
              <Label className="mb-2 block">當前草稿</Label>
              <div className="whitespace-pre-wrap text-sm">
                {finalContent || draftContent}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setCurrentStep(8)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                繼續修改
              </Button>
              <Button 
                variant="outline"
                onClick={handlePolish}
                disabled={isChatting}
              >
                {isChatting ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                套用潤飾
              </Button>
              <Button 
                className="flex-1"
                onClick={handleComplete}
              >
                <Check className="w-4 h-4 mr-2" />
                完成，儲存到草稿庫
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
