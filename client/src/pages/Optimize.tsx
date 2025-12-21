import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  CheckCircle, 
  Copy,
  RefreshCw,
  Eye,
  Heart,
  User,
  Layout,
  Target,
  Sparkles,
  TrendingUp,
  MessageCircle,
  Hash,
  Zap,
  Wand2,
  Check,
  X,
  AlertCircle,
  Send,
} from "lucide-react";

// 健檢結果類型定義
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
  tagging: {
    hasMBTI: boolean;
    hasConstellation: boolean;
    hasMetaphysics: boolean;
    hasIdentityTag: boolean;
    detectedKeywords: string[];
    isCoreTopic: boolean;
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
  scores: {
    hook: number;
    tagging: number;
    translation: number;
    tone: number;
    cta: number;
  };
  maxScores: {
    hook: number;
    tagging: number;
    translation: number;
    tone: number;
    cta: number;
  };
  totalScore: number;
  overallAdvice: string;
}

// 流量密碼 Badge 組件
const ViralBadge = ({ label, detected }: { label: string; detected: boolean }) => (
  <span className={`px-2 py-1 rounded text-xs ${detected ? 'bg-purple-100 text-purple-800 font-bold border border-purple-300' : 'bg-gray-100 text-gray-400'}`}>
    {detected ? `✅ 命中：${label}` : `⚪ 未使用：${label}`}
  </span>
);

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

export default function Optimize() {
  const { data: fourLens } = trpc.knowledge.fourLens.useQuery();
  
  const [inputText, setInputText] = useState("");
  const [healthCheckResult, setHealthCheckResult] = useState<HealthCheckResult | null>(null);
  const [clarityResult, setClarityResult] = useState("");
  const [autoFixResult, setAutoFixResult] = useState("");
  
  // 新版健檢 API
  const contentHealthCheck = trpc.ai.contentHealthCheck.useMutation({
    onSuccess: (data) => {
      setHealthCheckResult(data as HealthCheckResult);
      toast.success("文案健檢完成！");
    },
    onError: () => {
      toast.error("健檢失敗，請稍後再試");
    },
  });

  const checkClarity = trpc.ai.checkClarity.useMutation({
    onSuccess: (data) => {
      setClarityResult(typeof data.result === 'string' ? data.result : '');
      toast.success("蛤？測試完成！");
    },
    onError: () => {
      toast.error("測試失敗，請稍後再試");
    },
  });

  const autoFix = trpc.ai.autoFix.useMutation({
    onSuccess: (data) => {
      setAutoFixResult(typeof data.content === 'string' ? data.content : '');
      toast.success("AI 已幫你優化文案！");
    },
    onError: () => {
      toast.error("優化失敗，請稍後再試");
    },
  });

  const handleHealthCheck = () => {
    if (!inputText.trim()) {
      toast.error("請先輸入要健檢的文案");
      return;
    }
    contentHealthCheck.mutate({ text: inputText });
  };

  const handleCheckClarity = () => {
    if (!inputText.trim()) {
      toast.error("請先輸入要測試的文案");
      return;
    }
    checkClarity.mutate({ text: inputText });
  };

  const handleAutoFix = () => {
    if (!inputText.trim()) {
      toast.error("請先輸入要優化的文案");
      return;
    }
    autoFix.mutate({ text: inputText });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  const lensIcons = {
    emotion: Heart,
    persona: User,
    structure: Layout,
    conversion: Target,
  };

  const lensColors = {
    emotion: "text-rose-500 bg-rose-500/10",
    persona: "text-blue-500 bg-blue-500/10",
    structure: "text-emerald-500 bg-emerald-500/10",
    conversion: "text-amber-500 bg-amber-500/10",
  };

  // 新版五大維度說明
  const scoreItems = [
    { icon: Zap, name: "Hook 鉤子", desc: "前兩行是否讓人停下", color: "text-amber-500 bg-amber-500/10", maxScore: 30 },
    { icon: Hash, name: "Tagging", desc: "是否有流量密碼", color: "text-purple-500 bg-purple-500/10", maxScore: 25 },
    { icon: RefreshCw, name: "Translation", desc: "是否用比喻說白話", color: "text-blue-500 bg-blue-500/10", maxScore: 25 },
    { icon: MessageCircle, name: "Tone", desc: "是否像真人說話", color: "text-cyan-500 bg-cyan-500/10", maxScore: 10 },
    { icon: Target, name: "CTA", desc: "是否有互動召喚", color: "text-emerald-500 bg-emerald-500/10", maxScore: 10 },
  ];

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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文案健檢</h1>
          <p className="text-muted-foreground mt-1">
            使用 Threads 演算法偏好進行審計式評分，確保你的文案有爆款潛力
          </p>
        </div>

        {/* Score Items Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {scoreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.name} className="elegant-card">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {item.maxScore} 分
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Input Section */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              輸入文案
            </CardTitle>
            <CardDescription>
              貼上你想健檢的文案，AI 會用五大維度幫你評分並給出優化建議
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="把你的文案貼在這裡..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleHealthCheck}
                disabled={contentHealthCheck.isPending || !inputText.trim()}
                className="flex-1"
              >
                {contentHealthCheck.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    健檢中...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    五維度健檢
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleCheckClarity}
                disabled={checkClarity.isPending || !inputText.trim()}
              >
                {checkClarity.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    測試中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    蛤？測試
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleAutoFix}
                disabled={autoFix.isPending || !inputText.trim()}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                {autoFix.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    優化中...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    AI 幫我修改
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Health Check Result V2 */}
        {healthCheckResult && (
          <Card className="elegant-card border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    文案健檢結果
                  </CardTitle>
                  <CardDescription>
                    根據 Threads 演算法偏好進行審計式評分
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setHealthCheckResult(null)}>
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

              {/* 五大維度詳細評分 */}
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

                {/* Tagging 流量密碼 */}
                <DimensionCard
                  title="🏷️ Tagging 流量密碼"
                  score={healthCheckResult.scores.tagging}
                  maxScore={healthCheckResult.maxScores.tagging}
                  icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                  deductionReason={healthCheckResult.tagging.deductionReason}
                  advice={healthCheckResult.tagging.advice}
                >
                  <div className="flex flex-wrap gap-2 mb-2">
                    <ViralBadge label="MBTI" detected={healthCheckResult.tagging.hasMBTI} />
                    <ViralBadge label="星座" detected={healthCheckResult.tagging.hasConstellation} />
                    <ViralBadge label="玄學/能量" detected={healthCheckResult.tagging.hasMetaphysics} />
                    <ViralBadge label="身分標籤" detected={healthCheckResult.tagging.hasIdentityTag} />
                  </div>
                  {healthCheckResult.tagging.detectedKeywords.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      偵測到：{healthCheckResult.tagging.detectedKeywords.join('、')}
                    </div>
                  )}
                  <CheckItem 
                    label="流量密碼為核心主題" 
                    passed={healthCheckResult.tagging.isCoreTopic}
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
            </CardContent>
          </Card>
        )}

        {/* Auto Fix Result */}
        {autoFixResult && (
          <Card className="elegant-card border-purple-500/20 bg-gradient-to-br from-purple-50/50 to-indigo-50/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-500" />
                  AI 優化版本
                </CardTitle>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setInputText(autoFixResult);
                      setAutoFixResult("");
                      toast.success("已套用優化版本");
                    }}
                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                  >
                    套用這版
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleCopy(autoFixResult)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    複製
                  </Button>
                </div>
              </div>
              <CardDescription>
                AI 已根據爆款元素優化你的文案，點擊「套用這版」可以繼續調整
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert bg-white/60 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap font-sans text-sm">{autoFixResult}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clarity Result */}
        {clarityResult && (
          <Card className="elegant-card border-amber-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  蛤？測試結果
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopy(clarityResult)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  複製
                </Button>
              </div>
              <CardDescription>
                檢查文案是否讓一般人聽得懂
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{clarityResult}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Four Lens Reference (Collapsed) */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-muted-foreground" />
              四透鏡框架參考
            </CardTitle>
            <CardDescription>
              健檢時也會參考四透鏡框架的原則
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {fourLens && Object.entries(fourLens).map(([key, lens]) => {
                const Icon = lensIcons[key as keyof typeof lensIcons];
                const colorClass = lensColors[key as keyof typeof lensColors];
                return (
                  <div key={key} className="p-3 rounded-lg bg-muted/30">
                    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{lens.name}</h3>
                    <p className="text-xs text-muted-foreground">{lens.question}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
