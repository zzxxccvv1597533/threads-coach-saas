/**
 * BatchQuestionsFlow - 一次性問答流程組件
 * 
 * AI 一次列出所有問題，用戶一次性填寫，像專業教練一樣說明每個問題的重點
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Sparkles, CheckCircle, HelpCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface BatchQuestionsFlowProps {
  topic: string;
  contentType: string;
  onComplete: (answers: Record<string, string>) => void;
  onSkip: () => void;
}

interface Question {
  id: string;
  question: string;
  hint: string;
  importance: "required" | "recommended" | "optional";
  example?: string;
}

export function BatchQuestionsFlow({ topic, contentType, onComplete, onSkip }: BatchQuestionsFlowProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [coachIntro, setCoachIntro] = useState("");

  // 生成問題的 mutation
  const generateQuestions = trpc.writingSession.generateBatchQuestions.useMutation({
    onSuccess: (data) => {
      setQuestions(data.questions);
      setCoachIntro(data.coachIntro);
      setIsLoading(false);
    },
    onError: () => {
      // 如果 API 失敗，使用預設問題
      setQuestions(getDefaultQuestions(contentType));
      setCoachIntro("讓我幫你整理一下寫這篇文章需要的素材：");
      setIsLoading(false);
    },
  });

  // 初始化時生成問題
  useEffect(() => {
    generateQuestions.mutate({ topic, contentType });
  }, [topic, contentType]);

  // 預設問題（根據貼文類型）
  const getDefaultQuestions = (type: string): Question[] => {
    const defaultQuestions: Record<string, Question[]> = {
      story: [
        { id: "when", question: "這件事發生在什麼時候？", hint: "時間點能幫助讀者進入情境", importance: "recommended", example: "上週五晚上、去年過年的時候" },
        { id: "who", question: "主角是誰？（可以是你、客戶、朋友）", hint: "有具體角色更有代入感", importance: "required", example: "我的一個學員、我媽、我自己" },
        { id: "what", question: "發生了什麼事？", hint: "簡單描述事件經過", importance: "required", example: "她突然問我一個問題..." },
        { id: "insight", question: "你從這件事學到什麼？", hint: "這是文章的核心價值", importance: "recommended", example: "我才發現原來..." },
      ],
      knowledge: [
        { id: "problem", question: "你想解決讀者的什麼問題？", hint: "越具體越好", importance: "required", example: "不知道怎麼開始經營自媒體" },
        { id: "solution", question: "你的解決方法是什麼？", hint: "可以列出 2-3 個重點", importance: "required", example: "1. 先確定受眾 2. 每天發一篇" },
        { id: "proof", question: "為什麼這個方法有效？", hint: "可以用自己或學員的經驗", importance: "recommended", example: "我用這個方法三個月漲了 5000 粉" },
      ],
      casual: [
        { id: "today", question: "今天發生了什麼事讓你想分享？", hint: "可以是很小的事", importance: "required", example: "在便利商店看到一個畫面" },
        { id: "feeling", question: "你當下的感受是什麼？", hint: "真實的情緒最動人", importance: "recommended", example: "突然覺得很感動" },
      ],
      viewpoint: [
        { id: "topic", question: "你想討論的議題是什麼？", hint: "可以是最近的熱門話題", importance: "required", example: "AI 會不會取代人類" },
        { id: "stance", question: "你的立場是什麼？", hint: "清楚表達你的觀點", importance: "required", example: "我認為不會，因為..." },
        { id: "reason", question: "為什麼你這樣想？", hint: "給出 1-2 個理由", importance: "recommended", example: "因為人類有 AI 沒有的..." },
      ],
    };
    return defaultQuestions[type] || defaultQuestions.story;
  };

  // 處理答案變更
  const handleAnswerChange = (id: string, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
  };

  // 檢查必填問題是否都有填寫
  const requiredQuestions = questions.filter(q => q.importance === "required");
  const allRequiredFilled = requiredQuestions.every(q => answers[q.id]?.trim());

  // 提交答案
  const handleSubmit = () => {
    onComplete(answers);
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">AI 教練正在準備問題...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          AI 教練引導
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 教練開場白 */}
        <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-primary mb-1">AI 教練</p>
              <p className="text-sm text-foreground/80">{coachIntro}</p>
            </div>
          </div>
        </div>

        {/* 問題列表 */}
        <div className="space-y-6">
          {questions.map((q, index) => (
            <div key={q.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                  {index + 1}
                </span>
                <Label className="font-medium">{q.question}</Label>
                <Badge 
                  variant="outline" 
                  className={
                    q.importance === "required" 
                      ? "bg-red-50 text-red-700 border-red-200" 
                      : q.importance === "recommended"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-gray-50 text-gray-700 border-gray-200"
                  }
                >
                  {q.importance === "required" ? "必填" : q.importance === "recommended" ? "建議" : "選填"}
                </Badge>
              </div>
              
              {/* 提示 */}
              <div className="flex items-start gap-2 ml-8 text-sm text-muted-foreground">
                <HelpCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{q.hint}</span>
              </div>
              
              {/* 範例 */}
              {q.example && (
                <div className="ml-8 text-sm text-muted-foreground italic">
                  例如：{q.example}
                </div>
              )}
              
              {/* 輸入框 */}
              <Textarea
                className="ml-8 w-[calc(100%-2rem)]"
                placeholder="請輸入..."
                value={answers[q.id] || ""}
                onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                rows={2}
              />
            </div>
          ))}
        </div>

        {/* 操作按鈕 */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1"
          >
            跳過，直接生成
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!allRequiredFilled}
            className="flex-1"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            完成，開始生成
          </Button>
        </div>
        
        {!allRequiredFilled && (
          <p className="text-sm text-muted-foreground text-center">
            請填寫所有必填問題後再繼續
          </p>
        )}
      </CardContent>
    </Card>
  );
}
