import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { useState, useEffect } from "react";
import { 
  ArrowLeft,
  Copy,
  Save,
  Trash2,
  Clock,
  CheckCircle,
  Archive,
  Send,
  Sparkles,
  List,
  RefreshCw,
  TrendingUp,
  Wand2,
  Check,
  X,
  AlertCircle,
  Heart,
  User,
  Layout,
  Target,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// 健檢結果類型定義（新版：移除 tagging，新增 fourLens）
interface HealthCheckResult {
  hook: {
    hasContrastOpener: boolean;
    hasObservationQuestion: boolean;
    hasSuspense: boolean;
    openerType: string;
    openerContent: string;
    deductionReason: string;
    advice: string;
  };
  translation: {
    hasJargon: boolean;
    hasBrilliantMetaphor: boolean;
    hasSimpleExplanation: boolean;
    metaphorExample: string;
    jargonList: string[];
    deductionReason: string;
    advice: string;
  };
  tone: {
    hasInterjections: boolean;
    hasBreathingSpace: boolean;
    isHumanLike: boolean;
    detectedInterjections: string[];
    deductionReason: string;
    advice: string;
  };
  cta: {
    ctaType: string;
    hasTargetAudienceCall: boolean;
    ctaContent: string;
    deductionReason: string;
    advice: string;
  };
  fourLens: {
    emotion: {
      isDesireOriented: boolean;
      emotionType: string;
      deductionReason: string;
      advice: string;
    };
    persona: {
      isConsistent: boolean;
      hasPersonalTouch: boolean;
      deductionReason: string;
      advice: string;
    };
    structure: {
      isEasyToAbsorb: boolean;
      hasLogicalFlow: boolean;
      deductionReason: string;
      advice: string;
    };
    conversion: {
      hasNextStep: boolean;
      isActionable: boolean;
      deductionReason: string;
      advice: string;
    };
  };
  scores: {
    hook: number;
    translation: number;
    tone: number;
    cta: number;
    fourLens: number;
  };
  fourLensScores: {
    emotion: number;
    persona: number;
    structure: number;
    conversion: number;
  };
  maxScores: {
    hook: number;
    translation: number;
    tone: number;
    cta: number;
    fourLens: number;
  };
  fourLensMaxScores: {
    emotion: number;
    persona: number;
    structure: number;
    conversion: number;
  };
  totalScore: number;
  overallAdvice: string;
  redlineMarks?: Array<{
    original: string;
    suggestion: string;
    reason: string;
    category: string;
  }>;
}

// 檢查項目組件
const CheckItem = ({ label, passed, detail }: { label: string; passed: boolean; detail?: string }) => (
  <div className="flex items-start gap-2 text-sm">
    {passed ? (
      <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
    ) : (
      <X className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
    )}
    <div>
      <span className={passed ? 'text-emerald-700' : 'text-red-600'}>{label}</span>
      {detail && <span className="text-muted-foreground ml-1">：{detail}</span>}
    </div>
  </div>
);

// 維度評分卡片組件
const DimensionCard = ({ 
  title, 
  score, 
  maxScore, 
  icon, 
  children,
  advice,
  deductionReason,
}: { 
  title: string; 
  score: number; 
  maxScore: number; 
  icon: React.ReactNode;
  children: React.ReactNode;
  advice?: string;
  deductionReason?: string;
}) => {
  const percentage = (score / maxScore) * 100;
  const getScoreColor = () => {
    if (percentage >= 80) return 'text-emerald-600';
    if (percentage >= 50) return 'text-amber-600';
    return 'text-red-500';
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <span className={`font-bold ${getScoreColor()}`}>
          {score}/{maxScore}
        </span>
      </div>
      
      {/* 進度條 */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all ${
            percentage >= 80 ? 'bg-emerald-500' : 
            percentage >= 50 ? 'bg-amber-500' : 'bg-red-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* 檢查項目 */}
      <div className="space-y-1.5">
        {children}
      </div>

      {/* 扣分原因 */}
      {deductionReason && score < maxScore && (
        <div className="bg-red-50 border border-red-100 rounded p-2 text-sm text-red-700">
          <strong>扣分原因：</strong>{deductionReason}
        </div>
      )}

      {/* 改進建議 */}
      {advice && score < maxScore && (
        <div className="bg-amber-50 border border-amber-100 rounded p-2 text-sm text-amber-800">
          <strong>改進建議：</strong>{advice}
        </div>
      )}
    </div>
  );
};

// 四透鏡子維度卡片
const FourLensSubCard = ({
  title,
  score,
  maxScore,
  icon,
  iconBg,
  children,
  advice,
  deductionReason,
}: {
  title: string;
  score: number;
  maxScore: number;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  advice?: string;
  deductionReason?: string;
}) => {
  const percentage = (score / maxScore) * 100;
  
  return (
    <div className="p-3 rounded-lg bg-muted/30 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center`}>
            {icon}
          </div>
          <span className="font-medium text-sm">{title}</span>
        </div>
        <span className={`font-bold text-sm ${percentage >= 80 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
          {score}/{maxScore}
        </span>
      </div>
      <div className="space-y-1">
        {children}
      </div>
      {deductionReason && score < maxScore && (
        <div className="text-xs text-red-600 bg-red-50 p-1.5 rounded">
          {deductionReason}
        </div>
      )}
      {advice && score < maxScore && (
        <div className="text-xs text-amber-700 bg-amber-50 p-1.5 rounded">
          {advice}
        </div>
      )}
    </div>
  );
};

export default function DraftDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const draftId = parseInt(params.id || "0");
  
  const { data: draftData, isLoading } = trpc.draft.get.useQuery(
    { id: draftId },
    { enabled: draftId > 0 }
  );
  const { data: contentTypes } = trpc.knowledge.contentTypes.useQuery();
  
  const [editedBody, setEditedBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [showThreads, setShowThreads] = useState(false);
  const [threads, setThreads] = useState<string[]>([]);
  const [showHooks, setShowHooks] = useState(false);
  const [hooks, setHooks] = useState<string[]>([]);

  const draft = draftData?.draft;

  // 清理 Markdown 符號的函數
  const cleanMarkdown = (text: string) => {
    return text
      .replace(/\*\*/g, '') // 移除粗體符號
      .replace(/\*/g, '')   // 移除斜體符號
      .replace(/^#+\s/gm, '') // 移除標題符號
      .replace(/`/g, '');    // 移除代碼符號
  };

  useEffect(() => {
    if (draft?.body) {
      setEditedBody(cleanMarkdown(draft.body));
    }
  }, [draft?.body]);

  const utils = trpc.useUtils();
  
  const updateDraft = trpc.draft.update.useMutation({
    onSuccess: () => {
      utils.draft.get.invalidate({ id: draftId });
      utils.draft.list.invalidate();
      toast.success("草稿已更新");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("更新失敗");
    },
  });

  const deleteDraft = trpc.draft.delete.useMutation({
    onSuccess: () => {
      toast.success("草稿已刪除");
      setLocation("/drafts");
    },
    onError: () => {
      toast.error("刪除失敗");
    },
  });

  const markAsPublished = trpc.draft.update.useMutation({
    onSuccess: () => {
      utils.draft.get.invalidate({ id: draftId });
      utils.draft.list.invalidate();
      toast.success("已標記為已發布");
    },
  });

  const convertToThread = trpc.draft.convertToThread.useMutation({
    onSuccess: (data) => {
      setThreads(data.threads);
      setShowThreads(true);
      toast.success(`已轉換為 ${data.totalParts} 段串文`);
    },
    onError: () => {
      toast.error("轉換失敗");
    },
  });

  const generateHooks = trpc.draft.generateHooks.useMutation({
    onSuccess: (data) => {
      setHooks(data.hooks);
      setShowHooks(true);
      toast.success(`已生成 ${data.hooks.length} 個 Hook 選項`);
    },
    onError: () => {
      toast.error("生成失敗");
    },
  });

  const [showCTAs, setShowCTAs] = useState(false);
  const [ctas, setCTAs] = useState<string[]>([]);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
  const [autoFixResult, setAutoFixResult] = useState("");

  const generateCTA = trpc.draft.generateCTA.useMutation({
    onSuccess: (data) => {
      setCTAs(data.ctas);
      setShowCTAs(true);
      toast.success(`已生成 ${data.ctas.length} 個 CTA 選項`);
    },
    onError: () => {
      toast.error("生成失敗");
    },
  });

  const addEmoji = trpc.draft.addEmoji.useMutation({
    onSuccess: (data) => {
      setEditedBody(data.content);
      setIsEditing(true);
      toast.success("已加入 Emoji");
    },
    onError: () => {
      toast.error("加入失敗");
    },
  });

  // 新版健檢 API
  const contentHealthCheck = trpc.ai.contentHealthCheck.useMutation({
    onSuccess: (data) => {
      setHealthCheckResult(data as HealthCheckResult);
      setShowHealthCheck(true);
      toast.success("文案健檢完成！");
    },
    onError: () => {
      toast.error("健檢失敗");
    },
  });

  const autoFix = trpc.ai.autoFix.useMutation({
    onSuccess: (data) => {
      setAutoFixResult(typeof data.content === 'string' ? data.content : '');
      toast.success("AI 已幫你優化文案！");
    },
    onError: () => {
      toast.error("優化失敗");
    },
  });

  const getContentTypeName = (typeId: string) => {
    return contentTypes?.find(t => t.id === typeId)?.name || typeId;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />草稿</Badge>;
      case 'published':
        return <Badge variant="default" className="gap-1 bg-emerald-500"><CheckCircle className="w-3 h-3" />已發布</Badge>;
      case 'archived':
        return <Badge variant="outline" className="gap-1"><Archive className="w-3 h-3" />已封存</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handleCopy = () => {
    // 複製時確保清理 Markdown 符號
    navigator.clipboard.writeText(cleanMarkdown(editedBody));
    toast.success("已複製到剪貼簿");
  };

  const handleSave = () => {
    updateDraft.mutate({
      id: draftId,
      body: editedBody,
    });
  };

  const handleDelete = () => {
    if (confirm("確定要刪除這篇草稿嗎？")) {
      deleteDraft.mutate({ id: draftId });
    }
  };

  const handleMarkPublished = () => {
    markAsPublished.mutate({
      id: draftId,
      status: "published",
    });
  };

  // 取得總分顏色
  const getTotalScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-500';
  };

  // 取得總分評語
  const getTotalScoreLabel = (score: number) => {
    if (score >= 90) return '🔥 爆款潛力';
    if (score >= 80) return '✨ 優秀';
    if (score >= 60) return '👍 及格';
    if (score >= 40) return '⚠️ 需改進';
    return '❌ 重寫建議';
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!draft) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">找不到這篇草稿</p>
          <Button onClick={() => setLocation("/drafts")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回草稿庫
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // 此時 draft 已確定存在
  const draftStatus = draft.status || 'draft';
  const draftContentType = draft.contentType || '';
  const draftCreatedAt = draft.createdAt;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/drafts")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                {getStatusBadge(draftStatus)}
                <Badge variant="outline">
                  {getContentTypeName(draftContentType)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                建立於 {draftCreatedAt ? format(new Date(draftCreatedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW }) : '-'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-2" />
              複製
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => generateHooks.mutate({ content: editedBody })}
              disabled={generateHooks.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateHooks.isPending ? "生成中..." : "優化開頭"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => convertToThread.mutate({ content: editedBody })}
              disabled={convertToThread.isPending}
            >
              <List className="w-4 h-4 mr-2" />
              {convertToThread.isPending ? "轉換中..." : "轉為串文"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => generateCTA.mutate({ content: editedBody })}
              disabled={generateCTA.isPending}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generateCTA.isPending ? "生成中..." : "結尾 CTA"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => addEmoji.mutate({ content: editedBody })}
              disabled={addEmoji.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {addEmoji.isPending ? "加入中..." : "加入 Emoji"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => contentHealthCheck.mutate({ text: editedBody })}
              disabled={contentHealthCheck.isPending}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {contentHealthCheck.isPending ? "健檢中..." : "文案健檢"}
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => autoFix.mutate({ text: editedBody })}
              disabled={autoFix.isPending}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Wand2 className="w-4 h-4 mr-2" />
              {autoFix.isPending ? "優化中..." : "AI 優化"}
            </Button>
            {draftStatus !== 'published' && (
              <Button variant="outline" size="sm" onClick={handleMarkPublished}>
                <Send className="w-4 h-4 mr-2" />
                標記已發布
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDelete} className="text-red-500 hover:text-red-600">
              <Trash2 className="w-4 h-4 mr-2" />
              刪除
            </Button>
          </div>
        </div>

        {/* 編輯區 */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>文案內容</CardTitle>
            <CardDescription>
              點擊編輯後記得儲存
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={editedBody}
              onChange={(e) => {
                setEditedBody(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[300px] font-sans"
              placeholder="輸入你的文案..."
            />
            {isEditing && (
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => {
                  setEditedBody(cleanMarkdown(draft.body || ''));
                  setIsEditing(false);
                }}>
                  取消
                </Button>
                <Button onClick={handleSave} disabled={updateDraft.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateDraft.isPending ? "儲存中..." : "儲存"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hook 優化選項 */}
        {showHooks && hooks.length > 0 && (
          <Card className="elegant-card border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Hook 優化選項
                  </CardTitle>
                  <CardDescription>
                    選擇一個你喜歡的開頭，點擊即可替換
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowHooks(false)}>
                  收起
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {hooks.map((hook, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border border-border/50 hover:border-amber-500/50 hover:bg-amber-500/5 cursor-pointer transition-all"
                  onClick={() => {
                    // 替換第一段為新的 Hook
                    const lines = editedBody.split('\n\n');
                    lines[0] = hook;
                    setEditedBody(lines.join('\n\n'));
                    setIsEditing(true);
                    toast.success("已替換開頭");
                  }}
                >
                  <p className="text-sm">{hook}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 串文格式化結果 */}
        {showThreads && threads.length > 0 && (
          <Card className="elegant-card border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <List className="w-5 h-5 text-blue-500" />
                    串文格式（共 {threads.length} 段）
                  </CardTitle>
                  <CardDescription>
                    每段都可以單獨複製發布
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowThreads(false)}>
                  收起
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {threads.map((thread, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border border-border/50 bg-background"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <Badge variant="outline" className="mb-2">
                        第 {index + 1} 段
                      </Badge>
                      <p className="text-sm whitespace-pre-wrap">{thread}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(thread);
                        toast.success(`已複製第 ${index + 1} 段`);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 文案健檢結果 V2（新版：移除 Tagging，新增四透鏡） */}
        {showHealthCheck && healthCheckResult && (
          <Card className="elegant-card border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    文案健檢結果
                  </CardTitle>
                  <CardDescription>
                    根據 Threads 演算法偏好 + 四透鏡框架進行審計式評分
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowHealthCheck(false)}>
                  收起
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 總分顯示 */}
              <div className="text-center p-6 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                <div className={`text-5xl font-bold ${getTotalScoreColor(healthCheckResult.totalScore)}`}>
                  {healthCheckResult.totalScore}
                  <span className="text-2xl text-muted-foreground">/100</span>
                </div>
                <div className="text-lg mt-2">
                  {getTotalScoreLabel(healthCheckResult.totalScore)}
                </div>
              </div>

              {/* 維度詳細評分 */}
              <div className="grid gap-4">
                {/* Hook 鉤子強度 */}
                <DimensionCard
                  title="🎣 Hook 鉤子強度"
                  score={healthCheckResult.scores.hook}
                  maxScore={healthCheckResult.maxScores.hook}
                  icon={<Sparkles className="w-5 h-5 text-amber-500" />}
                  deductionReason={healthCheckResult.hook.deductionReason}
                  advice={healthCheckResult.hook.advice}
                >
                  <CheckItem 
                    label="反直覺開場" 
                    passed={healthCheckResult.hook.hasContrastOpener}
                    detail={healthCheckResult.hook.hasContrastOpener ? healthCheckResult.hook.openerContent : undefined}
                  />
                  <CheckItem 
                    label="觀察+提問句型" 
                    passed={healthCheckResult.hook.hasObservationQuestion}
                  />
                  <CheckItem 
                    label="有懸念" 
                    passed={healthCheckResult.hook.hasSuspense}
                  />
                </DimensionCard>

                {/* Translation 翻譯機 */}
                <DimensionCard
                  title="🔄 Translation 翻譯機"
                  score={healthCheckResult.scores.translation}
                  maxScore={healthCheckResult.maxScores.translation}
                  icon={<RefreshCw className="w-5 h-5 text-blue-500" />}
                  deductionReason={healthCheckResult.translation.deductionReason}
                  advice={healthCheckResult.translation.advice}
                >
                  <CheckItem 
                    label="有精彩比喻" 
                    passed={healthCheckResult.translation.hasBrilliantMetaphor}
                    detail={healthCheckResult.translation.metaphorExample || undefined}
                  />
                  <CheckItem 
                    label="白話易懂（五年級能懂）" 
                    passed={healthCheckResult.translation.hasSimpleExplanation}
                  />
                  {healthCheckResult.translation.hasJargon && (
                    <CheckItem 
                      label="有專業術語未解釋" 
                      passed={false}
                      detail={healthCheckResult.translation.jargonList.join('、')}
                    />
                  )}
                </DimensionCard>

                {/* Tone 閱讀體感 */}
                <DimensionCard
                  title="💬 Tone 閱讀體感"
                  score={healthCheckResult.scores.tone}
                  maxScore={healthCheckResult.maxScores.tone}
                  icon={<AlertCircle className="w-5 h-5 text-cyan-500" />}
                  deductionReason={healthCheckResult.tone.deductionReason}
                  advice={healthCheckResult.tone.advice}
                >
                  <CheckItem 
                    label="有語助詞（真的、欸、啊）" 
                    passed={healthCheckResult.tone.hasInterjections}
                    detail={healthCheckResult.tone.detectedInterjections.length > 0 ? healthCheckResult.tone.detectedInterjections.join('、') : undefined}
                  />
                  <CheckItem 
                    label="排版有呼吸感" 
                    passed={healthCheckResult.tone.hasBreathingSpace}
                  />
                  <CheckItem 
                    label="像真人說話" 
                    passed={healthCheckResult.tone.isHumanLike}
                  />
                </DimensionCard>

                {/* CTA 互動召喚 */}
                <DimensionCard
                  title="📢 CTA 互動召喚"
                  score={healthCheckResult.scores.cta}
                  maxScore={healthCheckResult.maxScores.cta}
                  icon={<Send className="w-5 h-5 text-emerald-500" />}
                  deductionReason={healthCheckResult.cta.deductionReason}
                  advice={healthCheckResult.cta.advice}
                >
                  <div className="text-sm">
                    <span className="font-medium">CTA 類型：</span>
                    <Badge variant="outline" className="ml-2">
                      {healthCheckResult.cta.ctaType === 'tribe_call' && '召喚同類 ✅'}
                      {healthCheckResult.cta.ctaType === 'binary_choice' && '二選一 ✅'}
                      {healthCheckResult.cta.ctaType === 'open_question' && '開放式提問 ⚠️'}
                      {healthCheckResult.cta.ctaType === 'lecture' && '說教結尾 ❌'}
                      {healthCheckResult.cta.ctaType === 'none' && '無 CTA ❌'}
                    </Badge>
                  </div>
                  <CheckItem 
                    label="召喚特定族群" 
                    passed={healthCheckResult.cta.hasTargetAudienceCall}
                  />
                  {healthCheckResult.cta.ctaContent && (
                    <div className="text-sm text-muted-foreground mt-1">
                      結尾內容：「{healthCheckResult.cta.ctaContent}」
                    </div>
                  )}
                </DimensionCard>

                {/* 四透鏡檢核 */}
                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🔍</span>
                      <span className="font-medium">四透鏡檢核</span>
                    </div>
                    <span className={`font-bold ${
                      (healthCheckResult.scores.fourLens / healthCheckResult.maxScores.fourLens) >= 0.8 ? 'text-emerald-600' :
                      (healthCheckResult.scores.fourLens / healthCheckResult.maxScores.fourLens) >= 0.5 ? 'text-amber-600' : 'text-red-500'
                    }`}>
                      {healthCheckResult.scores.fourLens}/{healthCheckResult.maxScores.fourLens}
                    </span>
                  </div>

                  {/* 進度條 */}
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        (healthCheckResult.scores.fourLens / healthCheckResult.maxScores.fourLens) >= 0.8 ? 'bg-emerald-500' : 
                        (healthCheckResult.scores.fourLens / healthCheckResult.maxScores.fourLens) >= 0.5 ? 'bg-amber-500' : 'bg-red-400'
                      }`}
                      style={{ width: `${(healthCheckResult.scores.fourLens / healthCheckResult.maxScores.fourLens) * 100}%` }}
                    />
                  </div>

                  {/* 四透鏡子維度 */}
                  <div className="grid gap-3 md:grid-cols-2">
                    {/* 心法透鏡 */}
                    <FourLensSubCard
                      title="心法透鏡"
                      score={healthCheckResult.fourLensScores.emotion}
                      maxScore={healthCheckResult.fourLensMaxScores.emotion}
                      icon={<Heart className="w-4 h-4 text-rose-500" />}
                      iconBg="bg-rose-500/10"
                      deductionReason={healthCheckResult.fourLens.emotion.deductionReason}
                      advice={healthCheckResult.fourLens.emotion.advice}
                    >
                      <CheckItem 
                        label="渴望導向（非焦慮）" 
                        passed={healthCheckResult.fourLens.emotion.isDesireOriented}
                        detail={healthCheckResult.fourLens.emotion.emotionType}
                      />
                    </FourLensSubCard>

                    {/* 人設透鏡 */}
                    <FourLensSubCard
                      title="人設透鏡"
                      score={healthCheckResult.fourLensScores.persona}
                      maxScore={healthCheckResult.fourLensMaxScores.persona}
                      icon={<User className="w-4 h-4 text-blue-500" />}
                      iconBg="bg-blue-500/10"
                      deductionReason={healthCheckResult.fourLens.persona.deductionReason}
                      advice={healthCheckResult.fourLens.persona.advice}
                    >
                      <CheckItem 
                        label="符合人設風格" 
                        passed={healthCheckResult.fourLens.persona.isConsistent}
                      />
                      <CheckItem 
                        label="有個人特色" 
                        passed={healthCheckResult.fourLens.persona.hasPersonalTouch}
                      />
                    </FourLensSubCard>

                    {/* 結構透鏡 */}
                    <FourLensSubCard
                      title="結構透鏡"
                      score={healthCheckResult.fourLensScores.structure}
                      maxScore={healthCheckResult.fourLensMaxScores.structure}
                      icon={<Layout className="w-4 h-4 text-emerald-500" />}
                      iconBg="bg-emerald-500/10"
                      deductionReason={healthCheckResult.fourLens.structure.deductionReason}
                      advice={healthCheckResult.fourLens.structure.advice}
                    >
                      <CheckItem 
                        label="好吸收" 
                        passed={healthCheckResult.fourLens.structure.isEasyToAbsorb}
                      />
                      <CheckItem 
                        label="有邏輯脈絡" 
                        passed={healthCheckResult.fourLens.structure.hasLogicalFlow}
                      />
                    </FourLensSubCard>

                    {/* 轉化透鏡 */}
                    <FourLensSubCard
                      title="轉化透鏡"
                      score={healthCheckResult.fourLensScores.conversion}
                      maxScore={healthCheckResult.fourLensMaxScores.conversion}
                      icon={<Target className="w-4 h-4 text-amber-500" />}
                      iconBg="bg-amber-500/10"
                      deductionReason={healthCheckResult.fourLens.conversion.deductionReason}
                      advice={healthCheckResult.fourLens.conversion.advice}
                    >
                      <CheckItem 
                        label="有明確下一步" 
                        passed={healthCheckResult.fourLens.conversion.hasNextStep}
                      />
                      <CheckItem 
                        label="行動可執行" 
                        passed={healthCheckResult.fourLens.conversion.isActionable}
                      />
                    </FourLensSubCard>
                  </div>
                </div>
              </div>

              {/* 總結建議 */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-amber-800 mb-1">優化重點</div>
                    <p className="text-sm text-amber-700">{healthCheckResult.overallAdvice}</p>
                  </div>
                </div>
              </div>

              {/* 紅線標記區塊 */}
              {healthCheckResult.redlineMarks && healthCheckResult.redlineMarks.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <span className="text-lg">✏️</span>
                    </div>
                    <div>
                      <h3 className="font-semibold">教學紅線標記</h3>
                      <p className="text-xs text-muted-foreground">學會辨識這些問題，下次就能避免</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {healthCheckResult.redlineMarks.map((mark, index) => (
                      <div key={index} className="bg-white/80 rounded-lg border border-border/50 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                            {mark.category}
                          </span>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                          {/* 原文 */}
                          <div className="bg-red-50/50 rounded-lg p-3 border border-red-200/50">
                            <p className="text-xs text-red-600 font-medium mb-1">❌ 原文</p>
                            <p className="text-sm text-red-800 line-through decoration-red-400">
                              {mark.original}
                            </p>
                          </div>
                          {/* 建議改寫 */}
                          <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-200/50">
                            <p className="text-xs text-emerald-600 font-medium mb-1">✅ 建議改寫</p>
                            <p className="text-sm text-emerald-800">
                              {mark.suggestion}
                            </p>
                          </div>
                        </div>
                        {/* 原因說明 */}
                        <div className="mt-3 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                          <span className="font-medium">💡 為什麼：</span> {mark.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI 優化結果 */}
        {autoFixResult && (
          <Card className="elegant-card border-purple-500/30 bg-purple-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-500" />
                    AI 優化版本
                  </CardTitle>
                  <CardDescription>
                    AI 已根據爆款元素優化你的文案
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setEditedBody(autoFixResult);
                      setIsEditing(true);
                      setAutoFixResult("");
                      toast.success("已套用優化版本");
                    }}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    套用這版
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setAutoFixResult("")}>
                    收起
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-white/60 dark:bg-gray-800/60 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap font-sans text-sm">{autoFixResult}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA 選項 */}
        {showCTAs && ctas.length > 0 && (
          <Card className="elegant-card border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-emerald-500" />
                    結尾互動 CTA
                  </CardTitle>
                  <CardDescription>
                    選擇一個你喜歡的結尾，點擊即可加到文章末尾
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowCTAs(false)}>
                  收起
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {ctas.map((cta, index) => (
                <div 
                  key={index}
                  className="p-4 rounded-lg border border-border/50 hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all"
                  onClick={() => {
                    // 加到文章末尾
                    setEditedBody(editedBody.trim() + '\n\n' + cta);
                    setIsEditing(true);
                    toast.success("已加入結尾 CTA");
                  }}
                >
                  <p className="text-sm">{cta}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p><strong>發布小提醒：</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>複製內容後，直接貼到 Threads 發布</li>
                <li>發布後記得回來標記「已發布」，方便追蹤</li>
                <li>可以在「戰報分析」填寫發布後的成效數據</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
