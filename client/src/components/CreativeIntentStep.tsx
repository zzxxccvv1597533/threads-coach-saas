/**
 * CreativeIntentStep - 創作意圖確認步驟
 * 
 * 讓用戶選擇這篇貼文的創作意圖：
 * - 純粹分享：不連結專業
 * - 順便帶點專業：自然連結
 * - 推廣專業或產品：完整導入
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { type CreativeIntent, CREATIVE_INTENT_INFO } from "@shared/creative-intent";

interface CreativeIntentStepProps {
  selectedIntent: CreativeIntent | null;
  onSelectIntent: (intent: CreativeIntent) => void;
  onConfirm: () => void;
}

export function CreativeIntentStep({ 
  selectedIntent, 
  onSelectIntent, 
  onConfirm 
}: CreativeIntentStepProps) {
  const intentOptions: CreativeIntent[] = ['pure_personal', 'light_connection', 'full_professional'];

  return (
    <Card className="elegant-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-violet-500" />
          這篇貼文你想...
        </CardTitle>
        <CardDescription>
          選擇你的創作意圖，AI 教練會根據你的選擇調整引導方式
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4">
          {intentOptions.map((intent) => {
            const info = CREATIVE_INTENT_INFO[intent];
            const isSelected = selectedIntent === intent;
            
            // 根據意圖設定不同的漸層色
            const gradientClass = {
              pure_personal: 'from-emerald-50 to-green-50 border-emerald-300',
              light_connection: 'from-blue-50 to-indigo-50 border-blue-300',
              full_professional: 'from-amber-50 to-orange-50 border-amber-300',
            }[intent];
            
            const iconBgClass = {
              pure_personal: 'border-emerald-500 bg-emerald-500',
              light_connection: 'border-blue-500 bg-blue-500',
              full_professional: 'border-amber-500 bg-amber-500',
            }[intent];

            return (
              <div
                key={intent}
                className={`relative border rounded-xl p-5 cursor-pointer transition-all ${
                  isSelected
                    ? `bg-gradient-to-r ${gradientClass} border-2`
                    : "hover:bg-muted/30 border-muted"
                }`}
                onClick={() => onSelectIntent(intent)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isSelected ? iconBgClass : "border-muted-foreground/30"
                  }`}>
                    {isSelected && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{info.icon}</span>
                      <span className="font-semibold text-lg">{info.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {info.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 說明提示 */}
        <div className="bg-muted/30 rounded-lg p-4 mt-4">
          <h4 className="font-medium text-sm mb-2">💡 選擇說明</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            {selectedIntent === 'pure_personal' && (
              <p>AI 會專注於幫你呈現故事和情緒，不會加入任何專業內容。適合分享生活、心情、個人經歷。</p>
            )}
            {selectedIntent === 'light_connection' && (
              <p>AI 會先幫你完成故事，然後提供幾個自然連結專業的建議，你可以選擇是否採用。</p>
            )}
            {selectedIntent === 'full_professional' && (
              <p>AI 會完整運用你的 IP 地基和爆款公式，幫你產出高轉換的專業內容。</p>
            )}
            {!selectedIntent && (
              <p>選擇一個創作意圖，AI 教練會根據你的選擇調整引導方式。</p>
            )}
          </div>
        </div>

        {/* 確認按鈕 */}
        <Button 
          className="w-full mt-4"
          disabled={!selectedIntent}
          onClick={onConfirm}
        >
          確認，開始創作
        </Button>
      </CardContent>
    </Card>
  );
}
