import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { 
  Sparkles, 
  PenTool, 
  Target, 
  MessageSquare, 
  BarChart3, 
  CheckCircle,
  ArrowRight,
  Zap,
  Users,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // 如果已登入，重定向到 dashboard
  if (user && !loading) {
    setLocation('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        {/* Navigation */}
        <nav className="relative container py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-semibold tracking-tight">
                幕創行銷
              </span>
            </div>
            <Button 
              onClick={() => window.location.href = getLoginUrl()}
              className="shadow-lg shadow-primary/20"
            >
              開始使用
            </Button>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative container py-24 md:py-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Zap className="w-4 h-4" />
              <span>AI 驅動的 Threads 內容創作平台</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              讓你的
              <span className="elegant-gradient-text"> Threads </span>
              內容
              <br />
              自然吸引、有效轉換
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              不用硬套模板，用你自己的故事與觀點，穩定產出高互動內容。
              把重心放在互動與轉換，而不是只追讚數。
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => window.location.href = getLoginUrl()}
                className="text-lg px-8 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
              >
                免費開始
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="text-lg px-8"
              >
                了解更多
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
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
                className="elegant-card p-6 group"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <feature.icon className={`w-6 h-6 ${feature.iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              簡單三步驟，開始你的內容之旅
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">{index + 1}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-24 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-4xl md:text-5xl font-bold mb-2">{stat.value}</div>
                <div className="text-primary-foreground/80">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              準備好提升你的 Threads 經營了嗎？
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              加入幕創行銷，讓 AI 成為你的內容創作夥伴
            </p>
            <Button 
              size="lg" 
              onClick={() => window.location.href = getLoginUrl()}
              className="text-lg px-10 shadow-lg shadow-primary/20"
            >
              立即開始
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/50">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">幕創行銷</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 幕創行銷. All rights reserved.
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
    bgColor: "bg-primary/10",
    iconColor: "text-primary",
  },
  {
    icon: PenTool,
    title: "AI 發文工作室",
    description: "有靈感或沒靈感都能用，AI 幫你產出三種風格開頭與完整草稿",
    bgColor: "bg-blue-500/10",
    iconColor: "text-blue-500",
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
    bgColor: "bg-amber-500/10",
    iconColor: "text-amber-500",
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
