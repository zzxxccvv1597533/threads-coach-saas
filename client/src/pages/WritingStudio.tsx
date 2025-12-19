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
  Target,
  Gift,
  Star,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// 導流內容類型定義
const monetizationContentTypes = [
  {
    id: "profile_intro",
    name: "首頁自介文",
    description: "讓新訪客認識你，適合置頂",
    icon: <User className="w-4 h-4" />,
    badge: "置頂推薦",
    badgeColor: "bg-amber-500",
  },
  {
    id: "service_intro",
    name: "服務介紹文",
    description: "說明你能幫什麼忙",
    icon: <ShoppingBag className="w-4 h-4" />,
    badge: null,
    badgeColor: "",
  },
  {
    id: "plus_one",
    name: "+1 互動文",
    description: "高轉換機制，留言後私訊",
    icon: <MessageSquare className="w-4 h-4" />,
    badge: "高轉換",
    badgeColor: "bg-emerald-500",
  },
  {
    id: "free_value",
    name: "免費價值文",
    description: "提供免費資源吸引關注",
    icon: <Gift className="w-4 h-4" />,
    badge: null,
    badgeColor: "",
  },
  {
    id: "success_story",
    name: "成功案例故事",
    description: "用故事展現價值",
    icon: <Star className="w-4 h-4" />,
    badge: null,
    badgeColor: "",
  },
  {
    id: "lead_magnet",
    name: "引流品推廣",
    description: "低門檻服務邀請",
    icon: <Target className="w-4 h-4" />,
    badge: null,
    badgeColor: "",
  },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function WritingStudio() {
  const { data: contentTypes } = trpc.knowledge.contentTypes.useQuery();
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
  
  const [brainstormResult, setBrainstormResult] = useState(() => getStoredState("brainstormResult", ""));
  const [anglesResult, setAnglesResult] = useState(() => getStoredState("anglesResult", ""));
  const [draftResult, setDraftResult] = useState(() => getStoredState("draftResult", ""));
  const [draftId, setDraftId] = useState<number | null>(() => getStoredState("draftId", null));

  // 對話修改功能
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => getStoredState("chatMessages", []));
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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
  }, [mode, material, selectedContentType, selectedMonetizeType, selectedAngle, step, brainstormResult, anglesResult, draftResult, draftId, chatMessages]);

  const brainstorm = trpc.ai.brainstorm.useMutation({
    onSuccess: (data) => {
      setBrainstormResult(typeof data.suggestions === 'string' ? data.suggestions : '');
      toast.success("靈感已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  const analyzeAngles = trpc.ai.analyzeAngles.useMutation({
    onSuccess: (data) => {
      setAnglesResult(typeof data.angles === 'string' ? data.angles : '');
      setStep(2);
      toast.success("切角分析完成！");
    },
    onError: () => {
      toast.error("分析失敗，請稍後再試");
    },
  });

  const generateDraft = trpc.ai.generateDraft.useMutation({
    onSuccess: (data) => {
      setDraftResult(typeof data.content === 'string' ? data.content : '');
      setDraftId(data.draftId || null);
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
    if (!material.trim()) {
      toast.error("請先輸入你的素材");
      return;
    }
    generateDraft.mutate({
      material,
      contentType: selectedContentType,
      angle: selectedAngle || undefined,
    });
  };

  const handleGenerateMonetize = () => {
    if (!hasCoreProduct) {
      toast.error("請先在 IP 地基設定你的核心產品");
      return;
    }
    generateMonetizeContent.mutate({
      contentType: selectedMonetizeType,
      additionalContext: material || undefined,
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
      chatHistory: chatMessages,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  const handleReset = () => {
    setMaterial("");
    setSelectedAngle("");
    setStep(1);
    setBrainstormResult("");
    setAnglesResult("");
    setDraftResult("");
    setDraftId(null);
    setChatMessages([]);
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
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "brainstorm"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              沒靈感
            </button>
            <button
              onClick={() => setMode("material")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "material"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap className="w-4 h-4" />
              有素材
            </button>
            <button
              onClick={() => setMode("monetize")}
              className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === "monetize"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              變現內容
              {hasCoreProduct && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" />
              )}
            </button>
          </div>

          {/* Brainstorm Mode */}
          {mode === "brainstorm" && (
          <div className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  腦力激盪
                </CardTitle>
                <CardDescription>
                  讓 AI 根據你的人設和受眾，給你今天可以發的主題建議
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>參考方向（選填）</Label>
                  <Textarea
                    placeholder="例如：最近想聊聊關於自我懷疑的話題..."
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleBrainstorm}
                  disabled={brainstorm.isPending}
                  className="w-full"
                >
                  {brainstorm.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      思考中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      給我靈感
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Brainstorm Result */}
            {brainstormResult && (
              <Card className="elegant-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>主題建議</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopy(brainstormResult)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      複製
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Streamdown>{brainstormResult}</Streamdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
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
            {step >= 2 && anglesResult && (
              <Card className="elegant-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                      2
                    </span>
                    選擇切角
                  </CardTitle>
                  <CardDescription>
                    AI 分析了三種不同的切角方向，選一個你喜歡的
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg">
                    <Streamdown>{anglesResult}</Streamdown>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>選擇內容類型</Label>
                    <RadioGroup
                      value={selectedContentType}
                      onValueChange={setSelectedContentType}
                      className="grid grid-cols-2 md:grid-cols-3 gap-2"
                    >
                      {contentTypes?.map((type: { id: string; name: string }) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={type.id} id={type.id} />
                          <Label htmlFor={type.id} className="text-sm cursor-pointer">
                            {type.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

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
                  chatEndRef={chatEndRef}
                />
                
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
                    <div className="grid gap-3 md:grid-cols-2">
                      {monetizationContentTypes.map((type) => (
                        <div
                          key={type.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedMonetizeType === type.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border/50 hover:border-primary/50'
                          }`}
                          onClick={() => setSelectedMonetizeType(type.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              selectedMonetizeType === type.id ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              {type.icon}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{type.name}</span>
                                {type.badge && (
                                  <Badge className={`text-xs ${type.badgeColor} text-white`}>
                                    {type.badge}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {type.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label>補充說明（選填）</Label>
                      <Textarea
                        placeholder="例如：我想強調我的服務特色是...、最近有個成功案例想分享..."
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        rows={3}
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
                      chatEndRef={chatEndRef}
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
  chatEndRef: React.RefObject<HTMLDivElement | null>;
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
  chatEndRef,
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
        <div className="flex flex-col h-[500px]">
          {/* 對話歷史區 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* AI 初始回覆 - 生成的草稿 */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">幕創 AI</div>
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
