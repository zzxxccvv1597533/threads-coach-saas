/**
 * AdminTemplates - 管理後台模板管理頁面
 * 
 * 管理開頭模板和禁止句式
 */

import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  BarChart3,
  RefreshCw,
} from "lucide-react";

// 模板類別對應
const TEMPLATE_CATEGORIES = [
  { value: "mirror", label: "🪞 鏡像策略", description: "讓讀者看到自己的影子" },
  { value: "contrast", label: "🔄 反差策略", description: "製造認知衝突" },
  { value: "scene", label: "🎬 場景策略", description: "帶入具體情境" },
  { value: "question", label: "❓ 提問策略", description: "引發思考" },
  { value: "data", label: "📊 數據策略", description: "用數字說話" },
  { value: "story", label: "📖 故事策略", description: "用故事開場" },
  { value: "emotion", label: "💫 情緒策略", description: "觸動情感" },
];

// 禁止句式類型
const AVOID_PATTERN_TYPES = [
  { value: "opener", label: "開頭句式" },
  { value: "transition", label: "過渡句式" },
  { value: "ending", label: "結尾句式" },
  { value: "ai_phrase", label: "AI 特徵詞" },
  { value: "filler", label: "填充詞" },
];

// 嚴重程度
const SEVERITY_LEVELS = [
  { value: "block", label: "🚫 阻擋", color: "bg-red-500" },
  { value: "warn", label: "⚠️ 警告", color: "bg-yellow-500" },
  { value: "suggest", label: "💡 建議", color: "bg-blue-500" },
];

export default function AdminTemplates() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  // 模板相關狀態
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "mirror",
    description: "",
    promptTemplate: "",
    exampleOutput: "",
    weight: 1.0,
  });

  // 禁止句式相關狀態
  const [avoidDialogOpen, setAvoidDialogOpen] = useState(false);
  const [editingAvoid, setEditingAvoid] = useState<any>(null);
  const [avoidForm, setAvoidForm] = useState<{
    phrase: string;
    category: string;
    reason: string;
    severity: "low" | "medium" | "high";
  }>({
    phrase: "",
    category: "opener",
    reason: "",
    severity: "medium",
  });

  // API 查詢
  const { data: templates, isLoading: templatesLoading } = trpc.admin.getOpenerTemplates.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const { data: avoidList, isLoading: avoidLoading } = trpc.admin.getAvoidList.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  // API 變更
  const createTemplateMutation = trpc.admin.createOpenerTemplate.useMutation({
    onSuccess: () => {
      toast.success("模板已新增");
      utils.admin.getOpenerTemplates.invalidate();
      setTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: (error) => {
      toast.error("新增失敗：" + error.message);
    },
  });

  const updateTemplateMutation = trpc.admin.updateOpenerTemplate.useMutation({
    onSuccess: () => {
      toast.success("模板已更新");
      utils.admin.getOpenerTemplates.invalidate();
      setTemplateDialogOpen(false);
      resetTemplateForm();
    },
    onError: (error) => {
      toast.error("更新失敗：" + error.message);
    },
  });

  const toggleTemplateMutation = trpc.admin.toggleOpenerTemplate.useMutation({
    onSuccess: () => {
      toast.success("狀態已切換");
      utils.admin.getOpenerTemplates.invalidate();
    },
    onError: (error) => {
      toast.error("切換失敗：" + error.message);
    },
  });

  const createAvoidMutation = trpc.admin.createAvoidPhrase.useMutation({
    onSuccess: () => {
      toast.success("禁止句式已新增");
      utils.admin.getAvoidList.invalidate();
      setAvoidDialogOpen(false);
      resetAvoidForm();
    },
    onError: (error) => {
      toast.error("新增失敗：" + error.message);
    },
  });

  const updateAvoidMutation = trpc.admin.updateAvoidPhrase.useMutation({
    onSuccess: () => {
      toast.success("禁止句式已更新");
      utils.admin.getAvoidList.invalidate();
      setAvoidDialogOpen(false);
      resetAvoidForm();
    },
    onError: (error) => {
      toast.error("更新失敗：" + error.message);
    },
  });

  const toggleAvoidMutation = trpc.admin.toggleAvoidPhrase.useMutation({
    onSuccess: () => {
      toast.success("狀態已切換");
      utils.admin.getAvoidList.invalidate();
    },
    onError: (error) => {
      toast.error("切換失敗：" + error.message);
    },
  });

  const deleteAvoidMutation = trpc.admin.deleteAvoidPhrase.useMutation({
    onSuccess: () => {
      toast.success("禁止句式已刪除");
      utils.admin.getAvoidList.invalidate();
    },
    onError: (error) => {
      toast.error("刪除失敗：" + error.message);
    },
  });

  // 如果不是管理員，重定向
  if (user && user.role !== "admin") {
    setLocation("/dashboard");
    return null;
  }

  const resetTemplateForm = () => {
    setEditingTemplate(null);
    setTemplateForm({
      name: "",
      category: "mirror",
      description: "",
      promptTemplate: "",
      exampleOutput: "",
      weight: 1.0,
    });
  };

  const resetAvoidForm = () => {
    setEditingAvoid(null);
    setAvoidForm({
      phrase: "",
      category: "opener",
      reason: "",
      severity: "medium",
    });
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name || "",
      category: template.category || "mirror",
      description: template.description || "",
      promptTemplate: template.template || template.promptTemplate || "",
      exampleOutput: template.example || template.exampleOutput || "",
      weight: parseFloat(template.weight) || 1.0,
    });
    setTemplateDialogOpen(true);
  };

  const handleEditAvoid = (avoid: any) => {
    setEditingAvoid(avoid);
    // 映射 severity 從 schema 格式到表單格式
    const severityMap: Record<string, "low" | "medium" | "high"> = {
      block: "high",
      warn: "medium",
      suggest: "low",
    };
    setAvoidForm({
      phrase: avoid.pattern || avoid.phrase || "",
      category: avoid.patternType || avoid.category || "opener",
      reason: avoid.description || avoid.reason || "",
      severity: severityMap[avoid.severity] || "medium",
    });
    setAvoidDialogOpen(true);
  };

  const handleSaveTemplate = () => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        ...templateForm,
      });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleSaveAvoid = () => {
    if (editingAvoid) {
      updateAvoidMutation.mutate({
        id: editingAvoid.id,
        ...avoidForm,
      });
    } else {
      createAvoidMutation.mutate(avoidForm);
    }
  };

  const getCategoryLabel = (category: string) => {
    return TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label || category;
  };

  const getPatternTypeLabel = (type: string) => {
    return AVOID_PATTERN_TYPES.find((t) => t.value === type)?.label || type;
  };

  const getSeverityBadge = (severity: string) => {
    const level = SEVERITY_LEVELS.find((l) => l.value === severity);
    return (
      <Badge className={`${level?.color || "bg-gray-500"} text-white`}>
        {level?.label || severity}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">模板管理</h1>
          <p className="text-muted-foreground mt-1">
            管理 AI 生成開頭的模板和禁止句式，優化內容自然度
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{templates?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">開頭模板</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <ToggleRight className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {templates?.filter((t: any) => t.isActive).length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">啟用中</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{avoidList?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">禁止句式</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="elegant-card">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {avoidList?.filter((a: any) => a.severity === "block").length || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">阻擋級別</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates" className="gap-2">
              <Sparkles className="w-4 h-4" />
              開頭模板
            </TabsTrigger>
            <TabsTrigger value="avoid" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              禁止句式
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              使用統計
            </TabsTrigger>
          </TabsList>

          {/* 開頭模板 */}
          <TabsContent value="templates">
            <Card className="elegant-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    開頭模板庫
                  </CardTitle>
                  <CardDescription>
                    管理 AI 生成開頭時使用的模板，調整權重影響使用頻率
                  </CardDescription>
                </div>
                <Button onClick={() => { resetTemplateForm(); setTemplateDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增模板
                </Button>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                  </div>
                ) : templates && templates.length > 0 ? (
                  <div className="space-y-4">
                    {templates.map((template: any) => (
                      <div
                        key={template.id}
                        className={`border rounded-lg p-4 transition-all ${
                          template.isActive ? "bg-card" : "bg-muted/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{template.name}</span>
                              <Badge variant="outline">
                                {getCategoryLabel(template.category)}
                              </Badge>
                              <Badge variant="secondary">
                                權重: {parseFloat(template.weight || 1).toFixed(1)}
                              </Badge>
                              {!template.isActive && (
                                <Badge variant="destructive">已停用</Badge>
                              )}
                            </div>
                            {template.description && (
                              <p className="text-sm text-muted-foreground">
                                {template.description}
                              </p>
                            )}
                            <div className="text-sm bg-muted/50 rounded p-2 font-mono">
                              {template.template || template.promptTemplate}
                            </div>
                            {(template.example || template.exampleOutput) && (
                              <p className="text-sm text-primary/80 italic">
                                範例：「{template.example || template.exampleOutput}」
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>使用次數: {template.usageCount || 0}</span>
                              <span>成功次數: {template.successCount || 0}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={template.isActive}
                              onCheckedChange={() => toggleTemplateMutation.mutate({ id: template.id })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditTemplate(template)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>尚無模板，點擊「新增模板」開始</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 禁止句式 */}
          <TabsContent value="avoid">
            <Card className="elegant-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    禁止句式清單
                  </CardTitle>
                  <CardDescription>
                    這些句式會被 AI 偵測器標記，降低內容的 AI 感
                  </CardDescription>
                </div>
                <Button onClick={() => { resetAvoidForm(); setAvoidDialogOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增禁止句式
                </Button>
              </CardHeader>
              <CardContent>
                {avoidLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : avoidList && avoidList.length > 0 ? (
                  <div className="space-y-3">
                    {avoidList.map((avoid: any) => (
                      <div
                        key={avoid.id}
                        className={`border rounded-lg p-4 transition-all ${
                          avoid.isActive ? "bg-card" : "bg-muted/50 opacity-60"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="bg-red-500/10 text-red-600 px-2 py-1 rounded text-sm font-mono">
                                {avoid.pattern || avoid.phrase}
                              </code>
                              <Badge variant="outline">
                                {getPatternTypeLabel(avoid.patternType || avoid.category)}
                              </Badge>
                              {getSeverityBadge(avoid.severity)}
                              {!avoid.isActive && (
                                <Badge variant="secondary">已停用</Badge>
                              )}
                            </div>
                            {(avoid.description || avoid.reason) && (
                              <p className="text-sm text-muted-foreground">
                                {avoid.description || avoid.reason}
                              </p>
                            )}
                            {avoid.replacement && (
                              <p className="text-sm text-emerald-600">
                                建議替代：{avoid.replacement}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground">
                              匹配次數: {avoid.matchCount || 0}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={avoid.isActive}
                              onCheckedChange={() => toggleAvoidMutation.mutate({ id: avoid.id })}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditAvoid(avoid)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => {
                                if (confirm("確定要刪除這個禁止句式嗎？")) {
                                  deleteAvoidMutation.mutate({ id: avoid.id });
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>尚無禁止句式，點擊「新增禁止句式」開始</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 使用統計 */}
          <TabsContent value="stats">
            <Card className="elegant-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  使用統計
                </CardTitle>
                <CardDescription>
                  查看模板使用情況和效果分析
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>統計功能開發中，敬請期待</p>
                  <p className="text-sm mt-2">將顯示各模板的使用次數、選中率、效果評分等數據</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 模板編輯對話框 */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "編輯模板" : "新增模板"}
            </DialogTitle>
            <DialogDescription>
              設定開頭模板的內容和參數
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">模板名稱</Label>
                <Input
                  id="name"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="例如：共鳴開場"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">策略類別</Label>
                <Select
                  value={templateForm.category}
                  onValueChange={(value) => setTemplateForm({ ...templateForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">描述</Label>
              <Input
                id="description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
                placeholder="簡短描述這個模板的用途"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promptTemplate">提示詞模板</Label>
              <Textarea
                id="promptTemplate"
                value={templateForm.promptTemplate}
                onChange={(e) => setTemplateForm({ ...templateForm, promptTemplate: e.target.value })}
                placeholder="輸入給 AI 的提示詞模板，可使用 {{topic}}、{{audience}} 等變數"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exampleOutput">範例輸出</Label>
              <Input
                id="exampleOutput"
                value={templateForm.exampleOutput}
                onChange={(e) => setTemplateForm({ ...templateForm, exampleOutput: e.target.value })}
                placeholder="這個模板可能產生的開頭範例"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">權重 (0.1 - 2.0)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                min="0.1"
                max="2.0"
                value={templateForm.weight}
                onChange={(e) => setTemplateForm({ ...templateForm, weight: parseFloat(e.target.value) || 1.0 })}
              />
              <p className="text-xs text-muted-foreground">
                權重越高，被選中的機率越大
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                "儲存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 禁止句式編輯對話框 */}
      <Dialog open={avoidDialogOpen} onOpenChange={setAvoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAvoid ? "編輯禁止句式" : "新增禁止句式"}
            </DialogTitle>
            <DialogDescription>
              設定要避免的句式模式
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="phrase">句式模式</Label>
              <Input
                id="phrase"
                value={avoidForm.phrase}
                onChange={(e) => setAvoidForm({ ...avoidForm, phrase: e.target.value })}
                placeholder="例如：你是不是覺得"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patternType">類型</Label>
                <Select
                  value={avoidForm.category}
                  onValueChange={(value) => setAvoidForm({ ...avoidForm, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVOID_PATTERN_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="severity">嚴重程度</Label>
                <Select
                  value={avoidForm.severity}
                  onValueChange={(value: "low" | "medium" | "high") => setAvoidForm({ ...avoidForm, severity: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">🚫 高（阻擋）</SelectItem>
                    <SelectItem value="medium">⚠️ 中（警告）</SelectItem>
                    <SelectItem value="low">💡 低（建議）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">原因說明</Label>
              <Textarea
                id="reason"
                value={avoidForm.reason}
                onChange={(e) => setAvoidForm({ ...avoidForm, reason: e.target.value })}
                placeholder="說明為什麼要避免這個句式"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvoidDialogOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleSaveAvoid}
              disabled={createAvoidMutation.isPending || updateAvoidMutation.isPending}
            >
              {(createAvoidMutation.isPending || updateAvoidMutation.isPending) ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  儲存中...
                </>
              ) : (
                "儲存"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
