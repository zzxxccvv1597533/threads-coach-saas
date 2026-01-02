import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  Users, 
  Search,
  Filter,
  FileText,
  Tag,
  Edit,
  ChevronRight,
  BarChart3,
  Download,
  CheckSquare,
  Square,
  Minus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { BatchActionBar } from "@/components/BatchActionBar";

type Student = {
  id: number;
  name: string | null;
  email: string;
  cohort: string | null;
  threadsHandle: string | null;
  coachNote: string | null;
  coachTags: string[];
  activatedAt: Date | null;
  expiresAt: Date | null;
  lastSignedIn: Date;
  postCount: number;
  latestPostDate: Date | null;
  latestPostReach: number;
  ipCompleteness: number;
};

const DEFAULT_COHORTS = ["第四期", "第五期", "第六期", "第七期", "第八期"];

export default function CoachStudents() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState({
    cohort: "",
    threadsHandle: "",
    coachNote: "",
    coachTags: "",
  });

  // 批次操作對話框
  const [batchCohortDialogOpen, setBatchCohortDialogOpen] = useState(false);
  const [batchTagsDialogOpen, setBatchTagsDialogOpen] = useState(false);
  const [batchCohort, setBatchCohort] = useState("");
  const [batchTags, setBatchTags] = useState("");

  // 取得期別列表
  const { data: cohorts } = trpc.admin.getCohorts.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  // 取得學員列表
  const { data: students, isLoading } = trpc.admin.getStudents.useQuery(
    {
      cohort: selectedCohort || undefined,
      search: searchTerm || undefined,
    },
    {
      enabled: user?.role === 'admin',
    }
  );

  // 多選功能
  const {
    selectedIds,
    isSelected,
    toggle,
    toggleAll,
    deselectAll,
    isAllSelected,
    isSomeSelected,
    selectedCount,
  } = useMultiSelect({
    items: students || [],
    getItemId: (student) => student.id,
  });

  const updateStudentMutation = trpc.admin.updateStudentInfo.useMutation({
    onSuccess: () => {
      toast.success("學員資料已更新");
      utils.admin.getStudents.invalidate();
      setEditDialogOpen(false);
      setSelectedStudent(null);
    },
    onError: (error) => {
      toast.error("更新失敗：" + error.message);
    },
  });

  // 批次設定期別
  const batchSetCohortMutation = trpc.admin.batchSetCohort.useMutation({
    onSuccess: (data) => {
      toast.success(`已為 ${data.count} 位學員設定期別`);
      utils.admin.getStudents.invalidate();
      setBatchCohortDialogOpen(false);
      setBatchCohort("");
      deselectAll();
    },
    onError: (error) => {
      toast.error("批次設定失敗：" + error.message);
    },
  });

  // 批次新增標籤
  const batchAddTagsMutation = trpc.admin.batchAddTags.useMutation({
    onSuccess: (data) => {
      toast.success(`已為 ${data.count} 位學員新增標籤`);
      utils.admin.getStudents.invalidate();
      setBatchTagsDialogOpen(false);
      setBatchTags("");
      deselectAll();
    },
    onError: (error) => {
      toast.error("批次新增失敗：" + error.message);
    },
  });

  // 匯出學員資料
  const { refetch: exportStudents, isFetching: isExporting } = trpc.admin.exportStudents.useQuery(
    { userIds: Array.from(selectedIds) as number[] },
    { enabled: false }
  );

  // 如果不是管理員，重定向
  if (user && user.role !== 'admin') {
    setLocation('/dashboard');
    return null;
  }

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditForm({
      cohort: student.cohort || "",
      threadsHandle: student.threadsHandle || "",
      coachNote: student.coachNote || "",
      coachTags: student.coachTags?.join(", ") || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedStudent) return;
    updateStudentMutation.mutate({
      userId: selectedStudent.id,
      cohort: editForm.cohort || null,
      threadsHandle: editForm.threadsHandle || null,
      coachNote: editForm.coachNote || null,
      coachTags: editForm.coachTags 
        ? editForm.coachTags.split(",").map(t => t.trim()).filter(t => t)
        : null,
    });
  };

  const handleViewReports = (studentId: number) => {
    setLocation(`/coach/reports?userId=${studentId}`);
  };

  const handleBatchSetCohort = () => {
    if (selectedCount === 0) return;
    batchSetCohortMutation.mutate({
      userIds: Array.from(selectedIds) as number[],
      cohort: batchCohort || null,
    });
  };

  const handleBatchAddTags = () => {
    if (selectedCount === 0 || !batchTags.trim()) return;
    const tags = batchTags.split(",").map(t => t.trim()).filter(t => t);
    if (tags.length === 0) return;
    batchAddTagsMutation.mutate({
      userIds: Array.from(selectedIds) as number[],
      tags,
    });
  };

  const handleExport = async () => {
    if (selectedCount === 0) return;
    const result = await exportStudents();
    if (result.data) {
      // 轉換為 CSV
      const headers = ['ID', '姓名', 'Email', '期別', 'Threads帳號', '教練備註', '標籤', '開通時間', '到期時間', '最後登入'];
      const rows = result.data.map((s: any) => [
        s.id,
        s.name || '',
        s.email || '',
        s.cohort || '',
        s.threadsHandle || '',
        s.coachNote || '',
        Array.isArray(s.coachTags) ? s.coachTags.join(';') : '',
        s.activatedAt ? format(new Date(s.activatedAt), 'yyyy-MM-dd HH:mm') : '',
        s.expiresAt ? format(new Date(s.expiresAt), 'yyyy-MM-dd HH:mm') : '',
        s.lastSignedIn ? format(new Date(s.lastSignedIn), 'yyyy-MM-dd HH:mm') : '',
      ]);
      
      const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `學員資料_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`已匯出 ${result.data.length} 筆學員資料`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">學員管理</h1>
            <p className="text-muted-foreground mt-1">
              管理學員資料、標註期別、查看學習進度
            </p>
          </div>
          <Button 
            variant="outline"
            onClick={() => setLocation('/coach/reports')}
          >
            <FileText className="w-4 h-4 mr-2" />
            查看戰報總覽
          </Button>
        </div>

        {/* 篩選器 */}
        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="搜尋學員姓名、Email 或 Threads 帳號..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="篩選期別" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部期別</SelectItem>
                    {cohorts?.map((cohort) => (
                      <SelectItem key={cohort} value={cohort}>
                        {cohort}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedCohort || searchTerm) && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedCohort("");
                    setSearchTerm("");
                  }}
                >
                  清除篩選
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 學員列表 */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              學員列表
              {students && (
                <Badge variant="secondary" className="ml-2">
                  {students.length} 位學員
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              勾選學員可進行批次操作（設定期別、新增標籤、匯出資料）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : students && students.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={toggleAll}
                          aria-label="全選"
                          className={isSomeSelected ? "data-[state=checked]:bg-primary/50" : ""}
                        />
                      </TableHead>
                      <TableHead className="w-[200px]">學員</TableHead>
                      <TableHead>期別</TableHead>
                      <TableHead>Threads</TableHead>
                      <TableHead className="text-center">IP 完成度</TableHead>
                      <TableHead className="text-center">發文數</TableHead>
                      <TableHead>最近發文</TableHead>
                      <TableHead>標籤</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student: Student) => (
                      <TableRow 
                        key={student.id} 
                        className={`hover:bg-muted/30 ${isSelected(student.id) ? 'bg-primary/5' : ''}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected(student.id)}
                            onCheckedChange={() => toggle(student.id)}
                            aria-label={`選擇 ${student.name || student.email}`}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {student.name?.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{student.name || '未命名'}</p>
                              <p className="text-xs text-muted-foreground">{student.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {student.cohort ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                              {student.cohort}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">未設定</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {student.threadsHandle ? (
                            <span className="text-sm">@{student.threadsHandle}</span>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${student.ipCompleteness}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-8">
                              {student.ipCompleteness}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {student.postCount}
                        </TableCell>
                        <TableCell>
                          {student.latestPostDate ? (
                            <div>
                              <p className="text-sm">
                                {format(new Date(student.latestPostDate), 'MM/dd', { locale: zhTW })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                觸及 {student.latestPostReach}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">尚無發文</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {student.coachTags?.slice(0, 2).map((tag, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {student.coachTags && student.coachTags.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{student.coachTags.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(student)}
                              title="編輯標註"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReports(student.id)}
                              title="查看戰報"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>沒有找到符合條件的學員</p>
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
          onClick={() => setBatchCohortDialogOpen(true)}
        >
          <Tag className="w-4 h-4 mr-1" />
          設定期別
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setBatchTagsDialogOpen(true)}
        >
          <Tag className="w-4 h-4 mr-1" />
          新增標籤
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <Download className="w-4 h-4 mr-1" />
          {isExporting ? '匯出中...' : '匯出資料'}
        </Button>
      </BatchActionBar>

      {/* 編輯學員標註 Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              編輯學員標註
            </DialogTitle>
            <DialogDescription>
              {selectedStudent?.name || '學員'} ({selectedStudent?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cohort">期別</Label>
              <select
                id="cohort"
                value={editForm.cohort}
                onChange={(e) => setEditForm({ ...editForm, cohort: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">未設定</option>
                {DEFAULT_COHORTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                {editForm.cohort && !DEFAULT_COHORTS.includes(editForm.cohort) && (
                  <option value={editForm.cohort}>{editForm.cohort}</option>
                )}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threadsHandle">Threads 帳號</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="threadsHandle"
                  placeholder="threads_username"
                  value={editForm.threadsHandle}
                  onChange={(e) => setEditForm({ ...editForm, threadsHandle: e.target.value })}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="coachTags">標籤（用逗號分隔）</Label>
              <Input
                id="coachTags"
                placeholder="例如：積極, 需關注, VIP"
                value={editForm.coachTags}
                onChange={(e) => setEditForm({ ...editForm, coachTags: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coachNote">教練備註</Label>
              <Textarea
                id="coachNote"
                placeholder="記錄學員狀況、學習進度等..."
                value={editForm.coachNote}
                onChange={(e) => setEditForm({ ...editForm, coachNote: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateStudentMutation.isPending}
            >
              {updateStudentMutation.isPending ? "儲存中..." : "儲存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批次設定期別 Dialog */}
      <Dialog open={batchCohortDialogOpen} onOpenChange={setBatchCohortDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>批次設定期別</DialogTitle>
            <DialogDescription>
              為已選擇的 {selectedCount} 位學員設定期別
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="batchCohort">選擇期別</Label>
            <select
              id="batchCohort"
              value={batchCohort}
              onChange={(e) => setBatchCohort(e.target.value)}
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">清除期別</option>
              {DEFAULT_COHORTS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchCohortDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleBatchSetCohort}
              disabled={batchSetCohortMutation.isPending}
            >
              {batchSetCohortMutation.isPending ? "設定中..." : "確認設定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批次新增標籤 Dialog */}
      <Dialog open={batchTagsDialogOpen} onOpenChange={setBatchTagsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>批次新增標籤</DialogTitle>
            <DialogDescription>
              為已選擇的 {selectedCount} 位學員新增標籤
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="batchTags">標籤（用逗號分隔）</Label>
            <Input
              id="batchTags"
              placeholder="例如：積極, 需關注"
              value={batchTags}
              onChange={(e) => setBatchTags(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">
              新標籤會與現有標籤合併，不會覆蓋
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchTagsDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleBatchAddTags}
              disabled={batchAddTagsMutation.isPending || !batchTags.trim()}
            >
              {batchAddTagsMutation.isPending ? "新增中..." : "確認新增"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
