import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  FileText, 
  PenTool,
  Trash2,
  Clock,
  CheckCircle,
  Archive,
  Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Drafts() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: drafts, isLoading } = trpc.draft.list.useQuery();
  const { data: contentTypes } = trpc.knowledge.contentTypes.useQuery();
  
  const deleteDraft = trpc.draft.delete.useMutation({
    onSuccess: () => {
      utils.draft.list.invalidate();
      toast.success("草稿已刪除");
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

  const draftCount = drafts?.filter(d => d.status === 'draft').length || 0;
  const publishedCount = drafts?.filter(d => d.status === 'published').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">草稿庫</h1>
            <p className="text-muted-foreground mt-1">
              管理你的所有草稿與已發布內容
            </p>
          </div>
          <Button onClick={() => setLocation('/writing-studio')}>
            <Plus className="w-4 h-4 mr-2" />
            新增草稿
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{draftCount}</p>
                  <p className="text-sm text-muted-foreground">待發布草稿</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{publishedCount}</p>
                  <p className="text-sm text-muted-foreground">已發布</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <PenTool className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{drafts?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">總計</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Draft List */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle>所有草稿</CardTitle>
            <CardDescription>
              點擊草稿可以編輯或查看詳情
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : drafts && drafts.length > 0 ? (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div 
                    key={draft.id}
                    className="group flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer"
                    onClick={() => setLocation(`/drafts/${draft.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(draft.status || 'draft')}
                        <Badge variant="outline" className="text-xs">
                          {getContentTypeName(draft.contentType || '')}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">
                        {draft.body || draft.title || '（無內容）'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {draft.createdAt ? format(new Date(draft.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW }) : '-'}
                      </p>
                    </div>

                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDraft.mutate({ id: draft.id });
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground mb-4">還沒有任何草稿</p>
                <Button onClick={() => setLocation('/writing-studio')}>
                  <Plus className="w-4 h-4 mr-2" />
                  開始寫作
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
