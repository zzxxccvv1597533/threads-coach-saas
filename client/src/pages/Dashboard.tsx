import DashboardLayout from "@/components/DashboardLayout";
import React, { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { 
  PenTool, 
  CheckCircle, 
  MessageSquare, 
  BarChart3,
  ArrowRight,
  Sparkles,
  Target,
  TrendingUp,
  FileText,
  Clock,
  Rocket,
  ChevronRight,
  Settings,
  Users,
  Link2,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: ipProfile, isLoading: ipLoading } = trpc.ipProfile.get.useQuery();
  const { data: drafts, isLoading: draftsLoading } = trpc.draft.list.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.task.today.useQuery();
  const { data: weeklyReport, isLoading: reportLoading } = trpc.post.weeklyReport.useQuery();
  const { data: contentTypeStats } = trpc.draft.contentTypeStats.useQuery();
  const { data: accountHealthData, isLoading: healthLoading } = trpc.accountHealth.getDashboardData.useQuery();
  const { data: growthMetrics, isLoading: metricsLoading } = trpc.growthMetrics.get.useQuery();
  const utils = trpc.useUtils();
  const setManualStageMutation = trpc.growthMetrics.setManualStage.useMutation({
    onSuccess: (data) => {
      utils.growthMetrics.get.invalidate();
      toast.success(data.isManual ? '已設定經營階段' : '已恢復自動判定');
    },
    onError: () => {
      toast.error('設定失敗，請稍後再試');
    },
  });

  const updateGrowthMetricsMutation = trpc.growthMetrics.update.useMutation({
    onSuccess: (data) => {
      utils.growthMetrics.get.invalidate();
      toast.success(`數據已更新，經營階段：${getStageLabel(data.stage)}`);
    },
    onError: () => {
      toast.error('更新失敗，請稍後再試');
    },
  });

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      startup: '起步階段',
      growth: '成長階段',
      monetize: '變現階段',
      scale: '規模化階段',
    };
    return labels[stage] || '起步階段';
  };

  const handleSetManualStage = (stage: string | null) => {
    setManualStageMutation.mutate({ stage: stage as any });
  };

  const handleUpdateMetrics = (data: {
    followerCount?: number;
    hasLineLink?: boolean;
    hasProduct?: boolean;
    totalSales?: number;
  }) => {
    updateGrowthMetricsMutation.mutate(data);
  };

  // 計算 IP 完成度
  const calculateIpProgress = () => {
    if (!ipProfile) return 0;
    let score = 0;
    if (ipProfile.occupation) score += 15;
    if (ipProfile.voiceTone) score += 15;
    if (ipProfile.viewpointStatement) score += 15;
    if (ipProfile.personaExpertise) score += 20;
    if (ipProfile.personaEmotion) score += 15;
    if (ipProfile.personaViewpoint) score += 20;
    return score;
  };

  const ipProgress = calculateIpProgress();
  const pendingTasks = tasks?.filter(t => t.status === 'todo').length || 0;
  const draftCount = drafts?.filter(d => d.status === 'draft').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">歡迎回來 👋</h1>
            <p className="text-muted-foreground mt-1">
              準備好今天的內容創作了嗎？
            </p>
          </div>
          <Button onClick={() => setLocation('/writing-studio')} size="lg" className="shadow-lg shadow-primary/20">
            <PenTool className="w-4 h-4 mr-2" />
            開始寫作
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="elegant-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">IP 完成度</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {ipLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{ipProgress}%</div>
                  <Progress value={ipProgress} className="mt-2" />
                </>
              )}
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">待處理草稿</CardTitle>
              <FileText className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {draftsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{draftCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">篇草稿等待發布</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">今日任務</CardTitle>
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{pendingTasks}</div>
                  <p className="text-xs text-muted-foreground mt-1">項互動任務待完成</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="elegant-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">本週互動</CardTitle>
              <TrendingUp className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {weeklyReport?.summary?.totalComments || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">則留言互動</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 經營階段卡片 */}
        <GrowthStageCard 
          stage={growthMetrics?.currentStage || 'startup'} 
          manualStage={growthMetrics?.manualStage}
          metrics={growthMetrics}
          isLoading={metricsLoading}
          isUpdating={updateGrowthMetricsMutation.isPending}
          onNavigate={() => setLocation('/ip-profile')}
          onSetManualStage={handleSetManualStage}
          onUpdateMetrics={handleUpdateMetrics}
        />

        {/* P2 優化：今日推薦選題和帳號健康度 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 今日推薦選題 */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                今日推薦選題
              </CardTitle>
              <CardDescription>
                根據你的領域和內容組合，推薦適合今天發的主題
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : accountHealthData?.todaySuggestions && accountHealthData.todaySuggestions.length > 0 ? (
                <div className="space-y-3">
                  {accountHealthData.todaySuggestions.map((topic, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        // 導航到寫作工作室，帶入選題
                        setLocation(`/writing-studio?topic=${encodeURIComponent(topic.title)}&type=${topic.contentType}`);
                      }}
                      className="w-full text-left p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {topic.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {topic.reason}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            topic.targetGoal === 'awareness' ? 'bg-blue-100 text-blue-700' :
                            topic.targetGoal === 'trust' ? 'bg-emerald-100 text-emerald-700' :
                            topic.targetGoal === 'engagement' ? 'bg-amber-100 text-amber-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {topic.targetGoal === 'awareness' ? '讓人更懂我' :
                             topic.targetGoal === 'trust' ? '讓人信任我' :
                             topic.targetGoal === 'engagement' ? '有人互動' : '引導變現'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {{
                              story: '故事型',
                              dialogue: '對話型',
                              question: '提問型',
                              casual: '閒聊型',
                              knowledge: '乾貨型',
                              viewpoint: '觀點型',
                              contrast: '反差型',
                              success_story: '案例故事',
                            }[topic.contentType] || topic.contentType}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setLocation('/writing-studio')}
                  >
                    查看更多選題
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">完善 IP 地基後，系統會推薦適合你的選題</p>
                  <Button 
                    variant="outline"
                    onClick={() => setLocation('/ip-profile')}
                  >
                    完善 IP 地基
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 帳號健康度摘要 */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-500" />
                帳號健康度
              </CardTitle>
              <CardDescription>
                綜合分析你的內容、互動和人設一致性
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : accountHealthData ? (
                <div className="space-y-4">
                  {/* 總分 */}
                  <div className="text-center p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                    <div className="text-4xl font-bold text-primary">
                      {accountHealthData.healthScore}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">綜合健康分數</p>
                  </div>

                  {/* 各維度分數 */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">內容</span>
                      </div>
                      <div className="text-xl font-bold">{accountHealthData.contentHealth.score}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-emerald-500" />
                        <span className="text-sm font-medium">互動</span>
                      </div>
                      <div className="text-xl font-bold">{accountHealthData.interactionHealth.score}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">成長</span>
                      </div>
                      <div className="text-xl font-bold">{accountHealthData.growthHealth.score}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">人設</span>
                      </div>
                      <div className="text-xl font-bold">{accountHealthData.personaConsistency.score}</div>
                    </div>
                  </div>

                  {/* 內容組合建議 */}
                  {accountHealthData.contentMix.recommendation && (
                    <div className={`p-3 rounded-lg text-sm ${
                      accountHealthData.contentMix.recommendation.urgency === 'high' 
                        ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                        : accountHealthData.contentMix.recommendation.urgency === 'medium'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      <p className="font-medium mb-1">
                        {accountHealthData.contentMix.recommendation.urgency === 'high' ? '⚠️' : '💡'} 內容組合建議
                      </p>
                      <p>{accountHealthData.contentMix.recommendation.reason}</p>
                    </div>
                  )}

                  {/* 領域識別 */}
                  {accountHealthData.domain.primary !== '通用' && (
                    <div className="text-center text-sm text-muted-foreground">
                      識別領域：<span className="font-medium text-foreground">{accountHealthData.domain.primary}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground">無法載入健康度數據</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* IP Profile Status */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                IP 地基狀態
              </CardTitle>
              <CardDescription>
                完善你的人設三支柱，讓 AI 更了解你的風格
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ipLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : ipProgress < 100 ? (
                <>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>完成進度</span>
                      <span className="font-medium">{ipProgress}%</span>
                    </div>
                    <Progress value={ipProgress} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {!ipProfile?.occupation && <p>• 尚未設定職業/身份</p>}
                    {!ipProfile?.personaExpertise && <p>• 尚未設定專業支柱</p>}
                    {!ipProfile?.personaEmotion && <p>• 尚未設定情感支柱</p>}
                    {!ipProfile?.personaViewpoint && <p>• 尚未設定觀點支柱</p>}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setLocation('/ip-profile')}
                  >
                    完善 IP 地基
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="font-medium">IP 地基已完成！</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    你可以開始使用發文工作室了
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Today's Tasks */}
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                今日互動任務
              </CardTitle>
              <CardDescription>
                互動是 Threads 成長的關鍵，記得每天完成任務
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : tasks && tasks.length > 0 ? (
                <div className="space-y-3">
                  {tasks.slice(0, 3).map((task) => (
                    <div 
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        task.status === 'done' 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        task.status === 'done' 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-muted'
                      }`}>
                        {task.status === 'done' ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          task.status === 'done' ? 'line-through text-muted-foreground' : ''
                        }`}>
                          {task.taskDetail}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setLocation('/tasks')}
                  >
                    查看所有任務
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground mb-4">今天還沒有任務</p>
                  <Button 
                    variant="outline"
                    onClick={() => setLocation('/tasks')}
                  >
                    生成今日任務
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 內容比例追蹤 */}
        {contentTypeStats && contentTypeStats.length > 0 && (
          <Card className="elegant-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                內容類型分佈
              </CardTitle>
              <CardDescription>
                建議保持 70% 情緒內容 / 30% 品牌內容的比例
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentTypeChart stats={contentTypeStats} />
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>快速開始</CardTitle>
            <CardDescription>選擇你想做的事</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => setLocation(action.path)}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border/50 hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl ${action.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// 內容類型分佈圖表組件
function ContentTypeChart({ stats }: { stats: { contentType: string; count: number }[] }) {
  const contentTypeNames: Record<string, string> = {
    knowledge: '乾貨型',
    summary: '懶人包',
    story: '故事型',
    viewpoint: '觀點型',
    contrast: '反差型',
    casual: '閒聊型',
    dialogue: '對話型',
    question: '提問型',
    poll: '投票型',
    quote: '金句型',
    intro: '首頁自介',
    plus_one: '+1互動',
    free_value: '價值分享',
    case_study: '案例故事',
    lead_magnet: '引流品推廣',
  };

  // 分類：情緒內容 vs 品牌內容
  const emotionalTypes = ['story', 'viewpoint', 'contrast', 'casual', 'dialogue', 'question', 'poll', 'quote'];
  const brandTypes = ['knowledge', 'summary', 'intro', 'plus_one', 'free_value', 'case_study', 'lead_magnet'];

  let emotionalCount = 0;
  let brandCount = 0;

  stats.forEach(s => {
    if (emotionalTypes.includes(s.contentType)) {
      emotionalCount += s.count;
    } else if (brandTypes.includes(s.contentType)) {
      brandCount += s.count;
    }
  });

  const total = emotionalCount + brandCount;
  const emotionalPercent = total > 0 ? Math.round((emotionalCount / total) * 100) : 0;
  const brandPercent = total > 0 ? Math.round((brandCount / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 比例條 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>情緒內容（故事/觀點/閒聊...）</span>
          <span className="font-medium">{emotionalPercent}%</span>
        </div>
        <Progress value={emotionalPercent} className="h-2" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>品牌內容（乾貨/案例/引流...）</span>
          <span className="font-medium">{brandPercent}%</span>
        </div>
        <Progress value={brandPercent} className="h-2" />
      </div>

      {/* 建議 */}
      {total >= 5 && (
        <div className={`p-3 rounded-lg text-sm ${
          emotionalPercent >= 60 && emotionalPercent <= 80 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          {emotionalPercent >= 60 && emotionalPercent <= 80 ? (
            <p>✅ 內容比例很健康！繼續保持這個節奏。</p>
          ) : emotionalPercent > 80 ? (
            <p>✨ 情緒內容較多，可以適當增加一些品牌內容來引導變現。</p>
          ) : (
            <p>💡 品牌內容較多，建議增加一些情緒內容來提升互動。</p>
          )}
        </div>
      )}

      {/* 詳細分佈 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2">
        {stats.slice(0, 6).map(s => (
          <div key={s.contentType} className="text-center p-2 rounded-lg bg-muted/30">
            <p className="text-lg font-bold">{s.count}</p>
            <p className="text-xs text-muted-foreground">{contentTypeNames[s.contentType] || s.contentType}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 經營階段卡片組件
function GrowthStageCard({ 
  stage, 
  manualStage,
  metrics,
  isLoading, 
  isUpdating,
  onNavigate,
  onSetManualStage,
  onUpdateMetrics,
}: { 
  stage: string; 
  manualStage?: string | null;
  metrics?: {
    followerCount?: number | null;
    avgReach?: number | null;
    avgEngagementRate?: number | null;
    postFrequency?: number | null;
    totalPosts?: number | null;
    hasLineLink?: boolean | null;
    hasProduct?: boolean | null;
    totalSales?: number | null;
    updatedAt?: Date | null;
  } | null;
  isLoading: boolean;
  isUpdating?: boolean;
  onNavigate: () => void;
  onSetManualStage: (stage: string | null) => void;
  onUpdateMetrics: (data: {
    followerCount?: number;
    hasLineLink?: boolean;
    hasProduct?: boolean;
    totalSales?: number;
  }) => void;
}) {
  const [showStageSelector, setShowStageSelector] = React.useState(false);
  const [showMetricsDialog, setShowMetricsDialog] = React.useState(false);
  const [metricsForm, setMetricsForm] = React.useState({
    followerCount: metrics?.followerCount || 0,
    hasLineLink: metrics?.hasLineLink || false,
    hasProduct: metrics?.hasProduct || false,
    totalSales: metrics?.totalSales || 0,
  });

  // 當 metrics 變化時更新表單
  React.useEffect(() => {
    if (metrics) {
      setMetricsForm({
        followerCount: metrics.followerCount || 0,
        hasLineLink: metrics.hasLineLink || false,
        hasProduct: metrics.hasProduct || false,
        totalSales: metrics.totalSales || 0,
      });
    }
  }, [metrics]);
  
  const stageInfo: Record<string, {
    name: string;
    description: string;
    tips: string;
    recommendedTypes: string[];
    color: string;
    bgColor: string;
    progress: number;
  }> = {
    startup: {
      name: '起步階段',
      description: '建立人設與信任',
      tips: '多分享個人故事和專業知識，建立人設和信任感，先不要推銷',
      recommendedTypes: ['故事型', '知識型', '閃聊型', '觀點型'],
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
      progress: 25,
    },
    growth: {
      name: '成長階段',
      description: '擴大影響力',
      tips: '增加互動型內容，引導加入 LINE 或電子報',
      recommendedTypes: ['提問型', '投票型', '觀點型', '對話型'],
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200',
      progress: 50,
    },
    monetize: {
      name: '變現階段',
      description: '導入產品',
      tips: '可以開始分享產品相關內容，但仍要保持 70% 情緒內容',
      recommendedTypes: ['知識型', '故事型', '引流品推廣'],
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 border-amber-200',
      progress: 75,
    },
    scale: {
      name: '規模化階段',
      description: '系統化運營',
      tips: '可以更積極推廣產品，建立自動化流程',
      recommendedTypes: ['全部類型'],
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
      progress: 100,
    },
  };

  const currentStage = stageInfo[stage] || stageInfo.startup;
  const isManual = !!manualStage;

  const handleSaveMetrics = () => {
    onUpdateMetrics(metricsForm);
    setShowMetricsDialog(false);
  };

  if (isLoading) {
    return (
      <Card className="elegant-card">
        <CardContent className="p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`elegant-card border ${currentStage.bgColor}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className={`w-5 h-5 ${currentStage.color}`} />
              <span className={`text-sm font-medium ${currentStage.color}`}>
                當前經營階段
                {isManual && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-white/70 text-muted-foreground">
                    手動設定
                  </span>
                )}
              </span>
            </div>
            <h3 className="text-xl font-bold mb-1">{currentStage.name}</h3>
            <p className="text-sm text-muted-foreground mb-3">{currentStage.description}</p>
            
            {/* 進度條 */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>經營進度</span>
                <span>{currentStage.progress}%</span>
              </div>
              <Progress value={currentStage.progress} className="h-2" />
            </div>

            {/* 策略提示 */}
            <div className="bg-white/50 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium mb-1">💡 策略提示</p>
              <p className="text-sm text-muted-foreground">{currentStage.tips}</p>
            </div>

            {/* 推薦內容類型 */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-muted-foreground">推薦內容：</span>
              {currentStage.recommendedTypes.map((type, index) => (
                <span 
                  key={index}
                  className="text-xs px-2 py-1 rounded-full bg-white/70 border border-border/50"
                >
                  {type}
                </span>
              ))}
            </div>

            {/* 手動選擇階段 */}
            {showStageSelector ? (
              <div className="bg-white/70 rounded-lg p-3 border border-border/50">
                <p className="text-xs text-muted-foreground mb-2">選擇你的經營階段：</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(stageInfo).map(([key, info]) => (
                    <button
                      key={key}
                      onClick={() => {
                        onSetManualStage(key);
                        setShowStageSelector(false);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        stage === key 
                          ? `${info.bgColor} ${info.color} font-medium` 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {info.name}
                    </button>
                  ))}
                  {isManual && (
                    <button
                      onClick={() => {
                        onSetManualStage(null);
                        setShowStageSelector(false);
                      }}
                      className="text-xs px-3 py-1.5 rounded-full border bg-gray-100 hover:bg-gray-200 text-gray-600"
                    >
                      恢復自動判定
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowStageSelector(false)}
                  className="text-xs text-muted-foreground mt-2 hover:text-foreground"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowStageSelector(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                🎯 手動設定階段（粉絲少但已在變現？）
              </button>
            )}
          </div>

          {/* 右側操作 */}
          <Dialog open={showMetricsDialog} onOpenChange={setShowMetricsDialog}>
            <DialogTrigger asChild>
              <button 
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                設定
                <ChevronRight className="w-4 h-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>更新經營數據</DialogTitle>
                <DialogDescription>
                  更新你的帳號數據，系統會自動重新計算經營階段
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                {/* 粉絲數 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-500" />
                    粉絲數
                  </Label>
                  <Input
                    type="number"
                    placeholder="輸入你的 Threads 粉絲數"
                    value={metricsForm.followerCount || ''}
                    onChange={(e) => setMetricsForm({
                      ...metricsForm,
                      followerCount: parseInt(e.target.value) || 0
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    到 Threads 個人檔案查看粉絲數
                  </p>
                </div>

                {/* LINE 連結 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-green-500" />
                      已設定 LINE 連結
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      個人檔案或貼文中有引導加 LINE 的連結
                    </p>
                  </div>
                  <Switch
                    checked={metricsForm.hasLineLink}
                    onCheckedChange={(checked) => setMetricsForm({
                      ...metricsForm,
                      hasLineLink: checked
                    })}
                  />
                </div>

                {/* 有產品 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-amber-500" />
                      已設定產品
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      已在 IP 地基設定產品資訊
                    </p>
                  </div>
                  <Switch
                    checked={metricsForm.hasProduct}
                    onCheckedChange={(checked) => setMetricsForm({
                      ...metricsForm,
                      hasProduct: checked
                    })}
                  />
                </div>

                {/* 成交數 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-purple-500" />
                    總成交數
                  </Label>
                  <Input
                    type="number"
                    placeholder="透過 Threads 帶來的成交數"
                    value={metricsForm.totalSales || ''}
                    onChange={(e) => setMetricsForm({
                      ...metricsForm,
                      totalSales: parseInt(e.target.value) || 0
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    透過 Threads 引流帶來的實際成交數量
                  </p>
                </div>

                {/* 當前數據摘要 */}
                {metrics && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground mb-2">當前自動計算的數據：</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>平均觸及：{metrics.avgReach || 0}</div>
                      <div>互動率：{((metrics.avgEngagementRate || 0) / 100).toFixed(1)}%</div>
                      <div>週發文數：{metrics.postFrequency || 0}</div>
                      <div>總發文數：{metrics.totalPosts || 0}</div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      以上數據由戰報自動計算，無需手動輸入
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleSaveMetrics} 
                  className="w-full"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      更新中...
                    </>
                  ) : (
                    '儲存並重新計算階段'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

const quickActions = [
  {
    icon: PenTool,
    title: "寫新貼文",
    description: "使用 AI 產出內容",
    path: "/writing-studio",
    bgColor: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: CheckCircle,
    title: "文案健檢",
    description: "優化現有文案",
    path: "/optimize",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: MessageSquare,
    title: "互動任務",
    description: "完成今日互動",
    path: "/tasks",
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: BarChart3,
    title: "查看戰報",
    description: "分析內容成效",
    path: "/reports",
    bgColor: "bg-rose-500/10",
    iconColor: "text-rose-500",
  },
];
