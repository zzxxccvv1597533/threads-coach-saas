import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { 
  PenTool, 
  Target, 
  MessageSquare, 
  BarChart3, 
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  Infinity,
  Sparkles,
} from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // 如果已登入，重定向到 dashboard
  useEffect(() => {
    if (user && !loading) {
      setLocation('/dashboard');
    }
  }, [user, loading, setLocation]);

  // 如果正在載入或已登入，顯示載入狀態
  if (loading || user) {
    return (
      <div className="min-h-screen bg-[#0F345B] flex items-center justify-center">
        <div className="text-center">
          <img 
            src="/images/logo-horizontal-white.png" 
            alt="幕創行銷" 
            className="h-12 object-contain mx-auto mb-4 animate-pulse"
          />
          <p className="text-white/70">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background - 幕創深藍漸層 */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F345B] via-[#0F345B] to-[#0a2540]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2796B2]/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#FCC80E]/10 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4" />
        
        {/* Navigation */}
        <nav className="relative container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/images/logo-horizontal-white.png" 
                alt="幕創行銷" 
                className="h-10 object-contain"
              />
            </div>
            <Button 
              onClick={() => window.location.href = getLoginUrl()}
              className="bg-[#FCC80E] text-[#0F345B] hover:bg-[#FCC80E]/90 font-semibold shadow-lg shadow-black/20"
            >
              學員登入
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative container py-20 md:py-28">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-8 backdrop-blur-sm border border-white/10">
              <Zap className="w-4 h-4 text-[#FCC80E]" />
              <span>Threads 課程專屬 AI 助教系統</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-white">
              讓你的
              <span className="text-[#FCC80E]"> Threads </span>
              內容
              <br />
              自然吸引、有效轉換
            </h1>
            
            <p className="text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto">
              不用硬套模板，用你自己的故事與觀點，穩定產出高互動內容。
              把重心放在互動與轉換，而不是只追讚數。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => window.location.href = getLoginUrl()}
                className="text-lg px-8 bg-[#FCC80E] text-[#0F345B] hover:bg-[#FCC80E]/90 font-semibold shadow-lg shadow-black/20 hover:shadow-xl transition-all"
              >
                學員登入
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8 border-white/30 text-white hover:bg-white/10 bg-transparent"
              >
                了解課程
              </Button>
            </div>

            {/* Trust Badge */}
            <div className="mt-12 flex items-center justify-center gap-2 text-white/50 text-sm">
              <Infinity className="w-4 h-4 text-[#FCC80E]" />
              <span>MOVE STRONG - 幕創行銷學員專屬</span>
            </div>
          </div>
        </div>

        {/* Wave Divider */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="currentColor" className="text-background"/>
          </svg>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0F345B]">
              為 Threads 創作者打造的完整工具
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              從 IP 定位到內容產出，從互動策略到成效追蹤，一站式解決你的經營痛點
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="elegant-card p-6 group hover:border-[#0F345B]/20"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#0F345B]">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 bg-[#F8F9FA]">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0F345B]">
              簡單三步驟，開始你的內容之旅
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[#0F345B] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#0F345B]/20">
                  <span className="text-2xl font-bold text-[#FCC80E]">{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-[#0F345B]">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section - 幕創品牌漸層 */}
      <section className="py-24 bg-gradient-to-br from-[#0F345B] to-[#0a2540] text-white">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-4xl md:text-5xl font-bold mb-2 text-[#FCC80E]">{stat.value}</div>
                <div className="text-white/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="w-20 h-20 rounded-2xl bg-[#0F345B] flex items-center justify-center mx-auto mb-8 shadow-lg shadow-[#0F345B]/20">
              <Sparkles className="w-10 h-10 text-[#FCC80E]" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#0F345B]">
              準備好提升你的 Threads 經營了嗎？
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              幕創行銷課程學員專屬，讓 AI 成為你的內容創作夥伴
            </p>
            <Button 
              size="lg" 
              onClick={() => window.location.href = getLoginUrl()}
              className="text-lg px-10 bg-[#0F345B] hover:bg-[#0F345B]/90 shadow-lg shadow-[#0F345B]/20"
            >
              學員登入
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <p className="mt-6 text-sm text-muted-foreground">
              尚未成為學員？<a href="#" className="text-[#0F345B] font-medium hover:underline">了解幕創課程</a>
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50 bg-[#0F345B]">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img 
                src="/images/logo-horizontal-white.png" 
                alt="幕創行銷" 
                className="h-8 object-contain"
              />
            </div>
            <p className="text-sm text-white/50">
              © 2024 幕創行銷 MOVE STRONG. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: Target,
    title: "IP 地基建立",
    description: "透過人設三支柱框架，建立你的專業權威、情感共鳴與獨特觀點",
    bgColor: "bg-[#0F345B]/10",
    iconColor: "text-[#0F345B]",
  },
  {
    icon: PenTool,
    title: "AI 發文工作室",
    description: "有靈感或沒靈感都能用，AI 幫你產出三種風格開頭與完整草稿",
    bgColor: "bg-[#2796B2]/10",
    iconColor: "text-[#2796B2]",
  },
  {
    icon: CheckCircle,
    title: "四透鏡文案健檢",
    description: "心法、人設、結構、轉化四個面向，系統化優化你的文案",
    bgColor: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: MessageSquare,
    title: "互動任務系統",
    description: "每日任務清單與海巡策略，讓互動不再是負擔",
    bgColor: "bg-[#FCC80E]/10",
    iconColor: "text-[#F08316]",
  },
  {
    icon: BarChart3,
    title: "戰報分析",
    description: "追蹤貼文成效，了解什麼內容最能引發互動與轉換",
    bgColor: "bg-rose-500/10",
    iconColor: "text-rose-500",
  },
  {
    icon: Users,
    title: "受眾洞察",
    description: "深入了解你的目標受眾，產出更精準的內容",
    bgColor: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
];

const steps = [
  {
    title: "建立 IP 地基",
    description: "填寫你的人設三支柱與目標受眾，讓 AI 了解你的風格",
  },
  {
    title: "產出內容",
    description: "使用發文工作室，輕鬆產出符合你風格的高品質內容",
  },
  {
    title: "追蹤優化",
    description: "透過戰報分析持續優化，讓內容效果越來越好",
  },
];

const stats = [
  { value: "70%", label: "內容產出效率提升" },
  { value: "3x", label: "互動率平均成長" },
  { value: "500+", label: "創作者正在使用" },
];
