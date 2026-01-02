import { useState } from "react";
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
  User,
  FileText,
  Target,
  Calendar,
  Tag,
  Edit,
  Eye,
  ChevronRight,
  BarChart3,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  const handleViewDetail = (studentId: number) => {
    setLocation(`/coach/students/${studentId}`);
  };

  const handleViewReports = (studentId: number) => {
    setLocation(`/coach/reports?userId=${studentId}`);
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
              點擊學員可查看詳細資料和學習進度
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
                      <TableRow key={student.id} className="hover:bg-muted/30">
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
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${
                                  student.ipCompleteness >= 80 ? 'bg-emerald-500' :
                                  student.ipCompleteness >= 50 ? 'bg-amber-500' : 'bg-red-400'
                                }`}
                                style={{ width: `${student.ipCompleteness}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">{student.ipCompleteness}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-medium">{student.postCount}</span>
                        </TableCell>
                        <TableCell>
                          {student.latestPostDate ? (
                            <div className="text-sm">
                              <p>{format(new Date(student.latestPostDate), 'MM/dd', { locale: zhTW })}</p>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(student.id)}
                              title="查看詳情"
                            >
                              <ChevronRight className="w-4 h-4" />
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
                <option value="第四期">第四期</option>
                <option value="第五期">第五期</option>
                <option value="第六期">第六期</option>
                <option value="第七期">第七期</option>
                <option value="第八期">第八期</option>
                {editForm.cohort && !['第四期', '第五期', '第六期', '第七期', '第八期'].includes(editForm.cohort) && (
                  <option value={editForm.cohort}>{editForm.cohort}</option>
                )}
              </select>
              <p className="text-xs text-muted-foreground">
                如需自訂期別，請在創建邀請碼時設定
              </p>
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
    </DashboardLayout>
  );
}
