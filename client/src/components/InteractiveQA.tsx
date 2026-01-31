/**
 * InteractiveQA - 互動式問答流程組件
 * 
 * AI 根據選題和貼文類型動態生成問題，像對話一樣
 */

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MessageSquare,
  Send,
  RefreshCw,
  Check,
  ArrowRight,
  SkipForward,
} from "lucide-react";

interface QAItem {
  question: string;
  answer: string;
}

interface InteractiveQAProps {
  topic: string;
  contentType: string;
  onComplete: (material: string) => void;
  onSkip: () => void;
}

export function InteractiveQA({ topic, contentType, onComplete, onSkip }: InteractiveQAProps) {
  const [qaHistory, setQaHistory] = useState<QAItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestComplete, setSuggestComplete] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // 生成下一個問題
  const generateNextQuestion = trpc.writingSession.generateNextQuestion.useMutation({
    onSuccess: (data) => {
      if (data.suggestComplete) {
        setSuggestComplete(true);
        setCurrentQuestion(null);
        toast.success(data.message || "資訊已經足夠了！");
      } else {
        setCurrentQuestion(data.question);
      }
      setIsLoading(false);
    },
    onError: () => {
      toast.error("生成問題失敗，請稍後再試");
      setIsLoading(false);
    },
  });
  
  // 初始化：生成第一個問題
  useEffect(() => {
    if (!currentQuestion && qaHistory.length === 0 && !isLoading) {
      setIsLoading(true);
      generateNextQuestion.mutate({
        topic,
        contentType,
        previousQA: [],
      });
    }
  }, [topic, contentType]);
  
  // 滾動到最新訊息
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaHistory, currentQuestion]);
  
  // 提交答案
  const handleSubmitAnswer = () => {
    if (!currentAnswer.trim() || !currentQuestion) return;
    
    const newQA = {
      question: currentQuestion,
      answer: currentAnswer.trim(),
    };
    
    const updatedHistory = [...qaHistory, newQA];
    setQaHistory(updatedHistory);
    setCurrentAnswer("");
    setCurrentQuestion(null);
    
    // 生成下一個問題
    setIsLoading(true);
    generateNextQuestion.mutate({
      topic,
      contentType,
      previousQA: updatedHistory,
    });
  };
  
  // 跳過當前問題
  const handleSkipQuestion = () => {
    if (!currentQuestion) return;
    
    setCurrentQuestion(null);
    
    // 生成下一個問題
    setIsLoading(true);
    generateNextQuestion.mutate({
      topic,
      contentType,
      previousQA: qaHistory,
    });
  };
  
  // 完成問答，組合素材
  const handleComplete = () => {
    let material = `選題：${topic}\n\n`;
    
    if (qaHistory.length > 0) {
      material += "問答補充：\n";
      material += qaHistory.map(qa => `問：${qa.question}\n答：${qa.answer}`).join("\n\n");
    }
    
    onComplete(material);
  };
  
  // 取得貼文類型名稱
  const getContentTypeName = (type: string) => {
    const names: Record<string, string> = {
      story: "故事型",
      knowledge: "知識型",
      viewpoint: "觀點型",
      casual: "閒聊型",
      contrast: "反差型",
      dialogue: "對話型",
      diagnosis: "診斷型",
      summary: "整理型",
      quote: "金句型",
      question: "問答型",
      poll: "投票型",
    };
    return names[type] || type;
  };
  
  return (
    <Card className="elegant-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-primary" />
          AI 寫作教練
        </CardTitle>
        <CardDescription>
          讓我問你幾個問題，幫你收集寫文素材
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 選題和類型顯示 */}
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline">選題</Badge>
            <span className="text-sm">{topic}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">類型</Badge>
            <span className="text-sm">{getContentTypeName(contentType)}</span>
          </div>
        </div>
        
        {/* 對話歷史 */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {qaHistory.map((qa, index) => (
            <div key={index} className="space-y-2">
              {/* AI 問題 */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-muted/50 rounded-lg p-3 flex-1">
                  <p className="text-sm">{qa.question}</p>
                </div>
              </div>
              
              {/* 用戶回答 */}
              <div className="flex items-start gap-3 justify-end">
                <div className="bg-primary/10 rounded-lg p-3 max-w-[80%]">
                  <p className="text-sm">{qa.answer}</p>
                </div>
              </div>
            </div>
          ))}
          
          {/* 當前問題 */}
          {currentQuestion && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted/50 rounded-lg p-3 flex-1">
                <p className="text-sm">{currentQuestion}</p>
              </div>
            </div>
          )}
          
          {/* 載入中 */}
          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <RefreshCw className="w-4 h-4 text-primary animate-spin" />
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">AI 正在思考...</p>
              </div>
            </div>
          )}
          
          {/* 建議完成 */}
          {suggestComplete && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div className="bg-green-50 rounded-lg p-3 flex-1">
                <p className="text-sm text-green-700">
                  資訊已經足夠了！可以開始生成文案了。
                </p>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
        
        {/* 回答輸入區 */}
        {currentQuestion && !isLoading && (
          <div className="space-y-3">
            <Textarea
              placeholder="輸入你的回答..."
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              className="min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitAnswer();
                }
              }}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim()}
                className="flex-1"
              >
                <Send className="w-4 h-4 mr-1" />
                送出
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipQuestion}
              >
                <SkipForward className="w-4 h-4 mr-1" />
                跳過
              </Button>
            </div>
          </div>
        )}
        
        {/* 完成按鈕 */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1"
          >
            跳過問答，直接生成
          </Button>
          <Button
            onClick={handleComplete}
            disabled={qaHistory.length === 0 && !suggestComplete}
            className="flex-1"
          >
            {qaHistory.length > 0 || suggestComplete ? (
              <>
                <Check className="w-4 h-4 mr-1" />
                夠了，開始生成
              </>
            ) : (
              <>
                <ArrowRight className="w-4 h-4 mr-1" />
                回答問題後繼續
              </>
            )}
          </Button>
        </div>
        
        {/* 進度提示 */}
        {qaHistory.length > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            已回答 {qaHistory.length} 個問題
            {qaHistory.length >= 2 && "，資訊應該足夠了"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
