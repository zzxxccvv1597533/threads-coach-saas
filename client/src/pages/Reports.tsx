import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  BarChart3, 
  Plus,
  Eye,
  Heart,
  MessageSquare,
  Bookmark,
  Share2,
  TrendingUp,
  Link,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.post.list.useQuery();
  const { data: weeklyReport, isLoading: reportLoading } = trpc.post.weeklyReport.useQuery();
  
  const [newPostUrl, setNewPostUrl] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [metrics, setMetrics] = useState({
    reach: 0,
    likes: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
    postingTime: '' as '' | 'morning' | 'noon' | 'evening' | 'night',
    topComment: '',
    selfReflection: '',
  });

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      setNewPostUrl("");
      setDialogOpen(false);
      toast.success("貼文已記錄！");
    },
    onError: () => {
      toast.error("記錄失敗，請稍後再試");
    },
  });

  const addMetrics = trpc.post.addMetrics.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.weeklyReport.invalidate();
      setMetricsDialogOpen(false);
      setMetrics({ 
        reach: 0, 
        likes: 0, 
        comments: 0, 
        reposts: 0, 
        saves: 0,
        postingTime: '',
        topComment: '',
        selfReflection: '',
      });
      toast.success("數據已更新！");
    },
  });

  const handleCreatePost = () => {
    if (!newPostUrl.trim()) {
      toast.error("請輸入貼文連結");
      return;
    }
    createPost.mutate({ threadUrl: newPostUrl });
  };

  const handleAddMetrics = () => {
    if (!selectedPostId) return;
    addMetrics.mutate({
      postId: selectedPostId,
      reach: metrics.reach,
      likes: metrics.likes,
      comments: metrics.comments,
      reposts: metrics.reposts,
      saves: metrics.saves,
      postingTime: metrics.postingTime || undefined,
      topComment: metrics.topComment || undefined,
      selfReflection: metrics.selfReflection || undefined,
    });
  };

  const openMetricsDialog = (postId: number) => {
    setSelectedPostId(postId);
    setMetricsDialogOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">戰報分析</h1>
            <p className="text-muted-foreground mt-1">
              追蹤貼文成效，了解什麼內容最有效
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                記錄新貼文
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>記錄新貼文</DialogTitle>
                <DialogDescription>
                  輸入你在 Threads 發布的貼文連結
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>貼文連結</Label>
                  <Input
                    placeholder="https://www.threads.net/..."
                    value={newPostUrl}
                    onChange={(e) => setNewPostUrl(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreatePost} className="w-full">
                  記錄貼文
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Weekly Summary */}
        <Card className="elegant-card bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              本週總覽
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reportLoading ? (
              <div className="grid gap-4 md:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-5">
                <div className="text-center p-4 rounded-lg bg-background/50">
                  <Eye className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{weeklyReport?.summary?.totalReach || 0}</p>
                  <p className="text-xs text-muted-foreground">觸及</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/50">
                  <Heart className="w-5 h-5 mx-auto mb-2 text-rose-500" />
                  <p className="text-2xl font-bold">{weeklyReport?.summary?.totalLikes || 0}</p>
                  <p className="text-xs text-muted-foreground">愛心</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/50">
                  <MessageSquare className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                  <p className="text-2xl font-bold">{weeklyReport?.summary?.totalComments || 0}</p>
                  <p className="text-xs text-muted-foreground">留言</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/50">
                  <Share2 className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold">0</p>
                  <p className="text-xs text-muted-foreground">轉發</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-background/50">
                  <Bookmark className="w-5 h-5 mx-auto mb-2 text-violet-500" />
                  <p className="text-2xl font-bold">{weeklyReport?.summary?.totalSaves || 0}</p>
                  <p className="text-xs text-muted-foreground">收藏</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Post List */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>貼文記錄</CardTitle>
            <CardDescription>
              點擊「更新數據」來記錄最新的互動數據
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : posts && posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div 
                    key={post.id}
                    className="flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/30 transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <a 
                          href={post.threadUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <Link className="w-3 h-3" />
                          查看貼文
                        </a>
                        <span className="text-xs text-muted-foreground">
                          {post.postedAt ? format(new Date(post.postedAt), 'yyyy/MM/dd', { locale: zhTW }) : '-'}
                        </span>
                      </div>
                      
                      <p className="text-xs text-muted-foreground">
                        點擊「更新數據」來記錄最新的互動數據
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openMetricsDialog(post.id)}
                    >
                      更新數據
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">還沒有記錄任何貼文</p>
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  記錄第一篇貼文
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metrics Dialog */}
        <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>更新貼文數據</DialogTitle>
              <DialogDescription>
                輸入最新的互動數據
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* 基本數據 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>觸及</Label>
                  <Input
                    type="number"
                    value={metrics.reach}
                    onChange={(e) => setMetrics({ ...metrics, reach: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>愛心</Label>
                  <Input
                    type="number"
                    value={metrics.likes}
                    onChange={(e) => setMetrics({ ...metrics, likes: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>留言</Label>
                  <Input
                    type="number"
                    value={metrics.comments}
                    onChange={(e) => setMetrics({ ...metrics, comments: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>轉發</Label>
                  <Input
                    type="number"
                    value={metrics.reposts}
                    onChange={(e) => setMetrics({ ...metrics, reposts: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>收藏</Label>
                  <Input
                    type="number"
                    value={metrics.saves}
                    onChange={(e) => setMetrics({ ...metrics, saves: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* 戰報閉環學習欄位 */}
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">📊 深度分析（選填）</p>
                
                <div className="space-y-4">
                  {/* 發文時段 */}
                  <div className="space-y-2">
                    <Label>發文時段</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: 'morning', label: '早晨', emoji: '🌅' },
                        { value: 'noon', label: '中午', emoji: '☀️' },
                        { value: 'evening', label: '傍晚', emoji: '🌇' },
                        { value: 'night', label: '晚上', emoji: '🌙' },
                      ].map((time) => (
                        <button
                          key={time.value}
                          type="button"
                          onClick={() => setMetrics({ 
                            ...metrics, 
                            postingTime: metrics.postingTime === time.value ? '' : time.value as typeof metrics.postingTime 
                          })}
                          className={`p-2 rounded-lg border text-center transition-all ${
                            metrics.postingTime === time.value
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background border-border hover:border-primary/50'
                          }`}
                        >
                          <span className="text-lg">{time.emoji}</span>
                          <p className="text-xs mt-1">{time.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 最熱門留言 */}
                  <div className="space-y-2">
                    <Label>最熱門留言</Label>
                    <Input
                      placeholder="貼上互動最高的留言內容..."
                      value={metrics.topComment}
                      onChange={(e) => setMetrics({ ...metrics, topComment: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">幫助 AI 了解什麼內容最能引起共鳴</p>
                  </div>

                  {/* 自我反思 */}
                  <div className="space-y-2">
                    <Label>自我反思</Label>
                    <Input
                      placeholder="你覺得這篇什麼有效？什麼可以改進？"
                      value={metrics.selfReflection}
                      onChange={(e) => setMetrics({ ...metrics, selfReflection: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">你的觀察會幫助 AI 更了解你的風格</p>
                  </div>
                </div>
              </div>

              <Button onClick={handleAddMetrics} className="w-full">
                儲存數據
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
