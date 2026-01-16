/**
 * GoalSelector - 目的導向選擇器組件
 * 
 * 讓用戶先選擇「想達成什麼目標」，再推薦適合的內容類型
 * 
 * 四大目標：
 * 1. 讓人更懂我（建立情感連結）
 * 2. 讓人信任我（建立專業權威）
 * 3. 有人留言互動（提升互動率）
 * 4. 慢慢賣產品（軟性銷售）
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronRight, Info } from "lucide-react";

// 目標選項定義
export interface GoalOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  subText: string;
  recommendedTypes: string[];
  color: string;
}

export const GOAL_OPTIONS: GoalOption[] = [
  {
    id: 'connect',
    name: '讓人更懂我',
    description: '建立情感連結，讓讀者感受到你是真實的人',
    icon: '💝',
    subText: '分享故事、心情、生活',
    recommendedTypes: ['story', 'casual', 'dialogue', 'humor'],
    color: 'from-pink-500/10 to-rose-500/10 border-pink-200',
  },
  {
    id: 'trust',
    name: '讓人信任我',
    description: '建立專業權威，讓讀者相信你的專業能力',
    icon: '🎯',
    subText: '分享知識、整理、教學',
    recommendedTypes: ['knowledge', 'curation', 'summary', 'series', 'contrast'],
    color: 'from-blue-500/10 to-indigo-500/10 border-blue-200',
  },
  {
    id: 'engage',
    name: '有人留言互動',
    description: '提升互動率，讓讀者想要留言回應',
    icon: '💬',
    subText: '問問題、投票、對話',
    recommendedTypes: ['question', 'poll', 'dialogue', 'diagnosis', 'contrast'],
    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-200',
  },
  {
    id: 'sell',
    name: '慢慢賣產品',
    description: '軟性銷售，讓讀者對你的產品/服務產生興趣',
    icon: '🛒',
    subText: '故事帶產品、系列文',
    recommendedTypes: ['story', 'series', 'contrast', 'diagnosis', 'knowledge'],
    color: 'from-amber-500/10 to-orange-500/10 border-amber-200',
  },
];

interface GoalSelectorProps {
  selectedGoal: string | null;
  onSelect: (goalId: string) => void;
  onConfirm: () => void;
  showRecommendations?: boolean;
}

export function GoalSelector({ 
  selectedGoal, 
  onSelect, 
  onConfirm,
  showRecommendations = true 
}: GoalSelectorProps) {
  const selectedGoalData = GOAL_OPTIONS.find(g => g.id === selectedGoal);

  return (
    <Card className="elegant-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          你想達成什麼？
        </CardTitle>
        <CardDescription>
          選擇你這篇文章的目標，AI 會根據目標推薦最適合的寫法
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 提示訊息 */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-medium">小提醒：</span>
              <span className="text-amber-700">
                不需要每篇都追求爆款，真實的內容比完美的公式更重要
              </span>
            </div>
          </div>
        </div>

        {/* 目標選項 */}
        <div className="grid gap-3">
          {GOAL_OPTIONS.map((goal) => (
            <div
              key={goal.id}
              className={`relative border rounded-xl p-4 cursor-pointer transition-all ${
                selectedGoal === goal.id
                  ? `bg-gradient-to-r ${goal.color} border-2`
                  : "hover:bg-muted/30 border-muted"
              }`}
              onClick={() => onSelect(goal.id)}
            >
              <div className="flex items-start gap-4">
                {/* 選中指示器 */}
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  selectedGoal === goal.id 
                    ? "border-primary bg-primary" 
                    : "border-muted-foreground/30"
                }`}>
                  {selectedGoal === goal.id && (
                    <Check className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>

                {/* 目標內容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{goal.icon}</span>
                    <span className="font-semibold text-lg">{goal.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {goal.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {goal.subText}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 推薦類型預覽 */}
        {showRecommendations && selectedGoalData && (
          <div className="bg-muted/30 rounded-lg p-4 mt-4">
            <div className="text-sm font-medium mb-2">
              推薦的文章類型：
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedGoalData.recommendedTypes.slice(0, 4).map((type) => (
                <Badge key={type} variant="secondary" className="text-xs">
                  {getTypeName(type)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 確認按鈕 */}
        <Button 
          className="w-full mt-4"
          disabled={!selectedGoal}
          onClick={onConfirm}
        >
          確認目標
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>

        {/* 跳過選項 */}
        <div className="text-center">
          <button
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              onSelect(''); // 清空選擇
              onConfirm();
            }}
          >
            我只是想發文，跳過這步
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// 輔助函數：取得類型名稱
function getTypeName(typeId: string): string {
  const typeNames: Record<string, string> = {
    story: '故事型',
    casual: '雜感型',
    dialogue: '對話型',
    humor: '幽默型',
    knowledge: '知識型',
    curation: '整理型',
    summary: '懶人包',
    series: '系列型',
    contrast: '反差型',
    question: '問答型',
    poll: '投票型',
    diagnosis: '診斷型',
    viewpoint: '觀點型',
    quote: '金句型',
  };
  return typeNames[typeId] || typeId;
}

/**
 * 簡化版目的選擇器（用於快速選擇）
 */
interface QuickGoalSelectorProps {
  selectedGoal: string | null;
  onSelect: (goalId: string) => void;
}

export function QuickGoalSelector({ selectedGoal, onSelect }: QuickGoalSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {GOAL_OPTIONS.map((goal) => (
        <button
          key={goal.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
            selectedGoal === goal.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => onSelect(goal.id)}
        >
          <span>{goal.icon}</span>
          <span>{goal.name}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * 目的導向提示組件（顯示在生成過程中）
 */
interface GoalHintProps {
  goalId: string | null;
}

export function GoalHint({ goalId }: GoalHintProps) {
  if (!goalId) return null;
  
  const goal = GOAL_OPTIONS.find(g => g.id === goalId);
  if (!goal) return null;

  return (
    <div className={`bg-gradient-to-r ${goal.color} rounded-lg p-3 text-sm`}>
      <div className="flex items-center gap-2">
        <span>{goal.icon}</span>
        <span className="font-medium">目標：{goal.name}</span>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {goal.description}
      </p>
    </div>
  );
}

export default GoalSelector;
