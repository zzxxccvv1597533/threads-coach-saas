import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  User,
  PenTool,
  CheckCircle,
  MessageSquare,
  BarChart3,
  FileText,
  Settings,
  Crown,
  GraduationCap,
  Users,
  Sparkles,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "總覽", path: "/dashboard" },
  { icon: User, label: "IP 地基", path: "/ip-profile" },
  { icon: PenTool, label: "發文工作室", path: "/writing-studio" },
  { icon: CheckCircle, label: "文案健檢", path: "/optimize" },
  { icon: MessageSquare, label: "互動任務", path: "/tasks" },
  { icon: FileText, label: "草稿庫", path: "/drafts" },
  { icon: BarChart3, label: "戰報分析", path: "/reports" },
];

const adminMenuItems = [
  { icon: Crown, label: "管理後台", path: "/admin" },
  { icon: Sparkles, label: "模板管理", path: "/admin/templates" },
];

const coachMenuItems = [
  { icon: Users, label: "學員管理", path: "/coach/students" },
  { icon: FileText, label: "戰報總覽", path: "/coach/reports" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            {/* 幕創 Logo */}
            <img 
              src="/images/logo-square.png" 
              alt="幕創行銷" 
              className="w-20 h-20 object-contain"
            />
            <h1 className="text-2xl font-bold tracking-tight text-center text-[#0F345B]">
              歡迎回來
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              登入以繼續使用 Threads AI 教練，開始你的內容創作之旅
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-[#0F345B] hover:bg-[#0F345B]/90"
          >
            立即登入
          </Button>
        </div>
      </div>
    );
  }

  // 檢查學員開通狀態 - 管理員不需要檢查
  const userWithActivation = user as typeof user & { activationStatus?: string };
  if (userWithActivation.role !== 'admin' && userWithActivation.activationStatus !== 'activated') {
    // 重導到待開通頁面
    window.location.href = '/pending';
    return <DashboardLayoutSkeleton />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = [...menuItems, ...adminMenuItems].find(item => location.startsWith(item.path));
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          style={{ 
            background: 'linear-gradient(180deg, #0F345B 0%, #0a2540 100%)',
          }}
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-white/10">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-9 w-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FCC80E] shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-white/70" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <img 
                    src="/images/logo-horizontal-white.png" 
                    alt="幕創行銷" 
                    className="h-8 object-contain"
                  />
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 px-2 py-4">
            <SidebarMenu>
              {menuItems.map(item => {
                const isActive = location.startsWith(item.path);
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 transition-all font-normal rounded-lg mb-1 ${
                        isActive 
                          ? "bg-[#FCC80E] text-[#0F345B] hover:bg-[#FCC80E]/90" 
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-[#0F345B]" : "text-white/70"}`}
                      />
                      <span className={isActive ? "font-semibold" : ""}>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {isAdmin && (
              <>
                {/* 教練專區 */}
                <div className="my-4 mx-2 h-px bg-white/10" />
                <div className="px-2 mb-2 group-data-[collapsible=icon]:hidden">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">教練專區</span>
                </div>
                <SidebarMenu>
                  {coachMenuItems.map(item => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-11 transition-all font-normal rounded-lg mb-1 ${
                            isActive 
                              ? "bg-emerald-500 text-white hover:bg-emerald-500/90" 
                              : "text-emerald-300 hover:bg-white/10"
                          }`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-white" : "text-emerald-300"}`}
                          />
                          <span className={isActive ? "font-semibold" : ""}>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>

                {/* 管理後台 */}
                <div className="my-4 mx-2 h-px bg-white/10" />
                <SidebarMenu>
                  {adminMenuItems.map(item => {
                    const isActive = location.startsWith(item.path);
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-11 transition-all font-normal rounded-lg mb-1 ${
                            isActive 
                              ? "bg-[#F08316] text-white hover:bg-[#F08316]/90" 
                              : "text-[#FCC80E] hover:bg-white/10"
                          }`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${isActive ? "text-white" : "text-[#FCC80E]"}`}
                          />
                          <span className={isActive ? "font-semibold" : ""}>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/10">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-white/10 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FCC80E]">
                  <Avatar className="h-9 w-9 border-2 border-[#FCC80E]/30 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-[#FCC80E] text-[#0F345B]">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-white">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-white/60 truncate mt-1.5">
                      {user?.role === 'admin' ? '管理員' : '學員'}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation('/settings')}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>設定</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>登出</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#FCC80E]/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b border-border/50 h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {activeMenuItem?.label ?? "選單"}
                </span>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-6 elegant-scrollbar overflow-auto">{children}</main>
      </SidebarInset>
    </>
  );
}
