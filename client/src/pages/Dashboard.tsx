import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: ipProfile, isLoading: ipLoading } = trpc.ipProfile.get.useQuery();
  const { data: drafts, isLoading: draftsLoading } = trpc.draft.list.useQuery();
  const { data: tasks, isLoading: tasksLoading } = trpc.task.today.useQuery();
  const { data: weeklyReport, isLoading: reportLoading } = trpc.post.weeklyReport.useQuery();

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
