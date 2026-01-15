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
  "非常自然": { color: "text-green-600", bg: "bg-green-50", label: "非常自然" },
  "較自然": { color: "text-blue-600", bg: "bg-blue-50", label: "較自然" },
  "有 AI 痕跡": { color: "text-yellow-600", bg: "bg-yellow-50", label: "有 AI 痕跡" },
  "AI 感明顯": { color: "text-red-600", bg: "bg-red-50", label: "AI 感明顯" },
  "error": { color: "text-gray-600", bg: "bg-gray-50", label: "生成失敗" },
};

// 模板類別對應的 emoji
const categoryEmoji: Record<string, string> = {
  "mirror": "🪞",
  "contrast": "🔄",
  "scene": "🎬",
  "question": "❓",
  "data": "📊",
  "story": "📖",
  "emotion": "💫",
  "other": "✨",
};

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
    <div className="space-y-4">
      {/* 標題區 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">選擇開頭風格</h3>
        </div>
        {generateMutation.data && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={generateMutation.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", generateMutation.isPending && "animate-spin")} />
            重新生成
          </Button>
        )}
      </div>

      {/* 說明文字 */}
      <p className="text-sm text-muted-foreground">
        系統為您生成了多個不同風格的開頭，請選擇最符合您風格的版本
      </p>

      {/* 載入中 */}
      {generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">正在生成開頭候選...</p>
        </div>
      )}

      {/* 錯誤狀態 */}
      {generateMutation.isError && (
        <div className="flex flex-col items-center justify-center py-8 space-y-4">
          <AlertTriangle className="h-8 w-8 text-red-500" />
          <p className="text-sm text-red-600">生成失敗，請重試</p>
          <Button onClick={handleRegenerate} variant="outline">
            重新生成
          </Button>
        </div>
      )}

      {/* 候選列表 */}
      {generateMutation.data && (
        <div className="space-y-3">
          {/* 統計資訊 */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>共 {generateMutation.data.candidates.length} 個候選</span>
            <span>•</span>
            <span>平均 AI 分數：{(generateMutation.data.avgAiScore * 100).toFixed(0)}%</span>
            {generateMutation.data.explorationCount > 0 && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-yellow-500" />
                  {generateMutation.data.explorationCount} 個探索模式
                </span>
              </>
            )}
          </div>

          {/* 候選卡片 */}
          {generateMutation.data.candidates.map((candidate, index) => {
            const isSelected = selectedId === (candidate.id || candidate.templateId);
            const scoreStyle = scoreStyles[candidate.scoreLevel] || scoreStyles["error"];
            const emoji = categoryEmoji[candidate.templateCategory] || "✨";

            return (
              <Card
                key={candidate.id || index}
                className={cn(
                  "cursor-pointer transition-all duration-200 hover:shadow-md",
                  isSelected && "ring-2 ring-primary shadow-md",
                  candidate.isExploration && "border-dashed border-yellow-400"
                )}
                onClick={() => handleSelect(candidate)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* 排名 */}
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                      index === 0 ? "bg-yellow-100 text-yellow-700" :
                      index === 1 ? "bg-gray-100 text-gray-700" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-gray-50 text-gray-500"
                    )}>
                      {candidate.rank}
                    </div>

                    {/* 內容 */}
                    <div className="flex-1 min-w-0">
                      {/* 標籤列 */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {emoji} {candidate.templateName}
                        </Badge>
                        <Badge 
                          variant="secondary" 
                          className={cn("text-xs", scoreStyle.color, scoreStyle.bg)}
                        >
                          {scoreStyle.label} ({(candidate.aiScore * 100).toFixed(0)}%)
                        </Badge>
                        {candidate.isExploration && (
                          <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-400">
                            <Zap className="h-3 w-3 mr-1" />
                            探索模式
                          </Badge>
                        )}
                      </div>

                      {/* 開頭文字 */}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {candidate.openerText}
                      </p>

                      {/* AI 痕跡提示 */}
                      {candidate.aiFlags.length > 0 && candidate.aiScore > 0.4 && (
                        <div className="mt-2 text-xs text-yellow-600 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          <span>偵測到：{candidate.aiFlags.slice(0, 2).join("、")}</span>
                        </div>
                      )}
                    </div>

                    {/* 選中標記 */}
                    {isSelected && (
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 底部按鈕 */}
      {onCancel && (
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        </div>
      )}
    </div>
  );
}

export default OpenerSelector;
