/**
 * OpenerSelector 組件
 * 
 * 顯示多個開頭候選供學員選擇
 * 包含 AI 痕跡分數、模板類別、排名等資訊
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, Check, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpenerCandidate {
  id?: number;
  templateId: number;
  templateName: string;
  templateCategory: string;
  openerText: string;
  aiScore: number;
  aiFlags: string[];
  scoreLevel: string;
  isExploration: boolean;
  rank: number;
  finalScore: number;
}

interface OpenerSelectorProps {
  topic: string;
  contentType: string;
  hookStyle?: string;
  targetAudience?: string;
  userContext?: string;
  onSelect: (opener: OpenerCandidate) => void;
  onCancel?: () => void;
}

// AI 分數等級對應的樣式
const scoreStyles: Record<string, { color: string; bg: string; label: string }> = {
  "非常自然": { color: "text-emerald-700", bg: "bg-emerald-100", label: "非常自然" },
  "較自然": { color: "text-blue-700", bg: "bg-blue-100", label: "較自然" },
  "有 AI 痕跡": { color: "text-amber-700", bg: "bg-amber-100", label: "有 AI 痕跡" },
  "AI 感明顯": { color: "text-red-700", bg: "bg-red-100", label: "AI 感明顯" },
  "error": { color: "text-gray-600", bg: "bg-gray-100", label: "生成失敗" },
};

// 模板類別對應的 emoji 和中文名稱
const categoryInfo: Record<string, { emoji: string; label: string; description: string }> = {
  "mirror": { emoji: "🪞", label: "鏡像心理", description: "說出受眾心聲" },
  "contrast": { emoji: "⚡", label: "反差型", description: "打破預期認知" },
  "scene": { emoji: "🎬", label: "情境化帶入", description: "具體場景描繪" },
  "question": { emoji: "❓", label: "提問型", description: "引發讀者思考" },
  "data": { emoji: "📊", label: "數據型", description: "用數字說話" },
  "story": { emoji: "📖", label: "故事型", description: "敘事開場" },
  "emotion": { emoji: "💫", label: "情緒型", description: "情感共鳴" },
  "dialogue": { emoji: "💬", label: "對話型", description: "對話開場" },
  "casual": { emoji: "💭", label: "閒聊型", description: "輕鬆自然" },
  "other": { emoji: "✨", label: "其他", description: "其他風格" },
};

// 獲取類別的中文顯示信息
function getCategoryDisplay(category: string) {
  return categoryInfo[category] || categoryInfo["other"];
}

export function OpenerSelector({
  topic,
  contentType,
  hookStyle,
  targetAudience,
  userContext,
  onSelect,
  onCancel,
}: OpenerSelectorProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const generateMutation = trpc.opener.generate.useMutation();
  const selectMutation = trpc.opener.select.useMutation();

  const handleGenerate = () => {
    generateMutation.mutate({
      topic,
      contentType,
      hookStyle,
      targetAudience,
      userContext,
      count: 5,
    });
  };

  const handleSelect = async (candidate: OpenerCandidate) => {
    setSelectedId(candidate.id || candidate.templateId);
    
    // 標記選中
    if (candidate.id) {
      await selectMutation.mutateAsync({ candidateId: candidate.id });
    }
    
    onSelect(candidate);
  };

  const handleRegenerate = () => {
    setSelectedId(null);
    handleGenerate();
  };

  // 初次載入時自動生成
  if (!generateMutation.data && !generateMutation.isPending && !generateMutation.isError) {
    handleGenerate();
  }

  return (
    <div className="space-y-6">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-amber-100 to-yellow-100 rounded-xl">
            <Sparkles className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">選擇開頭風格</h3>
            <p className="text-sm text-muted-foreground">
              AI 為您生成了多個不同風格的開頭
            </p>
          </div>
        </div>
        {generateMutation.data && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", generateMutation.isPending && "animate-spin")} />
            重新生成
          </Button>
        )}
      </div>

      {/* 載入中 */}
      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
          </div>
          <p className="text-sm text-muted-foreground">正在生成開頭候選...</p>
        </div>
      )}

      {/* 錯誤狀態 */}
      {generateMutation.isError && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 bg-red-50 rounded-xl">
          <AlertTriangle className="h-10 w-10 text-red-500" />
          <p className="text-sm text-red-600 font-medium">生成失敗，請重試</p>
          <Button onClick={handleRegenerate} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重新生成
          </Button>
        </div>
      )}

      {/* 候選列表 */}
      {generateMutation.data && (
        <div className="space-y-4">
          {/* 統計資訊 */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
            <span className="font-medium">共 {generateMutation.data.candidates.length} 個候選</span>
            <span className="text-muted-foreground/50">•</span>
            <span>平均自然度：{((1 - generateMutation.data.avgAiScore) * 100).toFixed(0)}%</span>
            {generateMutation.data.explorationCount > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="flex items-center gap-1 text-amber-600">
                  <Zap className="h-3 w-3" />
                  {generateMutation.data.explorationCount} 個探索模式
                </span>
              </>
            )}
          </div>

          {/* 候選卡片 - 改善布局 */}
          <div className="grid gap-4">
            {generateMutation.data.candidates.map((candidate, index) => {
              const isSelected = selectedId === (candidate.id || candidate.templateId);
              const scoreStyle = scoreStyles[candidate.scoreLevel] || scoreStyles["error"];
              const categoryDisplay = getCategoryDisplay(candidate.templateCategory);

              return (
                <Card
                  key={candidate.id || index}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-[1.01]",
                    "border-2",
                    isSelected 
                      ? "border-primary shadow-lg ring-2 ring-primary/20" 
                      : "border-transparent hover:border-muted-foreground/20",
                    candidate.isExploration && "bg-gradient-to-r from-amber-50/50 to-transparent"
                  )}
                  onClick={() => handleSelect(candidate)}
                >
                  <CardContent className="p-5">
                    {/* 頂部：風格標籤和自然度 */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {/* 風格類別標籤 - 使用中文 */}
                        <Badge 
                          variant="outline" 
                          className="text-sm font-medium px-3 py-1 bg-background"
                        >
                          <span className="mr-1.5">{categoryDisplay.emoji}</span>
                          {categoryDisplay.label}
                        </Badge>
                        
                        {/* 模板名稱 */}
                        <span className="text-xs text-muted-foreground">
                          {candidate.templateName}
                        </span>
                        
                        {candidate.isExploration && (
                          <Badge 
                            variant="outline" 
                            className="text-xs text-amber-600 border-amber-300 bg-amber-50"
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            探索
                          </Badge>
                        )}
                      </div>
                      
                      {/* 自然度評級 */}
                      <Badge 
                        variant="secondary" 
                        className={cn("text-xs font-medium px-3 py-1", scoreStyle.color, scoreStyle.bg)}
                      >
                        {((1 - candidate.aiScore) * 100).toFixed(0)}% {scoreStyle.label}
                      </Badge>
                    </div>

                    {/* 開頭文字 - 更好的排版 */}
                    <div className={cn(
                      "relative rounded-lg p-4 bg-muted/30",
                      isSelected && "bg-primary/5"
                    )}>
                      <p className="text-base leading-relaxed whitespace-pre-wrap text-foreground">
                        {candidate.openerText}
                      </p>
                      
                      {/* 選中標記 */}
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shadow-md">
                            <Check className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI 痕跡提示 - 更友好的呈現 */}
                    {candidate.aiFlags.length > 0 && candidate.aiScore > 0.4 && (
                      <div className="mt-3 flex items-start gap-2 text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <span>
                          <span className="font-medium">優化建議：</span>
                          {candidate.aiFlags.slice(0, 2).join("、")}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 底部按鈕 */}
      {onCancel && (
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>
      )}
    </div>
  );
}

export default OpenerSelector;
