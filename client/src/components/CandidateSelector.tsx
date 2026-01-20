/**
 * 候選展示組件
 * 
 * 功能：
 * 1. 展示 3 個不同風格的候選版本
 * 2. 讓用戶選擇最喜歡的版本
 * 3. 顯示每個候選的風格標籤和亮點
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Sparkles, MessageSquare, BookOpen, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

// 候選版本類型
interface ContentCandidate {
  id: string;
  content: string;
  style: string;
  opener: string;
  highlight: string;
  wordCount: number;
}

interface CandidateSelectorProps {
  candidates: ContentCandidate[];
  onSelect: (candidate: ContentCandidate) => void;
  selectedId?: string;
  isLoading?: boolean;
}

// 風格圖標映射
const styleIcons: Record<string, typeof Sparkles> = {
  '情緒型': Heart,
  '知識型': BookOpen,
  '故事型': MessageSquare,
  '對話型': MessageSquare,
  '觀點型': Sparkles,
};

// 風格顏色映射
const styleColors: Record<string, string> = {
  '情緒型': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  '知識型': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  '故事型': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  '對話型': 'bg-green-500/10 text-green-500 border-green-500/20',
  '觀點型': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
};

export function CandidateSelector({
  candidates,
  onSelect,
  selectedId,
  isLoading = false,
}: CandidateSelectorProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>AI 為你準備了 {candidates.length} 個不同風格的版本，選擇你最喜歡的：</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {candidates.map((candidate, index) => {
          const isSelected = selectedId === candidate.id;
          const isHovered = hoveredId === candidate.id;
          const StyleIcon = styleIcons[candidate.style] || Sparkles;
          const colorClass = styleColors[candidate.style] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';

          return (
            <Card
              key={candidate.id}
              className={cn(
                'relative cursor-pointer transition-all duration-200',
                'hover:shadow-md hover:border-primary/50',
                isSelected && 'ring-2 ring-primary border-primary',
                isHovered && !isSelected && 'border-primary/30'
              )}
              onClick={() => onSelect(candidate)}
              onMouseEnter={() => setHoveredId(candidate.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* 選中標記 */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </div>
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={cn('gap-1', colorClass)}>
                    <StyleIcon className="h-3 w-3" />
                    {candidate.style}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {candidate.wordCount} 字
                  </span>
                </div>
                <CardTitle className="text-sm font-medium mt-2">
                  版本 {index + 1}：{candidate.opener}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* 內容預覽 */}
                <div className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {candidate.content.substring(0, 150)}
                  {candidate.content.length > 150 && '...'}
                </div>

                {/* 亮點說明 */}
                <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {candidate.highlight}
                  </p>
                </div>

                {/* 選擇按鈕 */}
                <Button
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isSelected ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      已選擇
                    </>
                  ) : (
                    '選擇這個版本'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// 簡化版：只顯示候選列表，不含選擇功能
export function CandidatePreview({
  candidates,
  onExpand,
}: {
  candidates: ContentCandidate[];
  onExpand?: () => void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="text-sm">
        已生成 {candidates.length} 個不同風格的版本
      </span>
      {onExpand && (
        <Button variant="ghost" size="sm" onClick={onExpand} className="ml-auto">
          查看全部
        </Button>
      )}
    </div>
  );
}

export default CandidateSelector;
