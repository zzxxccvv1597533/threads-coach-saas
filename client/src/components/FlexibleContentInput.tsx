import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  MessageCircle, 
  HelpCircle, 
  Vote, 
  Lightbulb,
  BookOpen,
  ListOrdered,
  MessageSquare,
  Quote,
  Zap,
  Coffee,
  Plus,
  X,
} from "lucide-react";

// 內容類型配置
const contentTypeConfig = {
  question: {
    name: "提問型",
    icon: <HelpCircle className="w-4 h-4" />,
    description: "丟出一個問題，引發討論",
    hint: "只需要輸入問題主題，AI 會幫你設計引發討論的問題",
    structure: "simple",
    fields: [
      { id: "topic", label: "問題主題", placeholder: "例如：MBTI 跟八字哪個準？", type: "input" }
    ],
  },
  poll: {
    name: "投票型",
    icon: <Vote className="w-4 h-4" />,
    description: "讓大家投票選擇",
    hint: "輸入主題和選項，AI 會幫你設計投票貼文",
    structure: "poll",
    fields: [
      { id: "topic", label: "投票主題", placeholder: "例如：早起 vs 熬夜，你是哪一派？", type: "input" },
      { id: "options", label: "選項（可多個）", placeholder: "", type: "options" }
    ],
  },
  viewpoint: {
    name: "觀點型",
    icon: <Lightbulb className="w-4 h-4" />,
    description: "表達你的立場和看法",
    hint: "輸入你的觀點，AI 會幫你論述",
    structure: "argument",
    fields: [
      { id: "stance", label: "你的觀點/立場", placeholder: "例如：我認為內向的人更適合經營社群", type: "input" },
      { id: "reason", label: "為什麼這樣想（選填）", placeholder: "例如：因為內向的人更擅長深度思考...", type: "textarea" }
    ],
  },
  contrast: {
    name: "反差型",
    icon: <Zap className="w-4 h-4" />,
    description: "打破認知，製造驚喜",
    hint: "輸入大家以為的事，和真實的情況",
    structure: "twist",
    fields: [
      { id: "common_belief", label: "大家以為的", placeholder: "例如：很多人以為經營社群要很外向", type: "input" },
      { id: "truth", label: "其實是", placeholder: "例如：其實內向的人更有優勢", type: "input" }
    ],
  },
  casual: {
    name: "閒聊型",
    icon: <Coffee className="w-4 h-4" />,
    description: "日常分享，輕鬆互動",
    hint: "輸入想聊的話題，AI 會幫你寫成輕鬆的貼文",
    structure: "free",
    fields: [
      { id: "topic", label: "想聊什麼", placeholder: "例如：今天發現了一個超好用的 App...", type: "textarea" }
    ],
  },
  dialogue: {
    name: "對話型",
    icon: <MessageSquare className="w-4 h-4" />,
    description: "問答形式，像在對話",
    hint: "輸入別人問你的問題，AI 會幫你設計對話式貼文",
    structure: "qa",
    fields: [
      { id: "question", label: "別人問你的問題", placeholder: "例如：朋友問我：「你怎麼知道自己適合什麼？」", type: "input" },
      { id: "context", label: "你想怎麼回答（選填）", placeholder: "例如：我想從自我探索的角度來回答...", type: "textarea" }
    ],
  },
  quote: {
    name: "引用型",
    icon: <Quote className="w-4 h-4" />,
    description: "引用名言，分享感想",
    hint: "輸入你想引用的話，AI 會幫你延伸",
    structure: "reflection",
    fields: [
      { id: "quote", label: "引用的話", placeholder: "例如：「成功不是終點，失敗也不是終結。」", type: "input" },
      { id: "reflection", label: "你的感想（選填）", placeholder: "例如：這句話讓我想到最近的經歷...", type: "textarea" }
    ],
  },
  story: {
    name: "故事型",
    icon: <BookOpen className="w-4 h-4" />,
    description: "分享經歷，說個故事",
    hint: "輸入你的故事素材，AI 會幫你整理成吸引人的敘事",
    structure: "narrative",
    fields: [
      { id: "material", label: "故事素材", placeholder: "例如：今天有個案主來問我，她說她一直很想開始經營社群，但總是覺得自己沒什麼好分享的...", type: "textarea" }
    ],
  },
  knowledge: {
    name: "知識型",
    icon: <Lightbulb className="w-4 h-4" />,
    description: "分享專業知識",
    hint: "輸入你想分享的知識點，AI 會幫你整理成易讀的內容",
    structure: "golden",
    fields: [
      { id: "material", label: "知識內容", placeholder: "例如：塔羅牌的三個常見誤解...", type: "textarea" }
    ],
  },
  summary: {
    name: "整理型",
    icon: <ListOrdered className="w-4 h-4" />,
    description: "清單式整理",
    hint: "輸入主題，AI 會幫你整理成清單",
    structure: "list",
    fields: [
      { id: "material", label: "整理主題", placeholder: "例如：5個讓你更有魅力的小習慣", type: "input" },
      { id: "count", label: "要幾點", placeholder: "例如：5", type: "input" }
    ],
  },
};

interface FlexibleContentInputProps {
  selectedType: string;
  onTypeChange: (type: string) => void;
  onGenerate: (data: Record<string, string | string[]>) => void;
  isGenerating: boolean;
}

export default function FlexibleContentInput({
  selectedType,
  onTypeChange,
  onGenerate,
  isGenerating,
}: FlexibleContentInputProps) {
  const [formData, setFormData] = useState<Record<string, string | string[]>>({});
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const config = contentTypeConfig[selectedType as keyof typeof contentTypeConfig];

  useEffect(() => {
    // 切換類型時重置表單
    setFormData({});
    setPollOptions(["", ""]);
  }, [selectedType]);

  const handleFieldChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleAddOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const handleSubmit = () => {
    const data = { ...formData };
    if (selectedType === "poll") {
      data.options = pollOptions.filter(o => o.trim());
    }
    onGenerate(data);
  };

  // 簡單類型（提問、閒聊）的快速入口
  const simpleTypes = ["question", "poll", "casual"];
  // 需要更多輸入的類型
  const advancedTypes = ["viewpoint", "contrast", "dialogue", "quote", "story", "knowledge", "summary"];

  return (
    <div className="space-y-6">
      {/* 類型選擇 - 分組顯示 */}
      <Card className="elegant-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            選擇內容類型
          </CardTitle>
          <CardDescription>
            不同類型有不同的輸入需求，選擇最適合你的
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 快速互動類型 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">快速互動</Label>
            <div className="grid grid-cols-3 gap-2">
              {simpleTypes.map(type => {
                const typeConfig = contentTypeConfig[type as keyof typeof contentTypeConfig];
                return (
                  <button
                    key={type}
                    onClick={() => onTypeChange(type)}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
                      selectedType === type
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    {typeConfig.icon}
                    <span className="text-sm font-medium">{typeConfig.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 進階內容類型 */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">進階內容</Label>
            <RadioGroup
              value={selectedType}
              onValueChange={onTypeChange}
              className="grid grid-cols-2 md:grid-cols-4 gap-2"
            >
              {advancedTypes.map(type => {
                const typeConfig = contentTypeConfig[type as keyof typeof contentTypeConfig];
                return (
                  <div key={type} className="flex items-center space-x-2">
                    <RadioGroupItem value={type} id={type} />
                    <Label htmlFor={type} className="text-sm cursor-pointer flex items-center gap-1">
                      {typeConfig.icon}
                      {typeConfig.name}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* 動態輸入表單 */}
      {config && (
        <Card className="elegant-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {config.icon}
                {config.name}
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {config.structure === "simple" ? "簡單結構" : 
                 config.structure === "poll" ? "投票結構" :
                 config.structure === "free" ? "自由結構" : "完整結構"}
              </Badge>
            </div>
            <CardDescription>{config.hint}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config.fields.map(field => (
              <div key={field.id} className="space-y-2">
                <Label>{field.label}</Label>
                {field.type === "input" ? (
                  <Input
                    placeholder={field.placeholder}
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                  />
                ) : field.type === "textarea" ? (
                  <Textarea
                    placeholder={field.placeholder}
                    value={(formData[field.id] as string) || ""}
                    onChange={(e) => handleFieldChange(field.id, e.target.value)}
                    rows={4}
                  />
                ) : field.type === "options" ? (
                  <div className="space-y-2">
                    {pollOptions.map((option, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder={`選項 ${index + 1}`}
                          value={option}
                          onChange={(e) => handleOptionChange(index, e.target.value)}
                        />
                        {pollOptions.length > 2 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveOption(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 6 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddOption}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        新增選項
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
            ))}

            <Button
              onClick={handleSubmit}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? "生成中..." : "生成貼文"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
