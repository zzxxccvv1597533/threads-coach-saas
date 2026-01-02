import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  FileText, 
  Search,
  Filter,
  User,
  ExternalLink,
  Eye,
  TrendingUp,
  Heart,
  MessageSquare,
  Repeat,
  Bookmark,
  Zap,
  Calendar,
  Users,
  ChevronLeft,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type Report = {
  postId: number;
  userId: number;
  userName: string;
  userEmail: string;
  cohort: string;
  threadsHandle: string;
  threadUrl: string | null;
  postedAt: Date | null;
  createdAt: Date;
  reach: number;
  likes: number;
  comments: number;
  reposts: number;
  saves: number;
  profileVisits: number;
  linkClicks: number;
  inquiries: number;
  notes: string;
  postingTime: string;
  topComment: string;
  selfReflection: string;
  aiInsight: string;
  performanceLevel: 'hit' | 'normal' | 'low';
  isViral: boolean;
  viralAnalysis: string;
};

export default function CoachReports() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlParams = new URLSearchParams(searchParams);
  const initialUserId = urlParams.get('userId');
  
  const [selectedCohort, setSelectedCohort] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || "");
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // 取得期別列表
  const { data: cohorts } = trpc.admin.getCohorts.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  // 取得學員列表（用於篩選）
  const { data: students } = trpc.admin.getStudents.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  // 取得戰報列表
  const { data: reportsData, isLoading } = trpc.admin.getStudentReports.useQuery(
    {
      cohort: selectedCohort || undefined,
      userId: selectedUserId ? parseInt(selectedUserId) : undefined,
      limit: 100,
    },
    {
      enabled: user?.role === 'admin',
    }
  );

  // 取得戰報詳情
  const { data: reportDetail, isLoading: detailLoading } = trpc.admin.getReportDetail.useQuery(
    { postId: selectedReport?.postId || 0 },
    {
      enabled: !!selectedReport?.postId && detailDialogOpen,
    }
  );

  // 如果不是管理員，重定向
  if (user && user.role !== 'admin') {
    setLocation('/dashboard');
    return null;
  }

  const reports = reportsData?.reports || [];
  const totalReports = reportsData?.total || 0;

  const handleViewDetail = (report: Report) => {
    setSelectedReport(report);
    setDetailDialogOpen(true);
  };

  const getPerformanceBadge = (level: string) => {
    switch (level) {
      case 'hit':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><Zap className="w-3 h-3 mr-1" />爆文</Badge>;
      case 'low':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-600"><TrendingUp className="w-3 h-3 mr-1" />低迷</Badge>;
      default:
        return <Badge variant="outline">正常</Badge>;
    }
  };

  // 計算統計
  const stats = {
    totalReports: reports.length,
    viralCount: reports.filter(r => r.isViral).length,
    avgReach: reports.length > 0 
      ? Math.round(reports.reduce((sum, r) => sum + r.reach, 0) / reports.length)
      : 0,
    avgEngagement: reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + r.likes + r.comments, 0) / reports.length)
      : 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setLocation('/coach/students')}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回學員管理
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">戰報總覽</h1>
              <p className="text-muted-foreground mt-1">
                查看所有學員的戰報分析，追蹤學習進度
              </p>
            </div>
          </div>
        </div>

        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalReports}</p>
                  <p className="text-sm text-muted-foreground">總戰報數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.viralCount}</p>
                  <p className="text-sm text-muted-foreground">爆文數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Eye className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgReach}</p>
                  <p className="text-sm text-muted-foreground">平均觸及</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgEngagement}</p>
                  <p className="text-sm text-muted-foreground">平均互動</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 篩選器 */}
        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
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
              <div className="w-full md:w-64">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <User className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="篩選學員" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部學員</SelectItem>
                    {students?.map((student: any) => (
                      <SelectItem key={student.id} value={student.id.toString()}>
                        {student.name || student.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(selectedCohort || selectedUserId) && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedCohort("");
                    setSelectedUserId("");
                  }}
                >
                  清除篩選
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 戰報列表 */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              戰報列表
              <Badge variant="secondary" className="ml-2">
                共 {totalReports} 筆
              </Badge>
            </CardTitle>
            <CardDescription>
              點擊查看詳細的戰報內容和分析
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : reports.length > 0 ? (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[180px]">學員</TableHead>
                      <TableHead>期別</TableHead>
                      <TableHead>發文日期</TableHead>
                      <TableHead className="text-center">觸及</TableHead>
                      <TableHead className="text-center">愛心</TableHead>
                      <TableHead className="text-center">留言</TableHead>
                      <TableHead className="text-center">轉發</TableHead>
                      <TableHead className="text-center">收藏</TableHead>
                      <TableHead>表現</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report: Report) => (
                      <TableRow key={report.postId} className="hover:bg-muted/30">
                        <TableCell>
                          <div>
                            <p className="font-medium">{report.userName}</p>
                            {report.threadsHandle && (
                              <p className="text-xs text-muted-foreground">@{report.threadsHandle}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {report.cohort ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                              {report.cohort}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {report.postedAt ? (
                            <span className="text-sm">
                              {format(new Date(report.postedAt), 'MM/dd HH:mm', { locale: zhTW })}
                            </span>
                          ) : (
                            <span className="text-sm">
                              {format(new Date(report.createdAt), 'MM/dd HH:mm', { locale: zhTW })}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-medium">{report.reach}</TableCell>
                        <TableCell className="text-center">
                          <span className="text-pink-500">{report.likes}</span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-blue-500">{report.comments}</span>
                        </TableCell>
                        <TableCell className="text-center">{report.reposts}</TableCell>
                        <TableCell className="text-center">{report.saves}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {report.isViral && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                <Zap className="w-3 h-3" />
                              </Badge>
                            )}
                            {getPerformanceBadge(report.performanceLevel)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {report.threadUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => window.open(report.threadUrl!, '_blank')}
                                title="查看原文"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetail(report)}
                              title="查看詳情"
                            >
                              <Eye className="w-4 h-4" />
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
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>沒有找到符合條件的戰報</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 戰報詳情 Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              戰報詳情
            </DialogTitle>
            <DialogDescription>
              {selectedReport?.userName} 的戰報分析
            </DialogDescription>
          </DialogHeader>
          
          {detailLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : reportDetail ? (
            <div className="space-y-6 py-4">
              {/* 學員資訊 */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-medium text-primary">
                    {reportDetail.user?.name?.charAt(0).toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{reportDetail.user?.name || '未命名'}</p>
                  <p className="text-sm text-muted-foreground">{reportDetail.user?.email}</p>
                  {reportDetail.user?.cohort && (
                    <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-600 border-blue-200">
                      {reportDetail.user.cohort}
                    </Badge>
                  )}
                </div>
              </div>

              {/* 數據統計 */}
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Eye className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-bold">{reportDetail.metrics?.reach || 0}</p>
                  <p className="text-xs text-muted-foreground">觸及</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Heart className="w-5 h-5 mx-auto mb-1 text-pink-500" />
                  <p className="text-lg font-bold">{reportDetail.metrics?.likes || 0}</p>
                  <p className="text-xs text-muted-foreground">愛心</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <MessageSquare className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                  <p className="text-lg font-bold">{reportDetail.metrics?.comments || 0}</p>
                  <p className="text-xs text-muted-foreground">留言</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/30">
                  <Bookmark className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                  <p className="text-lg font-bold">{reportDetail.metrics?.saves || 0}</p>
                  <p className="text-xs text-muted-foreground">收藏</p>
                </div>
              </div>

              {/* 貼文內容 */}
              {reportDetail.draftContent && (
                <div>
                  <h4 className="font-medium mb-2">貼文內容</h4>
                  <div className="p-4 rounded-lg bg-muted/30 whitespace-pre-wrap text-sm">
                    {reportDetail.draftContent.body}
                  </div>
                </div>
              )}

              {/* 自我反思 */}
              {reportDetail.metrics?.selfReflection && (
                <div>
                  <h4 className="font-medium mb-2">學員自我反思</h4>
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                    {reportDetail.metrics.selfReflection}
                  </div>
                </div>
              )}

              {/* AI 洞察 */}
              {reportDetail.metrics?.aiInsight && (
                <div>
                  <h4 className="font-medium mb-2">AI 策略洞察</h4>
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    {reportDetail.metrics.aiInsight}
                  </div>
                </div>
              )}

              {/* 爆文分析 */}
              {reportDetail.metrics?.isViral && reportDetail.metrics?.viralAnalysis && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    爆文分析
                  </h4>
                  <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-sm">
                    {reportDetail.metrics.viralAnalysis}
                  </div>
                </div>
              )}

              {/* 最熱門留言 */}
              {reportDetail.metrics?.topComment && (
                <div>
                  <h4 className="font-medium mb-2">最熱門留言</h4>
                  <div className="p-4 rounded-lg bg-muted/30 text-sm italic">
                    "{reportDetail.metrics.topComment}"
                  </div>
                </div>
              )}

              {/* 教練備註 */}
              {reportDetail.user?.coachNote && (
                <div>
                  <h4 className="font-medium mb-2">教練備註</h4>
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 text-sm">
                    {reportDetail.user.coachNote}
                  </div>
                </div>
              )}

              {/* 原文連結 */}
              {reportDetail.post?.threadUrl && (
                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => window.open(reportDetail.post.threadUrl!, '_blank')}
                    className="w-full"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    查看 Threads 原文
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
