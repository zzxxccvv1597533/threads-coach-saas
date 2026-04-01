/**
 * SimpleWritingFlow - 簡化四步驟發文流程
 *
 * Step 0: 寫什麼？ — 主題輸入 + AI 靈感建議
 * Step 1: 你的素材 — BatchQuestionsFlow Q&A
 * Step 2: AI 生成 — 自動策略判斷 + 草稿生成
 * Step 3: 修改 + 完成 — 對話式修改 + 潤飾 + 儲存
 */

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { BatchQuestionsFlow } from "@/components/BatchQuestionsFlow";
import {
  Lightbulb,
  Sparkles,
  RefreshCw,
  Loader2,
  Copy,
  Wand2,
  Send,
  CheckSquare,
  Square,
  Check,
  BookmarkPlus,
  ChevronRight,
  AlertCircle,
  Zap,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimpleWritingFlowProps {
  ipProfile: {
    occupation?: string;
    personaExpertise?: string;
    personaEmotion?: string;
    personaViewpoint?: string;
    voiceTone?: string;
  } | null;
  initialTopic?: string;
  initialMaterial?: string;
  onComplete: (draftId: number | null, content: string) => void;
  onNavigateToIp: () => void;
}

interface InspirationTopic {
  id: number;
  text: string;
  source: string;
  reason: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["寫什麼", "素材", "生成", "完成"] as const;

const SOURCE_LABEL: Record<string, string> = {
  痛點矩陣: "痛點矩陣",
  IP人設: "IP 人設",
  爆款參考: "爆款參考",
};

const SOURCE_COLOR: Record<string, string> = {
  痛點矩陣: "bg-red-50 text-red-700 border-red-200",
  IP人設: "bg-blue-50 text-blue-700 border-blue-200",
  爆款參考: "bg-amber-50 text-amber-700 border-amber-200",
};

const CONTENT_TYPE_LABEL: Record<string, string> = {
  story: "故事型",
  knowledge: "知識型",
  viewpoint: "觀點型",
  casual: "生活型",
  list: "清單型",
  qa: "Q&A 型",
  dialogue: "對話型",
  summary: "整理型",
};

const CHECKLIST_ITEMS = [
  "距離上一篇 ≥ 3 小時",
  "不說「按讚追蹤分享」",
  "零外部連結",
  "跟上篇換不同切角",
  "發文後 30 分鐘內回留言",
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ current }: { current: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  i < current
                    ? "bg-[#0F345B] text-white"
                    : i === current
                    ? "bg-[#FCC80E] text-[#0F345B]"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < current ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={`text-xs whitespace-nowrap ${
                  i === current
                    ? "font-semibold text-[#0F345B]"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-4 transition-all ${
                  i < current ? "bg-[#0F345B]" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlgorithmChecks({
  checks,
}: {
  checks: Array<{ label: string; pass: boolean }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {checks.map((c, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {c.pass ? (
            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          )}
          <span className={c.pass ? "text-foreground" : "text-amber-700"}>
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SimpleWritingFlow({
  ipProfile,
  initialTopic = "",
  initialMaterial = "",
  onComplete,
  onNavigateToIp,
}: SimpleWritingFlowProps) {
  // ── Step navigation ──
  const [currentStep, setCurrentStep] = useState(0);

  // ── Step 0 state ──
  const [topic, setTopic] = useState(initialTopic);
  const [inspirationTopics, setInspirationTopics] = useState<InspirationTopic[]>([]);
  const [showInspirations, setShowInspirations] = useState(false);

  // ── Step 1 state ──
  const [materialAnswers, setMaterialAnswers] = useState<Record<string, string>>({});

  // ── Step 2 state ──
  const [draftContent, setDraftContent] = useState("");
  const [draftId, setDraftId] = useState<number | null>(null);
  const [strategyUsed, setStrategyUsed] = useState<{
    contentType: string;
    angleLabel: string;
    reasoning: string;
  } | null>(null);
  const [diagnosis, setDiagnosis] = useState<{
    strengths: string[];
    improvements: string[];
    score: number;
    algorithmChecks: Array<{ label: string; pass: boolean }>;
  } | null>(null);
  const [styleMatch, setStyleMatch] = useState<{
    score: number;
    breakdown?: Record<string, number>;
    details?: string;
    suggestions?: string[];
  } | null>(null);
  const [dataDriven, setDataDriven] = useState<unknown>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Step 3 state ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(CHECKLIST_ITEMS.length).fill(false)
  );
  const [isChatting, setIsChatting] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // If initialMaterial provided, skip to step 1 pre-filled
  useEffect(() => {
    if (initialMaterial) {
      setMaterialAnswers({ raw: initialMaterial });
    }
  }, [initialMaterial]);

  // ── tRPC mutations ──

  const generateTopicsMutation = trpc.inspiration.generateTopics.useMutation({
    onSuccess: (data) => {
      const topics = (data.topics || []).map((t: { id?: number; text: string; source?: string; reason?: string }, i: number) => ({
        id: t.id ?? i,
        text: t.text,
        source: t.source ?? "爆款參考",
        reason: t.reason ?? "",
      }));
      setInspirationTopics(topics);
      setShowInspirations(true);
    },
    onError: () => {
      toast.error("靈感生成失敗，請稍後再試");
    },
  });

  const smartStrategyMutation = trpc.ai.smartStrategy.useMutation();
  const generateDraftMutation = trpc.ai.generateDraft.useMutation();

  const refineDraftMutation = trpc.ai.refineDraft.useMutation({
    onSuccess: (data) => {
      const newContent = typeof data.content === "string" ? data.content : "";
      setFinalContent(newContent);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: newContent },
      ]);
      setIsChatting(false);
    },
    onError: () => {
      toast.error("修改失敗，請稍後再試");
      setIsChatting(false);
    },
  });

  const stylePolishMutation = trpc.draft.stylePolish.useMutation({
    onSuccess: (data) => {
      if (data.success && data.content) {
        setFinalContent(data.content);
        toast.success("潤飾完成");
        if (data.validation?.warnings?.length) {
          data.validation.warnings.forEach((w: string) => toast.warning(w));
        }
      } else {
        toast.error(data.message ?? "潤飾失敗");
      }
      setIsPolishing(false);
    },
    onError: () => {
      toast.error("潤飾失敗，請稍後再試");
      setIsPolishing(false);
    },
  });

  // ── Helpers: material text ──

  const buildMaterialText = (answers: Record<string, string>) =>
    Object.entries(answers)
      .filter(([, v]) => v?.trim())
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");

  // ── Step 0 handlers ──

  const handleGetInspiration = () => {
    generateTopicsMutation.mutate({ userIdea: topic.trim() || undefined });
  };

  const handleInspirationClick = (t: InspirationTopic) => {
    setTopic(t.text);
    setShowInspirations(false);
    setCurrentStep(1);
  };

  const handleStartWriting = () => {
    if (!topic.trim()) return;
    setCurrentStep(1);
  };

  // ── Step 1 handler ──

  const handleMaterialComplete = (answers: Record<string, string>) => {
    setMaterialAnswers(answers);
    setCurrentStep(2);
  };

  // ── Step 2: auto-generate on entry ──

  useEffect(() => {
    if (currentStep !== 2 || isGenerating || draftContent) return;
    runGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const runGeneration = async () => {
    setIsGenerating(true);
    try {
      const materialText = buildMaterialText(materialAnswers);

      // 1. Smart strategy
      const strategy = await smartStrategyMutation.mutateAsync({
        topic,
        material: materialText,
      });

      setStrategyUsed({
        contentType: strategy.contentType,
        angleLabel: strategy.angleLabel,
        reasoning: strategy.reasoning,
      });

      // 2. Generate draft
      const draft = await generateDraftMutation.mutateAsync({
        material: materialText,
        contentType: strategy.contentType,
        targetAudienceId: strategy.targetAudienceId ?? undefined,
        creativeIntent: undefined,
      });

      setDraftContent(typeof draft.content === "string" ? draft.content : "");
      setDraftId(draft.draftId ?? null);

      if (draft.diagnosis) {
        setDiagnosis(draft.diagnosis as typeof diagnosis);
      }
      if (draft.styleMatch) {
        setStyleMatch(draft.styleMatch as typeof styleMatch);
      }
      if (draft.dataDriven) {
        setDataDriven(draft.dataDriven);
      }

      toast.success("草稿生成完成！");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "生成失敗，請稍後再試";
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setDraftContent("");
    setDraftId(null);
    setStrategyUsed(null);
    setDiagnosis(null);
    setStyleMatch(null);
    runGeneration();
  };

  const handleProceedToEdit = () => {
    setFinalContent(draftContent);
    setChatMessages([]);
    setCurrentStep(3);
  };

  // ── Step 3 handlers ──

  const handleSendChat = () => {
    const instruction = chatInput.trim();
    if (!instruction || isChatting) return;

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: instruction },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setIsChatting(true);

    refineDraftMutation.mutate({
      currentDraft: finalContent || draftContent,
      instruction,
      draftId: draftId ?? undefined,
      chatHistory: newMessages.map((m) => ({ role: m.role, content: m.content })),
    });
  };

  const handlePolish = () => {
    const content = finalContent || draftContent;
    if (!content.trim()) return;
    setIsPolishing(true);
    stylePolishMutation.mutate({ content });
  };

  const handleCopy = async () => {
    const content = finalContent || draftContent;
    try {
      await navigator.clipboard.writeText(content);
      toast.success("已複製到剪貼簿");
    } catch {
      toast.error("複製失敗");
    }
  };

  const handleSave = () => {
    onComplete(draftId, finalContent || draftContent);
  };

  const toggleChecklist = (index: number) => {
    setCheckedItems((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <ProgressBar current={currentStep} />

      {/* ══ Step 0: 寫什麼？ ══════════════════════════════════════════════════ */}
      {currentStep === 0 && (
        <div className="space-y-4">
          <Card className="elegant-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">你今天想聊什麼？</CardTitle>
              <CardDescription>
                隨便打幾個字，或讓 AI 給你靈感
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="topic-input">主題</Label>
                <Textarea
                  id="topic-input"
                  rows={2}
                  placeholder="例如：最近客戶說的一句話讓我很有感觸…"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleStartWriting();
                    }
                  }}
                  className="resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleGetInspiration}
                  disabled={generateTopicsMutation.isPending}
                  className="flex-1"
                >
                  {generateTopicsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Lightbulb className="w-4 h-4 mr-2" />
                  )}
                  給我靈感
                </Button>
                <Button
                  onClick={handleStartWriting}
                  disabled={!topic.trim()}
                  className="flex-1 bg-[#0F345B] hover:bg-[#0F345B]/90 text-white"
                >
                  開始寫
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              {!ipProfile && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-sm text-amber-800">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                  <span>
                    設定 IP 人設後，AI 靈感會更貼近你的風格。
                    <button
                      onClick={onNavigateToIp}
                      className="ml-1 underline font-medium hover:no-underline"
                    >
                      前往設定
                    </button>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inspiration cards */}
          {showInspirations && inspirationTopics.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  AI 靈感建議（點選即可使用）
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGetInspiration}
                  disabled={generateTopicsMutation.isPending}
                  className="text-xs"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  換一批
                </Button>
              </div>
              <div className="space-y-2">
                {inspirationTopics.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleInspirationClick(t)}
                    className="w-full text-left"
                  >
                    <Card className="elegant-card hover:border-[#0F345B]/40 hover:shadow-md transition-all cursor-pointer group">
                      <CardContent className="py-3 px-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm group-hover:text-[#0F345B] transition-colors leading-snug">
                              {t.text}
                            </p>
                            {t.reason && (
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {t.reason}
                              </p>
                            )}
                          </div>
                          <Badge
                            variant="outline"
                            className={`flex-shrink-0 text-xs ${
                              SOURCE_COLOR[t.source] ?? "bg-gray-50 text-gray-700 border-gray-200"
                            }`}
                          >
                            {SOURCE_LABEL[t.source] ?? t.source}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Step 1: 你的素材 ══════════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gradient-to-r from-[#0F345B]/5 to-transparent border border-[#0F345B]/15 px-4 py-3">
            <p className="text-sm font-medium text-[#0F345B]">主題：{topic}</p>
          </div>

          <BatchQuestionsFlow
            topic={topic}
            onComplete={handleMaterialComplete}
          />
        </div>
      )}

      {/* ══ Step 2: AI 生成 ═══════════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="space-y-4">
          {isGenerating ? (
            <Card className="elegant-card">
              <CardContent className="py-16 text-center space-y-4">
                <div className="relative inline-flex">
                  <Sparkles className="w-10 h-10 text-[#FCC80E] animate-pulse" />
                  <Loader2 className="w-5 h-5 text-[#0F345B] animate-spin absolute -bottom-1 -right-1" />
                </div>
                <div>
                  <p className="font-semibold text-[#0F345B]">AI 正在幫你生成草稿</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    判斷內容策略，生成初稿中…
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : draftContent ? (
            <>
              {/* Strategy info bar */}
              {strategyUsed && (
                <div className="rounded-lg bg-gradient-to-r from-[#0F345B]/5 to-transparent border border-[#0F345B]/15 px-4 py-3 flex items-center gap-2 flex-wrap">
                  <Zap className="w-4 h-4 text-[#0F345B] flex-shrink-0" />
                  <span className="text-sm text-[#0F345B] font-medium">
                    AI 選用：
                    <span className="font-semibold">
                      {CONTENT_TYPE_LABEL[strategyUsed.contentType] ?? strategyUsed.contentType}
                    </span>
                    {strategyUsed.angleLabel && (
                      <>
                        {" · "}
                        <span className="font-semibold">{strategyUsed.angleLabel}</span>
                      </>
                    )}
                  </span>
                </div>
              )}

              {/* Algorithm health + style score */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {diagnosis?.algorithmChecks?.length && (
                  <Card className="elegant-card">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        演算法健檢
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <AlgorithmChecks checks={diagnosis.algorithmChecks} />
                    </CardContent>
                  </Card>
                )}

                {styleMatch && (
                  <Card className="elegant-card">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        風格吻合度
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl font-bold text-[#0F345B]">
                          {styleMatch.score}
                        </span>
                        <span className="text-muted-foreground text-sm">/ 100</span>
                        <Badge
                          variant="outline"
                          className={
                            styleMatch.score >= 80
                              ? "bg-green-50 text-green-700 border-green-200"
                              : styleMatch.score >= 60
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }
                        >
                          {styleMatch.score >= 80
                            ? "風格貼近"
                            : styleMatch.score >= 60
                            ? "尚可"
                            : "偏差較大"}
                        </Badge>
                      </div>
                      {styleMatch.suggestions?.length ? (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          {styleMatch.suggestions[0]}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Draft card */}
              <Card className="elegant-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">草稿內容</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(draftContent);
                          toast.success("已複製");
                        } catch {
                          toast.error("複製失敗");
                        }
                      }}
                      className="text-xs"
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      複製
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/40 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                    {draftContent}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重新生成
                </Button>
                <Button
                  onClick={handleProceedToEdit}
                  className="flex-1 bg-[#0F345B] hover:bg-[#0F345B]/90 text-white"
                >
                  下一步：修改
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </>
          ) : (
            /* Error / empty state */
            <Card className="elegant-card">
              <CardContent className="py-12 text-center space-y-4">
                <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                <p className="text-sm text-muted-foreground">生成遇到問題，請重試。</p>
                <Button onClick={runGeneration} variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  重試
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══ Step 3: 修改 + 完成 ═══════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="space-y-4">
          {/* Current draft display */}
          <Card className="elegant-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">目前草稿</CardTitle>
                <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs">
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  複製
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/40 rounded-lg p-4 text-sm whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {finalContent || draftContent}
              </div>
            </CardContent>
          </Card>

          {/* Chat area */}
          <Card className="elegant-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">對話修改</CardTitle>
              <CardDescription className="text-xs">
                告訴 AI 怎麼改，例如「開頭更直接」「加一個反問」
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Chat messages */}
              {chatMessages.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border bg-muted/20 p-3">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                          msg.role === "user"
                            ? "bg-[#0F345B] text-white"
                            : "bg-white border text-foreground shadow-sm"
                        }`}
                      >
                        {msg.role === "assistant"
                          ? msg.content.length > 120
                            ? `${msg.content.slice(0, 120)}…（已更新草稿）`
                            : msg.content
                          : msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* Chat input */}
              <div className="flex gap-2">
                <Textarea
                  rows={2}
                  placeholder="想怎麼改？"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleSendChat();
                    }
                  }}
                  disabled={isChatting}
                  className="resize-none flex-1"
                />
                <Button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatting}
                  className="self-end bg-[#0F345B] hover:bg-[#0F345B]/90 text-white px-3"
                >
                  {isChatting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>

              {/* Polish button */}
              <Button
                variant="outline"
                onClick={handlePolish}
                disabled={isPolishing || !(finalContent || draftContent).trim()}
                className="w-full border-dashed"
              >
                {isPolishing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                一鍵潤飾
              </Button>
            </CardContent>
          </Card>

          {/* 降流防護 checklist */}
          <Card className="elegant-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                發文前確認
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => toggleChecklist(i)}
                    className="w-full flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
                  >
                    {checkedItems[i] ? (
                      <CheckSquare className="w-4 h-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm ${
                        checkedItems[i]
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {item}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Final actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleCopy}
              className="flex-1"
            >
              <Copy className="w-4 h-4 mr-2" />
              複製
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-[#0F345B] hover:bg-[#0F345B]/90 text-white"
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              儲存到草稿庫
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
