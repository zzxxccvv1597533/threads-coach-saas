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
  Flame,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";

// ── Local task type (mirrors server schema) ─────────────────────
interface Task {
  id: number;
  taskType: string;
  taskDetail: string | null;
  status: string | null;
}

// ── Streak helpers ──────────────────────────────────────────────
const STREAK_KEY = "tasks-streak";

interface StreakData {
  count: number;
  lastCompletedDate: string; // "YYYY-MM-DD"
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw) as StreakData;
  } catch {
    // ignore
  }
  return { count: 0, lastCompletedDate: "" };
}

function saveStreak(data: StreakData): void {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

/**
 * Call this when all tasks are just-completed.
 * Returns the new streak count.
 */
function incrementStreak(): number {
  const today = todayStr();
  const yesterday = yesterdayStr();
  const current = loadStreak();

  if (current.lastCompletedDate === today) {
    // Already counted today — return existing count
    return current.count;
  }

  let newCount: number;
  if (current.lastCompletedDate === yesterday) {
    // Consecutive day — extend streak
    newCount = current.count + 1;
  } else {
    // Gap — reset
    newCount = 1;
  }

  saveStreak({ count: newCount, lastCompletedDate: today });
  return newCount;
}

export default function Tasks() {
  const utils = trpc.useUtils();
  const { data: tasks, isLoading } = trpc.task.today.useQuery();
  const { data: taskTypes } = trpc.knowledge.taskTypes.useQuery();

  // ── Gamification state ─────────────────────────────────────────
  const [streak, setStreak] = useState<number>(() => loadStreak().count);
  const [showCelebration, setShowCelebration] = useState(false);

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

  // ── Detect all-done ────────────────────────────────────────────
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    const allDone = tasks.every((t: Task) => t.status === "done");
    if (allDone) {
      const newStreak = incrementStreak();
      setStreak(newStreak);
      setShowCelebration(true);
    } else {
      setShowCelebration(false);
    }
  }, [tasks]);

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

  const completedCount = tasks?.filter((t: Task) => t.status === 'done').length || 0;
  const totalCount = tasks?.length || 0;

  return (
    <DashboardLayout>
      {/* ── Confetti CSS (injected once) ── */}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .confetti-piece {
          position: fixed;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: confetti-fall linear forwards;
          pointer-events: none;
          z-index: 9999;
        }
      `}</style>

      <div className="space-y-6 max-w-4xl">
        {/* ── Header ── */}
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

        {/* ── Streak Badge ── */}
        {streak > 0 && (
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm shadow-md"
            style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
              color: "#fff",
              boxShadow: "0 4px 14px rgba(245,158,11,0.35)",
            }}
          >
            <Flame className="w-4 h-4" />
            連續 {streak} 天完成
          </div>
        )}

        {/* ── Celebration Card ── */}
        {showCelebration && (
          <>
            {/* Confetti particles */}
            {Array.from({ length: 30 }).map((_, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${Math.random() * 100}vw`,
                  top: `-${10 + Math.random() * 20}px`,
                  background: ["#f59e0b","#10b981","#3b82f6","#8b5cf6","#ef4444","#ec4899"][i % 6],
                  animationDuration: `${1.5 + Math.random() * 2}s`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  width: `${6 + Math.floor(Math.random() * 8)}px`,
                  height: `${6 + Math.floor(Math.random() * 8)}px`,
                }}
              />
            ))}

            <Card
              className="elegant-card overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #a7f3d0 100%)",
                border: "1px solid #6ee7b7",
              }}
            >
              <CardContent className="pt-6 text-center space-y-3">
                <div className="text-4xl">🎉</div>
                <p className="text-xl font-bold text-emerald-800">
                  太棒了！今日任務全部完成！🎉
                </p>
                <p className="text-emerald-700 font-medium">
                  已連續 <span className="text-2xl font-bold">{streak}</span> 天完成互動任務
                </p>
                <p className="text-sm text-emerald-600">
                  持續互動是 Threads 成長的關鍵
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Progress Card ── */}
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

        {/* ── Task Types Info ── */}
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

                  <div className="space-y-1 mb-3">
                    {taskType.tips.slice(0, 2).map((tip, i) => (
                      <p key={i} className="text-xs text-muted-foreground">• {tip}</p>
                    ))}
                  </div>

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

        {/* ── Task List ── */}
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
                {tasks.map((task: Task) => {
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