import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  CheckCircle, 
  Copy,
  RefreshCw,
  Eye,
  Heart,
  User,
  Layout,
  Target,
  Sparkles,
  TrendingUp,
  MessageCircle,
  Hash,
  Zap,
} from "lucide-react";

export default function Optimize() {
  const { data: fourLens } = trpc.knowledge.fourLens.useQuery();
  
  const [inputText, setInputText] = useState("");
  const [optimizeResult, setOptimizeResult] = useState("");
  const [clarityResult, setClarityResult] = useState("");
  
  const optimize = trpc.ai.optimize.useMutation({
    onSuccess: (data) => {
      setOptimizeResult(typeof data.result === 'string' ? data.result : '');
      toast.success("文案健檢完成！");
    },
    onError: () => {
      toast.error("健檢失敗，請稍後再試");
    },
  });

  const checkClarity = trpc.ai.checkClarity.useMutation({
    onSuccess: (data) => {
      setClarityResult(typeof data.result === 'string' ? data.result : '');
      toast.success("蛤？測試完成！");
    },
    onError: () => {
      toast.error("測試失敗，請稍後再試");
    },
  });

  const handleOptimize = () => {
    if (!inputText.trim()) {
      toast.error("請先輸入要健檢的文案");
      return;
    }
    optimize.mutate({ text: inputText });
  };

  const handleCheckClarity = () => {
    if (!inputText.trim()) {
      toast.error("請先輸入要測試的文案");
      return;
    }
    checkClarity.mutate({ text: inputText });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  const lensIcons = {
    emotion: Heart,
    persona: User,
    structure: Layout,
    conversion: Target,
  };

  const lensColors = {
    emotion: "text-rose-500 bg-rose-500/10",
    persona: "text-blue-500 bg-blue-500/10",
    structure: "text-emerald-500 bg-emerald-500/10",
    conversion: "text-amber-500 bg-amber-500/10",
  };

  // 評分項目說明
  const scoreItems = [
    { icon: Zap, name: "Hook 開頭", desc: "開頭是否讓人停下來", color: "text-amber-500 bg-amber-500/10" },
    { icon: MessageCircle, name: "說人話", desc: "是否口語化、好理解", color: "text-blue-500 bg-blue-500/10" },
    { icon: Target, name: "CTA", desc: "行動呼籲是否明確且軟性", color: "text-emerald-500 bg-emerald-500/10" },
    { icon: Layout, name: "結構", desc: "段落是否清晰好吸收", color: "text-purple-500 bg-purple-500/10" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文案健檢</h1>
          <p className="text-muted-foreground mt-1">
            使用知識庫標準，系統化評分並優化你的文案
          </p>
        </div>

        {/* Score Items Overview */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
          {scoreItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.name} className="elegant-card">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mb-2`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5">{item.name}</h3>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Input Section */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              輸入文案
            </CardTitle>
            <CardDescription>
              貼上你想健檢的文案，AI 會用五大維度幫你評分並給出優化建議
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="把你的文案貼在這裡..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex gap-3">
              <Button 
                onClick={handleOptimize}
                disabled={optimize.isPending || !inputText.trim()}
                className="flex-1"
              >
                {optimize.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    健檢中...
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4 mr-2" />
                    五維度健檢
                  </>
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleCheckClarity}
                disabled={checkClarity.isPending || !inputText.trim()}
              >
                {checkClarity.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    測試中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    蛤？測試
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Optimize Result */}
        {optimizeResult && (
          <Card className="elegant-card border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  文案健檢結果
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopy(optimizeResult)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  複製
                </Button>
              </div>
              <CardDescription>
                根據 Hook、說人話、CTA、結構、Hashtag 五大維度評分
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{optimizeResult}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clarity Result */}
        {clarityResult && (
          <Card className="elegant-card border-amber-500/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  蛤？測試結果
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleCopy(clarityResult)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  複製
                </Button>
              </div>
              <CardDescription>
                檢查文案是否讓一般人聽得懂
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{clarityResult}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Four Lens Reference (Collapsed) */}
        <Card className="elegant-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-muted-foreground" />
              四透鏡框架參考
            </CardTitle>
            <CardDescription>
              健檢時也會參考四透鏡框架的原則
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {fourLens && Object.entries(fourLens).map(([key, lens]) => {
                const Icon = lensIcons[key as keyof typeof lensIcons];
                const colorClass = lensColors[key as keyof typeof lensColors];
                return (
                  <div key={key} className="p-3 rounded-lg bg-muted/30">
                    <div className={`w-8 h-8 rounded-lg ${colorClass} flex items-center justify-center mb-2`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{lens.name}</h3>
                    <p className="text-xs text-muted-foreground">{lens.question}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
