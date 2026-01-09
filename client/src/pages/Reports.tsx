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
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileText,
  Flame,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Reports() {
  const utils = trpc.useUtils();
  const { data: posts, isLoading } = trpc.post.list.useQuery();
  const { data: weeklyReport, isLoading: reportLoading } = trpc.post.weeklyReport.useQuery();
  
  const [newPostUrl, setNewPostUrl] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  // 新增貼文時的數據
  const [newMetrics, setNewMetrics] = useState({
    reach: 0,
    likes: 0,
    comments: 0,
    reposts: 0,
    saves: 0,
  });
  // 新增貼文時的深度分析欄位
  const [newPostDate, setNewPostDate] = useState<string>('');
  const [newPostingTime, setNewPostingTime] = useState<'' | 'morning' | 'noon' | 'evening' | 'night'>('');
  const [newTopComment, setNewTopComment] = useState('');
  const [newSelfReflection, setNewSelfReflection] = useState('');
  const [newIsViral, setNewIsViral] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
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
    isViral: false, // 爆文標記
  });

  const createPost = trpc.post.create.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.weeklyReport.invalidate();
      setNewPostUrl("");
      setNewPostContent("");
      setNewMetrics({ reach: 0, likes: 0, comments: 0, reposts: 0, saves: 0 });
      // 重置深度分析欄位
      setNewPostDate('');
      setNewPostingTime('');
      setNewTopComment('');
      setNewSelfReflection('');
      setNewIsViral(false);
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
        isViral: false,
      });
      toast.success("數據已更新！");
    },
  });

  const deletePost = trpc.post.delete.useMutation({
    onSuccess: () => {
      utils.post.list.invalidate();
      utils.post.weeklyReport.invalidate();
      toast.success("貼文記錄已刪除");
    },
    onError: () => {
      toast.error("刪除失敗，請稍後再試");
    },
  });

  // 策略總結狀態
  const [strategySummary, setStrategySummary] = useState<{
    summary: string | null;
    stats: {
      totalPosts: number;
      avgReach: number;
      viralCount: number;
      bestPostingTime: string | null;
    };
  } | null>(null);
  const [showStrategySummary, setShowStrategySummary] = useState(false);

  // 生成策略總結 mutation
  const generateStrategySummary = trpc.post.generateStrategySummary.useMutation({
    onSuccess: (data) => {
      if (data.success && data.stats) {
        setStrategySummary({
          summary: data.summary,
          stats: data.stats,
        });
        setShowStrategySummary(true);
        toast.success("策略總結已生成！");
      } else {
        toast.error(data.error || "生成失敗");
      }
    },
    onError: (error) => {
      toast.error(error.message || "生成失敗，請稍後再試");
    },
  });

  // 爆文標記 mutation
  const markAsViral = trpc.post.markAsViral.useMutation({

    onSuccess: (data) => {
      utils.post.list.invalidate();
      utils.post.weeklyReport.invalidate();
      if (data.isViral) {
        toast.success("🔥 已標記為爆文，AI 正在分析成功原因...");
        if (data.viralAnalysis) {
          setTimeout(() => {
            toast.success("爆文分析完成！點擊展開查看詳情");
          }, 1500);
        }
      } else {
        toast.success("已取消爆文標記");
      }
    },
    onError: () => {
      toast.error("標記失敗，請稍後再試");
    },
  });



  const handleCreatePost = () => {
    if (!newPostUrl.trim()) {
      toast.error("請輸入貼文連結");
      return;
    }
    createPost.mutate({ 
      threadUrl: newPostUrl,
      content: newPostContent || undefined,
      postedAt: newPostDate ? new Date(newPostDate) : undefined,
      metrics: (newMetrics.reach || newMetrics.likes || newMetrics.comments || newMetrics.reposts || newMetrics.saves) 
        ? newMetrics 
        : undefined,
      // 深度分析欄位
      postingTime: newPostingTime || undefined,
      topComment: newTopComment || undefined,
      selfReflection: newSelfReflection || undefined,
      isViral: newIsViral || undefined,
    });
  };

  const handleDeletePost = (postId: number) => {
    if (confirm("確定要刪除這筆貼文記錄嗎？")) {
      deletePost.mutate({ postId });
    }
  };

  const toggleExpand = (postId: number) => {
    setExpandedPostId(expandedPostId === postId ? null : postId);
  };

  // 獲取貼文標題（前 20 字）
  const getPostTitle = (post: any) => {
    // 如果有關聯的草稿，嘗試獲取內文
    if (post.draftPost?.body) {
      const body = post.draftPost.body;
      return body.length > 25 ? body.substring(0, 25) + '...' : body;
    }
    // 否則顯示連結
    return '查看貼文';
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
      isViral: metrics.isViral || undefined,
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
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>記錄新貼文</DialogTitle>
                <DialogDescription>
                  輸入 Threads 連結或直接貼上貼文內文
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Threads 連結 */}
                <div className="space-y-2">
                  <Label>貼文連結 *</Label>
                  <Input
                    placeholder="https://www.threads.net/..."
                    value={newPostUrl}
                    onChange={(e) => setNewPostUrl(e.target.value)}
                  />
                </div>

                {/* 貼文內文 */}
                <div className="space-y-2">
                  <Label>貼文內文</Label>
                  <textarea
                    placeholder="貼上你的貼文內文..."
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                </div>

                {/* 發文日期 */}
                <div className="space-y-2">
                  <Label>發文日期</Label>
                  <Input
                    type="date"
                    value={newPostDate}
                    onChange={(e) => setNewPostDate(e.target.value)}
                  />
                </div>

                {/* 互動數據 */}
                <div className="space-y-2">
                  <Label>互動數據</Label>
                  <div className="grid grid-cols-5 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">觸及</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newMetrics.reach || ''}
                        onChange={(e) => setNewMetrics(prev => ({ ...prev, reach: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">愛心</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newMetrics.likes || ''}
                        onChange={(e) => setNewMetrics(prev => ({ ...prev, likes: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">留言</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newMetrics.comments || ''}
                        onChange={(e) => setNewMetrics(prev => ({ ...prev, comments: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">轉發</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newMetrics.reposts || ''}
                        onChange={(e) => setNewMetrics(prev => ({ ...prev, reposts: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">收藏</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newMetrics.saves || ''}
                        onChange={(e) => setNewMetrics(prev => ({ ...prev, saves: parseInt(e.target.value) || 0 }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>

                {/* 深度分析（選填） */}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">📊 深度分析（選填）</p>
                  
                  <div className="space-y-4">
                    {/* 發文時段 */}
                    <div className="space-y-2">
                      <Label>發文時段</Label>
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { value: 'morning' as const, label: '早晨', emoji: '🌅' },
                          { value: 'noon' as const, label: '中午', emoji: '☀️' },
                          { value: 'evening' as const, label: '傍晚', emoji: '🌇' },
                          { value: 'night' as const, label: '晚上', emoji: '🌙' },
                        ].map((time) => (
                          <button
                            key={time.value}
                            type="button"
                            onClick={() => setNewPostingTime(newPostingTime === time.value ? '' : time.value)}
                            className={`p-2 rounded-lg border text-center transition-all ${
                              newPostingTime === time.value
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
                        value={newTopComment}
                        onChange={(e) => setNewTopComment(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">幫助 AI 了解什麼內容最能引起共鳴</p>
                    </div>

                    {/* 自我反思 */}
                    <div className="space-y-2">
                      <Label>自我反思</Label>
                      <Input
                        placeholder="你覺得這篇什麼有效？什麼可以改進？"
                        value={newSelfReflection}
                        onChange={(e) => setNewSelfReflection(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">你的觀察會幫助 AI 更了解你的風格</p>
                    </div>

                    {/* 爆文標記 */}
                    <div className="space-y-2">
                      <Label>爆文標記</Label>
                      <button
                        type="button"
                        onClick={() => setNewIsViral(!newIsViral)}
                        className={`w-full p-3 rounded-lg border text-center transition-all ${
                          newIsViral
                            ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-500'
                            : 'bg-background border-border hover:border-orange-500/50'
                        }`}
                      >
                        <span className="text-lg">🔥</span>
                        <p className="text-sm mt-1 font-medium">
                          {newIsViral ? '✅ 已標記為爆文' : '點擊標記為爆文'}
                        </p>
                        <p className="text-xs mt-1 opacity-80">
                          {newIsViral 
                            ? 'AI 將分析這篇貼文的成功原因' 
                            : '如果這篇表現特別好，標記它讓 AI 學習'}
                        </p>
                      </button>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={handleCreatePost} 
                  className="w-full"
                  disabled={!newPostUrl.trim() || createPost.isPending}
                >
                  {createPost.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      記錄中...
                    </>
                  ) : (
                    '記錄貼文'
                  )}
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
          <CardContent className="space-y-6">
            {reportLoading ? (
              <div className="grid gap-4 md:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : (
              <>
                {/* 數據總覽 */}
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

              </>
            )}
          </CardContent>
        </Card>

        {/* 策略總結區塊 */}
        <Card className="elegant-card bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI 策略總結
              </CardTitle>
              <Button
                onClick={() => generateStrategySummary.mutate()}
                disabled={generateStrategySummary.isPending || !posts || posts.length < 5}
                variant="outline"
                size="sm"
              >
                {generateStrategySummary.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    生成策略總結
                  </>
                )}
              </Button>
            </div>
            <CardDescription>
              根據你的貼文數據，AI 會分析並給出個人化的經營建議
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!posts || posts.length < 5 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>需要至少 5 篇貼文數據才能生成策略總結</p>
                <p className="text-sm mt-2">目前有 {posts?.length || 0} 篇貼文</p>
              </div>
            ) : showStrategySummary && strategySummary ? (
              <div className="space-y-6">
                {/* 統計摘要表格 */}
                <div className="overflow-hidden rounded-xl border border-purple-200/50">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-purple-100/50">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-purple-800">指標</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-purple-800">數値</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-purple-800">說明</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-purple-100">
                      <tr className="bg-white/50 hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">📊 分析貼文數</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-purple-600">{strategySummary.stats.totalPosts}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">納入分析的貼文總數</td>
                      </tr>
                      <tr className="bg-white/50 hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">👁️ 平均觸及</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-blue-600">{strategySummary.stats.avgReach.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">每篇貼文平均觸及人數</td>
                      </tr>
                      <tr className="bg-white/50 hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">🔥 爆文數</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-orange-600">{strategySummary.stats.viralCount}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">表現特別突出的貼文</td>
                      </tr>
                      <tr className="bg-white/50 hover:bg-purple-50/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">⏰ 最佳時段</td>
                        <td className="px-4 py-3 text-right text-lg font-bold text-emerald-600">
                          {strategySummary.stats.bestPostingTime === 'morning' && '早上 6-12點'}
                          {strategySummary.stats.bestPostingTime === 'noon' && '中午 12-14點'}
                          {strategySummary.stats.bestPostingTime === 'evening' && '晚上 18-22點'}
                          {strategySummary.stats.bestPostingTime === 'night' && '深夜 22-2點'}
                          {!strategySummary.stats.bestPostingTime && '待分析'}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">表現最佳的發文時段</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* AI 策略建議 */}
                {strategySummary.summary && (
                  <div className="rounded-xl border border-purple-200/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3">
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        AI 策略分析報告
                      </p>
                    </div>
                    <div className="p-5 bg-white/50">
                      <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {strategySummary.summary}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>點擊「生成策略總結」讓 AI 分析你的貼文數據</p>
                <p className="text-sm mt-2">目前有 {posts?.length || 0} 篇貼文可供分析</p>
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
                {posts.map((post) => {
                  const metrics = (post as any).metrics?.[0];
                  const hasMetrics = metrics && (metrics.reach > 0 || metrics.likes > 0 || metrics.comments > 0);
                  
                  return (
                  <div 
                    key={post.id}
                    className="rounded-xl border border-border/50 hover:border-primary/30 transition-all overflow-hidden"
                  >
                    {/* 主要內容區 */}
                    <div className="p-4">
                      {/* 第一行：標題、日期、爆文徽章 */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => toggleExpand(post.id)}
                            className="text-base font-medium text-foreground hover:text-primary transition-colors text-left line-clamp-2"
                          >
                            {getPostTitle(post)}
                          </button>
                          <div className="flex items-center gap-2 mt-1">
                            <a 
                              href={post.threadUrl || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline flex items-center gap-1"
                            >
                              <Link className="w-3 h-3" />
                              查看原文
                            </a>
                            <span className="text-xs text-muted-foreground">
                              {post.postedAt ? format(new Date(post.postedAt), 'yyyy/MM/dd', { locale: zhTW }) : '-'}
                            </span>
                            {/* 爆文徽章 */}
                            {metrics?.isViral && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-orange-500 to-red-500 text-white">
                                <Flame className="w-3 h-3" />
                                爆文
                              </span>
                            )}
                          </div>
                        </div>
                        
                        {/* 展開/收合按鈕 */}
                        <button
                          onClick={() => toggleExpand(post.id)}
                          className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 hover:bg-muted transition-colors"
                        >
                          {expandedPostId === post.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </button>
                      </div>
                      
                      {/* 第二行：數據摘要 */}
                      {hasMetrics ? (
                        <div className="flex items-center gap-4 mb-3 py-2 px-3 bg-muted/30 rounded-lg">
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">{metrics?.reach || 0}</span>
                            <span className="text-xs text-muted-foreground">觸及</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-4 h-4 text-pink-500" />
                            <span className="text-sm font-medium">{metrics?.likes || 0}</span>
                            <span className="text-xs text-muted-foreground">愛心</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium">{metrics?.comments || 0}</span>
                            <span className="text-xs text-muted-foreground">留言</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Bookmark className="w-4 h-4 text-purple-500" />
                            <span className="text-sm font-medium">{metrics?.saves || 0}</span>
                            <span className="text-xs text-muted-foreground">收藏</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 mb-3 py-2 px-3 bg-muted/20 rounded-lg">
                          <span className="text-xs text-muted-foreground">尚未記錄數據，點擊「更新數據」來新增</span>
                        </div>
                      )}

                      {/* 第三行：操作按鈕 */}
                      <div className="flex items-center gap-2">
                        {/* 爆文標記按鈕 */}
                        <Button
                          size="sm"
                          variant={(post as any).metrics?.[0]?.isViral ? "default" : "outline"}
                          className={(post as any).metrics?.[0]?.isViral 
                            ? "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 border-0" 
                            : ""}
                          onClick={() => {
                            const currentIsViral = (post as any).metrics?.[0]?.isViral || false;
                            markAsViral.mutate({ postId: post.id, isViral: !currentIsViral });
                          }}
                          disabled={markAsViral.isPending}
                        >
                          {markAsViral.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Flame className="w-4 h-4 mr-1" />
                              {(post as any).metrics?.[0]?.isViral ? '已標記' : '標記爆文'}
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openMetricsDialog(post.id)}
                        >
                          更新數據
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeletePost(post.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* 展開的詳細區 */}
                    {expandedPostId === post.id && (
                      <div className="px-4 pb-4 pt-0 space-y-4">
                        {/* 貼文內文 */}
                        {(post as any).draftPost?.body && (
                          <div className="bg-muted/50 rounded-lg p-4 ml-14">
                            <p className="text-sm font-medium mb-2">貼文內文</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {(post as any).draftPost.body}
                            </p>
                          </div>
                        )}
                        
                        {/* 互動數據總覽 */}
                        {(post as any).metrics && (post as any).metrics.length > 0 && (
                          <div className="bg-primary/5 rounded-lg p-4 ml-14">
                            <p className="text-sm font-medium mb-3">最新數據</p>
                            <div className="grid grid-cols-5 gap-4">
                              <div className="text-center">
                                <Eye className="w-4 h-4 mx-auto mb-1 text-blue-500" />
                                <p className="text-lg font-bold">{(post as any).metrics[0]?.reach || 0}</p>
                                <p className="text-xs text-muted-foreground">觸及</p>
                              </div>
                              <div className="text-center">
                                <Heart className="w-4 h-4 mx-auto mb-1 text-pink-500" />
                                <p className="text-lg font-bold">{(post as any).metrics[0]?.likes || 0}</p>
                                <p className="text-xs text-muted-foreground">愛心</p>
                              </div>
                              <div className="text-center">
                                <MessageSquare className="w-4 h-4 mx-auto mb-1 text-green-500" />
                                <p className="text-lg font-bold">{(post as any).metrics[0]?.comments || 0}</p>
                                <p className="text-xs text-muted-foreground">留言</p>
                              </div>
                              <div className="text-center">
                                <Share2 className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                                <p className="text-lg font-bold">{(post as any).metrics[0]?.reposts || 0}</p>
                                <p className="text-xs text-muted-foreground">轉發</p>
                              </div>
                              <div className="text-center">
                                <Bookmark className="w-4 h-4 mx-auto mb-1 text-purple-500" />
                                <p className="text-lg font-bold">{(post as any).metrics[0]?.saves || 0}</p>
                                <p className="text-xs text-muted-foreground">收藏</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* 爆文分析 */}
                        {(post as any).metrics?.[0]?.isViral && (post as any).metrics?.[0]?.viralAnalysis && (
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 ml-14">
                            <div className="flex items-center gap-2 mb-2">
                              <Flame className="w-4 h-4 text-orange-600" />
                              <p className="text-sm font-medium text-orange-800 dark:text-orange-200">🔥 爆文成功分析</p>
                            </div>
                            <p className="text-sm text-orange-900 dark:text-orange-100 whitespace-pre-wrap">
                              {(post as any).metrics[0].viralAnalysis}
                            </p>
                          </div>
                        )}
                        
                        {/* AI 洞察 */}
                        {(post as any).metrics?.[0]?.aiInsight && (
                          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 ml-14">
                            <div className="flex items-center gap-2 mb-2">
                              <TrendingUp className="w-4 h-4 text-amber-600" />
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">AI 策略建議</p>
                            </div>
                            <p className="text-sm text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                              {(post as any).metrics[0].aiInsight}
                            </p>
                          </div>
                        )}
                        
                        {/* 自我反思 */}
                        {(post as any).metrics?.[0]?.selfReflection && (
                          <div className="bg-muted/30 rounded-lg p-4 ml-14">
                            <p className="text-sm font-medium mb-2">自我反思</p>
                            <p className="text-sm text-muted-foreground">
                              {(post as any).metrics[0].selfReflection}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
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

                  {/* 爆文標記 */}
                  <div className="space-y-2">
                    <Label>爆文標記</Label>
                    <button
                      type="button"
                      onClick={() => setMetrics({ ...metrics, isViral: !metrics.isViral })}
                      className={`w-full p-3 rounded-lg border text-center transition-all ${
                        metrics.isViral
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-500'
                          : 'bg-background border-border hover:border-orange-500/50'
                      }`}
                    >
                      <span className="text-lg">🔥</span>
                      <p className="text-sm mt-1 font-medium">
                        {metrics.isViral ? '✅ 已標記為爆文' : '點擊標記為爆文'}
                      </p>
                      <p className="text-xs mt-1 opacity-80">
                        {metrics.isViral 
                          ? 'AI 將分析這篇貼文的成功原因' 
                          : '如果這篇表現特別好，標記它讓 AI 學習'}
                      </p>
                    </button>
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
