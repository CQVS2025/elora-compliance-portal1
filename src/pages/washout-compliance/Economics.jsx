import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, TrendingDown, PiggyBank, AlertTriangle } from 'lucide-react';
import MetricCard from '@/components/washout-compliance/MetricCard';
import WashoutEmptyState from '@/components/washout-compliance/WashoutEmptyState';
import { useWashoutFilteredData } from '@/hooks/useWashoutFilteredData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CHART_TOOLTIP_STYLES } from '@/components/washout-compliance/chartTheme';

export default function Economics() {
  const navigate = useNavigate();
  const washoutData = useWashoutFilteredData();
  const { vehicles, showEmptyState, isLoading, emptyMessage } = washoutData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (showEmptyState) {
    return <WashoutEmptyState message={emptyMessage} title="Economics & ROI Analysis" subtitle="Cost savings from dedagging prevention" />;
  }

  const vehicleCount = vehicles?.length ?? 0;
  const vehiclesAtRisk = (vehicles || []).filter(v => v.buildupRisk === 'High' || v.buildupRisk === 'Critical');
  const totalPotentialCost = vehiclesAtRisk.reduce((sum, v) => sum + (v.estimatedCost || 0), 0);
  const monthlyWashCost = vehicleCount * 340 * 0.002 * 16; // 340L * $0.002/L * 16 washes/month
  const estimatedSavings = 127000; // From FLEET_METRICS
  const roi = monthlyWashCost ? ((estimatedSavings - monthlyWashCost) / monthlyWashCost * 100).toFixed(0) : '0';

  const mainRef = useRef(null);
  useGSAP(() => {
    const ctx = mainRef.current;
    if (!ctx) return;
    const els = ctx.querySelectorAll('.gsap-fade-up');
    if (els.length) gsap.from(els, { opacity: 0, y: 18, duration: 0.4, stagger: 0.07, ease: 'power2.out' });
  }, { scope: mainRef });

  // Cost breakdown data
  const costBreakdownData = [
    { name: 'Water Cost', value: monthlyWashCost.toFixed(0) },
    { name: 'Potential Dedagging', value: totalPotentialCost },
    { name: 'Savings Realized', value: estimatedSavings }
  ];
  // Blue theme: Water = chart-3, Dedagging = red, Savings = primary
  const PIE_COLORS = ['hsl(var(--chart-3))', 'hsl(var(--chart-critical))', 'hsl(var(--primary))'];

  const monthlyTrendData = [
    { month: 'Oct', washCost: 2800, dedaggingCost: 34000, savings: 98000 },
    { month: 'Nov', washCost: 2900, dedaggingCost: 28000, savings: 112000 },
    { month: 'Dec', washCost: 2850, dedaggingCost: 31000, savings: 105000 },
    { month: 'Jan', washCost: 2920, dedaggingCost: 26000, savings: 119000 },
    { month: 'Feb', washCost: 2880, dedaggingCost: 25800, savings: 127000 }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Economics & ROI Analysis</h1>
              <p className="text-muted-foreground mt-1">Cost savings from dedagging prevention</p>
            </div>
            <Button onClick={() => navigate('/washout-compliance')}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <main ref={mainRef} className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="gsap-fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Monthly Wash Cost"
            value={`$${(monthlyWashCost / 1000).toFixed(1)}K`}
            label="Water & operations"
            icon={DollarSign}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
          <MetricCard
            title="Potential Dedagging Cost"
            value={`$${(totalPotentialCost / 1000).toFixed(1)}K`}
            label="If not addressed"
            icon={AlertTriangle}
            iconBgColor="bg-chart-critical/10 dark:bg-chart-critical/20"
            iconColor="text-chart-critical"
          />
          <MetricCard
            title="Estimated Savings"
            value={`$${(estimatedSavings / 1000).toFixed(0)}K`}
            label="This month"
            icon={PiggyBank}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
          <MetricCard
            title="ROI"
            value={`${roi}%`}
            label="Return on investment"
            icon={TrendingUp}
            iconBgColor="bg-primary/10 dark:bg-primary/20"
            iconColor="text-primary"
          />
        </div>

        {/* Cost Comparison */}
        <div className="gsap-fade-up grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <p className="text-sm text-muted-foreground">Monthly cost analysis</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={costBreakdownData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: $${(value / 1000).toFixed(0)}K`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {costBreakdownData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`$${(Number(value) / 1000).toFixed(1)}K`, name]}
                    contentStyle={CHART_TOOLTIP_STYLES.contentStyle}
                    labelStyle={CHART_TOOLTIP_STYLES.labelStyle}
                    itemStyle={CHART_TOOLTIP_STYLES.itemStyle}
                    wrapperStyle={CHART_TOOLTIP_STYLES.wrapperStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
              <p className="text-sm text-muted-foreground">Last 5 months</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyTrendData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                    formatter={(value, name) => [`$${(Number(value) / 1000).toFixed(1)}K`, name]}
                    contentStyle={CHART_TOOLTIP_STYLES.contentStyle}
                    labelStyle={CHART_TOOLTIP_STYLES.labelStyle}
                    itemStyle={CHART_TOOLTIP_STYLES.itemStyle}
                    wrapperStyle={CHART_TOOLTIP_STYLES.wrapperStyle}
                  />
                  <Bar dataKey="savings" fill="hsl(var(--primary))" name="Savings" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="dedaggingCost" fill="hsl(var(--chart-critical))" name="Dedagging Cost" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="washCost" fill="hsl(var(--chart-3))" name="Wash Cost" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Analysis */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Analysis Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10 dark:border-primary p-4 rounded-r-lg">
                <h4 className="font-semibold text-foreground mb-2">Washout Operating Costs</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Water consumption: 340L per washout @ $0.002/L</li>
                  <li>• Average 16 washouts per vehicle per month</li>
                  <li>• Fleet of {vehicleCount} vehicles</li>
                  <li>• <strong>Total monthly cost: ${monthlyWashCost.toFixed(0)}</strong></li>
                </ul>
              </div>

              <div className="border-l-4 border-destructive bg-destructive/10 dark:bg-destructive/20 dark:border-destructive p-4 rounded-r-lg">
                <h4 className="font-semibold text-foreground mb-2">Dedagging Costs (Avoided)</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Average dedagging cost: $8,600 per vehicle</li>
                  <li>• {vehiclesAtRisk.length} vehicles currently at risk</li>
                  <li>• Includes labor, downtime, and disposal</li>
                  <li>• <strong>Potential cost: ${totalPotentialCost.toLocaleString()}</strong></li>
                </ul>
              </div>

              <div className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10 p-4 rounded-r-lg">
                <h4 className="font-semibold text-foreground mb-2">Savings Realized</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Prevented dedagging through early intervention</li>
                  <li>• Reduced vehicle downtime</li>
                  <li>• Extended equipment lifespan</li>
                  <li>• <strong>Total savings this month: ${estimatedSavings.toLocaleString()}</strong></li>
                </ul>
              </div>

              <div className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10 p-4 rounded-r-lg">
                <h4 className="font-semibold text-foreground mb-2">Return on Investment</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• ROI: {roi}% per month</li>
                  <li>• Payback period: &lt;1 month</li>
                  <li>• Annual projected savings: ${(estimatedSavings * 12 / 1000).toFixed(0)}K</li>
                  <li>• <strong>System pays for itself immediately</strong></li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Insights */}
        <Card className="gsap-fade-up bg-gradient-to-br from-primary to-blue-600 text-primary-foreground border-0 dark:from-primary dark:to-blue-700">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-foreground/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-bold text-xl mb-3 text-primary-foreground">Key Economic Benefits</h3>
                <ul className="space-y-2 text-sm text-primary-foreground/95">
                  <li>✓ <strong>${(estimatedSavings / 1000).toFixed(0)}K saved this month</strong> through proactive washout monitoring</li>
                  <li>✓ <strong>{vehiclesAtRisk.length} vehicles identified</strong> before requiring expensive dedagging</li>
                  <li>✓ <strong>{roi}% ROI</strong> - system pays for itself in less than one month</li>
                  <li>✓ <strong>Reduced downtime</strong> - vehicles stay operational longer</li>
                  <li>✓ <strong>Extended equipment life</strong> - proper maintenance prevents premature wear</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
