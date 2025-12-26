import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { 
  CheckCircle, 
  Clock,
  MessageSquare,
  Users,
  Search,
  RefreshCw,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Tasks() {
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.task.today.useQuery();
  const { data: taskTypes } = trpc.knowledge.taskTypes.useQuery();
  
  const generateDaily = trpc.task.generateDaily.useMutation({
    onSuccess: () => {
      utils.task.today.invalidate();
      toast.success("今日任務已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  const updateStatus = trpc.task.updateStatus.useMutation({
    onSuccess: () => {
      utils.task.today.invalidate();
    },
  });

  const handleComplete = (taskId: number) => {
    updateStatus.mutate({ id: taskId, status: "done" });
    toast.success("任務完成！");
  };

  const handleSkip = (taskId: number) => {
    updateStatus.mutate({ id: taskId, status: "skipped" });
    toast.info("任務已跳過");
  };

  const taskIcons = {
    reply_comments: MessageSquare,
    comment_others: Users,
    sea_patrol: Search,
  };

  const taskColors = {
    reply_comments: "text-blue-500 bg-blue-500/10",
    comment_others: "text-emerald-500 bg-emerald-500/10",
    sea_patrol: "text-amber-500 bg-amber-500/10",
  };

  const completedCount = tasks?.filter(t => t.status === 'done').length || 0;
  const totalCount = tasks?.length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">互動任務</h1>
            <p className="text-muted-foreground mt-1">
              互動是 Threads 成長的關鍵，每天完成任務建立習慣
            </p>
          </div>
          <Button 
            onClick={() => generateDaily.mutate()}
            disabled={generateDaily.isPending}
          >
            {generateDaily.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                生成今日任務
              </>
            )}
          </Button>
        </div>

        {/* Progress Card */}
        {tasks && tasks.length > 0 && (
          <Card className="elegant-card bg-gradient-to-r from-primary/5 to-accent/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">今日進度</p>
                  <p className="text-2xl font-bold">
                    {completedCount} / {totalCount}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Types Info */}
        <div className="grid gap-4 md:grid-cols-3">
          {taskTypes && Object.entries(taskTypes).map(([key, type]) => {
            const Icon = taskIcons[key as keyof typeof taskIcons];
            const colorClass = taskColors[key as keyof typeof taskColors];
            const taskType = type as {
              name: string;
              description: string;
              timeLevel?: string;
              targetCount?: string;
              tips: string[];
              templates?: string[];
            };
            return (
              <Card key={key} className="elegant-card">
                <CardContent className="pt-6">
                  <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-1">{taskType.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{taskType.description}</p>
                  
                  {/* 時間等級和目標數量 */}
                  <div className="flex gap-2 mb-3">
                    {taskType.timeLevel && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        ⏱️ {taskType.timeLevel}
                      </span>
                    )}
                    {taskType.targetCount && (
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        🎯 {taskType.targetCount}
                      </span>
                    )}
                  </div>
                  
                  {/* 技巧提示 */}
                  <div className="space-y-1 mb-3">
                    {taskType.tips.slice(0, 2).map((tip, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {tip}</p>
                    ))}
                  </div>
                  
                  {/* 模板範例 */}
                  {taskType.templates && taskType.templates.length > 0 && (
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-xs font-medium mb-1">📝 範例句型</p>
                      <p className="text-xs text-muted-foreground italic">
                        「{taskType.templates[0]}」
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Task List */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              今日任務清單
            </CardTitle>
            <CardDescription>
              完成這些任務，讓你的帳號更活躍
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : tasks && tasks.length > 0 ? (
              <div className="space-y-4">
                {tasks.map((task) => {
                  const Icon = taskIcons[task.taskType as keyof typeof taskIcons] || MessageSquare;
                  const colorClass = taskColors[task.taskType as keyof typeof taskColors] || "text-gray-500 bg-gray-500/10";
                  const isDone = task.status === 'done';
                  const isSkipped = task.status === 'skipped';
                  
                  return (
                    <div 
                      key={task.id}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                        isDone 
                          ? 'bg-emerald-50 border-emerald-200' 
                          : isSkipped
                          ? 'bg-muted/50 border-border/50 opacity-60'
                          : 'bg-background border-border/50 hover:border-primary/30'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center shrink-0`}>
                        {isDone ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
                            {taskTypes?.[task.taskType as keyof typeof taskTypes]?.name || task.taskType}
                          </span>
                          {isDone && (
                            <span className="text-xs text-emerald-600 font-medium">已完成</span>
                          )}
                          {isSkipped && (
                            <span className="text-xs text-muted-foreground">已跳過</span>
                          )}
                        </div>
                        <p className={`text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                          {task.taskDetail}
                        </p>
                      </div>

                      {!isDone && !isSkipped && (
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSkip(task.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleComplete(task.id)}
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            完成
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">今天還沒有任務</p>
                <Button onClick={() => generateDaily.mutate()}>
                  <Plus className="w-4 h-4 mr-2" />
                  生成今日任務
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
