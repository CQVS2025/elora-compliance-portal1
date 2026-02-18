import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * AI Insights Box Component
 * Displays AI-generated insights with gradient background
 * 
 * @param {string} title - Main title/summary
 * @param {string} description - Detailed description
 * @param {number} confidence - Confidence percentage (optional)
 * @param {string} className - Additional CSS classes
 */
export default function AIInsightsBox({ title, description, confidence, className }) {
  return (
    <Card className={cn('bg-gradient-to-br from-primary to-blue-600 text-primary-foreground border-0 shadow-lg dark:from-primary dark:to-blue-700', className)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary-foreground/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg text-primary-foreground">✨ AI Summary</h3>
              <span className="text-xs bg-primary-foreground/20 px-2 py-0.5 rounded-full text-primary-foreground">
                Based on Washout Sensor Data + WES Scoring
              </span>
            </div>
            {title && (
              <p className="font-semibold text-base mb-2">
                {title}
              </p>
            )}
            {description && (
              <p className="text-sm leading-relaxed opacity-95">
                {description}
              </p>
            )}
            {confidence && (
              <div className="mt-3 text-xs opacity-80">
                Confidence: {confidence}%
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Compact AI Insight for vehicle detail pages
 */
export function CompactAIInsight({ children, className }) {
  return (
    <div className={cn('bg-primary/5 border border-primary/20 rounded-lg p-4 dark:bg-primary/10 dark:border-primary/30', className)}>
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-foreground mb-1">🤖 Elora AI:</div>
          <div className="text-sm text-muted-foreground leading-relaxed">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
