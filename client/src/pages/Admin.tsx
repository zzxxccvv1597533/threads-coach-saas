import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { 
  Users, 
  Crown,
  Activity,
  Shield,
  CheckCircle,
  Clock,
  XCircle,
  UserCheck,
  UserX,
  Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Ticket, Plus, Trash2, Info, Link, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useMultiSelect } from "@/hooks/useMultiSelect";
import { BatchActionBar } from "@/components/BatchActionBar";

type UserWithActivation = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  activationStatus: "pending" | "activated" | "expired" | "rejected";
  activatedAt: Date | null;
  expiresAt: Date | null;
  activationNote: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  invitationBonusDays: number | null;
  createdAt: Date;
};

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  
  const { data: users, isLoading } = trpc.admin.users.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  const [activateDialogOpen, setActivateDialogOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithActivation | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [activationNote, setActivationNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const activateMutation = trpc.admin.activateUser.useMutation({
    onSuccess: () => {
      toast.success("學員已成功開通");
      utils.admin.users.invalidate();
      setActivateDialogOpen(false);
      setSelectedUser(null);
      setExpiryDate("");
      setActivationNote("");
    },
    onError: (error) => {
      toast.error("開通失敗：" + error.message);
    },
  });

  const deactivateMutation = trpc.admin.deactivateUser.useMutation({
    onSuccess: () => {
      toast.success("學員已停用");
      utils.admin.users.invalidate();
      setDeactivateDialogOpen(false);
      setSelectedUser(null);
      setActivationNote("");
    },
    onError: (error) => {
      toast.error("停用失敗：" + error.message);
    },
  });

  const rejectMutation = trpc.admin.rejectUser.useMutation({
    onSuccess: () => {
      toast.success("已拒絕學員申請");
      utils.admin.users.invalidate();
      setRejectDialogOpen(false);
      setSelectedUser(null);
      setRejectionReason("");
    },
    onError: (error) => {
      toast.error("拒絕失敗：" + error.message);
    },
  });

  // 如果不是管理員，重定向
  if (user && user.role !== 'admin') {
    setLocation('/dashboard');
    return null;
  }

  const typedUsers = users as UserWithActivation[] | undefined;
  const totalUsers = typedUsers?.length || 0;
  const adminCount = typedUsers?.filter(u => u.role === 'admin').length || 0;
  const pendingCount = typedUsers?.filter(u => u.activationStatus === 'pending').length || 0;
  const activatedCount = typedUsers?.filter(u => u.activationStatus === 'activated').length || 0;

  const handleActivate = (u: UserWithActivation) => {
    setSelectedUser(u);
    setActivateDialogOpen(true);
  };

  const handleDeactivate = (u: UserWithActivation) => {
    setSelectedUser(u);
    setDeactivateDialogOpen(true);
  };

  const confirmActivate = () => {
    if (!selectedUser) return;
    activateMutation.mutate({
      userId: selectedUser.id,
      expiresAt: expiryDate ? new Date(expiryDate) : undefined,
      note: activationNote || undefined,
    });
  };

  const confirmDeactivate = () => {
    if (!selectedUser) return;
    deactivateMutation.mutate({
      userId: selectedUser.id,
      note: activationNote || undefined,
    });
  };

  const handleReject = (u: UserWithActivation) => {
    setSelectedUser(u);
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!selectedUser) return;
    rejectMutation.mutate({
      userId: selectedUser.id,
      reason: rejectionReason || undefined,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'activated':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />已開通</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />待開通</Badge>;
      case 'expired':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="w-3 h-3 mr-1" />已過期</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="bg-gray-500/10 text-gray-600 border-gray-200"><XCircle className="w-3 h-3 mr-1" />已拒絕</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">管理後台</h1>
          <p className="text-muted-foreground mt-1">
            管理學員開通、查看系統狀態
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-sm text-muted-foreground">總用戶數</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-sm text-muted-foreground">待開通</p>
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
                  <p className="text-2xl font-bold">{activatedCount}</p>
                  <p className="text-sm text-muted-foreground">已開通</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#0F345B]/10 flex items-center justify-center">
                  <Crown className="w-6 h-6 text-[#0F345B]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-sm text-muted-foreground">管理員</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pending" className="space-y-6">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              待開通 ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="activated" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              已開通 ({activatedCount})
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2">
              <Users className="w-4 h-4" />
              全部用戶
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-2">
              <Ticket className="w-4 h-4" />
              邀請碼管理
            </TabsTrigger>
          </TabsList>

          {/* 待開通學員 */}
          <TabsContent value="pending">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  待開通學員
                </CardTitle>
                <CardDescription>
                  這些學員已註冊但尚未開通，請確認付款後開通
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : typedUsers && typedUsers.filter(u => u.activationStatus === 'pending').length > 0 ? (
                  <div className="space-y-3">
                    {typedUsers.filter(u => u.activationStatus === 'pending').map((u) => (
                      <div 
                        key={u.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50"
                      >
                        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <span className="text-lg font-medium text-amber-600">
                            {u.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{u.name || '未命名'}</p>
                            {getStatusBadge(u.activationStatus)}
                            {u.invitationBonusDays && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                                <Ticket className="w-3 h-3 mr-1" />
                                邀請碼 {u.invitationBonusDays} 天
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {u.email || '無 Email'} · 註冊於 {format(new Date(u.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            onClick={() => handleReject(u)}
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            拒絕
                          </Button>
                          <Button 
                            onClick={() => handleActivate(u)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <UserCheck className="w-4 h-4 mr-2" />
                            開通
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>目前沒有待開通的學員</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 已開通學員 */}
          <TabsContent value="activated">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  已開通學員
                </CardTitle>
                <CardDescription>
                  這些學員已開通，可以正常使用系統
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : typedUsers && typedUsers.filter(u => u.activationStatus === 'activated').length > 0 ? (
                  <div className="space-y-3">
                    {typedUsers.filter(u => u.activationStatus === 'activated').map((u) => (
                      <div 
                        key={u.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50"
                      >
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                          <span className="text-lg font-medium text-emerald-600">
                            {u.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{u.name || '未命名'}</p>
                            {getStatusBadge(u.activationStatus)}
                            {u.role === 'admin' && (
                              <Badge variant="secondary" className="gap-1">
                                <Shield className="w-3 h-3" />
                                管理員
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {u.email || '無 Email'}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            {u.activatedAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                開通於 {format(new Date(u.activatedAt), 'yyyy/MM/dd', { locale: zhTW })}
                              </span>
                            )}
                            {u.expiresAt && (
                              <span className="flex items-center gap-1 text-amber-600">
                                <Clock className="w-3 h-3" />
                                到期 {format(new Date(u.expiresAt), 'yyyy/MM/dd', { locale: zhTW })}
                              </span>
                            )}
                          </div>
                        </div>
                        {u.role !== 'admin' && (
                          <Button 
                            variant="outline"
                            onClick={() => handleDeactivate(u)}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <UserX className="w-4 h-4 mr-2" />
                            停用
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>目前沒有已開通的學員</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 全部用戶 */}
          <TabsContent value="all">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  全部用戶
                </CardTitle>
                <CardDescription>
                  查看所有註冊用戶
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : typedUsers && typedUsers.length > 0 ? (
                  <div className="space-y-3">
                    {typedUsers.map((u) => (
                      <div 
                        key={u.id}
                        className="flex items-center gap-4 p-4 rounded-xl border border-border/50"
                      >
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {u.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{u.name || '未命名'}</p>
                            {getStatusBadge(u.activationStatus)}
                            {u.role === 'admin' && (
                              <Badge variant="secondary" className="gap-1">
                                <Shield className="w-3 h-3" />
                                管理員
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {u.email || '無 Email'}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          <p>註冊時間</p>
                          <p>{u.createdAt ? format(new Date(u.createdAt), 'yyyy/MM/dd', { locale: zhTW }) : '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    暫無用戶
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 邀請碼管理 */}
          <TabsContent value="invitations">
            <InvitationManagement />
          </TabsContent>
        </Tabs>
      </div>

      {/* 開通對話框 */}
      <Dialog open={activateDialogOpen} onOpenChange={setActivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>開通學員帳號</DialogTitle>
            <DialogDescription>
              確認要開通 {selectedUser?.name || selectedUser?.email} 的帳號嗎？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="expiry">有效期限（選填）</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="不設定則永久有效"
              />
              <p className="text-xs text-muted-foreground">
                留空表示永久有效
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">備註（選填）</Label>
              <Textarea
                id="note"
                value={activationNote}
                onChange={(e) => setActivationNote(e.target.value)}
                placeholder="例如：已確認付款、課程名稱等"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={confirmActivate}
              disabled={activateMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {activateMutation.isPending ? "處理中..." : "確認開通"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 停用對話框 */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>停用學員帳號</DialogTitle>
            <DialogDescription>
              確認要停用 {selectedUser?.name || selectedUser?.email} 的帳號嗎？停用後該學員將無法使用系統。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deactivate-note">停用原因（選填）</Label>
              <Textarea
                id="deactivate-note"
                value={activationNote}
                onChange={(e) => setActivationNote(e.target.value)}
                placeholder="例如：課程到期、退款等"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={deactivateMutation.isPending}
            >
              {deactivateMutation.isPending ? "處理中..." : "確認停用"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 拒絕對話框 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒絕學員申請</DialogTitle>
            <DialogDescription>
              確認要拒絕 {selectedUser?.name || selectedUser?.email} 的申請嗎？
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">拒絕原因（選填）</Label>
              <Textarea
                id="reject-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="例如：未在報名名單中、資料不符等"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "處理中..." : "確認拒絕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// 邀請碼管理組件
// 預設期別選項
const DEFAULT_COHORTS = ["第四期", "第五期", "第六期", "第七期", "第八期"];

function InvitationManagement() {
  const utils = trpc.useUtils();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [batchCount, setBatchCount] = useState(1);
  const [validDays, setValidDays] = useState(90);
  const [cohort, setCohort] = useState(""); // 期別
  const [customCohort, setCustomCohort] = useState(""); // 自訂期別
  const [note, setNote] = useState("");

  // 獲取當前網站的基礎 URL
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const { data: invitations, isLoading } = trpc.invitation.list.useQuery();

  // 多選功能（只選擇可用的邀請碼）
  const activeInvitations = invitations?.filter(i => i.status === 'active') || [];
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
    items: activeInvitations,
    getItemId: (inv) => inv.id,
  });

  const createMutation = trpc.invitation.create.useMutation({
    onSuccess: (data) => {
      toast.success(`邀請碼已創建：${data?.code || ''}`);
      utils.invitation.list.invalidate();
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("創建失敗：" + error.message);
    },
  });

  const createBatchMutation = trpc.invitation.createBatch.useMutation({
    onSuccess: (data) => {
      toast.success(`已批量創建 ${data.length} 個邀請碼`);
      utils.invitation.list.invalidate();
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("批量創建失敗：" + error.message);
    },
  });

  const revokeMutation = trpc.invitation.revoke.useMutation({
    onSuccess: () => {
      toast.success("邀請碼已撤銷");
      utils.invitation.list.invalidate();
    },
    onError: (error) => {
      toast.error("撤銷失敗：" + error.message);
    },
  });

  // 批次撤銷邀請碼
  const batchRevokeMutation = trpc.admin.batchRevokeInvitations.useMutation({
    onSuccess: (data) => {
      toast.success(`已撤銷 ${data.count} 個邀請碼`);
      utils.invitation.list.invalidate();
      deselectAll();
    },
    onError: (error) => {
      toast.error("批次撤銷失敗：" + error.message);
    },
  });

  // 批次複製邀請碼
  const handleBatchCopy = () => {
    const selectedInvitations = activeInvitations.filter(inv => selectedIds.has(inv.id));
    const codes = selectedInvitations.map(inv => inv.code).join('\n');
    navigator.clipboard.writeText(codes);
    toast.success(`已複製 ${selectedInvitations.length} 個邀請碼`);
  };

  // 批次複製註冊連結
  const handleBatchCopyLinks = () => {
    const selectedInvitations = activeInvitations.filter(inv => selectedIds.has(inv.id));
    const links = selectedInvitations.map(inv => `${baseUrl}/register?code=${inv.code}`).join('\n');
    navigator.clipboard.writeText(links);
    toast.success(`已複製 ${selectedInvitations.length} 個註冊連結`);
  };

  // 批次撤銷
  const handleBatchRevoke = () => {
    if (selectedCount === 0) return;
    batchRevokeMutation.mutate({ ids: Array.from(selectedIds) as number[] });
  };

  const resetForm = () => {
    setBatchCount(1);
    setValidDays(90);
    setCohort("");
    setCustomCohort("");
    setNote("");
  };

  // 取得最終的期別值
  const getFinalCohort = () => {
    if (cohort === "custom") return customCohort || undefined;
    return cohort || undefined;
  };

  const handleCreate = () => {
    const finalCohort = getFinalCohort();
    if (batchCount === 1) {
      createMutation.mutate({ validDays, cohort: finalCohort, note: note || undefined });
    } else {
      createBatchMutation.mutate({ count: batchCount, validDays, cohort: finalCohort, note: note || undefined });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("已複製邀請碼");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'used':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />已使用</Badge>;
      case 'active':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-200"><Activity className="w-3 h-3 mr-1" />可用</Badge>;
      case 'expired':
        return <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-200"><Clock className="w-3 h-3 mr-1" />已過期</Badge>;
      case 'revoked':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="w-3 h-3 mr-1" />已撤銷</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const activeCount = invitations?.filter(i => i.status === 'active').length || 0;
  const usedCount = invitations?.filter(i => i.status === 'used').length || 0;

  // 複製註冊連結
  const copyRegisterLink = (code: string) => {
    const link = `${baseUrl}/register?code=${code}`;
    navigator.clipboard.writeText(link);
    toast.success("已複製學員註冊連結");
  };

  return (
    <div className="space-y-6">
      {/* 使用說明卡片 */}
      <Card className="elegant-card border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Info className="w-5 h-5" />
            如何使用邀請碼
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">方法一：發送註冊連結</h4>
              <p className="text-sm text-blue-700">
                點擊邀請碼旁的「複製連結」按鈕，將完整註冊連結發送給學員。
                學員點擊連結後會自動帶入邀請碼。
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">方法二：發送邀請碼</h4>
              <p className="text-sm text-blue-700">
                複製邀請碼發送給學員，學員在註冊時輸入邀請碼即可自動開通。
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-blue-200">
            <p className="text-xs text-blue-600">
              💡 提示：每個邀請碼只能使用一次，使用後學員帳號會自動開通指定天數。
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Ticket className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">可用邀請碼</p>
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
                <p className="text-2xl font-bold">{usedCount}</p>
                <p className="text-sm text-muted-foreground">已使用</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="elegant-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{invitations?.length || 0}</p>
                <p className="text-sm text-muted-foreground">總邀請碼數</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 邀請碼列表 */}
      <Card className="elegant-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              邀請碼列表
            </CardTitle>
            <CardDescription>
              管理學員邀請碼，每個邀請碼只能使用一次
            </CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            創建邀請碼
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : invitations && invitations.length > 0 ? (
            <div className="space-y-3">
              {/* 全選列 */}
              {activeInvitations.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 rounded-lg">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleAll}
                    aria-label="全選可用邀請碼"
                  />
                  <span className="text-sm text-muted-foreground">
                    全選可用邀請碼 ({activeInvitations.length})
                  </span>
                </div>
              )}
              {invitations.map((inv) => (
                <div 
                  key={inv.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border bg-card ${inv.status === 'active' && isSelected(inv.id) ? 'ring-2 ring-primary/30 bg-primary/5' : ''}`}
                >
                  {inv.status === 'active' && (
                    <Checkbox
                      checked={isSelected(inv.id)}
                      onCheckedChange={() => toggle(inv.id)}
                      aria-label={`選擇邀請碼 ${inv.code}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-lg font-mono font-bold tracking-wider">{inv.code}</code>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyToClipboard(inv.code)}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        複製碼
                      </Button>
                      {inv.status === 'active' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => copyRegisterLink(inv.code)}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          複製連結
                        </Button>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-x-3">
                      <span>有效期：{inv.validDays} 天</span>
                      {(inv as any).cohort && <span>· 期別：<span className="text-blue-600 font-medium">{(inv as any).cohort}</span></span>}
                      {inv.usedBy && <span>· 使用者 ID：{inv.usedBy}</span>}
                      {inv.usedAt && <span>· 使用時間：{format(new Date(inv.usedAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}</span>}
                      {inv.note && <span>· {inv.note}</span>}
                    </div>
                  </div>
                  {inv.status === 'active' && (
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => revokeMutation.mutate({ id: inv.id })}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Ticket className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>還沒有邀請碼</p>
              <p className="text-sm">點擊上方按鈕創建第一個邀請碼</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 批次操作工具列 */}
      <BatchActionBar selectedCount={selectedCount} onDeselectAll={deselectAll}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchCopy}
        >
          <Copy className="w-4 h-4 mr-1" />
          複製邀請碼
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchCopyLinks}
        >
          <Link className="w-4 h-4 mr-1" />
          複製連結
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBatchRevoke}
          disabled={batchRevokeMutation.isPending}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          {batchRevokeMutation.isPending ? '撤銷中...' : '撤銷邀請碼'}
        </Button>
      </BatchActionBar>

      {/* 創建邀請碼對話框 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>創建邀請碼</DialogTitle>
            <DialogDescription>
              創建新的邀請碼給學員使用
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="batchCount">創建數量</Label>
              <Input
                id="batchCount"
                type="number"
                min={1}
                max={100}
                value={batchCount}
                onChange={(e) => setBatchCount(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                最多可一次創建 100 個
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="validDays">有效天數</Label>
              <Input
                id="validDays"
                type="number"
                min={1}
                value={validDays}
                onChange={(e) => setValidDays(parseInt(e.target.value) || 90)}
              />
              <p className="text-xs text-muted-foreground">
                學員使用邀請碼後的帳號有效期
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort">學員期別</Label>
              <select
                id="cohort"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">不設定期別</option>
                {DEFAULT_COHORTS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="custom">自訂期別...</option>
              </select>
              {cohort === "custom" && (
                <Input
                  placeholder="輸入自訂期別名稱"
                  value={customCohort}
                  onChange={(e) => setCustomCohort(e.target.value)}
                  className="mt-2"
                />
              )}
              <p className="text-xs text-muted-foreground">
                學員使用邀請碼後會自動歸入此期別
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">備註（選填）</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：學員姓名"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              取消
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={createMutation.isPending || createBatchMutation.isPending}
            >
              {(createMutation.isPending || createBatchMutation.isPending) ? "創建中..." : `創建 ${batchCount} 個邀請碼`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
