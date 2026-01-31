/**
 * GuidedQuestionsFlow - 問答引導流程組件
 * 
 * 功能：
 * 1. 根據內容類型顯示 2-3 個引導問題
 * 2. 用戶可以回答或跳過
 * 3. 完成後組合答案成為素材
 * 
 * v4.0 新增
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  MessageSquare,
  ChevronRight,
  SkipForward,
  Check,
  Sparkles,
} from "lucide-react";

interface GuidedQuestionsFlowProps {
  userIdea?: string;
  topicHistoryId?: number;
  contentType?: string;
  onComplete: (material: string, contentType: string, sessionId: number) => void;
  onSkip?: () => void;
}

export function GuidedQuestionsFlow({ 
  userIdea, 
  topicHistoryId, 
  contentType = "story",
  onComplete,
  onSkip,
}: GuidedQuestionsFlowProps) {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<Array<{ index: number; question: string; answer: string | null; skipped: boolean }>>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);

  // 開始會話 API
  const startSession = trpc.writingSession.start.useMutation({
    onSuccess: (data) => {
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      toast.success("開始問答引導！");
    },
    onError: (error) => {
      toast.error(`開始失敗：${error.message}`);
    },
  });

  // 更新答案 API
  const updateAnswer = trpc.writingSession.updateAnswer.useMutation({
    onError: (error) => {
      toast.error(`儲存失敗：${error.message}`);
    },
  });

  // 完成會話 API
  const completeSession = trpc.writingSession.complete.useMutation({
    onSuccess: (data) => {
      setIsCompleting(false);
      onComplete(data.material, data.contentType, data.sessionId);
    },
    onError: (error) => {
      setIsCompleting(false);
      toast.error(`完成失敗：${error.message}`);
    },
  });

  // 初始化會話
  useEffect(() => {
    if (!sessionId) {
      startSession.mutate({
        userIdea,
        topicHistoryId,
        contentType,
      });
    }
  }, []);

  // 處理回答
  const handleAnswer = () => {
    if (!sessionId) return;

    // 更新當前問題的答案
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      answer: currentAnswer,
      skipped: false,
    };
    setQuestions(updatedQuestions);

    // 儲存到後端
    updateAnswer.mutate({
      sessionId,
      questionIndex: currentQuestionIndex,
      answer: currentAnswer,
      skipped: false,
    });

    // 移動到下一題或完成
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer("");
    } else {
      handleComplete();
    }
  };

  // 處理跳過
  const handleSkip = () => {
    if (!sessionId) return;

    // 更新當前問題為跳過
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex] = {
      ...updatedQuestions[currentQuestionIndex],
      answer: null,
      skipped: true,
    };
    setQuestions(updatedQuestions);

    // 儲存到後端
    updateAnswer.mutate({
      sessionId,
      questionIndex: currentQuestionIndex,
      skipped: true,
    });

    // 移動到下一題或完成
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setCurrentAnswer("");
    } else {
      handleComplete();
    }
  };

  // 處理完成
  const handleComplete = () => {
    if (!sessionId) return;
    setIsCompleting(true);
    completeSession.mutate({ sessionId });
  };

  // 處理全部跳過
  const handleSkipAll = () => {
    if (onSkip) {
      onSkip();
    }
  };

  // 計算進度
  const progress = questions.length > 0 
    ? ((currentQuestionIndex + 1) / questions.length) * 100 
    : 0;

  // 載入中
  if (startSession.isPending || !sessionId) {
    return (
      <Card className="elegant-card">
        <CardContent className="py-8 text-center">
          <div className="animate-pulse space-y-4">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">準備問答引導中...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <Card className="elegant-card border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              問答引導
            </CardTitle>
            <CardDescription className="mt-1">
              回答幾個問題，幫助 AI 更了解你想表達的內容
            </CardDescription>
          </div>
          <div className="text-sm text-muted-foreground">
            {currentQuestionIndex + 1} / {questions.length}
          </div>
        </div>
        <Progress value={progress} className="h-1 mt-3" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 用戶的 Idea 預覽 */}
        {userIdea && currentQuestionIndex === 0 && (
          <div className="bg-muted/30 rounded-lg p-3 mb-4">
            <div className="text-xs text-muted-foreground mb-1">你的想法：</div>
            <div className="text-sm">{userIdea}</div>
          </div>
        )}

        {/* 當前問題 */}
        {currentQuestion && (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-xl p-4">
              <div className="text-lg font-medium text-foreground">
                {currentQuestion.question}
              </div>
            </div>

            <Textarea
              placeholder="在這裡輸入你的回答..."
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              rows={4}
              className="resize-none"
            />

            {/* 操作按鈕 */}
            <div className="flex items-center gap-3">
              <Button 
                onClick={handleAnswer}
                disabled={!currentAnswer.trim() || updateAnswer.isPending}
                className="flex-1"
              >
                {currentQuestionIndex < questions.length - 1 ? (
                  <>
                    下一題
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    開始生成
                  </>
                )}
              </Button>
              
              <Button 
                variant="ghost"
                onClick={handleSkip}
                disabled={updateAnswer.isPending}
              >
                <SkipForward className="w-4 h-4 mr-1" />
                跳過
              </Button>
            </div>
          </div>
        )}

        {/* 全部跳過選項 */}
        {currentQuestionIndex === 0 && onSkip && (
          <div className="text-center pt-2">
            <button
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={handleSkipAll}
            >
              我已經有想法了，跳過問答直接生成
            </button>
          </div>
        )}

        {/* 已回答的問題摘要 */}
        {currentQuestionIndex > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="text-xs text-muted-foreground mb-2">已回答：</div>
            <div className="space-y-2">
              {questions.slice(0, currentQuestionIndex).map((q, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <div className="text-muted-foreground">
                    {q.skipped ? (
                      <span className="italic">已跳過</span>
                    ) : (
                      <span className="line-clamp-1">{q.answer}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 完成中 */}
        {isCompleting && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center space-y-4">
              <Sparkles className="w-12 h-12 mx-auto text-primary animate-pulse" />
              <p className="text-lg font-medium">正在組合你的素材...</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
