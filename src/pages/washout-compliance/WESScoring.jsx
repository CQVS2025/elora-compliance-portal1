import React, { useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, Droplet, Gauge, Waves, Thermometer, Clock, TrendingUp } from 'lucide-react';
import { SimpleMetricCard } from '@/components/washout-compliance/MetricCard';
import { WESScoreStatus } from '@/components/washout-compliance/WESScoreBadge';
import WESScoreChart from '@/components/washout-compliance/WESScoreChart';
import WashHistoryTable from '@/components/washout-compliance/WashHistoryTable';
import { CompactAIInsight } from '@/components/washout-compliance/AIInsightsBox';
import { RiskCard } from '@/components/washout-compliance/BuildupRiskIndicator';
import { Progress } from '@/components/ui/progress';
import WashoutEmptyState from '@/components/washout-compliance/WashoutEmptyState';
import { useWashoutFilteredData } from '@/hooks/useWashoutFilteredData';
import { WES_TREND_AGI_089 } from '@/data/washout-dummy-data';
import moment from 'moment';
import { cn } from '@/lib/utils';

export default function WESScoring() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const washoutData = useWashoutFilteredData();
  const { vehicles, showEmptyState, isLoading, emptyMessage, customerName } = washoutData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (showEmptyState) {
    return <WashoutEmptyState message={emptyMessage} />;
  }

  // Find vehicle: by URL param, or fallback to first vehicle when visiting /wes-scoring with no id, or AGI-089 for dummy data
  const vehicle = vehicles.find(v => v.vehicleId === vehicleId)
    || (vehicleId == null && vehicles.length > 0 ? vehicles[0] : null)
    || vehicles.find(v => v.vehicleId === 'AGI-089');

  // When URL has no vehicleId, redirect to first vehicle so the page shows content and URL is bookmarkable
  useEffect(() => {
    if (vehicleId == null && vehicle && vehicles.length > 0) {
      navigate(`/washout-compliance/wes-scoring/${encodeURIComponent(vehicle.vehicleId)}`, { replace: true });
    }
  }, [vehicleId, vehicle, vehicles.length, navigate]);

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Vehicle not found</p>
            <Button onClick={() => navigate('/washout-compliance')} className="mt-4">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get WES trend data (use AGI-089 data as example, or generate simple trend)
  const wesTrendData = vehicle.vehicleId === 'AGI-089' ? WES_TREND_AGI_089 : generateSimpleTrend(vehicle.avgWESScore);

  function generateSimpleTrend(avgScore) {
    const data = [];
    const startDate = moment().subtract(30, 'days');
    for (let i = 0; i < 30; i++) {
      data.push({
        date: startDate.clone().add(i, 'days').format('YYYY-MM-DD'),
        score: Math.max(0, Math.min(100, avgScore + (Math.random() * 20 - 10)))
      });
    }
    return data;
  }

  const getAIInsight = (vehicle) => {
    if (vehicle.vehicleId === 'AGI-089') {
      return `AGI-089 has shown a declining washout trend over 30 days (avg WES dropped from 78 to 54). At current trajectory, dedagging required within 23 days (~$8,600 cost). Primary issues: low drum RPM (avg 6.1 vs 8–12 target) and high end-discharge NTU (avg 285 vs <50 target) — the driver is receiving the full 340L water dispense but not running the drum long enough or fast enough to actually remove concrete. Recommend driver coaching for ${vehicle.driver} and enforce full 90-second rotation cycle. Monitor next 5 washout events.`;
    }
    if (vehicle.wesScore < 50) {
      return `${vehicle.vehicleId} requires immediate attention. WES score of ${vehicle.wesScore} indicates inadequate washout performance. Recommend immediate driver coaching and equipment inspection.`;
    }
    if (vehicle.wesScore < 70) {
      return `${vehicle.vehicleId} shows marginal washout performance. Monitor closely and consider driver coaching to improve drum rotation and wash duration.`;
    }
    return `${vehicle.vehicleId} is performing well with consistent washout quality. Continue current practices.`;
  };

  const mainRef = useRef(null);
  useGSAP(() => {
    const ctx = mainRef.current;
    if (!ctx) return;
    const els = ctx.querySelectorAll('.gsap-fade-up');
    if (els.length) gsap.from(els, { opacity: 0, y: 18, duration: 0.4, stagger: 0.07, ease: 'power2.out' });
  }, { scope: mainRef });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/washout-compliance')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold text-foreground">{vehicle.vehicleId}</h1>
                <WESScoreStatus status={vehicle.status} />
              </div>
              <p className="text-muted-foreground">
                {customerName ?? 'BORAL — QLD'} · {vehicle.site} · Driver: {vehicle.driver}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-border mt-6">
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance')}
            >
              Dashboard
            </button>
            <button
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                'border-primary text-primary'
              )}
            >
              Vehicle Detail
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance/sensor-data')}
            >
              Data Integration
            </button>
          </div>
        </div>
      </div>

      <main ref={mainRef} className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Identity & Status Section */}
        <div className="gsap-fade-up grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Vehicle Reference</div>
              <div className="text-lg font-bold text-foreground">{vehicle.vehicleReference}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Internal ID</div>
              <div className="text-lg font-bold text-foreground">{vehicle.internalId}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">RFID Tag</div>
              <div className="text-lg font-bold text-foreground font-mono">{vehicle.rfidTag}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <Badge className="bg-primary/10 text-primary border-primary/30">Active</Badge>
            </CardContent>
          </Card>
        </div>

        {/* Overview Section */}
        <Card className="gsap-fade-up">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-muted-foreground mb-2">Washes this month</div>
                <div className="text-3xl font-bold text-foreground">{vehicle.washesThisMonth}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Target washes (monthly)</div>
                <div className="text-3xl font-bold text-foreground">{vehicle.targetWashes}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Progress</div>
                <div className="text-3xl font-bold text-foreground mb-2">{vehicle.progress.toFixed(0)}%</div>
                <Progress value={vehicle.progress} className="h-2" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-2">Last scan</div>
                <div className="text-lg font-bold text-foreground">
                  {moment(vehicle.lastWashout).format('DD MMM YYYY HH:mm')}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Washout Quality Metrics */}
        <div className="gsap-fade-up">
          <h2 className="text-xl font-bold text-foreground mb-4">Washout Quality — New Sensor Data</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <SimpleMetricCard
              title="Water Volume"
              value="340L"
              subtitle="Fixed dispense per wash"
            />
            <SimpleMetricCard
              title="Avg Drum RPM"
              value={vehicle.drumRPM.toFixed(1)}
              subtitle="Target: 8–12 RPM"
            />
            <SimpleMetricCard
              title="Avg End NTU"
              value={vehicle.endNTU}
              subtitle="Target: <50 NTU"
            />
            <SimpleMetricCard
              title="Avg Temp at Wash"
              value={`${vehicle.avgTemp}°C`}
              subtitle={vehicle.avgTemp > 30 ? 'Urgency: High' : 'Normal'}
            />
            <SimpleMetricCard
              title="Avg Duration"
              value={`${vehicle.avgDuration}s`}
              subtitle="Target: 90s+"
            />
            <SimpleMetricCard
              title="Avg WES Score"
              value={vehicle.avgWESScore.toFixed(1)}
              subtitle="30-day average"
            />
          </div>
        </div>

        {/* WES Score Trend Chart */}
        <div className="gsap-fade-up">
          <WESScoreChart data={wesTrendData} />
        </div>

        {/* Buildup Risk Prediction */}
        {vehicle.estimatedBuildup && (
          <div className="gsap-fade-up">
            <h2 className="text-xl font-bold text-foreground mb-4">Buildup Risk Prediction</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <SimpleMetricCard
                title="Est. Current Buildup"
                value={`~${vehicle.estimatedBuildup} kg`}
                subtitle="Based on sensor data"
              />
              <SimpleMetricCard
                title="Monthly Rate"
                value={`${vehicle.monthlyBuildupRate} kg/mo`}
                subtitle="Accumulation rate"
              />
              <SimpleMetricCard
                title="Predicted Dedag"
                value={vehicle.dedagETA || 'N/A'}
                subtitle="At current trajectory"
              />
              <SimpleMetricCard
                title="Estimated Cost"
                value={vehicle.estimatedCost ? `$${vehicle.estimatedCost.toLocaleString()}` : 'N/A'}
                subtitle="If dedagging required"
              />
            </div>
          </div>
        )}

        {/* Risk Card */}
        {vehicle.buildupRisk && vehicle.buildupRisk !== 'Low' && (
          <div className="gsap-fade-up">
            <RiskCard
              risk={vehicle.buildupRisk}
              dedagETA={vehicle.dedagETA}
              estimatedCost={vehicle.estimatedCost}
            />
          </div>
        )}

        {/* AI Insight */}
        <div className="gsap-fade-up">
          <CompactAIInsight>
            {getAIInsight(vehicle)}
          </CompactAIInsight>
        </div>

        {/* Wash History */}
        {vehicle.washHistory && vehicle.washHistory.length > 0 && (
          <div className="gsap-fade-up">
            <WashHistoryTable washHistory={vehicle.washHistory} />
          </div>
        )}
      </main>
    </div>
  );
}
