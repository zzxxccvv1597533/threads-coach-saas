import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  PenTool, 
  Sparkles, 
  Lightbulb,
  Zap,
  Copy,
  Save,
  RefreshCw,
  ChevronRight,
  Info,
  MessageSquare,
  Send,
  ShoppingBag,
  User,
  Users,
  Target,
  Gift,
  Star,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GuidedWritingFlow } from "@/components/GuidedWritingFlow";

import { FLEXIBLE_INPUT_FIELDS, CONTENT_TYPES_WITH_VIRAL_ELEMENTS } from "@shared/knowledge-base";
import { CONTENT_TYPES_V2, ALL_CONTENT_TYPES_V2, HOOK_STYLES_V2 } from "@shared/content-types-v2";

// 導流內容類型定義 - 整合產品矩陣概念
const monetizationContentTypes = [
  // 基礎導流
  {
    id: "profile_intro",
    name: "首頁自介文",
    description: "讓新訪客認識你，適合置頂",
    icon: <User className="w-4 h-4" />,
    badge: "置頂推薦",
    badgeColor: "bg-amber-500",
    category: "base",
    inputFields: ["unique_value", "target_audience", "cta_action"],
  },
  {
    id: "plus_one",
    name: "+1 互動文",
    description: "高轉換機制，留言後私訊",
    icon: <MessageSquare className="w-4 h-4" />,
    badge: "高轉換",
    badgeColor: "bg-emerald-500",
    category: "base",
    inputFields: ["offer_content", "target_pain"],
  },
  // 引流品（低價/免費）
  {
    id: "lead_magnet",
    name: "引流品推廣",
    description: "低門檻服務邀請，吸引潛在客戶",
    icon: <Target className="w-4 h-4" />,
    badge: "引流品",
    badgeColor: "bg-blue-500",
    category: "lead",
    inputFields: ["product_name", "product_benefit", "value_preview"],
  },
  {
    id: "free_value",
    name: "免費價值文",
    description: "提供免費資源吸引關注",
    icon: <Gift className="w-4 h-4" />,
    badge: "引流品",
    badgeColor: "bg-blue-500",
    category: "lead",
    inputFields: ["free_content", "target_pain"],
  },
  // 核心品（主力產品）
  {
    id: "service_intro",
    name: "核心服務介紹",
    description: "說明你的主力產品/服務",
    icon: <ShoppingBag className="w-4 h-4" />,
    badge: "核心品",
    badgeColor: "bg-purple-500",
    category: "core",
    inputFields: ["service_detail", "transformation", "social_proof"],
  },
  {
    id: "success_story",
    name: "成功案例故事",
    description: "用故事展現價值，建立信任",
    icon: <Star className="w-4 h-4" />,
    badge: "核心品",
    badgeColor: "bg-purple-500",
    category: "core",
    inputFields: ["case_background", "case_transformation", "case_result"],
  },
  // VIP 品（高價服務）
  {
    id: "vip_service",
    name: "VIP 服務推廣",
    description: "高價服務的軟性推廣",
    icon: <Star className="w-4 h-4" />,
    badge: "VIP 品",
    badgeColor: "bg-amber-600",
    category: "vip",
    inputFields: ["vip_benefit", "exclusivity", "transformation"],
  },
  // 被動品（數位產品）
  {
    id: "passive_product",
    name: "數位產品推廣",
    description: "電子書、課程、模板等被動收入",
    icon: <Gift className="w-4 h-4" />,
    badge: "被動品",
    badgeColor: "bg-teal-500",
    category: "passive",
    inputFields: ["product_name", "product_benefit", "target_pain"],
  },
];

// 變現內容輸入欄位定義
const monetizeInputFields: Record<string, { label: string; placeholder: string; description: string }> = {
  unique_value: {
    label: "你的獨特價值",
    placeholder: "例如：我幫助女性創業者找到自己的定位...",
    description: "你能幫受眾解決什麼問題？",
  },
  target_audience: {
    label: "目標受眾",
    placeholder: "例如：想經營個人品牌的女性創業者...",
    description: "你想吸引誰？",
  },
  cta_action: {
    label: "行動呼籲",
    placeholder: "例如：追蹤我獲得更多創業干貨...",
    description: "你希望讀者採取什麼行動？",
  },
  offer_content: {
    label: "提供的內容",
    placeholder: "例如：免費的《Threads 經營指南》電子書...",
    description: "留言 +1 後會得到什麼？",
  },
  target_pain: {
    label: "目標痛點",
    placeholder: "例如：不知道怎麼開始經營社群...",
    description: "這個內容解決什麼痛點？",
  },
  product_name: {
    label: "產品名稱",
    placeholder: "例如：Threads 內容經營工作坊...",
    description: "你要推廣的產品/服務名稱",
  },
  product_benefit: {
    label: "產品效益",
    placeholder: "例如：學會如何寫出爆款貼文...",
    description: "買了會得到什麼結果？",
  },
  value_preview: {
    label: "內容預告",
    placeholder: "例如：這份清單能讓你快速定位現在的狀態...",
    description: "簡單描述這個內容能帶來什麼價值？",
  },
  free_content: {
    label: "免費內容",
    placeholder: "例如：免費的 30 分鐘諮詢...",
    description: "你提供什麼免費價值？",
  },
  service_detail: {
    label: "服務內容",
    placeholder: "例如：1對1 品牌諮詢，包含...",
    description: "你的服務包含什麼？",
  },
  transformation: {
    label: "轉變結果",
    placeholder: "例如：從不知道要發什麼，到每天都有靈感...",
    description: "客戶會得到什麼轉變？",
  },
  social_proof: {
    label: "社會證明",
    placeholder: "例如：已幫助 100+ 學員開始經營...",
    description: "你有什麼成績可以展示？（選填）",
  },
  case_background: {
    label: "案例背景",
    placeholder: "例如：她是一個全職媽媽，想開始副業...",
    description: "這個客戶原本的狀況？",
  },
  case_transformation: {
    label: "轉變過程",
    placeholder: "例如：透過 3 個月的諮詢，她...",
    description: "你幫她做了什麼？",
  },
  case_result: {
    label: "最終結果",
    placeholder: "例如：現在每月有穩定的副業收入...",
    description: "客戶最後得到什麼結果？",
  },
  vip_benefit: {
    label: "VIP 專屬權益",
    placeholder: "例如：無限次 1對1 諮詢、專屬群組...",
    description: "VIP 客戶有什麼獨家權益？",
  },
  exclusivity: {
    label: "稀缺性",
    placeholder: "例如：每月只收 3 位新學員...",
    description: "為什麼這個服務很稀有？",
  },
};

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function WritingStudio() {
  const [, setLocation] = useLocation();
  const { data: contentTypes } = trpc.knowledge.contentTypesWithViralElements.useQuery();
  const { data: ipProfile } = trpc.ipProfile.get.useQuery();
  const { data: userProducts } = trpc.userProduct.list.useQuery();
  const { data: successStories } = trpc.successStory.list.useQuery();
  const { data: growthMetrics } = trpc.growthMetrics.get.useQuery();
  
  // 從 localStorage 讀取保存的狀態
  const getStoredState = <T,>(key: string, defaultValue: T): T => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = localStorage.getItem(`writingStudio_${key}`);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [mode, setMode] = useState<"brainstorm" | "material" | "monetize">(() => getStoredState("mode", "brainstorm"));
  const [material, setMaterial] = useState(() => getStoredState("material", ""));
  const [selectedContentType, setSelectedContentType] = useState(() => getStoredState("selectedContentType", "story"));
  const [selectedMonetizeType, setSelectedMonetizeType] = useState(() => getStoredState("selectedMonetizeType", "profile_intro"));
  const [selectedAngle, setSelectedAngle] = useState(() => getStoredState("selectedAngle", ""));
  const [step, setStep] = useState(() => getStoredState("step", 1));
  
  const [brainstormResult, setBrainstormResult] = useState<Array<{ title: string; audience: string; contentType: string; hook: string }>>(() => {
    const stored = getStoredState("brainstormResult", []);
    // 確保是陣列格式，如果是舊的字串格式則返回空陣列
    return Array.isArray(stored) ? stored : [];
  });
  const [anglesResult, setAnglesResult] = useState<Array<{ name: string; type: string; description: string; hook: string; cta: string }>>(() => {
    const stored = getStoredState("anglesResult", []);
    // 確保是陣列格式，如果是舊的字串格式則返回空陣列
    return Array.isArray(stored) ? stored : [];
  });
  const [draftResult, setDraftResult] = useState(() => getStoredState("draftResult", ""));
  const [draftId, setDraftId] = useState<number | null>(() => getStoredState("draftId", null));
  const [flexibleInputs, setFlexibleInputs] = useState<Record<string, string>>(() => getStoredState("flexibleInputs", {}));
  
  // Hook 選擇相關 state
  const [selectedHookStyle, setSelectedHookStyle] = useState(() => getStoredState("selectedHookStyle", ""));
  const [hookOptions, setHookOptions] = useState<Array<{ style: string; styleName: string; content: string; reason: string }>>(() => {
    const stored = getStoredState("hookOptions", []);
    return Array.isArray(stored) ? stored : [];
  });
  const [selectedHook, setSelectedHook] = useState(() => getStoredState("selectedHook", ""));
  
  // 新版專屬輸入欄位（根據 content-types-v2）
  const [typeInputs, setTypeInputs] = useState<Record<string, string>>(() => getStoredState("typeInputs", {}));

  // 對話修改功能
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => getStoredState("chatMessages", []));
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  
  // 診斷結果
  const [diagnosis, setDiagnosis] = useState<{
    strengths: Array<{ label: string; description: string }>;
    improvements: Array<{ label: string; description: string; action?: string }>;
    score: number;
  } | null>(null);

  // 保存狀態到 localStorage
  useEffect(() => {
    const saveState = (key: string, value: unknown) => {
      try {
        localStorage.setItem(`writingStudio_${key}`, JSON.stringify(value));
      } catch {
        // 忽略儲存錯誤
      }
    };
    saveState("mode", mode);
    saveState("material", material);
    saveState("selectedContentType", selectedContentType);
    saveState("selectedMonetizeType", selectedMonetizeType);
    saveState("selectedAngle", selectedAngle);
    saveState("step", step);
    saveState("brainstormResult", brainstormResult);
    saveState("anglesResult", anglesResult);
    saveState("draftResult", draftResult);
    saveState("draftId", draftId);
    saveState("chatMessages", chatMessages);
    saveState("flexibleInputs", flexibleInputs);
    saveState("selectedHookStyle", selectedHookStyle);
    saveState("hookOptions", hookOptions);
    saveState("selectedHook", selectedHook);
    saveState("typeInputs", typeInputs);
  }, [mode, material, selectedContentType, selectedMonetizeType, selectedAngle, step, brainstormResult, anglesResult, draftResult, draftId, chatMessages, flexibleInputs, selectedHookStyle, hookOptions, selectedHook, typeInputs]);

  // 處理 URL 參數（從痛點矩陣或其他頁面跳轉過來）
  const searchString = useSearch();
  useEffect(() => {
    if (searchString) {
      const params = new URLSearchParams(searchString);
      const urlMaterial = params.get('material');
      const urlMode = params.get('mode');
      const urlAngle = params.get('angle');
      const urlTopic = params.get('topic');
      
      if (urlMaterial) {
        setMaterial(decodeURIComponent(urlMaterial));
        setStep(1);
        
        // 設定模式 - 支援 guided 模式
        if (urlMode === 'guided') {
          // 引導模式：切換到引導模式 Tab
          setMode('brainstorm');
          // 如果有帶入選題，設定為選中的切角
          if (urlTopic) {
            setSelectedAngle(decodeURIComponent(urlTopic));
          }
        } else if (urlMode === 'material' || urlMode === 'brainstorm' || urlMode === 'monetize') {
          setMode(urlMode);
        } else {
          setMode('material');
        }
        
        if (urlAngle) {
          setSelectedAngle(decodeURIComponent(urlAngle));
        }
        
        toast.success('已帶入選題，可以直接生成文案！');
        
        // 清除 URL 參數，避免重複處理
        window.history.replaceState({}, '', '/writing-studio');
      }
    }
  }, [searchString]);

  const brainstorm = trpc.ai.brainstorm.useMutation({
    onSuccess: (data) => {
      setBrainstormResult(Array.isArray(data.suggestions) ? data.suggestions : []);
      toast.success("靈感已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  const analyzeAngles = trpc.ai.analyzeAngles.useMutation({
    onSuccess: (data) => {
      setAnglesResult(Array.isArray(data.angles) ? data.angles : []);
      setStep(2);
      toast.success("切角分析完成！");
    },
    onError: () => {
      toast.error("分析失敗，請稍後再試");
    },
  });

  // 生成 Hook 選項
  const generateHooks = trpc.ai.generateHooks.useMutation({
    onSuccess: (data) => {
      setHookOptions(Array.isArray(data.hooks) ? data.hooks : []);
      toast.success("Hook 選項已生成！");
    },
    onError: () => {
      toast.error("生成 Hook 失敗，請稍後再試");
    },
  });

  const generateDraft = trpc.ai.generateDraft.useMutation({
    onSuccess: (data) => {
      setDraftResult(typeof data.content === 'string' ? data.content : '');
      setDraftId(data.draftId || null);
      // 設定診斷結果
      if (data.diagnosis) {
        setDiagnosis(data.diagnosis);
      }
      setStep(3);
      setChatMessages([]); // 重置對話歷史
      toast.success("草稿已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  // 變現內容生成
  const generateMonetizeContent = trpc.ai.generateMonetizeContent.useMutation({
    onSuccess: (data) => {
      setDraftResult(typeof data.content === 'string' ? data.content : '');
      setDraftId(data.draftId || null);
      setStep(3);
      setChatMessages([]);
      toast.success("變現內容已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  // 對話修改
  const refineDraft = trpc.ai.refineDraft.useMutation({
    onSuccess: (data) => {
      const newContent = typeof data.content === 'string' ? data.content : '';
      setDraftResult(newContent);
      setChatMessages(prev => [...prev, { role: "assistant", content: newContent }]);
      setIsChatting(false);
    },
    onError: () => {
      toast.error("修改失敗，請稍後再試");
      setIsChatting(false);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleBrainstorm = () => {
    brainstorm.mutate({ topic: material || undefined });
  };

  const handleAnalyzeAngles = () => {
    if (!material.trim()) {
      toast.error("請先輸入你的素材");
      return;
    }
    analyzeAngles.mutate({ material });
  };

  const handleGenerateDraft = () => {
    // 如果沒有素材且沒有填寫任何彈性欄位，則顯示錯誤
    const hasFlexibleInput = Object.values(flexibleInputs).some(v => v && v.trim().length > 0);
    if (!material.trim() && !hasFlexibleInput) {
      toast.error("請先輸入你的素材或填寫關鍵資訊");
      return;
    }
    
    // 只傳遞有內容的欄位
    const filledFlexibleInputs: Record<string, string | string[]> = {};
    for (const [key, value] of Object.entries(flexibleInputs)) {
      if (value && typeof value === 'string' && value.trim()) {
        filledFlexibleInputs[key] = value;
      } else if (Array.isArray(value) && value.length > 0) {
        filledFlexibleInputs[key] = value;
      }
    }
    
    generateDraft.mutate({
      material: material || undefined,
      contentType: selectedContentType,
      angle: selectedAngle || undefined,
      flexibleInput: Object.keys(filledFlexibleInputs).length > 0 ? filledFlexibleInputs as any : undefined,
    });
  };

  const handleGenerateMonetize = () => {
    if (!hasCoreProduct) {
      toast.error("請先在 IP 地基設定你的核心產品");
      return;
    }
    // 只傳遞有內容的欄位
    const filledInputFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(flexibleInputs)) {
      if (value && value.trim()) {
        filledInputFields[key] = value;
      }
    }
    
    generateMonetizeContent.mutate({
      contentType: selectedMonetizeType,
      additionalContext: material || undefined,
      inputFields: Object.keys(filledInputFields).length > 0 ? filledInputFields : undefined,
    });
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim() || !draftResult) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setChatInput("");
    setIsChatting(true);

    refineDraft.mutate({
      currentDraft: draftResult,
      instruction: userMessage,
      draftId: draftId || undefined, // 傳遞草稿 ID 以更新資料庫
      chatHistory: chatMessages,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  // 確認當前版本，存入草稿庫
  const handleConfirmVersion = () => {
    if (draftId) {
      toast.success(
        <div className="flex flex-col gap-1">
          <span>✅ 已存入草稿庫</span>
          <a 
            href="/drafts" 
            className="text-primary underline text-sm"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/drafts';
            }}
          >
            前往草稿庫 →
          </a>
        </div>,
        { duration: 5000 }
      );
    } else {
      toast.success("已存入草稿庫");
    }
  };

  const handleReset = () => {
    setMaterial("");
    setSelectedAngle("");
    setStep(1);
    setBrainstormResult([]);
    setAnglesResult([]);
    setDraftResult("");
    setDraftId(null);
    setChatMessages([]);
    setFlexibleInputs({});
    setSelectedHookStyle("");
    setHookOptions([]);
    setSelectedHook("");
    setTypeInputs({});
  };

  // Check if IP profile is complete enough
  const ipProgress = (() => {
    if (!ipProfile) return 0;
    let score = 0;
    if (ipProfile.occupation) score += 15;
    if (ipProfile.voiceTone) score += 15;
    if (ipProfile.viewpointStatement) score += 15;
    if (ipProfile.personaExpertise) score += 20;
    if (ipProfile.personaEmotion) score += 15;
    if (ipProfile.personaViewpoint) score += 20;
    return score;
  })();

  // Check if has core product
  const hasCoreProduct = userProducts?.some((p: { productType: string }) => p.productType === 'core');

  // Show warning banner instead of blocking
  const showIpWarning = ipProgress < 50;

  // 計算缺少的 IP 資料項目
  const missingIpItems = (() => {
    if (!ipProfile) return [];
    const items: { name: string; boost: string; link: string }[] = [];
    if (!ipProfile.occupation) {
      items.push({ name: '職業/身份', boost: '專業度 +15%', link: '/ip-profile' });
    }
    if (!ipProfile.personaExpertise || !ipProfile.personaEmotion || !ipProfile.personaViewpoint) {
      items.push({ name: '人設三支柱', boost: '粉絲記憶度 +30%', link: '/ip-profile' });
    }
    if (!ipProfile.viewpointStatement) {
      items.push({ name: '信念價值觀', boost: '內容一致性 +25%', link: '/ip-profile' });
    }
    return items;
  })();

  // 檢查產品資訊是否完善
  const missingProductInfo = !hasCoreProduct ? [
    { name: '核心產品', boost: '變現轉換率 +40%', link: '/ip-profile' }
  ] : [];

  // 判斷是否應該顯示變現建議
  const shouldShowMonetizeTip = growthMetrics && 
    ((growthMetrics.followerCount ?? 0) >= 100 || (growthMetrics.avgReach ?? 0) >= 1000);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">發文工作室</h1>
            <p className="text-muted-foreground mt-1">
              讓 AI 幫你產出符合人設的高品質內容
            </p>
          </div>
          {step > 1 && (
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新開始
            </Button>
          )}
        </div>

        {/* IP Warning Banner */}
        {showIpWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">建議先完善 IP 地基</p>
                <p className="text-sm text-amber-700">設定你的人設三支柱，讓 AI 產出更符合你風格的內容</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/ip-profile'}>
              前往設定
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* 經營階段提示 */}
        {growthMetrics && (
          <GrowthStageHint stage={growthMetrics.currentStage || 'startup'} />
        )}

        {/* Monetization Tip */}
        {shouldShowMonetizeTip && !hasCoreProduct && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="font-medium text-emerald-800">你的帳號已準備好變現！</p>
                <p className="text-sm text-emerald-700">流量穩定後，建議設定產品並開始發布變現內容</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/ip-profile'}>
              設定產品
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Mode Selection - Custom Tab Buttons */}
        <div className="space-y-6">
          <div className="bg-muted p-1 rounded-lg grid grid-cols-3 gap-1">
            <button
              onClick={() => setMode("brainstorm")}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "brainstorm"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-1">
                <Lightbulb className="w-4 h-4" />
                引導模式
              </div>
              <span className="text-[10px] opacity-70">新手推薦</span>
            </button>
            <button
              onClick={() => setMode("material")}
              className={`flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "material"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                進階模式
              </div>
              <span className="text-[10px] opacity-70">直接與 AI 對話</span>
            </button>
            <button
              onClick={() => setMode("monetize")}
              className={`relative flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "monetize"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center gap-1">
                <ShoppingBag className="w-4 h-4" />
                變現內容
              </div>
              <span className="text-[10px] opacity-70">導流與銷售</span>
              {hasCoreProduct && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Brainstorm Mode */}
          {/* Brainstorm Mode - 完整引導流程 */}
          {mode === "brainstorm" && (
            <GuidedWritingFlow
              ipProfile={ipProfile ? {
                occupation: ipProfile.occupation || undefined,
                personaExpertise: ipProfile.personaExpertise || undefined,
                personaEmotion: ipProfile.personaEmotion || undefined,
                personaViewpoint: ipProfile.personaViewpoint || undefined,
                voiceTone: ipProfile.voiceTone || undefined,
              } : null}
              initialTopic={selectedAngle || undefined}
              initialMaterial={material || undefined}
              onComplete={(newDraftId, content) => {
                setDraftId(newDraftId);
                setDraftResult(content);
                toast.success("已儲存到草稿庫！");
                setLocation('/drafts');
              }}
              onNavigateToIp={() => setLocation('/ip-profile')}
            />
          )}

          {/* Material Mode */}
          {mode === "material" && (
          <div className="space-y-6">
            {/* Step 1: Input Material */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                    1
                  </span>
                  輸入素材
                </CardTitle>
                <CardDescription>
                  把你想發的內容、靈感、故事、觀點寫下來
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="例如：今天有個案主來問我，她說她一直很想開始經營社群，但總是覺得自己沒什麼好分享的..."
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <div className="flex gap-3">
                  <Button 
                    onClick={handleAnalyzeAngles}
                    disabled={analyzeAngles.isPending || !material.trim()}
                    className="flex-1"
                  >
                    {analyzeAngles.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        分析切角
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleGenerateDraft}
                    disabled={generateDraft.isPending || !material.trim()}
                  >
                    {generateDraft.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-4 h-4 mr-2" />
                        直接生成
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Angles Result */}
            {step >= 2 && anglesResult && anglesResult.length > 0 && (
              <Card className="elegant-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                      2
                    </span>
                    選擇切角
                  </CardTitle>
                  <CardDescription>
                    AI 分析了三種不同的切角方向，點擊卡片選擇你想用的切角
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 切角結果 - 表格化呈現 */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-3 font-medium text-sm border-b">切角類型</th>
                          <th className="text-left p-3 font-medium text-sm border-b">說明</th>
                          <th className="text-left p-3 font-medium text-sm border-b">開頭示範</th>
                          <th className="text-left p-3 font-medium text-sm border-b">互動引導</th>
                          <th className="text-center p-3 font-medium text-sm border-b">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {anglesResult.map((angle, index) => (
                          <tr 
                            key={index} 
                            className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedAngle === angle.hook ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                            onClick={() => {
                              setSelectedAngle(angle.hook);
                              toast.success(`已選擇「${angle.name}」切角`);
                            }}
                          >
                            <td className="p-3 border-b">
                              <div className="font-medium text-primary">{angle.name}</div>
                            </td>
                            <td className="p-3 border-b">
                              <div className="text-sm text-muted-foreground">{angle.description}</div>
                            </td>
                            <td className="p-3 border-b">
                              <div className="text-sm italic">「{angle.hook}」</div>
                            </td>
                            <td className="p-3 border-b">
                              <div className="text-sm text-muted-foreground">{angle.cta}</div>
                            </td>
                            <td className="p-3 border-b text-center">
                              <Button
                                size="sm"
                                variant={selectedAngle === angle.hook ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedAngle(angle.hook);
                                  toast.success(`已選擇「${angle.name}」切角`);
                                }}
                              >
                                {selectedAngle === angle.hook ? (
                                  <>✓ 已選擇</>
                                ) : (
                                  <>選擇</>
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  {selectedAngle && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="text-sm font-medium text-primary mb-1">已選擇的開頭：</div>
                      <div className="text-sm italic">「{selectedAngle}」</div>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    <Label>選擇內容類型</Label>
                    <RadioGroup
                      value={selectedContentType}
                      onValueChange={setSelectedContentType}
                      className="grid grid-cols-2 md:grid-cols-3 gap-2"
                    >
                      {contentTypes?.map((type: { id: string; name: string; description: string }) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={type.id} id={type.id} />
                          <Label htmlFor={type.id} className="text-sm cursor-pointer">
                            {type.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* 爆款元素提示卡片 */}
                  {selectedContentType && (() => {
                    const selectedType = contentTypes?.find((t: { id: string }) => t.id === selectedContentType) as { 
                      id: string; 
                      name: string; 
                      description: string;
                      viralElements?: { 
                        hookTips: string; 
                        contentTips: string; 
                        ctaTips: string; 
                        avoidTips: string; 
                      } 
                    } | undefined;
                    if (!selectedType?.viralElements) return null;
                    return (
                      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-purple-700 font-medium">
                          <Sparkles className="w-4 h-4" />
                          <span>{selectedType.name}爆款元素</span>
                        </div>
                        <div className="grid gap-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-purple-600 font-medium min-w-[60px]">開頭：</span>
                            <span className="text-gray-700">{selectedType.viralElements.hookTips}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-purple-600 font-medium min-w-[60px]">內容：</span>
                            <span className="text-gray-700">{selectedType.viralElements.contentTips}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-purple-600 font-medium min-w-[60px]">互動：</span>
                            <span className="text-gray-700">{selectedType.viralElements.ctaTips}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-red-500 font-medium min-w-[60px]">避免：</span>
                            <span className="text-gray-700">{selectedType.viralElements.avoidTips}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 動態輸入欄位 - 根據內容類型顯示專屬欄位 (v2) */}
                  {selectedContentType && (() => {
                    const selectedTypeV2 = CONTENT_TYPES_V2.find(t => t.id === selectedContentType);
                    if (!selectedTypeV2) return null;
                    
                    return (
                      <div className="space-y-4 bg-muted/30 rounded-lg p-4">
                        <div className="text-sm font-medium text-muted-foreground">
                          📝 填寫關鍵資訊（讓 AI 更懂你的需求）
                        </div>
                        
                        {/* 故事型特殊處理：新增故事來源選擇 */}
                        {selectedContentType === 'story' && (
                          <div className="space-y-2">
                            <Label>故事來源 *</Label>
                            <RadioGroup
                              value={flexibleInputs['story_source'] || 'case'}
                              onValueChange={(value) => setFlexibleInputs(prev => ({ ...prev, story_source: value }))}
                              className="flex flex-wrap gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="case" id="story_case" />
                                <Label htmlFor="story_case" className="cursor-pointer">案例故事（個案/客戶）</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="self" id="story_self" />
                                <Label htmlFor="story_self" className="cursor-pointer">自己的故事</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="others" id="story_others" />
                                <Label htmlFor="story_others" className="cursor-pointer">他人的故事（朋友/同事）</Label>
                              </div>
                            </RadioGroup>
                            <p className="text-xs text-muted-foreground">不同來源的故事會有不同的寫作角度</p>
                          </div>
                        )}
                        
                        {selectedTypeV2.inputFields.map((field) => (
                          <div key={field.key} className="space-y-2">
                            <Label className="flex items-center gap-2">
                              {field.label}
                              {field.required && <span className="text-red-500 text-xs">*</span>}
                            </Label>
                            {field.type === 'textarea' ? (
                              <Textarea
                                placeholder={field.placeholder}
                                value={flexibleInputs[field.key] || ''}
                                onChange={(e) => setFlexibleInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                                rows={3}
                              />
                            ) : (
                              <Input
                                placeholder={field.placeholder}
                                value={flexibleInputs[field.key] || ''}
                                onChange={(e) => setFlexibleInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                              />
                            )}
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <Label>補充切角方向（選填）</Label>
                    <Textarea
                      placeholder="例如：我想用故事切角，從案主的角度出發..."
                      value={selectedAngle}
                      onChange={(e) => setSelectedAngle(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button 
                    onClick={handleGenerateDraft}
                    disabled={generateDraft.isPending}
                    className="w-full"
                  >
                    {generateDraft.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-4 h-4 mr-2" />
                        生成草稿
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Draft Result with Chat */}
            {step >= 3 && draftResult && (
              <>
                <DraftResultWithChat
                  draftResult={draftResult}
                  draftId={draftId}
                  chatMessages={chatMessages}
                  chatInput={chatInput}
                  isChatting={isChatting}
                  onChatInputChange={setChatInput}
                  onChatSubmit={handleChatSubmit}
                  onCopy={handleCopy}
                  onConfirmVersion={handleConfirmVersion}
                  chatEndRef={chatEndRef}
                  diagnosis={diagnosis}
                />
                
                {/* 補充資料建議卡片 - 根據內容類型顯示 */}
                {selectedContentType && (() => {
                  const selectedType = CONTENT_TYPES_WITH_VIRAL_ELEMENTS.find(t => t.id === selectedContentType);
                  if (!selectedType) return null;
                  const inputFields = selectedType.inputFields || ['material'];
                  const missingFields = inputFields.filter((fieldId: string) => !flexibleInputs[fieldId]);
                  
                  if (missingFields.length === 0) return null;
                  
                  return (
                    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
                          <Lightbulb className="w-5 h-5" />
                          讓內容更好的小建議
                        </CardTitle>
                        <CardDescription className="text-blue-700">
                          補充以下資料，讓 AI 產出更符合你風格的內容
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {missingFields.map((fieldId: string) => {
                            const field = FLEXIBLE_INPUT_FIELDS[fieldId];
                            if (!field) return null;
                            return (
                              <div key={fieldId} className="flex items-center gap-2 p-2 bg-white/60 rounded-lg">
                                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Info className="w-3 h-3 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-blue-900">
                                    補充「{field.label}」可以讓內容更精準
                                  </p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                  onClick={() => {
                                    setStep(2);
                                    toast.info(`請在上方補充「${field.label}」`);
                                  }}
                                >
                                  去補充
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* IP 未完善提醒卡片 */}
                {(missingIpItems.length > 0 || missingProductInfo.length > 0) && (
                  <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
                        <Zap className="w-5 h-5" />
                        提升內容效果的小建議
                      </CardTitle>
                      <CardDescription className="text-amber-700">
                        完善以下資料，讓 AI 產出更符合你風格的內容
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        {missingIpItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                <Info className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-amber-900">設定{item.name}</p>
                                <p className="text-xs text-amber-700">完善後可提升 <span className="font-semibold text-emerald-600">{item.boost}</span></p>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                              onClick={() => window.location.href = item.link}
                            >
                              前往設定
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        ))}
                        {missingProductInfo.map((item, idx) => (
                          <div key={`product-${idx}`} className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="font-medium text-sm text-amber-900">設定{item.name}</p>
                                <p className="text-xs text-amber-700">完善後可提升 <span className="font-semibold text-emerald-600">{item.boost}</span></p>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                              onClick={() => window.location.href = item.link}
                            >
                              前往設定
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
          )}

          {/* Monetize Mode */}
          {mode === "monetize" && (
          <div className="space-y-6">
            {!hasCoreProduct ? (
              <Card className="elegant-card border-amber-500/30">
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <ShoppingBag className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">請先設定你的核心產品</h3>
                    <p className="text-muted-foreground mb-4">
                      在 IP 地基中設定你的產品/服務後，AI 才能幫你生成變現內容
                    </p>
                    <Button onClick={() => window.location.href = '/ip-profile'}>
                      前往設定產品
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* IP 地基預覽卡片 - 顯示已設定的內容 */}
                <Card className="elegant-card border-brand-blue/20 bg-gradient-to-br from-brand-blue/5 to-brand-gold/5">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-brand-blue">
                      <User className="w-5 h-5" />
                      AI 將參考你的 IP 地基
                    </CardTitle>
                    <CardDescription>
                      以下資料會自動帶入變現內容，讓內容更符合你的人設
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 人設三支柱 */}
                    {(ipProfile?.personaExpertise || ipProfile?.personaEmotion || ipProfile?.personaViewpoint) && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-brand-blue">人設三支柱</div>
                        <div className="grid gap-2 md:grid-cols-3">
                          {ipProfile?.personaExpertise && (
                            <div className="p-2 bg-white/60 rounded-lg border border-brand-blue/10">
                              <div className="text-xs text-muted-foreground mb-1">專業權威</div>
                              <div className="text-sm line-clamp-2">{ipProfile.personaExpertise}</div>
                            </div>
                          )}
                          {ipProfile?.personaEmotion && (
                            <div className="p-2 bg-white/60 rounded-lg border border-brand-blue/10">
                              <div className="text-xs text-muted-foreground mb-1">情感共鳴</div>
                              <div className="text-sm line-clamp-2">{ipProfile.personaEmotion}</div>
                            </div>
                          )}
                          {ipProfile?.personaViewpoint && (
                            <div className="p-2 bg-white/60 rounded-lg border border-brand-blue/10">
                              <div className="text-xs text-muted-foreground mb-1">獨特觀點</div>
                              <div className="text-sm line-clamp-2">{ipProfile.personaViewpoint}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* 英雄旅程故事 */}
                    {(ipProfile?.heroJourneyOrigin || ipProfile?.heroJourneyMission) && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-brand-blue">你的故事</div>
                        <div className="p-2 bg-white/60 rounded-lg border border-brand-blue/10">
                          {ipProfile.heroJourneyOrigin && (
                            <div className="text-sm line-clamp-2">緣起：{ipProfile.heroJourneyOrigin}</div>
                          )}
                          {ipProfile.heroJourneyMission && (
                            <div className="text-xs text-muted-foreground mt-1">使命：{ipProfile.heroJourneyMission}</div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* 產品資訊 */}
                    {userProducts && userProducts.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-brand-blue">已設定的產品</div>
                        <div className="flex flex-wrap gap-2">
                          {userProducts.map((product) => (
                            <Badge 
                              key={product.id} 
                              variant="outline" 
                              className={`${
                                product.productType === 'core' ? 'border-purple-500 text-purple-700 bg-purple-50' :
                                product.productType === 'lead' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                product.productType === 'vip' ? 'border-amber-500 text-amber-700 bg-amber-50' :
                                'border-teal-500 text-teal-700 bg-teal-50'
                              }`}
                            >
                              {product.productType === 'core' ? '核心品' :
                               product.productType === 'lead' ? '引流品' :
                               product.productType === 'vip' ? 'VIP' : '被動品'}
                              ：{product.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 編輯連結 */}
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => window.location.href = '/ip-profile'} className="text-brand-blue hover:text-brand-blue/80">
                        編輯 IP 地基
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Content Type Selection */}
                <Card className="elegant-card">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-emerald-500" />
                      選擇變現內容類型
                    </CardTitle>
                    <CardDescription>
                      AI 會根據你的產品和人設，生成原生風格的導流內容（不像廣告）
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 產品矩陣分類顯示 */}
                    <div className="space-y-4">
                      {/* 基礎導流 */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">🎯 基礎導流</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {monetizationContentTypes.filter(t => t.category === 'base').map((type) => (
                            <div
                              key={type.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedMonetizeType === type.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/50 hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedMonetizeType(type.id)}
                            >
                              <div className="flex items-center gap-2">
                                {type.icon}
                                <span className="font-medium text-sm">{type.name}</span>
                                {type.badge && (
                                  <Badge className={`text-xs ${type.badgeColor} text-white`}>
                                    {type.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 ml-6">{type.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 引流品 */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">🎁 引流品（低價/免費）</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {monetizationContentTypes.filter(t => t.category === 'lead').map((type) => (
                            <div
                              key={type.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedMonetizeType === type.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/50 hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedMonetizeType(type.id)}
                            >
                              <div className="flex items-center gap-2">
                                {type.icon}
                                <span className="font-medium text-sm">{type.name}</span>
                                <Badge className={`text-xs ${type.badgeColor} text-white`}>{type.badge}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 ml-6">{type.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* 核心品 */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">💼 核心品（主力產品）</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {monetizationContentTypes.filter(t => t.category === 'core').map((type) => (
                            <div
                              key={type.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedMonetizeType === type.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/50 hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedMonetizeType(type.id)}
                            >
                              <div className="flex items-center gap-2">
                                {type.icon}
                                <span className="font-medium text-sm">{type.name}</span>
                                <Badge className={`text-xs ${type.badgeColor} text-white`}>{type.badge}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 ml-6">{type.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* VIP 品 & 被動品 */}
                      <div>
                        <div className="text-sm font-medium text-muted-foreground mb-2">⭐ 高價服務 & 被動收入</div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {monetizationContentTypes.filter(t => t.category === 'vip' || t.category === 'passive').map((type) => (
                            <div
                              key={type.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selectedMonetizeType === type.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/50 hover:border-primary/50'
                              }`}
                              onClick={() => setSelectedMonetizeType(type.id)}
                            >
                              <div className="flex items-center gap-2">
                                {type.icon}
                                <span className="font-medium text-sm">{type.name}</span>
                                <Badge className={`text-xs ${type.badgeColor} text-white`}>{type.badge}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 ml-6">{type.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 動態輸入欄位 - 根據選擇的類型顯示 */}
                    {selectedMonetizeType && (() => {
                      const selectedType = monetizationContentTypes.find(t => t.id === selectedMonetizeType);
                      if (!selectedType?.inputFields) return null;
                      
                      return (
                        <div className="space-y-4 bg-muted/30 rounded-lg p-4">
                          <div className="text-sm font-medium text-muted-foreground">
                            📝 補充資料（讓內容更精準）
                          </div>
                          {selectedType.inputFields.map((fieldId: string) => {
                            const field = monetizeInputFields[fieldId];
                            if (!field) return null;
                            return (
                              <div key={fieldId} className="space-y-2">
                                <Label>{field.label}</Label>
                                <Textarea
                                  placeholder={field.placeholder}
                                  value={flexibleInputs[fieldId] || ''}
                                  onChange={(e) => setFlexibleInputs(prev => ({ ...prev, [fieldId]: e.target.value }))}
                                  rows={2}
                                />
                                <p className="text-xs text-muted-foreground">{field.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}

                    <div className="space-y-2">
                      <Label>其他補充說明（選填）</Label>
                      <Textarea
                        placeholder="例如：我想強調我的服務特色是...、最近有個成功案例想分享..."
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <Button 
                      onClick={handleGenerateMonetize}
                      disabled={generateMonetizeContent.isPending}
                      className="w-full"
                    >
                      {generateMonetizeContent.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mr-2" />
                          生成變現內容
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Tips Card */}
                <Card className="border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-emerald-700 mb-2">變現內容小技巧</p>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• <strong>首頁自介文</strong>建議置頂，讓新訪客第一眼認識你</li>
                          <li>• <strong>+1 互動文</strong>轉換率最高，適合定期使用</li>
                          <li>• 保持<strong>原生內容風格</strong>，不要像廣告</li>
                          <li>• 用<strong>故事</strong>展現價值，不要硬賣</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Draft Result with Chat */}
                {draftResult && (
                  <>
                    <DraftResultWithChat
                      draftResult={draftResult}
                      draftId={draftId}
                      chatMessages={chatMessages}
                      chatInput={chatInput}
                      isChatting={isChatting}
                      onChatInputChange={setChatInput}
                      onChatSubmit={handleChatSubmit}
                      onCopy={handleCopy}
                      onConfirmVersion={handleConfirmVersion}
                      chatEndRef={chatEndRef}
                      diagnosis={diagnosis}
                    />
                    
                    {/* IP 未完善提醒卡片 - 變現內容 */}
                    {missingIpItems.length > 0 && (
                      <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
                            <Zap className="w-5 h-5" />
                            提升變現效果的小建議
                          </CardTitle>
                          <CardDescription className="text-amber-700">
                            完善以下資料，讓變現內容更有說服力
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {missingIpItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white/60 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                                    <Info className="w-4 h-4 text-amber-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-sm text-amber-900">設定{item.name}</p>
                                    <p className="text-xs text-amber-700">完善後可提升 <span className="font-semibold text-emerald-600">{item.boost}</span></p>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                                  onClick={() => window.location.href = item.link}
                                >
                                  前往設定
                                  <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// 草稿結果 + 對話修改組件 (ChatGPT 風格)
interface DraftResultWithChatProps {
  draftResult: string;
  draftId: number | null;
  chatMessages: ChatMessage[];
  chatInput: string;
  isChatting: boolean;
  onChatInputChange: (value: string) => void;
  onChatSubmit: () => void;
  onCopy: (text: string) => void;
  onConfirmVersion: () => void; // 新增：確認此版本
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  diagnosis?: {
    strengths: Array<{ label: string; description: string }>;
    improvements: Array<{ label: string; description: string; action?: string }>;
    score: number;
  } | null;
}

function DraftResultWithChat({
  draftResult,
  draftId,
  chatMessages,
  chatInput,
  isChatting,
  onChatInputChange,
  onChatSubmit,
  onCopy,
  onConfirmVersion,
  chatEndRef,
  diagnosis,
}: DraftResultWithChatProps) {
  return (
    <Card className="elegant-card border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            AI 創作助手
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onCopy(draftResult)}
            >
              <Copy className="w-4 h-4 mr-2" />
              複製
            </Button>
            {draftId && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = `/drafts/${draftId}`}
              >
                <Save className="w-4 h-4 mr-2" />
                編輯草稿
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* ChatGPT 風格對話區域 */}
        <div className="flex flex-col">
          {/* 對話歷史區 - 自適應高度 */}
          <div className="px-4 py-4 space-y-4">
            {/* AI 初始回覆 - 生成的草稿 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">幕創 AI</div>
                
                {/* 診斷結果卡片 */}
                {diagnosis && (
                  <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20 mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-medium text-sm">生成診斷</span>
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
                                  onChatInputChange(`請幫我${imp.action}`);
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
                
                <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-4">
                  <div className="prose prose-sm max-w-none text-foreground">
                    <Streamdown>{draftResult}</Streamdown>
                  </div>
                </div>
              </div>
            </div>

            {/* 對話歷史 */}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className="flex gap-3">
                {msg.role === 'user' ? (
                  // 用戶訊息 - 靠右
                  <>
                    <div className="flex-1" />
                    <div className="max-w-[85%] space-y-2">
                      <div className="text-sm font-medium text-muted-foreground text-right">你</div>
                      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm p-4">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  // AI 回覆 - 靠左
                  <>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 max-w-[85%] space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">幕創 AI</div>
                      <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-4">
                        <div className="prose prose-sm max-w-none text-foreground">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
            
            {/* 載入中狀態 */}
            {isChatting && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">幕創 AI</div>
                  <div className="bg-muted/50 rounded-2xl rounded-tl-sm p-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      正在思考中...
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* 確認版本按鈕 - 在對話後顯示 */}
          {chatMessages.length > 0 && (
            <div className="border-t border-border/50 p-3 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>對這個版本滿意嗎？</span>
                </div>
                <Button 
                  onClick={onConfirmVersion}
                  className="bg-primary hover:bg-primary/90"
                  size="sm"
                >
                  <Save className="w-4 h-4 mr-2" />
                  確認此版本，存入草稿庫
                </Button>
              </div>
            </div>
          )}

          {/* 固定底部輸入框 */}
          <div className="border-t border-border/50 p-4 bg-background/80 backdrop-blur-sm">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <Textarea
                  placeholder="告訴 AI 你想怎麼修改，例如：幫我改得更真誠一點..."
                  value={chatInput}
                  onChange={(e) => onChatInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onChatSubmit();
                    }
                  }}
                  disabled={isChatting}
                  className="min-h-[44px] max-h-[120px] resize-none pr-12 rounded-xl"
                  rows={1}
                />
                <Button 
                  onClick={onChatSubmit}
                  disabled={isChatting || !chatInput.trim()}
                  size="icon"
                  className="absolute right-2 bottom-2 h-8 w-8 rounded-lg"
                >
                  {isChatting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              💡 試試看：「幫我改得更口語化」「加入更多個人故事」「這段太像廣告了」
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 經營階段提示組件
function GrowthStageHint({ stage }: { stage: string }) {
  const stageInfo: Record<string, {
    name: string;
    color: string;
    bgColor: string;
    recommendedTypes: string[];
    tips: string;
  }> = {
    startup: {
      name: '起步階段',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      recommendedTypes: ['故事型', '知識型', '閃聊型', '觀點型'],
      tips: '建立人設和信任感，先不要推銷'
    },
    growth: {
      name: '成長階段',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200',
      recommendedTypes: ['提問型', '投票型', '觀點型', '對話型'],
      tips: '增加互動，引導加入 LINE'
    },
    monetization: {
      name: '變現階段',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200',
      recommendedTypes: ['知識型', '故事型', '引流品推廣'],
      tips: '可以分享產品，保持 70% 情緒內容'
    },
    scaling: {
      name: '規模化階段',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      recommendedTypes: ['全部類型'],
      tips: '可以更積極推廣產品'
    }
  };

  const current = stageInfo[stage] || stageInfo.startup;

  return (
    <div className={`rounded-lg p-3 border ${current.bgColor}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${current.color}`}>
            🚀 {current.name}
          </span>
          <span className="text-sm text-muted-foreground">
            {current.tips}
          </span>
        </div>
        <div className="flex gap-1">
          {current.recommendedTypes.slice(0, 3).map((type, index) => (
            <span 
              key={index}
              className="text-xs px-2 py-0.5 rounded-full bg-white/70 border border-border/50"
            >
              {type}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
