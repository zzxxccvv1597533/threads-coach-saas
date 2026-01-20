/**
 * ContentDiff 組件
 * 
 * 用於顯示內容修改前後的差異
 * 使用簡單的字串比對算法，高亮顯示新增和刪除的部分
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface ContentDiffProps {
  original: string;
  modified: string;
  className?: string;
  showSideBySide?: boolean; // 是否並排顯示
}

interface DiffSegment {
  type: 'unchanged' | 'added' | 'removed';
  text: string;
}

/**
 * 簡單的 Diff 算法
 * 基於最長公共子序列（LCS）的簡化版本
 */
function computeDiff(original: string, modified: string): DiffSegment[] {
  // 按段落分割
  const originalParts = original.split(/(\n+)/);
  const modifiedParts = modified.split(/(\n+)/);
  
  const result: DiffSegment[] = [];
  
  // 使用簡單的逐行比對
  let i = 0;
  let j = 0;
  
  while (i < originalParts.length || j < modifiedParts.length) {
    const origPart = originalParts[i] || '';
    const modPart = modifiedParts[j] || '';
    
    if (origPart === modPart) {
      // 相同
      if (origPart) {
        result.push({ type: 'unchanged', text: origPart });
      }
      i++;
      j++;
    } else if (modifiedParts.slice(j).includes(origPart)) {
      // 原文在後面出現，表示有新增內容
      result.push({ type: 'added', text: modPart });
      j++;
    } else if (originalParts.slice(i).includes(modPart)) {
      // 修改後的內容在原文後面出現，表示有刪除內容
      result.push({ type: 'removed', text: origPart });
      i++;
    } else {
      // 完全不同，標記為刪除+新增
      if (origPart) {
        result.push({ type: 'removed', text: origPart });
      }
      if (modPart) {
        result.push({ type: 'added', text: modPart });
      }
      i++;
      j++;
    }
  }
  
  return result;
}

/**
 * 計算修改統計
 */
function computeStats(original: string, modified: string): {
  charDiff: number;
  percentChange: number;
} {
  const charDiff = modified.length - original.length;
  const percentChange = original.length > 0 
    ? Math.round((charDiff / original.length) * 100) 
    : 0;
  
  return { charDiff, percentChange };
}

export function ContentDiff({ 
  original, 
  modified, 
  className,
  showSideBySide = false 
}: ContentDiffProps) {
  const diff = useMemo(() => computeDiff(original, modified), [original, modified]);
  const stats = useMemo(() => computeStats(original, modified), [original, modified]);
  
  if (showSideBySide) {
    return (
      <div className={cn("grid grid-cols-2 gap-4", className)}>
        {/* 原始版本 */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            修改前
          </div>
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg text-sm whitespace-pre-wrap">
            {original}
          </div>
        </div>
        
        {/* 修改後版本 */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            修改後
            {stats.charDiff !== 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                stats.charDiff > 0 
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                {stats.charDiff > 0 ? '+' : ''}{stats.charDiff} 字
              </span>
            )}
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm whitespace-pre-wrap">
            {modified}
          </div>
        </div>
      </div>
    );
  }
  
  // 內聯 Diff 顯示
  return (
    <div className={cn("space-y-3", className)}>
      {/* 統計資訊 */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          新增
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          刪除
        </span>
        {stats.charDiff !== 0 && (
          <span className={cn(
            "ml-auto px-2 py-0.5 rounded text-xs",
            stats.charDiff > 0 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {stats.charDiff > 0 ? '+' : ''}{stats.charDiff} 字 ({stats.percentChange > 0 ? '+' : ''}{stats.percentChange}%)
          </span>
        )}
      </div>
      
      {/* Diff 內容 */}
      <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
        {diff.map((segment, index) => {
          if (segment.type === 'unchanged') {
            return <span key={index}>{segment.text}</span>;
          }
          if (segment.type === 'added') {
            return (
              <span 
                key={index} 
                className="bg-green-200 dark:bg-green-900/50 text-green-900 dark:text-green-100 px-0.5 rounded"
              >
                {segment.text}
              </span>
            );
          }
          if (segment.type === 'removed') {
            return (
              <span 
                key={index} 
                className="bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-100 line-through px-0.5 rounded"
              >
                {segment.text}
              </span>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

/**
 * 簡化版 Diff 顯示（只顯示修改後的內容，帶有變化指示）
 */
export function ContentDiffSimple({ 
  original, 
  modified, 
  className 
}: Omit<ContentDiffProps, 'showSideBySide'>) {
  const stats = useMemo(() => computeStats(original, modified), [original, modified]);
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* 變化指示 */}
      {stats.charDiff !== 0 && (
        <div className="flex items-center gap-2 text-xs">
          <span className={cn(
            "px-2 py-0.5 rounded",
            stats.charDiff > 0 
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {stats.charDiff > 0 ? '增加' : '減少'} {Math.abs(stats.charDiff)} 字
          </span>
          <span className="text-muted-foreground">
            ({stats.percentChange > 0 ? '+' : ''}{stats.percentChange}%)
          </span>
        </div>
      )}
      
      {/* 修改後的內容 */}
      <div className="p-3 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap">
        {modified}
      </div>
    </div>
  );
}

export default ContentDiff;
