import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, LogOut, Lock, User, ShieldCheck } from "lucide-react";

export default function Settings() {
  const { user, logout } = useAuth();

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("請填寫所有欄位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("新密碼與確認密碼不一致");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("新密碼至少需要 6 個字元");
      return;
    }
    // Endpoint not yet implemented
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      toast.info("功能開發中");
    }, 300);
  };

  const roleLabel = (role?: string | null) => {
    if (role === "admin") return "管理員";
    if (role === "coach") return "教練";
    return "學員";
  };

  const activationLabel = (status?: string | null) => {
    if (status === "activated") return "已開通";
    if (status === "pending") return "待審核";
    return status ?? "未知";
  };

  const activationVariant = (status?: string | null): "default" | "secondary" | "outline" => {
    if (status === "activated") return "default";
    if (status === "pending") return "secondary";
    return "outline";
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0F345B]">帳號設定</h1>
          <p className="text-muted-foreground mt-1">管理您的帳號資訊與安全設定</p>
        </div>

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" />
              帳號資訊
            </CardTitle>
            <CardDescription>您的個人資料與帳號狀態</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">姓名</p>
                <p className="text-sm font-medium">{user?.name || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">角色</p>
                <p className="text-sm font-medium">{roleLabel(user?.role)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">帳號狀態</p>
                <Badge variant={activationVariant(user?.activationStatus)} className="text-xs">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {activationLabel(user?.activationStatus)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="w-4 h-4" />
              變更密碼
            </CardTitle>
            <CardDescription>定期更換密碼以保護帳號安全</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">目前密碼</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    placeholder="請輸入目前密碼"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">新密碼</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    placeholder="至少 6 個字元"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">確認新密碼</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="再次輸入新密碼"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="bg-[#0F345B] hover:bg-[#0F345B]/90"
                disabled={isSubmitting}
              >
                {isSubmitting ? "更新中..." : "更新密碼"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Logout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LogOut className="w-4 h-4" />
              登出
            </CardTitle>
            <CardDescription>登出您的帳號</CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <Button
              variant="outline"
              className="text-destructive border-destructive hover:bg-destructive/10"
              onClick={logout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              登出帳號
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
