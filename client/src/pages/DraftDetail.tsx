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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
  const [showOptimize, setShowOptimize] = useState(false);
  const [optimizeResult, setOptimizeResult] = useState("");
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

  const optimize = trpc.ai.optimize.useMutation({
    onSuccess: (data) => {
      setOptimizeResult(typeof data.result === 'string' ? data.result : '');
      setShowOptimize(true);
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
  const draftBody = draft.body || '';

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
          <div className="flex gap-2">
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
              onClick={() => optimize.mutate({ text: editedBody })}
              disabled={optimize.isPending}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <TrendingUp className="w-4 h-4 mr-2" />
              {optimize.isPending ? "健檢中..." : "文案健檢"}
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
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              刪除
            </Button>
          </div>
        </div>

        {/* Content */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>草稿內容</CardTitle>
            <CardDescription>
              點擊內容區域可以編輯
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={editedBody}
              onChange={(e) => {
                setEditedBody(e.target.value);
                setIsEditing(true);
              }}
              className="min-h-[400px] text-base leading-relaxed"
              placeholder="草稿內容..."
            />
            
            {isEditing && (
              <div className="flex justify-end gap-2 mt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setEditedBody(draftBody);
                    setIsEditing(false);
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleSave} disabled={updateDraft.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {updateDraft.isPending ? "儲存中..." : "儲存變更"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hook 優化器結果 */}
        {showHooks && hooks.length > 0 && (
          <Card className="elegant-card border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    Hook 優化器
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

        {/* 文案健檢結果 */}
        {showOptimize && optimizeResult && (
          <Card className="elegant-card border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    文案健檢結果
                  </CardTitle>
                  <CardDescription>
                    根據 Hook、說人話、CTA、結構四大維度評分
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowOptimize(false)}>
                  收起
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">
                {optimizeResult}
              </div>
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
