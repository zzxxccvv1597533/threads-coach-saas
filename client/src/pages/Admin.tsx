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
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: users, isLoading } = trpc.admin.users.useQuery(undefined, {
    enabled: user?.role === 'admin',
  });

  // 如果不是管理員，重定向
  if (user && user.role !== 'admin') {
    setLocation('/dashboard');
    return null;
  }

  const totalUsers = users?.length || 0;
  const adminCount = users?.filter(u => u.role === 'admin').length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">管理後台</h1>
          <p className="text-muted-foreground mt-1">
            管理用戶、查看系統狀態
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
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
                  <Crown className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-sm text-muted-foreground">管理員</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">正常</p>
                  <p className="text-sm text-muted-foreground">系統狀態</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">用戶管理</TabsTrigger>
            <TabsTrigger value="system">系統設定</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  用戶列表
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
                ) : users && users.length > 0 ? (
                  <div className="space-y-3">
                    {users.map((u) => (
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

          <TabsContent value="system">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle>系統設定</CardTitle>
                <CardDescription>
                  管理系統配置與提示詞版本
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  系統設定功能開發中...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
