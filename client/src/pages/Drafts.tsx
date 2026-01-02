import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  FolderInput,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { BatchActionBar } from "@/components/BatchActionBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Drafts() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: drafts, isLoading } = trpc.draft.list.useQuery();
  const { data: contentTypes } = trpc.knowledge.contentTypes.useQuery();
  
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  // 多選功能
  const {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    deselectAll,
    isAllSelected,
    selectedCount,
  } = useMultiSelect({
    items: drafts || [],
    getItemId: (draft) => draft.id,
  });

  const deleteDraft = trpc.draft.delete.useMutation({
    onSuccess: () => {
      utils.draft.list.invalidate();
      toast.success("草稿已刪除");
    },
  });

  // 批次刪除
  const batchDeleteMutation = trpc.draft.batchDelete.useMutation({
    onSuccess: (data) => {
      toast.success(`已刪除 ${data.count} 篇草稿`);
      utils.draft.list.invalidate();
      deselectAll();
    },
    onError: (error) => {
      toast.error("批次刪除失敗：" + error.message);
    },
  });

  // 批次移動分類
  const batchMoveMutation = trpc.draft.batchMove.useMutation({
    onSuccess: (data) => {
      toast.success(`已移動 ${data.count} 篇草稿`);
      utils.draft.list.invalidate();
      deselectAll();
      setMoveDialogOpen(false);
      setSelectedCategory("");
    },
    onError: (error) => {
      toast.error("批次移動失敗：" + error.message);
    },
  });

  // 批次封存
  const batchArchiveMutation = trpc.draft.batchArchive.useMutation({
    onSuccess: (data) => {
      toast.success(`已封存 ${data.count} 篇草稿`);
      utils.draft.list.invalidate();
      deselectAll();
    },
    onError: (error) => {
      toast.error("批次封存失敗：" + error.message);
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

  const handleBatchDelete = () => {
    if (selectedCount === 0) return;
    if (!confirm(`確定要刪除 ${selectedCount} 篇草稿嗎？此操作無法復原。`)) return;
    batchDeleteMutation.mutate({ ids: Array.from(selectedIds) as number[] });
  };

  const handleBatchArchive = () => {
    if (selectedCount === 0) return;
    batchArchiveMutation.mutate({ ids: Array.from(selectedIds) as number[] });
  };

  const handleBatchMove = () => {
    if (selectedCount === 0 || !selectedCategory) return;
    batchMoveMutation.mutate({ 
      ids: Array.from(selectedIds) as number[], 
      contentType: selectedCategory 
    });
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>所有草稿</CardTitle>
                <CardDescription>
                  勾選草稿可進行批次操作（刪除、移動分類、封存）
                </CardDescription>
              </div>
              {drafts && drafts.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleAll}
                    aria-label="全選"
                  />
                  <span className="text-sm text-muted-foreground">全選</span>
                </div>
              )}
            </div>
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
                    className={`group flex items-start gap-4 p-4 rounded-xl border border-border/50 hover:border-primary/30 hover:bg-muted/30 transition-all ${isSelected(draft.id) ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                  >
                    <div className="flex items-center pt-1">
                      <Checkbox
                        checked={isSelected(draft.id)}
                        onCheckedChange={() => toggle(draft.id)}
                        aria-label={`選擇草稿`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    <div 
                      className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 cursor-pointer"
                      onClick={() => setLocation(`/drafts/${draft.id}`)}
                    >
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    
                    <div 
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setLocation(`/drafts/${draft.id}`)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusBadge(draft.status || 'draft')}
                        <Badge variant="outline" className="text-xs">
                          {getContentTypeName(draft.contentType || '')}
                        </Badge>
                      </div>
                      <p className="text-sm line-clamp-2 mb-2">
                        {(draft.body || draft.title || '（無內容）').replace(/\*\*/g, '')}
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

      {/* 批次操作工具列 */}
      <BatchActionBar selectedCount={selectedCount} onDeselectAll={deselectAll}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMoveDialogOpen(true)}
        >
          <FolderInput className="w-4 h-4 mr-1" />
          移動分類
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchArchive}
          disabled={batchArchiveMutation.isPending}
        >
          <Archive className="w-4 h-4 mr-1" />
          {batchArchiveMutation.isPending ? '封存中...' : '封存'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchDelete}
          disabled={batchDeleteMutation.isPending}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {batchDeleteMutation.isPending ? '刪除中...' : '刪除'}
        </Button>
      </BatchActionBar>

      {/* 移動分類對話框 */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>移動分類</DialogTitle>
            <DialogDescription>
              將選取的 {selectedCount} 篇草稿移動到指定分類
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="選擇目標分類" />
              </SelectTrigger>
              <SelectContent>
                {contentTypes?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleBatchMove}
              disabled={!selectedCategory || batchMoveMutation.isPending}
            >
              {batchMoveMutation.isPending ? '移動中...' : '確認移動'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
