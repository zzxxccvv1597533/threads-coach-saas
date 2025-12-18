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

type UserWithActivation = {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  activationStatus: "pending" | "activated" | "expired";
  activatedAt: Date | null;
  expiresAt: Date | null;
  activationNote: string | null;
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
  const [selectedUser, setSelectedUser] = useState<UserWithActivation | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [activationNote, setActivationNote] = useState("");

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'activated':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />已開通</Badge>;
      case 'pending':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />待開通</Badge>;
      case 'expired':
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="w-3 h-3 mr-1" />已過期</Badge>;
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
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {u.email || '無 Email'} · 註冊於 {format(new Date(u.createdAt), 'yyyy/MM/dd HH:mm', { locale: zhTW })}
                          </p>
                        </div>
                        <Button 
                          onClick={() => handleActivate(u)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <UserCheck className="w-4 h-4 mr-2" />
                          開通
                        </Button>
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
    </DashboardLayout>
  );
}
