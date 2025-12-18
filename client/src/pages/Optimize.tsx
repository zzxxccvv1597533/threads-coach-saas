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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文案健檢</h1>
          <p className="text-muted-foreground mt-1">
            使用四透鏡框架，系統化優化你的文案
          </p>
        </div>

        {/* Four Lens Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {fourLens && Object.entries(fourLens).map(([key, lens]) => {
            const Icon = lensIcons[key as keyof typeof lensIcons];
            const colorClass = lensColors[key as keyof typeof lensColors];
            return (
              <Card key={key} className="elegant-card">
                <CardContent className="pt-6">
                  <div className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center mb-3`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-1">{lens.name}</h3>
                  <p className="text-xs text-muted-foreground">{lens.question}</p>
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
              貼上你想健檢的文案，AI 會用四透鏡框架幫你分析
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
                    <CheckCircle className="w-4 h-4 mr-2" />
                    四透鏡健檢
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
                  四透鏡健檢結果
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
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
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
              <div className="prose prose-sm max-w-none">
                <Streamdown>{clarityResult}</Streamdown>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
