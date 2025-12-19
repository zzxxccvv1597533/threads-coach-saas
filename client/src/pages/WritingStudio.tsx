import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { 
  PenTool, 
  Sparkles, 
  Lightbulb,
  Zap,
  Copy,
  Save,
  RefreshCw,
  ChevronRight,
  Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function WritingStudio() {
  const { data: contentTypes } = trpc.knowledge.contentTypes.useQuery();
  const { data: ipProfile } = trpc.ipProfile.get.useQuery();
  
  const [mode, setMode] = useState<"brainstorm" | "material">("brainstorm");
  const [material, setMaterial] = useState("");
  const [selectedContentType, setSelectedContentType] = useState("story");
  const [selectedAngle, setSelectedAngle] = useState("");
  const [step, setStep] = useState(1);
  
  const [brainstormResult, setBrainstormResult] = useState("");
  const [anglesResult, setAnglesResult] = useState("");
  const [draftResult, setDraftResult] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);

  const brainstorm = trpc.ai.brainstorm.useMutation({
    onSuccess: (data) => {
      setBrainstormResult(typeof data.suggestions === 'string' ? data.suggestions : '');
      toast.success("靈感已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  const analyzeAngles = trpc.ai.analyzeAngles.useMutation({
    onSuccess: (data) => {
      setAnglesResult(typeof data.angles === 'string' ? data.angles : '');
      setStep(2);
      toast.success("切角分析完成！");
    },
    onError: () => {
      toast.error("分析失敗，請稍後再試");
    },
  });

  const generateDraft = trpc.ai.generateDraft.useMutation({
    onSuccess: (data) => {
      setDraftResult(typeof data.content === 'string' ? data.content : '');
      setDraftId(data.draftId || null);
      setStep(3);
      toast.success("草稿已生成！");
    },
    onError: () => {
      toast.error("生成失敗，請稍後再試");
    },
  });

  const handleBrainstorm = () => {
    brainstorm.mutate({ topic: material || undefined });
  };

  const handleAnalyzeAngles = () => {
    if (!material.trim()) {
      toast.error("請先輸入你的素材");
      return;
    }
    analyzeAngles.mutate({ material });
  };

  const handleGenerateDraft = () => {
    if (!material.trim()) {
      toast.error("請先輸入你的素材");
      return;
    }
    generateDraft.mutate({
      material,
      contentType: selectedContentType,
      angle: selectedAngle || undefined,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("已複製到剪貼簿");
  };

  const handleReset = () => {
    setMaterial("");
    setSelectedAngle("");
    setStep(1);
    setBrainstormResult("");
    setAnglesResult("");
    setDraftResult("");
    setDraftId(null);
  };

  // Check if IP profile is complete enough
  const ipProgress = (() => {
    if (!ipProfile) return 0;
    let score = 0;
    if (ipProfile.occupation) score += 15;
    if (ipProfile.voiceTone) score += 15;
    if (ipProfile.viewpointStatement) score += 15;
    if (ipProfile.personaExpertise) score += 20;
    if (ipProfile.personaEmotion) score += 15;
    if (ipProfile.personaViewpoint) score += 20;
    return score;
  })();

  // Show warning banner instead of blocking
  const showIpWarning = ipProgress < 50;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">發文工作室</h1>
            <p className="text-muted-foreground mt-1">
              讓 AI 幫你產出符合人設的高品質內容
            </p>
          </div>
          {step > 1 && (
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              重新開始
            </Button>
          )}
        </div>

        {/* IP Warning Banner */}
        {showIpWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-800">建議先完善 IP 地基</p>
                <p className="text-sm text-amber-700">設定你的人設三支柱，讓 AI 產出更符合你風格的內容</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.href = '/ip-profile'}>
              前往設定
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Mode Selection */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="brainstorm" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              沒靈感
            </TabsTrigger>
            <TabsTrigger value="material" className="gap-2">
              <Zap className="w-4 h-4" />
              有素材
            </TabsTrigger>
          </TabsList>

          {/* Brainstorm Mode */}
          <TabsContent value="brainstorm" className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  腦力激盪
                </CardTitle>
                <CardDescription>
                  讓 AI 根據你的人設和受眾，給你今天可以發的主題建議
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>參考方向（選填）</Label>
                  <Textarea
                    placeholder="例如：最近想聊聊關於自我懷疑的話題..."
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleBrainstorm}
                  disabled={brainstorm.isPending}
                  className="w-full"
                >
                  {brainstorm.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      思考中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      給我靈感
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Brainstorm Result */}
            {brainstormResult && (
              <Card className="elegant-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>主題建議</CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleCopy(brainstormResult)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      複製
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Streamdown>{brainstormResult}</Streamdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Material Mode */}
          <TabsContent value="material" className="space-y-6">
            {/* Step 1: Input Material */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                    1
                  </span>
                  輸入素材
                </CardTitle>
                <CardDescription>
                  把你想發的內容、靈感、故事、觀點寫下來
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="例如：今天有個案主來問我，她說她一直很想開始經營社群，但總是覺得自己沒什麼好分享的..."
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <div className="flex gap-3">
                  <Button 
                    onClick={handleAnalyzeAngles}
                    disabled={analyzeAngles.isPending || !material.trim()}
                    className="flex-1"
                  >
                    {analyzeAngles.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        分析中...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        分析切角
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleGenerateDraft}
                    disabled={generateDraft.isPending || !material.trim()}
                  >
                    {generateDraft.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-4 h-4 mr-2" />
                        直接生成
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Step 2: Angles Result */}
            {step >= 2 && anglesResult && (
              <Card className="elegant-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                      2
                    </span>
                    選擇切角
                  </CardTitle>
                  <CardDescription>
                    AI 分析了三種不同的切角方向，選一個你喜歡的
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg">
                    <Streamdown>{anglesResult}</Streamdown>
                  </div>
                  
                  <div className="space-y-3">
                    <Label>選擇內容類型</Label>
                    <RadioGroup
                      value={selectedContentType}
                      onValueChange={setSelectedContentType}
                      className="grid grid-cols-2 md:grid-cols-3 gap-2"
                    >
                      {contentTypes?.map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={type.id} id={type.id} />
                          <Label htmlFor={type.id} className="text-sm cursor-pointer">
                            {type.name}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>補充切角方向（選填）</Label>
                    <Textarea
                      placeholder="例如：我想用故事切角，從案主的角度出發..."
                      value={selectedAngle}
                      onChange={(e) => setSelectedAngle(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button 
                    onClick={handleGenerateDraft}
                    disabled={generateDraft.isPending}
                    className="w-full"
                  >
                    {generateDraft.isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <PenTool className="w-4 h-4 mr-2" />
                        生成草稿
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Draft Result */}
            {step >= 3 && draftResult && (
              <Card className="elegant-card border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">
                        3
                      </span>
                      生成結果
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleCopy(draftResult)}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        複製
                      </Button>
                      {draftId && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.location.href = `/drafts/${draftId}`}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          編輯草稿
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <Streamdown>{draftResult}</Streamdown>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
