import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { 
  Target, 
  Sparkles, 
  Heart, 
  Lightbulb,
  Users,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  Info,
  ShoppingBag,
  Star,
  Crown,
  Package,
  Edit2,
  BookOpen,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function IpProfile() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.ipProfile.get.useQuery();
  const { data: audiences, isLoading: audiencesLoading } = trpc.audience.list.useQuery();
  const { data: pillars } = trpc.contentPillar.list.useQuery();
  const { data: personaPillarsData } = trpc.knowledge.personaPillars.useQuery();
  const { data: userProducts, isLoading: productsLoading } = trpc.userProduct.list.useQuery();
  const { data: successStories, isLoading: storiesLoading } = trpc.successStory.list.useQuery();
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const upsertProfile = trpc.ipProfile.upsert.useMutation({
    onSuccess: () => {
      utils.ipProfile.get.invalidate();
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      toast.success("IP 地基已儲存");
    },
    onError: () => {
      toast.error("儲存失敗，請稍後再試");
    },
  });

  const createAudience = trpc.audience.create.useMutation({
    onSuccess: () => {
      utils.audience.list.invalidate();
      toast.success("受眾已新增");
    },
  });

  const deleteAudience = trpc.audience.delete.useMutation({
    onSuccess: () => {
      utils.audience.list.invalidate();
      toast.success("受眾已刪除");
    },
  });

  const createProduct = trpc.userProduct.create.useMutation({
    onSuccess: () => {
      utils.userProduct.list.invalidate();
      toast.success("產品已新增");
      setNewProduct({ productType: "core", name: "", description: "", priceRange: "", deliveryTime: "", uniqueValue: "" });
      setShowProductForm(false);
    },
  });

  const deleteProduct = trpc.userProduct.delete.useMutation({
    onSuccess: () => {
      utils.userProduct.list.invalidate();
      toast.success("產品已刪除");
    },
  });

  const createStory = trpc.successStory.create.useMutation({
    onSuccess: () => {
      utils.successStory.list.invalidate();
      toast.success("成功案例已新增");
      setNewStory({ title: "", clientBackground: "", challenge: "", transformation: "", outcome: "", testimonialQuote: "" });
      setShowStoryForm(false);
    },
  });

  const deleteStory = trpc.successStory.delete.useMutation({
    onSuccess: () => {
      utils.successStory.list.invalidate();
      toast.success("成功案例已刪除");
    },
  });

  const [formData, setFormData] = useState({
    occupation: "",
    voiceTone: "",
    viewpointStatement: "",
    goalPrimary: "monetize" as "monetize" | "influence" | "expression",
    personaExpertise: "",
    personaEmotion: "",
    personaViewpoint: "",
    // 英雄旅程四階段
    heroJourneyOrigin: "",
    heroJourneyProcess: "",
    heroJourneyHero: "",
    heroJourneyMission: "",
    // 身份標籤
    identityTags: [] as string[],
    // 九宮格內容矩陣
    contentMatrixAudiences: { core: "", potential: "", opportunity: "" },
    contentMatrixThemes: [] as string[],
  });

  const [newAudience, setNewAudience] = useState({
    segmentName: "",
    painPoint: "",
    desiredOutcome: "",
  });

  const [newProduct, setNewProduct] = useState({
    productType: "core" as "lead" | "core" | "vip" | "passive",
    name: "",
    description: "",
    priceRange: "",
    deliveryTime: "",
    uniqueValue: "",
  });

  const [newStory, setNewStory] = useState({
    title: "",
    clientBackground: "",
    challenge: "",
    transformation: "",
    outcome: "",
    testimonialQuote: "",
  });

  const [showProductForm, setShowProductForm] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [activeTab, setActiveTab] = useState<"basic" | "pillars" | "audience" | "products" | "story" | "matrix">("basic");
  const [newIdentityTag, setNewIdentityTag] = useState("");
  const [newTheme, setNewTheme] = useState("");
  const [painPointMatrix, setPainPointMatrix] = useState<Record<string, Record<string, string[]>>>({});
  const [isGeneratingPainPoints, setIsGeneratingPainPoints] = useState(false);

  // 從資料庫載入資料
  useEffect(() => {
    if (profile) {
      setFormData({
        occupation: profile.occupation || "",
        voiceTone: profile.voiceTone || "",
        viewpointStatement: profile.viewpointStatement || "",
        goalPrimary: profile.goalPrimary || "monetize",
        personaExpertise: profile.personaExpertise || "",
        personaEmotion: profile.personaEmotion || "",
        personaViewpoint: profile.personaViewpoint || "",
        // 英雄旅程
        heroJourneyOrigin: profile.heroJourneyOrigin || "",
        heroJourneyProcess: profile.heroJourneyProcess || "",
        heroJourneyHero: profile.heroJourneyHero || "",
        heroJourneyMission: profile.heroJourneyMission || "",
        // 身份標籤
        identityTags: (profile.identityTags as string[]) || [],
        // 九宮格內容矩陣
        contentMatrixAudiences: (profile.contentMatrixAudiences as { core: string; potential: string; opportunity: string }) || { core: "", potential: "", opportunity: "" },
        contentMatrixThemes: (profile.contentMatrixThemes as string[]) || [],
      });
      // 設定最後儲存時間
      if (profile.updatedAt) {
        setLastSavedAt(new Date(profile.updatedAt));
      }
    }
  }, [profile]);

  // 自動儲存功能：當 formData 變更時，3 秒後自動儲存
  // 使用 useRef 來追蹤初始狀態，避免無限迴圈
  const initialFormDataRef = useRef<typeof formData | null>(null);
  const isInitializedRef = useRef(false);

  // 當 profile 載入後，設定初始狀態
  useEffect(() => {
    if (!isLoading && !isInitializedRef.current) {
      // 如果 profile 存在，使用 profile 的值；否則使用預設值
      const initialData = profile ? {
        occupation: profile.occupation || "",
        voiceTone: profile.voiceTone || "",
        viewpointStatement: profile.viewpointStatement || "",
        goalPrimary: profile.goalPrimary || "monetize",
        personaExpertise: profile.personaExpertise || "",
        personaEmotion: profile.personaEmotion || "",
        personaViewpoint: profile.personaViewpoint || "",
        heroJourneyOrigin: profile.heroJourneyOrigin || "",
        heroJourneyProcess: profile.heroJourneyProcess || "",
        heroJourneyHero: profile.heroJourneyHero || "",
        heroJourneyMission: profile.heroJourneyMission || "",
        identityTags: (profile.identityTags as string[]) || [],
        contentMatrixAudiences: (profile.contentMatrixAudiences as { core: string; potential: string; opportunity: string }) || { core: "", potential: "", opportunity: "" },
        contentMatrixThemes: (profile.contentMatrixThemes as string[]) || [],
      } : {
        occupation: "",
        voiceTone: "",
        viewpointStatement: "",
        goalPrimary: "monetize" as const,
        personaExpertise: "",
        personaEmotion: "",
        personaViewpoint: "",
        heroJourneyOrigin: "",
        heroJourneyProcess: "",
        heroJourneyHero: "",
        heroJourneyMission: "",
        identityTags: [] as string[],
        contentMatrixAudiences: { core: "", potential: "", opportunity: "" },
        contentMatrixThemes: [] as string[],
      };
      initialFormDataRef.current = initialData;
      isInitializedRef.current = true;
    }
  }, [isLoading, profile]);

  useEffect(() => {
    // 如果資料還在載入中或尚未初始化，不要觸發自動儲存
    if (isLoading || !isInitializedRef.current || !initialFormDataRef.current) return;
    
    // 檢查是否有變更（比較當前 formData 與初始狀態）
    const initial = initialFormDataRef.current;
    const hasChanges = 
      formData.occupation !== initial.occupation ||
      formData.voiceTone !== initial.voiceTone ||
      formData.viewpointStatement !== initial.viewpointStatement ||
      formData.goalPrimary !== initial.goalPrimary ||
      formData.personaExpertise !== initial.personaExpertise ||
      formData.personaEmotion !== initial.personaEmotion ||
      formData.personaViewpoint !== initial.personaViewpoint ||
      formData.heroJourneyOrigin !== initial.heroJourneyOrigin ||
      formData.heroJourneyProcess !== initial.heroJourneyProcess ||
      formData.heroJourneyHero !== initial.heroJourneyHero ||
      formData.heroJourneyMission !== initial.heroJourneyMission ||
      JSON.stringify(formData.identityTags) !== JSON.stringify(initial.identityTags) ||
      JSON.stringify(formData.contentMatrixAudiences) !== JSON.stringify(initial.contentMatrixAudiences) ||
      JSON.stringify(formData.contentMatrixThemes) !== JSON.stringify(initial.contentMatrixThemes);
    
    setHasUnsavedChanges(hasChanges);
    
    if (hasChanges) {
      // 清除之前的定時器
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      
      // 設定 3 秒後自動儲存
      autoSaveTimeoutRef.current = setTimeout(() => {
        upsertProfile.mutate({
          ...formData,
          ipAnalysisComplete: calculateProgress() >= 80,
        });
        // 儲存成功後更新初始狀態
        initialFormDataRef.current = { ...formData };
      }, 3000);
    }
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [formData, isLoading]);

  // 離開頁面前提醒
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '你有未儲存的變更，確定要離開嗎？';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const calculateProgress = () => {
    let score = 0;
    if (formData.occupation) score += 10;
    if (formData.voiceTone) score += 10;
    if (formData.viewpointStatement) score += 10;
    if (formData.personaExpertise) score += 15;
    if (formData.personaEmotion) score += 10;
    if (formData.personaViewpoint) score += 15;
    // 核心品是必填，佔 20%
    const hasCoreProduct = userProducts?.some(p => p.productType === 'core');
    if (hasCoreProduct) score += 20;
    // 有受眾佔 10%
    if (audiences && audiences.length > 0) score += 10;
    return score;
  };

  const handleSave = () => {
    upsertProfile.mutate({
      ...formData,
      ipAnalysisComplete: calculateProgress() >= 80,
    }, {
      onSuccess: () => {
        // 儲存成功後更新初始狀態
        initialFormDataRef.current = { ...formData };
      }
    });
  };

  const handleAddAudience = () => {
    if (!newAudience.segmentName) {
      toast.error("請輸入受眾名稱");
      return;
    }
    createAudience.mutate(newAudience);
    setNewAudience({ segmentName: "", painPoint: "", desiredOutcome: "" });
  };

  const handleAddProduct = () => {
    if (!newProduct.name) {
      toast.error("請輸入產品名稱");
      return;
    }
    createProduct.mutate(newProduct);
  };

  const handleAddStory = () => {
    if (!newStory.title) {
      toast.error("請輸入案例標題");
      return;
    }
    createStory.mutate(newStory);
  };

  const progress = calculateProgress();
  const hasCoreProduct = userProducts?.some(p => p.productType === 'core');

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">IP 地基設定</h1>
            <p className="text-muted-foreground mt-1">
              建立你的人設三支柱與產品矩陣，讓 AI 更了解你的風格
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* 儲存狀態提示 */}
            <div className="text-sm text-muted-foreground">
              {upsertProfile.isPending ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  儲存中...
                </span>
              ) : hasUnsavedChanges ? (
                <span className="flex items-center gap-1 text-amber-600">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  未儲存的變更
                </span>
              ) : lastSavedAt ? (
                <span className="flex items-center gap-1 text-emerald-600">
                  <CheckCircle className="w-3 h-3" />
                  已自動儲存
                </span>
              ) : null}
            </div>
            <Button 
              onClick={handleSave} 
              disabled={upsertProfile.isPending || !hasUnsavedChanges}
              variant={hasUnsavedChanges ? "default" : "outline"}
            >
              <Save className="w-4 h-4 mr-2" />
              {upsertProfile.isPending ? "儲存中..." : "立即儲存"}
            </Button>
          </div>
        </div>
        
        {/* 自動儲存提示 */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Info className="w-4 h-4" />
            你的變更會在 3 秒後自動儲存，也可以點擊「立即儲存」按鈕手動儲存
          </p>
        </div>

        {/* Progress Card */}
        <Card className="elegant-card bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">IP 地基完成度</span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {!hasCoreProduct && (
              <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                請先設定你的核心產品/服務（必填）
              </p>
            )}
            {progress < 80 && hasCoreProduct && (
              <p className="text-xs text-muted-foreground mt-2">
                完成 80% 以上即可開始使用發文工作室
              </p>
            )}
            {progress >= 80 && (
              <div className="flex items-center gap-2 mt-2 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">已達到使用門檻！</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="bg-muted p-1 rounded-lg grid grid-cols-6 gap-1">
            <button
              onClick={() => setActiveTab("basic")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "basic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              基本資料
            </button>
            <button
              onClick={() => setActiveTab("pillars")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "pillars"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              人設三支柱
            </button>
            <button
              onClick={() => setActiveTab("audience")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "audience"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              目標受眾
            </button>
            <button
              onClick={() => setActiveTab("products")}
              className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "products"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              我的產品
              {!hasCoreProduct && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("story")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "story"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              我的故事
            </button>
            <button
              onClick={() => setActiveTab("matrix")}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === "matrix"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              內容矩陣
            </button>
          </div>

          {/* Basic Info Tab */}
          {activeTab === "basic" && (
          <div className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  基本資料
                </CardTitle>
                <CardDescription>
                  設定你的身份與經營目標
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="occupation">職業/身份</Label>
                    <Input
                      id="occupation"
                      placeholder="例如：塔羅師、療癒師、身心靈教練"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voiceTone">語氣風格</Label>
                    <Input
                      id="voiceTone"
                      placeholder="例如：溫柔、犀利、幽默、專業"
                      value={formData.voiceTone}
                      onChange={(e) => setFormData({ ...formData, voiceTone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="viewpoint">觀點宣言（一句話）</Label>
                  <Textarea
                    id="viewpoint"
                    placeholder="例如：我相信每個人都有改變的力量，只是需要找到對的方法"
                    value={formData.viewpointStatement}
                    onChange={(e) => setFormData({ ...formData, viewpointStatement: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-3">
                  <Label>主要經營目標</Label>
                  <RadioGroup
                    value={formData.goalPrimary}
                    onValueChange={(value) => setFormData({ ...formData, goalPrimary: value as any })}
                    className="grid gap-3"
                  >
                    {goals.map((goal) => (
                      <div key={goal.value} className="flex items-start space-x-3">
                        <RadioGroupItem value={goal.value} id={goal.value} className="mt-1" />
                        <Label htmlFor={goal.value} className="flex-1 cursor-pointer">
                          <div className="font-medium">{goal.label}</div>
                          <div className="text-sm text-muted-foreground">{goal.description}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Pillars Tab */}
          {activeTab === "pillars" && (
          <div className="space-y-6">
            {/* Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary mb-1">什麼是人設三支柱？</p>
                    <p className="text-muted-foreground">
                      人設三支柱是建立個人品牌的核心框架，包含專業權威、情感共鳴、獨特觀點三個面向。
                      完善這三個支柱，能讓你的內容更有辨識度，也讓 AI 更精準地產出符合你風格的內容。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expertise Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  專業權威
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.expertise.description || "你的專業能力與知識深度，讓受眾相信你有能力幫助他們"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的專業支柱</Label>
                  <Textarea
                    placeholder="描述你的專業經驗、成就、認證或獨特能力..."
                    value={formData.personaExpertise}
                    onChange={(e) => setFormData({ ...formData, personaExpertise: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.expertise.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Emotion Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500" />
                  情感共鳴
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.emotion.description || "你的故事與經歷，讓受眾感受到你理解他們的處境"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的情感支柱</Label>
                  <Textarea
                    placeholder="分享你的故事、經歷過的困境、如何走過來的..."
                    value={formData.personaEmotion}
                    onChange={(e) => setFormData({ ...formData, personaEmotion: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.emotion.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Viewpoint Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  獨特觀點
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.viewpoint.description || "你對事物的獨特看法，讓受眾記住你、認同你"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的觀點支柱</Label>
                  <Textarea
                    placeholder="描述你的獨特觀點、核心價值觀、你相信什麼..."
                    value={formData.personaViewpoint}
                    onChange={(e) => setFormData({ ...formData, personaViewpoint: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.viewpoint.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Audience Tab */}
          {activeTab === "audience" && (
          <div className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  目標受眾
                </CardTitle>
                <CardDescription>
                  定義你想幫助的人，越具體越好
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Existing Audiences */}
                {audiencesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : audiences && audiences.length > 0 ? (
                  <div className="space-y-3">
                    {audiences.map((audience) => (
                      <div 
                        key={audience.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{audience.segmentName}</p>
                            {audience.painPoint && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">痛點：</span>{audience.painPoint}
                              </p>
                            )}
                            {audience.desiredOutcome && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">渴望：</span>{audience.desiredOutcome}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAudience.mutate({ id: audience.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    尚未設定目標受眾
                  </div>
                )}

                {/* Add New Audience */}
                <div className="border-t border-border/50 pt-6">
                  <p className="font-medium mb-4">新增受眾</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>受眾名稱</Label>
                      <Input
                        placeholder="例如：新手命理師、高壓上班族"
                        value={newAudience.segmentName}
                        onChange={(e) => setNewAudience({ ...newAudience, segmentName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>他在煩什麼（痛點）</Label>
                      <Textarea
                        placeholder="越具體越好，例如：不知道怎麼開始經營社群、覺得自己的內容沒人看..."
                        value={newAudience.painPoint}
                        onChange={(e) => setNewAudience({ ...newAudience, painPoint: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>他想要的美好結果（渴望）</Label>
                      <Textarea
                        placeholder="例如：能夠穩定產出內容、有人主動來詢問服務..."
                        value={newAudience.desiredOutcome}
                        onChange={(e) => setNewAudience({ ...newAudience, desiredOutcome: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <Button 
                      onClick={handleAddAudience}
                      disabled={createAudience.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      新增受眾
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Products Tab */}
          {activeTab === "products" && (
          <div className="space-y-6">
            {/* Info Card */}
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <ShoppingBag className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-700 mb-1">為什麼要設定產品矩陣？</p>
                    <p className="text-muted-foreground">
                      設定你的產品/服務後，AI 可以幫你生成變現用的內容，包括首頁自介、服務介紹、成功案例故事等。
                      <strong className="text-amber-700">核心品是必填項目</strong>，這是你的主要收入來源。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Matrix */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  產品矩陣
                </CardTitle>
                <CardDescription>
                  設定你的服務與產品，讓 AI 幫你生成變現內容
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Product Type Guide */}
                <div className="grid gap-3 md:grid-cols-2">
                  {productTypes.map((type) => (
                    <div 
                      key={type.value}
                      className={`p-3 rounded-lg border ${
                        type.value === 'core' 
                          ? 'border-amber-500/50 bg-amber-500/5' 
                          : 'border-border/50 bg-muted/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {type.icon}
                        <span className="font-medium text-sm">{type.label}</span>
                        {type.value === 'core' && (
                          <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">必填</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                      <p className="text-xs text-primary mt-1">{type.priceHint}</p>
                    </div>
                  ))}
                </div>

                {/* Existing Products */}
                {productsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : userProducts && userProducts.length > 0 ? (
                  <div className="space-y-3">
                    {userProducts.map((product) => {
                      const typeInfo = productTypes.find(t => t.value === product.productType);
                      return (
                        <div 
                          key={product.id}
                          className={`p-4 rounded-lg border ${
                            product.productType === 'core'
                              ? 'border-amber-500/50 bg-amber-500/5'
                              : 'border-border/50 bg-muted/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {typeInfo?.icon}
                                <p className="font-medium">{product.name}</p>
                                <Badge variant="outline" className="text-xs">
                                  {typeInfo?.label}
                                </Badge>
                              </div>
                              {product.description && (
                                <p className="text-sm text-muted-foreground">{product.description}</p>
                              )}
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                {product.priceRange && <span>💰 {product.priceRange}</span>}
                                {product.deliveryTime && <span>⏱️ {product.deliveryTime}</span>}
                              </div>
                              {product.uniqueValue && (
                                <p className="text-xs text-primary">✨ {product.uniqueValue}</p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteProduct.mutate({ id: product.id })}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    尚未設定產品，請先新增你的核心產品
                  </div>
                )}

                {/* Add Product Button/Form */}
                {!showProductForm ? (
                  <Button onClick={() => setShowProductForm(true)} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    新增產品/服務
                  </Button>
                ) : (
                  <div className="border-t border-border/50 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">新增產品/服務</p>
                      <Button variant="ghost" size="sm" onClick={() => setShowProductForm(false)}>
                        取消
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>產品類型</Label>
                      <RadioGroup
                        value={newProduct.productType}
                        onValueChange={(value) => setNewProduct({ ...newProduct, productType: value as any })}
                        className="grid grid-cols-2 gap-2"
                      >
                        {productTypes.map((type) => (
                          <div key={type.value} className="flex items-center space-x-2">
                            <RadioGroupItem value={type.value} id={`type-${type.value}`} />
                            <Label htmlFor={`type-${type.value}`} className="flex items-center gap-1 cursor-pointer text-sm">
                              {type.icon}
                              {type.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label>產品/服務名稱 *</Label>
                      <Input
                        placeholder="例如：完整命盤解讀、15分鐘快速塔羅"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>服務說明</Label>
                      <Textarea
                        placeholder="簡單描述這個服務能幫客戶什麼..."
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>價格區間</Label>
                        <Input
                          placeholder="例如：3000-5000元"
                          value={newProduct.priceRange}
                          onChange={(e) => setNewProduct({ ...newProduct, priceRange: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>服務時長</Label>
                        <Input
                          placeholder="例如：60分鐘、1週內交付"
                          value={newProduct.deliveryTime}
                          onChange={(e) => setNewProduct({ ...newProduct, deliveryTime: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>你的獨特價值（差異化）</Label>
                      <Textarea
                        placeholder="你跟同業的差異是什麼？例如：我是命理界的閨蜜，用聊天的方式解讀..."
                        value={newProduct.uniqueValue}
                        onChange={(e) => setNewProduct({ ...newProduct, uniqueValue: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <Button onClick={handleAddProduct} disabled={createProduct.isPending}>
                      <Plus className="w-4 h-4 mr-2" />
                      新增產品
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Success Stories */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-500" />
                  成功案例故事
                </CardTitle>
                <CardDescription>
                  用故事化的方式呈現客戶轉變，避免直接講療效
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Story Guide */}
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
                  <p className="text-sm text-emerald-700 font-medium mb-2">故事化案例小技巧：</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• 描述客戶「之前」的狀態（不要用療效詞彙）</li>
                    <li>• 說明他們經歷了什麼轉變過程</li>
                    <li>• 分享「之後」的正面改變（用客戶自己的話）</li>
                    <li>• 避免：「治好了」「痊癒了」等醫療用語</li>
                  </ul>
                </div>

                {/* Existing Stories */}
                {storiesLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : successStories && successStories.length > 0 ? (
                  <div className="space-y-3">
                    {successStories.map((story) => (
                      <div 
                        key={story.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <p className="font-medium">{story.title}</p>
                            {story.clientBackground && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">背景：</span>{story.clientBackground}
                              </p>
                            )}
                            {story.transformation && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">轉變：</span>{story.transformation}
                              </p>
                            )}
                            {story.testimonialQuote && (
                              <p className="text-sm italic text-primary">
                                「{story.testimonialQuote}」
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteStory.mutate({ id: story.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    尚未新增成功案例
                  </div>
                )}

                {/* Add Story Button/Form */}
                {!showStoryForm ? (
                  <Button onClick={() => setShowStoryForm(true)} variant="outline" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    新增成功案例
                  </Button>
                ) : (
                  <div className="border-t border-border/50 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">新增成功案例</p>
                      <Button variant="ghost" size="sm" onClick={() => setShowStoryForm(false)}>
                        取消
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>案例標題 *</Label>
                      <Input
                        placeholder="例如：從迷茫到找到方向的小美"
                        value={newStory.title}
                        onChange={(e) => setNewStory({ ...newStory, title: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>客戶背景（匿名）</Label>
                      <Textarea
                        placeholder="例如：30歲上班族，對工作感到迷茫..."
                        value={newStory.clientBackground}
                        onChange={(e) => setNewStory({ ...newStory, clientBackground: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>面臨的挑戰</Label>
                      <Textarea
                        placeholder="他當時遇到什麼困難？"
                        value={newStory.challenge}
                        onChange={(e) => setNewStory({ ...newStory, challenge: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>轉變過程</Label>
                      <Textarea
                        placeholder="經過你的服務後，他經歷了什麼轉變？"
                        value={newStory.transformation}
                        onChange={(e) => setNewStory({ ...newStory, transformation: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>成果（避免療效承諾）</Label>
                      <Textarea
                        placeholder="現在的狀態是什麼？用正面描述..."
                        value={newStory.outcome}
                        onChange={(e) => setNewStory({ ...newStory, outcome: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>客戶見證語錄</Label>
                      <Textarea
                        placeholder="客戶自己說的話（可匿名）"
                        value={newStory.testimonialQuote}
                        onChange={(e) => setNewStory({ ...newStory, testimonialQuote: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <Button onClick={handleAddStory} disabled={createStory.isPending}>
                      <Plus className="w-4 h-4 mr-2" />
                      新增案例
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          {/* Story Tab - 英雄旅程 */}
          {activeTab === "story" && (
          <div className="space-y-6">
            {/* 英雄旅程說明 */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">英雄旅程：你的品牌故事</h3>
                    <p className="text-sm text-muted-foreground">
                      透過四個階段說出你的故事，讓受眾認識你、信任你、記住你。
                      這些素材會自動注入到 AI 生成的內容中。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 英雄旅程四階段 */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  英雄旅程四階段
                </CardTitle>
                <CardDescription>
                  從「緣起」到「使命」，完整說出你的品牌故事
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 緣起 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 font-bold text-sm">1</div>
                    <Label className="text-base font-semibold">緣起：你為什麼開始做這件事？</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10 mb-2">
                    你的起點是什麼？是什麼事件或經歷讓你走上這條路？
                  </p>
                  <Textarea
                    placeholder="例如：我曾經是一個在職場中迷失的人，每天都在懷疑自己的價值..."
                    value={formData.heroJourneyOrigin}
                    onChange={(e) => setFormData({ ...formData, heroJourneyOrigin: e.target.value })}
                    rows={3}
                    className="ml-10"
                  />
                </div>

                {/* 過程 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold text-sm">2</div>
                    <Label className="text-base font-semibold">過程：你經歷了什麼挑戰？</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10 mb-2">
                    你遇到了什麼困難？嘗試過什麼方法？有什麼失敗經驗？
                  </p>
                  <Textarea
                    placeholder="例如：我嘗試過很多方法，讀了無數本書，上過很多課程，但總是覺得少了什麼..."
                    value={formData.heroJourneyProcess}
                    onChange={(e) => setFormData({ ...formData, heroJourneyProcess: e.target.value })}
                    rows={3}
                    className="ml-10"
                  />
                </div>

                {/* 英雄登場 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-sm">3</div>
                    <Label className="text-base font-semibold">英雄登場：轉折點是什麼？</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10 mb-2">
                    是什麼讓你找到答案？是什麼人、事、物改變了你？
                  </p>
                  <Textarea
                    placeholder="例如：直到我遇到了一位老師，他讓我看到了不同的可能性..."
                    value={formData.heroJourneyHero}
                    onChange={(e) => setFormData({ ...formData, heroJourneyHero: e.target.value })}
                    rows={3}
                    className="ml-10"
                  />
                </div>

                {/* 結局與使命 */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 font-bold text-sm">4</div>
                    <Label className="text-base font-semibold">結局與使命：你現在的使命是什麼？</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-10 mb-2">
                    你現在想幫助什麼樣的人？你的使命是什麼？
                  </p>
                  <Textarea
                    placeholder="例如：現在我想幫助那些和我一樣曾經迷失的人，讓他們知道..."
                    value={formData.heroJourneyMission}
                    onChange={(e) => setFormData({ ...formData, heroJourneyMission: e.target.value })}
                    rows={3}
                    className="ml-10"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 身份標籤 */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  身份標籤
                </CardTitle>
                <CardDescription>
                  選擇與你目標客群相關的身份標籤，讓受眾更容易產生共鳴
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 常見標籤選項 */}
                <div className="space-y-2">
                  <Label>常見標籤（點擊新增）</Label>
                  <div className="flex flex-wrap gap-2">
                    {["媽媽", "創業者", "高敏人", "ADHD", "內向者", "斜槓族", "自由工作者", "全職媽媽", "職場女性", "單親"].map((tag) => (
                      <Badge
                        key={tag}
                        variant={formData.identityTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer hover:bg-primary/10"
                        onClick={() => {
                          if (formData.identityTags.includes(tag)) {
                            setFormData({ ...formData, identityTags: formData.identityTags.filter(t => t !== tag) });
                          } else {
                            setFormData({ ...formData, identityTags: [...formData.identityTags, tag] });
                          }
                        }}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* 自訂標籤 */}
                <div className="space-y-2">
                  <Label>自訂標籤</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="輸入自訂標籤"
                      value={newIdentityTag}
                      onChange={(e) => setNewIdentityTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newIdentityTag.trim()) {
                          setFormData({ ...formData, identityTags: [...formData.identityTags, newIdentityTag.trim()] });
                          setNewIdentityTag("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (newIdentityTag.trim()) {
                          setFormData({ ...formData, identityTags: [...formData.identityTags, newIdentityTag.trim()] });
                          setNewIdentityTag("");
                        }
                      }}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* 已選標籤 */}
                {formData.identityTags.length > 0 && (
                  <div className="space-y-2">
                    <Label>已選標籤</Label>
                    <div className="flex flex-wrap gap-2">
                      {formData.identityTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            onClick={() => setFormData({ ...formData, identityTags: formData.identityTags.filter(t => t !== tag) })}
                            className="ml-1 hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          )}

          {/* Matrix Tab - 九宮格內容矩陣 */}
          {activeTab === "matrix" && (
          <div className="space-y-6">
            {/* 九宮格說明 */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">九宮格內容矩陣</h3>
                    <p className="text-sm text-muted-foreground">
                      三層受眾 × 三大主題 = 九個內容方向，解決「不知道寫什麼」的問題。
                      設定完成後，發文工作室會自動提供這九個方向的選題建議。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 三層受眾 */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  三層受眾
                </CardTitle>
                <CardDescription>
                  從「目標受眾」頁籤中選擇你的三層目標受眾，或手動輸入
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 如果有已設定的受眾，顯示快速選擇按鈕 */}
                {audiences && audiences.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <p className="text-sm font-medium mb-2">快速選擇已設定的受眾：</p>
                    <div className="flex flex-wrap gap-2">
                      {audiences.map((audience) => (
                        <Button
                          key={audience.id}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => {
                            // 智能填入：如果核心受眾空白就填核心，否則填潛在，最後填機會
                            const audienceText = `${audience.segmentName}${audience.painPoint ? `（痛點：${audience.painPoint}）` : ''}`;
                            if (!formData.contentMatrixAudiences.core) {
                              setFormData({ 
                                ...formData, 
                                contentMatrixAudiences: { ...formData.contentMatrixAudiences, core: audienceText } 
                              });
                            } else if (!formData.contentMatrixAudiences.potential) {
                              setFormData({ 
                                ...formData, 
                                contentMatrixAudiences: { ...formData.contentMatrixAudiences, potential: audienceText } 
                              });
                            } else if (!formData.contentMatrixAudiences.opportunity) {
                              setFormData({ 
                                ...formData, 
                                contentMatrixAudiences: { ...formData.contentMatrixAudiences, opportunity: audienceText } 
                              });
                            } else {
                              toast.info("三層受眾已填滿，請先清除某一層再選擇");
                            }
                          }}
                        >
                          {audience.segmentName}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    核心受眾（最想幫助的人）
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如：想轉型的職場媽媽"
                      value={formData.contentMatrixAudiences.core}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        contentMatrixAudiences: { ...formData.contentMatrixAudiences, core: e.target.value } 
                      })}
                    />
                    {formData.contentMatrixAudiences.core && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ 
                          ...formData, 
                          contentMatrixAudiences: { ...formData.contentMatrixAudiences, core: '' } 
                        })}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    潛在受眾（可能有興趣的人）
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如：對身心靈有興趣的職場人士"
                      value={formData.contentMatrixAudiences.potential}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        contentMatrixAudiences: { ...formData.contentMatrixAudiences, potential: e.target.value } 
                      })}
                    />
                    {formData.contentMatrixAudiences.potential && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ 
                          ...formData, 
                          contentMatrixAudiences: { ...formData.contentMatrixAudiences, potential: '' } 
                        })}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    機會受眾（擴大觸及的人）
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="例如：想提升生活品質的一般大眾"
                      value={formData.contentMatrixAudiences.opportunity}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        contentMatrixAudiences: { ...formData.contentMatrixAudiences, opportunity: e.target.value } 
                      })}
                    />
                    {formData.contentMatrixAudiences.opportunity && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setFormData({ 
                          ...formData, 
                          contentMatrixAudiences: { ...formData.contentMatrixAudiences, opportunity: '' } 
                        })}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                </div>
                
                {audiences && audiences.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    💡 提示：先到「目標受眾」頁籤新增受眾，就可以快速選擇了
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 三大主題 */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  三大主題
                </CardTitle>
                <CardDescription>
                  定義你的三個內容主題，建議包含：專業知識、個人故事、生活分享
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="輸入主題，例如：塔羅知識、個案故事、日常生活"
                    value={newTheme}
                    onChange={(e) => setNewTheme(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTheme.trim() && formData.contentMatrixThemes.length < 3) {
                        setFormData({ ...formData, contentMatrixThemes: [...formData.contentMatrixThemes, newTheme.trim()] });
                        setNewTheme("");
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={formData.contentMatrixThemes.length >= 3}
                    onClick={() => {
                      if (newTheme.trim() && formData.contentMatrixThemes.length < 3) {
                        setFormData({ ...formData, contentMatrixThemes: [...formData.contentMatrixThemes, newTheme.trim()] });
                        setNewTheme("");
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {formData.contentMatrixThemes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.contentMatrixThemes.map((theme, index) => (
                      <Badge key={index} variant="secondary" className="gap-1 text-base py-1 px-3">
                        {theme}
                        <button
                          onClick={() => setFormData({ ...formData, contentMatrixThemes: formData.contentMatrixThemes.filter((_, i) => i !== index) })}
                          className="ml-1 hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}

                {formData.contentMatrixThemes.length < 3 && (
                  <p className="text-sm text-muted-foreground">
                    還可以新增 {3 - formData.contentMatrixThemes.length} 個主題
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 痛點矩陣 */}
            {formData.contentMatrixAudiences.core && formData.contentMatrixThemes.length > 0 && (
            <Card className="elegant-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      痛點矩陣
                    </CardTitle>
                    <CardDescription>
                      每個格子都是具體的發文選題，點擊「生成痛點」讓 AI 幫你分析
                    </CardDescription>
                  </div>
                  <Button
                    onClick={async () => {
                      setIsGeneratingPainPoints(true);
                      try {
                        const audiences = [
                          formData.contentMatrixAudiences.core,
                          formData.contentMatrixAudiences.potential,
                          formData.contentMatrixAudiences.opportunity,
                        ].filter(Boolean);
                        
                        const result = await utils.client.ipProfile.generatePainPointMatrix.mutate({
                          audiences,
                          themes: formData.contentMatrixThemes,
                          occupation: formData.occupation,
                          voiceTone: formData.voiceTone,
                          viewpoint: formData.viewpointStatement,
                          identityTags: formData.identityTags,
                          contentPillars: {
                            authority: formData.personaExpertise,
                            emotion: formData.personaEmotion,
                            uniqueness: formData.personaViewpoint,
                          },
                          heroJourney: {
                            origin: formData.heroJourneyOrigin,
                            process: formData.heroJourneyProcess,
                            hero: formData.heroJourneyHero,
                            mission: formData.heroJourneyMission,
                          },
                          products: userProducts?.map(p => ({
                            name: p.name,
                            type: p.productType,
                            description: p.description || undefined,
                          })),
                        });
                        
                        setPainPointMatrix(result.matrix);
                        toast.success("痛點矩陣已生成");
                      } catch (error) {
                        toast.error("生成失敗，請稍後再試");
                      } finally {
                        setIsGeneratingPainPoints(false);
                      }
                    }}
                    disabled={isGeneratingPainPoints}
                    className="gap-2"
                  >
                    {isGeneratingPainPoints ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        生成痛點
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse table-fixed">
                    <thead>
                      <tr>
                        <th className="p-3 border border-border bg-muted/50 text-left w-[140px]">
                          <span className="text-xs text-muted-foreground">受眾 ↓</span>
                        </th>
                        {formData.contentMatrixThemes.map((theme, i) => (
                          <th key={i} className="p-3 border border-border bg-muted/50 text-sm font-medium">
                            {theme}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* 核心受眾 */}
                      <tr>
                        <td className="p-3 border border-border bg-emerald-500/10 text-sm font-medium w-[140px] align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                            <span className="text-xs leading-tight">{(formData.contentMatrixAudiences.core || "核心受眾").split(/[\uff08\(]/)[0].trim()}</span>
                          </div>
                        </td>
                        {formData.contentMatrixThemes.map((theme, i) => {
                          // 提取乾淨的受眾名稱（去除括號內的痛點描述）
                          const cleanAudienceName = (formData.contentMatrixAudiences.core || '').split(/[\uff08\(]/)[0].trim();
                          const painPoints = painPointMatrix[cleanAudienceName]?.[theme] || painPointMatrix[formData.contentMatrixAudiences.core]?.[theme] || [];
                          return (
                            <td key={i} className="p-3 border border-border text-sm align-top">
                              {painPoints.length > 0 ? (
                                <ul className="space-y-1">
                                  {painPoints.map((point: string, j: number) => (
                                    <li 
                                      key={j} 
                                      className="text-muted-foreground hover:text-primary cursor-pointer transition-colors hover:underline group"
                                      onClick={() => {
                                        // 將痛點帶入發文工作室，包含完整資訊
                                        const material = `受眾：${formData.contentMatrixAudiences.core}\n主題：${theme}\n選題：${point}\n\n請根據這個選題寫一篇貼文`;
                                        setLocation(`/writing-studio?material=${encodeURIComponent(material)}&mode=material`);
                                        toast.success(`已帶入選題：${point.slice(0, 20)}...`);
                                      }}
                                    >
                                      <span className="group-hover:underline">「{point}」</span>
                                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 ml-1">→ 寫文</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">
                                  點擊「生成痛點」按鈕
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      {/* 潛在受眾 */}
                      {formData.contentMatrixAudiences.potential && (
                      <tr>
                        <td className="p-3 border border-border bg-blue-500/10 text-sm font-medium w-[140px] align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                            <span className="text-xs leading-tight">{formData.contentMatrixAudiences.potential.split(/[\uff08\(]/)[0].trim()}</span>
                          </div>
                        </td>
                        {formData.contentMatrixThemes.map((theme, i) => {
                          const cleanAudienceName = formData.contentMatrixAudiences.potential.split(/[\uff08\(]/)[0].trim();
                          const painPoints = painPointMatrix[cleanAudienceName]?.[theme] || painPointMatrix[formData.contentMatrixAudiences.potential]?.[theme] || [];
                          return (
                            <td key={i} className="p-3 border border-border text-sm align-top">
                              {painPoints.length > 0 ? (
                                <ul className="space-y-1">
                                  {painPoints.map((point: string, j: number) => (
                                    <li 
                                      key={j} 
                                      className="text-muted-foreground hover:text-primary cursor-pointer transition-colors hover:underline group"
                                      onClick={() => {
                                        const material = `受眾：${formData.contentMatrixAudiences.potential}\n主題：${theme}\n選題：${point}\n\n請根據這個選題寫一篇貼文`;
                                        setLocation(`/writing-studio?material=${encodeURIComponent(material)}&mode=material`);
                                        toast.success(`已帶入選題：${point.slice(0, 20)}...`);
                                      }}
                                    >
                                      <span className="group-hover:underline">「{point}」</span>
                                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 ml-1">→ 寫文</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">
                                  點擊「生成痛點」按鈕
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      )}
                      {/* 機會受眾 */}
                      {formData.contentMatrixAudiences.opportunity && (
                      <tr>
                        <td className="p-3 border border-border bg-amber-500/10 text-sm font-medium w-[140px] align-top">
                          <div className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1" />
                            <span className="text-xs leading-tight">{formData.contentMatrixAudiences.opportunity.split(/[\uff08\(]/)[0].trim()}</span>
                          </div>
                        </td>
                        {formData.contentMatrixThemes.map((theme, i) => {
                          const cleanAudienceName = formData.contentMatrixAudiences.opportunity.split(/[\uff08\(]/)[0].trim();
                          const painPoints = painPointMatrix[cleanAudienceName]?.[theme] || painPointMatrix[formData.contentMatrixAudiences.opportunity]?.[theme] || [];
                          return (
                            <td key={i} className="p-3 border border-border text-sm align-top">
                              {painPoints.length > 0 ? (
                                <ul className="space-y-1">
                                  {painPoints.map((point: string, j: number) => (
                                    <li 
                                      key={j} 
                                      className="text-muted-foreground hover:text-primary cursor-pointer transition-colors hover:underline group"
                                      onClick={() => {
                                        const material = `受眾：${formData.contentMatrixAudiences.opportunity}\n主題：${theme}\n選題：${point}\n\n請根據這個選題寫一篇貼文`;
                                        setLocation(`/writing-studio?material=${encodeURIComponent(material)}&mode=material`);
                                        toast.success(`已帶入選題：${point.slice(0, 20)}...`);
                                      }}
                                    >
                                      <span className="group-hover:underline">「{point}」</span>
                                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 ml-1">→ 寫文</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted-foreground/50 text-xs">
                                  點擊「生成痛點」按鈕
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {Object.keys(painPointMatrix).length > 0 && (
                  <p className="text-sm text-muted-foreground mt-4">
💡 提示：這些是「受眾會說的話」，點擊任一句可以直接帶入發文工作室作為開頭 Hook
                  </p>
                )}
              </CardContent>
            </Card>
            )}
          </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

const goals = [
  {
    value: "monetize",
    label: "商業變現",
    description: "主要目標是獲得詢問、預約、銷售轉換",
  },
  {
    value: "influence",
    label: "擴大影響力",
    description: "主要目標是增加追蹤者、提升曝光與觸及",
  },
  {
    value: "expression",
    label: "自我表達",
    description: "主要目標是建立品牌故事、分享觀點與價值觀",
  },
];

const productTypes = [
  {
    value: "lead",
    label: "引流品",
    description: "低門檻服務，讓客戶先體驗",
    priceHint: "建議 800-1500 元",
    icon: <Star className="w-4 h-4 text-blue-500" />,
  },
  {
    value: "core",
    label: "核心品",
    description: "主要收入來源，你的招牌服務",
    priceHint: "建議 3000-8000 元",
    icon: <ShoppingBag className="w-4 h-4 text-amber-500" />,
  },
  {
    value: "vip",
    label: "高端 VIP",
    description: "高客單價服務，深度陪伴",
    priceHint: "建議 1 萬元以上",
    icon: <Crown className="w-4 h-4 text-purple-500" />,
  },
  {
    value: "passive",
    label: "被動產品",
    description: "數位產品、周邊商品",
    priceHint: "線上課程、開運小物等",
    icon: <Package className="w-4 h-4 text-emerald-500" />,
  },
];
