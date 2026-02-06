import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, LayoutDashboard, AlertTriangle, Lightbulb, BarChart3, Loader2, Play, Send, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/PermissionGuard';
import {
  aiSettingsOptions,
  aiPredictionsOptions,
  aiRecommendationsOptions,
  aiWashWindowsOptions,
  aiDriverPatternsOptions,
  aiSiteInsightsOptions,
  aiPatternSummaryOptions,
} from '@/query/options/aiInsights';
import { callEdgeFunction, supabase } from '@/lib/supabase';
import AIInsightsOverview from '@/components/ai-insights/AIInsightsOverview';
import AIInsightsRiskPredictions from '@/components/ai-insights/AIInsightsRiskPredictions';
import AIInsightsRecommendations from '@/components/ai-insights/AIInsightsRecommendations';
import AIInsightsPatterns from '@/components/ai-insights/AIInsightsPatterns';
import AIInsightsModelSwitcher from '@/components/ai-insights/AIInsightsModelSwitcher';

export default function AIInsights() {
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const companyId = permissions.userProfile?.company_id;
  const isSuperAdmin = permissions.isSuperAdmin;
  const canRunFleetAnalysis = permissions.isAdmin; // Super Admin and Admin only

  const today = new Date().toISOString().split('T')[0];
  const { data: predictions = [], isLoading: predictionsLoading } = useQuery(
    aiPredictionsOptions(companyId, today)
  );
  const { data: recommendations = [], isLoading: recsLoading } = useQuery(
    aiRecommendationsOptions(companyId)
  );
  const { data: washWindows = [] } = useQuery(aiWashWindowsOptions(companyId));
  const { data: driverPatterns = [] } = useQuery(aiDriverPatternsOptions(companyId));
  const { data: siteInsights = [] } = useQuery(aiSiteInsightsOptions(companyId));
  const { data: patternSummary = null } = useQuery(aiPatternSummaryOptions(companyId));
  const { data: aiSettings = {} } = useQuery(aiSettingsOptions());

  const [activeTab, setActiveTab] = useState('overview');

  const atRiskCount = predictions.filter((p) => ['critical', 'high'].includes(p.risk_level)).length;
  const criticalCount = predictions.filter((p) => p.risk_level === 'critical').length;
  const highCount = predictions.filter((p) => p.risk_level === 'high').length;
  const pendingRecs = recommendations.filter((r) => r.status === 'pending').length;
  const highPriorityRecs = recommendations.filter((r) => r.priority === 'high' || r.priority === 'critical').length;

  const [runFleetLoading, setRunFleetLoading] = useState(false);

  const invalidateAiQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPredictions'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiRecommendations'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiWashWindows'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiDriverPatterns'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiSiteInsights'] });
    queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPatternSummary'] });
  };

  const runFleetAnalysis = async (options = {}) => {
    if (!canRunFleetAnalysis) return null;
    const { offset = 0, limit } = options;
    setRunFleetLoading(true);
    try {
      const payload = { company_id: companyId, offset };
      if (limit != null) payload.limit = limit;
      const res = await callEdgeFunction('analyze-fleet', payload);
      const data = res?.data ?? res ?? {};
      const analyzed = data?.analyzed ?? 0;
      const total = data?.total ?? 0;
      const hasMore = data?.has_more ?? false;
      const message = data?.message;
      if (message) {
        if (analyzed === 0) {
          toast.error('No vehicles to analyze', { description: message });
        } else {
          toast.success(hasMore ? 'Batch complete' : 'Fleet analysis complete', { description: message });
        }
      } else if (analyzed > 0 || hasMore) {
        toast.success(hasMore ? 'Batch complete' : 'Fleet analysis complete', { description: `Analyzed ${analyzed} vehicles.` });
      } else {
        toast.success('Fleet analysis started', { description: 'AI analysis is running. Results will appear shortly.' });
      }
      invalidateAiQueries();
      return { ...data, has_more: hasMore, next_offset: data?.next_offset ?? offset + analyzed };
    } catch (err) {
      toast.error('Analysis failed', { description: err?.message || 'Could not start fleet analysis' });
      return null;
    } finally {
      setRunFleetLoading(false);
    }
  };

  const runFleetAnalysisAll = async () => {
    if (!canRunFleetAnalysis) return;
    setRunFleetLoading(true);
    let offset = 0;
    let totalProcessed = 0;
    let lastMessage = null;
    try {
      while (true) {
        // Refresh session before each batch so the token does not expire during long runs
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error('Session expired', { description: 'Please sign in again and run Process all.' });
          break;
        }
        await supabase.auth.refreshSession();
        const payload = { company_id: companyId, offset };
        const res = await callEdgeFunction('analyze-fleet', payload);
        const data = res?.data ?? res ?? {};
        const analyzed = data?.analyzed ?? 0;
        const hasMore = data?.has_more ?? false;
        const total = data?.total ?? 0;
        const message = data?.message;
        if (message) lastMessage = message;
        totalProcessed += analyzed;
        if (analyzed > 0) {
          toast.success('Processing fleet…', {
            description: `Processed ${totalProcessed} of ${total} vehicles.${hasMore ? ' Continuing…' : ''}`,
          });
        }
        invalidateAiQueries();
        if (!hasMore || analyzed === 0) break;
        offset = data?.next_offset ?? offset + analyzed;
      }
      if (totalProcessed > 0) {
        toast.success('Fleet analysis complete', {
          description: `All ${totalProcessed} vehicles have been analyzed.`,
        });
      } else if (lastMessage) {
        toast.error('No vehicles to analyze', { description: lastMessage });
      } else {
        toast.error('Fleet analysis complete', { description: 'No vehicles were analyzed.' });
      }
      invalidateAiQueries();
    } catch (err) {
      toast.error('Analysis failed', { description: err?.message || 'Could not complete fleet analysis' });
    } finally {
      setRunFleetLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header: title + Powered by ELORA AI + Super Admin model switcher & trigger */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Powered by ELORA AI</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">AI Insights</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Intelligent wash optimization & predictions</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canRunFleetAnalysis && (
            <>
              <AIInsightsModelSwitcher />
              {/* Run batch (18 vehicles) - hidden; Process all vehicles is used instead
              <Button
                variant="outline"
                size="sm"
                onClick={() => runFleetAnalysis()}
                disabled={runFleetLoading}
              >
                {runFleetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-2">Run batch (18 vehicles)</span>
              </Button>
              */}
              <Button
                size="sm"
                onClick={runFleetAnalysisAll}
                disabled={runFleetLoading}
              >
                {runFleetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                <span className="ml-2">Process all vehicles</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 rounded-lg p-1 h-auto flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Risk Predictions
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Lightbulb className="h-4 w-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="patterns" className="data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <BarChart3 className="h-4 w-4 mr-2" />
            Patterns
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <AIInsightsOverview
            atRiskCount={atRiskCount}
            pendingRecs={pendingRecs}
            highPriorityRecs={highPriorityRecs}
            predictions={predictions}
            recommendations={recommendations}
            washWindows={washWindows}
            driverPatterns={driverPatterns}
            siteInsights={siteInsights}
            isLoading={predictionsLoading || recsLoading}
            isSuperAdmin={isSuperAdmin}
            onViewAllAtRisk={() => setActiveTab('risk')}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPredictions'] });
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiRecommendations'] });
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiWashWindows'] });
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiDriverPatterns'] });
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiSiteInsights'] });
              queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPatternSummary'] });
            }}
          />
        </TabsContent>

        <TabsContent value="risk" className="mt-4">
          <AIInsightsRiskPredictions
            predictions={predictions}
            isLoading={predictionsLoading}
            isSuperAdmin={isSuperAdmin}
            canSendAlerts={permissions.isAdmin}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiPredictions'] })}
          />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <AIInsightsRecommendations
            recommendations={recommendations}
            isLoading={recsLoading}
            onRefresh={() => queryClient.invalidateQueries({ queryKey: ['tenant', companyId, 'aiRecommendations'] })}
          />
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <AIInsightsPatterns companyId={companyId} patternSummary={patternSummary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
