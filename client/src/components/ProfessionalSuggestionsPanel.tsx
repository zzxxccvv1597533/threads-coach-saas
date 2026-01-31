/**
 * ProfessionalSuggestionsPanel - 專業連結建議區塊
 * 
 * 在用戶完成初稿後，提供可選的專業連結建議
 * 用戶可以選擇是否採用這些建議
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, ChevronDown, ChevronUp, Check, X, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ProfessionalSuggestion {
  id: string;
  type: 'ending' | 'transition' | 'cta';
  title: string;
  description: string;
  example: string;
}

interface ProfessionalSuggestionsPanelProps {
  topic: string;
  contentType: string;
  draftContent: string;
  creativeIntent: 'pure_story' | 'light_connect' | 'full_professional';
  onApplySuggestion: (suggestion: ProfessionalSuggestion) => void;
  onDismiss: () => void;
}

export function ProfessionalSuggestionsPanel({
  topic,
  contentType,
  draftContent,
  creativeIntent,
  onApplySuggestion,
  onDismiss,
}: ProfessionalSuggestionsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // 獲取專業連結建議
  const { data: suggestions, isLoading } = trpc.writingSession.generateProfessionalSuggestions.useQuery(
    { topic, contentType, draftContent, creativeIntent },
    { enabled: creativeIntent !== 'pure_story' }
  ) as { data: ProfessionalSuggestion[] | undefined; isLoading: boolean };

  // 如果是純個人故事模式，不顯示此面板
  if (creativeIntent === 'pure_story') {
    return null;
  }

  // 類型標籤映射
  const typeLabels: Record<string, { label: string; color: string }> = {
    ending: { label: '結尾連結', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    transition: { label: '過渡段落', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    cta: { label: '行動呼籲', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  };

  return (
    <Card className="border-2 border-amber-200/50 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-900/10 dark:to-orange-900/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle className="text-base">專業連結建議</CardTitle>
              <CardDescription className="text-xs">
                以下是一些可選的專業連結方式，你可以選擇是否採用
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3 pt-2">
          {/* 提示文字 */}
          <div className="text-sm text-muted-foreground bg-background/50 rounded-lg p-3 border border-amber-100 dark:border-amber-800/30">
            <span className="font-medium text-amber-700 dark:text-amber-400">💡 小提示：</span>
            {' '}這些建議是可選的。如果你覺得這篇文章不需要連結專業，可以直接跳過。
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Sparkles className="w-5 h-5 animate-pulse text-amber-500 mr-2" />
              <span className="text-sm text-muted-foreground">正在生成建議...</span>
            </div>
          ) : suggestions && suggestions.length > 0 ? (
            <div className="space-y-3">
              {suggestions.map((suggestion: ProfessionalSuggestion) => {
                const typeInfo = typeLabels[suggestion.type] || typeLabels.ending;
                const isSelected = selectedSuggestion === suggestion.id;

                return (
                  <div
                    key={suggestion.id}
                    className={`rounded-lg border-2 p-4 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/20'
                        : 'border-transparent bg-background/50 hover:border-amber-200'
                    }`}
                    onClick={() => setSelectedSuggestion(isSelected ? null : suggestion.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                          <span className="font-medium text-sm">{suggestion.title}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {suggestion.description}
                        </p>
                        <div className="bg-muted/30 rounded p-2 text-sm italic text-muted-foreground">
                          「{suggestion.example}」
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-amber-200/50 flex gap-2">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApplySuggestion(suggestion);
                          }}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          <Check className="w-4 h-4 mr-1" />
                          採用這個建議
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSuggestion(null);
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              目前沒有適合的專業連結建議
            </div>
          )}

          {/* 底部操作 */}
          <div className="pt-2 border-t border-amber-100 dark:border-amber-800/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              不需要，保持原樣
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
