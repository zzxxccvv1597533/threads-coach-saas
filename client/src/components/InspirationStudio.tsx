/**
 * InspirationStudio - 靈感工作室組件
 * 
 * 功能：
 * 1. 生成 5 個選題推薦（結合痛點矩陣 + IP 資料 + 爆款資料庫）
 * 2. 選題格式為「具體情境」（15-40 字），讓人想知道「然後呢？」
 * 3. 記錄選題歷史，避免重複
 * 
 * v4.0 新增
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Lightbulb,
  RefreshCw,
  Check,
  Sparkles,
  X,
  ChevronRight,
  Info,
} from "lucide-react";

interface InspirationStudioProps {
  onSelectTopic: (topic: { id: number; text: string; source: string }) => void;
  onClose?: () => void;
  initialIdea?: string; // 有一點想法時傳入，讓 AI 延伸成具體選題
}

// 選題來源標籤
const SOURCE_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
  pain_matrix: { label: "痛點矩陣", color: "bg-red-100 text-red-700 border-red-200", emoji: "🎯" },
  ip_data: { label: "IP 人設", color: "bg-blue-100 text-blue-700 border-blue-200", emoji: "👤" },
  viral_db: { label: "爆款參考", color: "bg-amber-100 text-amber-700 border-amber-200", emoji: "🔥" },
};

export function InspirationStudio({ onSelectTopic, onClose, initialIdea }: InspirationStudioProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  
  // 生成選題 API
  const generateTopics = trpc.inspiration.generateTopics.useMutation({
    onSuccess: () => {
      toast.success("選題已生成！");
    },
    onError: (error) => {
      toast.error(`生成失敗：${error.message}`);
    },
  });

  // 選擇選題 API
  const selectTopic = trpc.inspiration.selectTopic.useMutation({
    onSuccess: () => {
      console.log("選題已記錄");
    },
  });

  // 處理生成選題
  const handleGenerateTopics = () => {
    generateTopics.mutate({ 
      count: 5,
      userIdea: initialIdea || undefined, // 傳入用戶的想法，讓 AI 延伸
    });
  };

  // 處理選擇選題
  const handleSelectTopic = (topic: { id: number; text: string; source: string }) => {
    setSelectedTopicId(topic.id);
    selectTopic.mutate({ topicId: topic.id });
    onSelectTopic(topic);
  };

  const topics = generateTopics.data?.topics || [];
  const domain = generateTopics.data?.domain || "";

  return (
    <Card className="elegant-card border-2 border-primary/20 max-h-[85vh] flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              靈感工作室
            </CardTitle>
            <CardDescription className="mt-1">
              AI 根據你的人設和受眾，推薦今天可以發的選題
            </CardDescription>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 overflow-y-auto flex-1">
        {/* 說明提示 */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">什麼是好選題？</span>
              <span className="text-amber-700 block mt-1">
                一個具體的情境描述，讓人想知道「然後呢？」
              </span>
            </div>
          </div>
        </div>

        {/* 生成按鈕 */}
        {topics.length === 0 && (
          <Button 
            onClick={handleGenerateTopics}
            disabled={generateTopics.isPending}
            className="w-full"
            size="lg"
          >
            {generateTopics.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                根據你的人設思考中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                給我 5 個選題
              </>
            )}
          </Button>
        )}

        {/* 選題列表 */}
        {topics.length > 0 && (
          <div className="space-y-3">
            {domain && (
              <div className="text-xs text-muted-foreground">
                根據你的領域「{domain}」推薦：
              </div>
            )}
            
            {topics.map((topic: { id: number; text: string; source: string; reason: string }, index: number) => {
              const sourceInfo = SOURCE_LABELS[topic.source] || SOURCE_LABELS.ip_data;
              const isSelected = selectedTopicId === topic.id;
              
              return (
                <div
                  key={topic.id || index}
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/50 hover:bg-muted/30"
                  }`}
                  onClick={() => handleSelectTopic(topic)}
                >
                  <div className="flex items-start gap-3">
                    {/* 選中指示器 */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isSelected 
                        ? "border-primary bg-primary" 
                        : "border-muted-foreground/30"
                    }`}>
                      {isSelected ? (
                        <Check className="w-4 h-4 text-primary-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground">{index + 1}</span>
                      )}
                    </div>

                    {/* 選題內容 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-base leading-relaxed">
                        {topic.text}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${sourceInfo.color}`}
                        >
                          {sourceInfo.emoji} {sourceInfo.label}
                        </Badge>
                        {topic.reason && (
                          <span className="text-xs text-muted-foreground truncate">
                            {topic.reason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 選擇按鈕 */}
                    {isSelected && (
                      <Button size="sm" className="flex-shrink-0">
                        開始寫
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 重新生成按鈕 */}
            <Button 
              variant="outline" 
              onClick={handleGenerateTopics}
              disabled={generateTopics.isPending}
              className="w-full"
            >
              {generateTopics.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  重新生成中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  換一批選題
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
