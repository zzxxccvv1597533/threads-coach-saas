import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  Target, 
  Sparkles, 
  Heart, 
  Lightbulb,
  Users,
  Save,
  Plus,
  Trash2,
  CheckCircle,
  Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function IpProfile() {
  const utils = trpc.useUtils();
  const { data: profile, isLoading } = trpc.ipProfile.get.useQuery();
  const { data: audiences, isLoading: audiencesLoading } = trpc.audience.list.useQuery();
  const { data: pillars } = trpc.contentPillar.list.useQuery();
  const { data: personaPillarsData } = trpc.knowledge.personaPillars.useQuery();
  
  const upsertProfile = trpc.ipProfile.upsert.useMutation({
    onSuccess: () => {
      utils.ipProfile.get.invalidate();
      toast.success("IP 地基已儲存");
    },
  });

  const createAudience = trpc.audience.create.useMutation({
    onSuccess: () => {
      utils.audience.list.invalidate();
      toast.success("受眾已新增");
    },
  });

  const deleteAudience = trpc.audience.delete.useMutation({
    onSuccess: () => {
      utils.audience.list.invalidate();
      toast.success("受眾已刪除");
    },
  });

  const [formData, setFormData] = useState({
    occupation: "",
    voiceTone: "",
    viewpointStatement: "",
    goalPrimary: "monetize" as "monetize" | "influence" | "expression",
    personaExpertise: "",
    personaEmotion: "",
    personaViewpoint: "",
  });

  const [newAudience, setNewAudience] = useState({
    segmentName: "",
    painPoint: "",
    desiredOutcome: "",
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        occupation: profile.occupation || "",
        voiceTone: profile.voiceTone || "",
        viewpointStatement: profile.viewpointStatement || "",
        goalPrimary: profile.goalPrimary || "monetize",
        personaExpertise: profile.personaExpertise || "",
        personaEmotion: profile.personaEmotion || "",
        personaViewpoint: profile.personaViewpoint || "",
      });
    }
  }, [profile]);

  const calculateProgress = () => {
    let score = 0;
    if (formData.occupation) score += 15;
    if (formData.voiceTone) score += 15;
    if (formData.viewpointStatement) score += 15;
    if (formData.personaExpertise) score += 20;
    if (formData.personaEmotion) score += 15;
    if (formData.personaViewpoint) score += 20;
    return score;
  };

  const handleSave = () => {
    upsertProfile.mutate({
      ...formData,
      ipAnalysisComplete: calculateProgress() >= 80,
    });
  };

  const handleAddAudience = () => {
    if (!newAudience.segmentName) {
      toast.error("請輸入受眾名稱");
      return;
    }
    createAudience.mutate(newAudience);
    setNewAudience({ segmentName: "", painPoint: "", desiredOutcome: "" });
  };

  const progress = calculateProgress();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">IP 地基設定</h1>
            <p className="text-muted-foreground mt-1">
              建立你的人設三支柱，讓 AI 更了解你的風格
            </p>
          </div>
          <Button onClick={handleSave} disabled={upsertProfile.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {upsertProfile.isPending ? "儲存中..." : "儲存設定"}
          </Button>
        </div>

        {/* Progress Card */}
        <Card className="elegant-card bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">IP 地基完成度</span>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            {progress < 80 && (
              <p className="text-xs text-muted-foreground mt-2">
                完成 80% 以上即可開始使用發文工作室
              </p>
            )}
            {progress >= 80 && (
              <div className="flex items-center gap-2 mt-2 text-emerald-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">已達到使用門檻！</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">基本資料</TabsTrigger>
            <TabsTrigger value="pillars">人設三支柱</TabsTrigger>
            <TabsTrigger value="audience">目標受眾</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  基本資料
                </CardTitle>
                <CardDescription>
                  設定你的身份與經營目標
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="occupation">職業/身份</Label>
                    <Input
                      id="occupation"
                      placeholder="例如：塔羅師、療癒師、身心靈教練"
                      value={formData.occupation}
                      onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="voiceTone">語氣風格</Label>
                    <Input
                      id="voiceTone"
                      placeholder="例如：溫柔、犀利、幽默、專業"
                      value={formData.voiceTone}
                      onChange={(e) => setFormData({ ...formData, voiceTone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="viewpoint">觀點宣言（一句話）</Label>
                  <Textarea
                    id="viewpoint"
                    placeholder="例如：我相信每個人都有改變的力量，只是需要找到對的方法"
                    value={formData.viewpointStatement}
                    onChange={(e) => setFormData({ ...formData, viewpointStatement: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="space-y-3">
                  <Label>主要經營目標</Label>
                  <RadioGroup
                    value={formData.goalPrimary}
                    onValueChange={(value) => setFormData({ ...formData, goalPrimary: value as any })}
                    className="grid gap-3"
                  >
                    {goals.map((goal) => (
                      <div key={goal.value} className="flex items-start space-x-3">
                        <RadioGroupItem value={goal.value} id={goal.value} className="mt-1" />
                        <Label htmlFor={goal.value} className="flex-1 cursor-pointer">
                          <div className="font-medium">{goal.label}</div>
                          <div className="text-sm text-muted-foreground">{goal.description}</div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Three Pillars Tab */}
          <TabsContent value="pillars" className="space-y-6">
            {/* Info Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-primary mb-1">什麼是人設三支柱？</p>
                    <p className="text-muted-foreground">
                      人設三支柱是建立個人品牌的核心框架，包含專業權威、情感共鳴、獨特觀點三個面向。
                      完善這三個支柱，能讓你的內容更有辨識度，也讓 AI 更精準地產出符合你風格的內容。
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Expertise Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  專業權威
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.expertise.description || "你的專業能力與知識深度，讓受眾相信你有能力幫助他們"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的專業支柱</Label>
                  <Textarea
                    placeholder="描述你的專業經驗、成就、認證或獨特能力..."
                    value={formData.personaExpertise}
                    onChange={(e) => setFormData({ ...formData, personaExpertise: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.expertise.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Emotion Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-500" />
                  情感共鳴
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.emotion.description || "你的故事與經歷，讓受眾感受到你理解他們的處境"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的情感支柱</Label>
                  <Textarea
                    placeholder="分享你的故事、經歷過的困境、如何走過來的..."
                    value={formData.personaEmotion}
                    onChange={(e) => setFormData({ ...formData, personaEmotion: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.emotion.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Viewpoint Pillar */}
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  獨特觀點
                </CardTitle>
                <CardDescription>
                  {personaPillarsData?.viewpoint.description || "你對事物的獨特看法，讓受眾記住你、認同你"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>你的觀點支柱</Label>
                  <Textarea
                    placeholder="描述你的獨特觀點、核心價值觀、你相信什麼..."
                    value={formData.personaViewpoint}
                    onChange={(e) => setFormData({ ...formData, personaViewpoint: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">引導問題：</p>
                  {personaPillarsData?.viewpoint.questions.map((q, i) => (
                    <p key={i}>• {q}</p>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audience Tab */}
          <TabsContent value="audience" className="space-y-6">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  目標受眾
                </CardTitle>
                <CardDescription>
                  定義你想幫助的人，越具體越好
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Existing Audiences */}
                {audiencesLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : audiences && audiences.length > 0 ? (
                  <div className="space-y-3">
                    {audiences.map((audience) => (
                      <div 
                        key={audience.id}
                        className="p-4 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="font-medium">{audience.segmentName}</p>
                            {audience.painPoint && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">痛點：</span>{audience.painPoint}
                              </p>
                            )}
                            {audience.desiredOutcome && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium">渴望：</span>{audience.desiredOutcome}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteAudience.mutate({ id: audience.id })}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    尚未設定目標受眾
                  </div>
                )}

                {/* Add New Audience */}
                <div className="border-t border-border/50 pt-6">
                  <p className="font-medium mb-4">新增受眾</p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>受眾名稱</Label>
                      <Input
                        placeholder="例如：新手命理師、高壓上班族"
                        value={newAudience.segmentName}
                        onChange={(e) => setNewAudience({ ...newAudience, segmentName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>他在煩什麼（痛點）</Label>
                      <Textarea
                        placeholder="越具體越好，例如：不知道怎麼開始經營社群、覺得自己的內容沒人看..."
                        value={newAudience.painPoint}
                        onChange={(e) => setNewAudience({ ...newAudience, painPoint: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>他想要的美好結果（渴望）</Label>
                      <Textarea
                        placeholder="例如：能夠穩定產出內容、有人主動來詢問服務..."
                        value={newAudience.desiredOutcome}
                        onChange={(e) => setNewAudience({ ...newAudience, desiredOutcome: e.target.value })}
                        rows={2}
                      />
                    </div>
                    <Button 
                      onClick={handleAddAudience}
                      disabled={createAudience.isPending}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      新增受眾
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

const goals = [
  {
    value: "monetize",
    label: "商業變現",
    description: "主要目標是獲得詢問、預約、銷售轉換",
  },
  {
    value: "influence",
    label: "擴大影響力",
    description: "主要目標是增加追蹤者、提升曝光與觸及",
  },
  {
    value: "expression",
    label: "自我表達",
    description: "主要目標是建立品牌故事、分享觀點與價值觀",
  },
];
