import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap, useGSAP } from '@/lib/gsap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, TrendingDown, DollarSign } from 'lucide-react';
import WESScoreBadge from '@/components/washout-compliance/WESScoreBadge';
import BuildupRiskIndicator from '@/components/washout-compliance/BuildupRiskIndicator';
import MetricCard from '@/components/washout-compliance/MetricCard';
import WashoutEmptyState from '@/components/washout-compliance/WashoutEmptyState';
import DataPagination from '@/components/ui/DataPagination';
import { useWashoutFilteredData } from '@/hooks/useWashoutFilteredData';
import moment from 'moment';
import { cn } from '@/lib/utils';

const RISK_PAGE_SIZES = [5, 10, 25, 50];

export default function DedaggingRisk() {
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
    return <WashoutEmptyState message={emptyMessage} />;
  }

  // Filter vehicles at risk (High or Critical) from dashboard-filtered list
  const vehiclesAtRisk = useMemo(() => {
    return (vehicles || [])
      .filter(v => v.buildupRisk === 'High' || v.buildupRisk === 'Critical')
      .sort((a, b) => {
        // Sort by risk level (Critical first) then by WES score (lowest first)
        if (a.buildupRisk === 'Critical' && b.buildupRisk !== 'Critical') return -1;
        if (a.buildupRisk !== 'Critical' && b.buildupRisk === 'Critical') return 1;
        return a.wesScore - b.wesScore;
      });
  }, [vehicles]);

  const [riskPage, setRiskPage] = useState(1);
  const [riskPageSize, setRiskPageSize] = useState(10);
  const riskTotalPages = Math.max(1, Math.ceil(vehiclesAtRisk.length / riskPageSize));
  const paginatedVehiclesAtRisk = useMemo(() => {
    const start = (riskPage - 1) * riskPageSize;
    return vehiclesAtRisk.slice(start, start + riskPageSize);
  }, [vehiclesAtRisk, riskPage, riskPageSize]);

  useEffect(() => {
    setRiskPage(1);
  }, [vehiclesAtRisk.length, riskPageSize]);
  useEffect(() => {
    if (riskPage > riskTotalPages) setRiskPage(1);
  }, [riskTotalPages, riskPage]);

  // Calculate metrics
  const totalAtRisk = vehiclesAtRisk.length;
  const criticalCount = vehiclesAtRisk.filter(v => v.buildupRisk === 'Critical').length;
  const highCount = vehiclesAtRisk.filter(v => v.buildupRisk === 'High').length;
  const totalEstimatedCost = vehiclesAtRisk.reduce((sum, v) => sum + (v.estimatedCost || 0), 0);
  const avgWESScore = vehiclesAtRisk.length
    ? vehiclesAtRisk.reduce((sum, v) => sum + v.wesScore, 0) / vehiclesAtRisk.length
    : 0;

  const handleVehicleClick = (vehicleId) => {
    navigate(`/washout-compliance/wes-scoring/${vehicleId}`);
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
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dedagging Risk Analysis</h1>
              <p className="text-muted-foreground mt-1">Vehicles at risk of concrete buildup requiring dedagging</p>
            </div>
            <Button onClick={() => navigate('/washout-compliance')}>
              Back to Dashboard
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-border">
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance')}
            >
              Dashboard
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => navigate('/washout-compliance/wes-scoring')}
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
        {/* Risk Metrics */}
        <div className="gsap-fade-up grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Vehicles At Risk"
            value={totalAtRisk}
            label="High or Critical risk"
            icon={AlertTriangle}
            iconBgColor="bg-chart-critical/10 dark:bg-chart-critical/20"
            iconColor="text-chart-critical"
          />
          <MetricCard
            title="Critical Risk"
            value={criticalCount}
            label="Immediate attention needed"
            icon={AlertTriangle}
            iconBgColor="bg-chart-critical/20 dark:bg-chart-critical/30"
            iconColor="text-chart-critical"
          />
          <MetricCard
            title="High Risk"
            value={highCount}
            label="Monitor closely"
            icon={TrendingDown}
            iconBgColor="bg-chart-high/10 dark:bg-chart-high/20"
            iconColor="text-chart-high"
          />
          <MetricCard
            title="Total Estimated Cost"
            value={`$${(totalEstimatedCost / 1000).toFixed(1)}K`}
            label="If dedagging required"
            icon={DollarSign}
            iconBgColor="bg-chart-medium/10 dark:bg-chart-medium/20"
            iconColor="text-chart-medium"
          />
        </div>

        {/* Alert Banner */}
        <Card className="gsap-fade-up bg-chart-critical/10 border-chart-critical/30 dark:bg-chart-critical/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-chart-critical/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-chart-critical" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground mb-2">
                  {totalAtRisk} Vehicles Require Attention
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {criticalCount} vehicle{criticalCount !== 1 ? 's' : ''} at critical risk and {highCount} at high risk 
                  of concrete buildup. Total estimated dedagging cost if not addressed: ${totalEstimatedCost.toLocaleString()}. 
                  Immediate action recommended for critical vehicles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Analysis Table */}
        <Card className="gsap-fade-up">
          <CardHeader>
            <CardTitle>Vehicles at Risk</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sorted by risk level and WES score (worst first)
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead className="text-center">WES Score</TableHead>
                    <TableHead className="text-center">Drum RPM</TableHead>
                    <TableHead className="text-center">End NTU</TableHead>
                    <TableHead>Risk Level</TableHead>
                    <TableHead>Dedag ETA</TableHead>
                    <TableHead className="text-right">Est. Buildup</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                    <TableHead>Last Washout</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedVehiclesAtRisk.map((vehicle, index) => (
                    <TableRow
                      key={vehicle.vehicleRef ?? vehicle.vehicleId ?? index}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleVehicleClick(vehicle.vehicleId)}
                    >
                      <TableCell className="font-medium">{vehicle.vehicleId}</TableCell>
                      <TableCell>{vehicle.driver}</TableCell>
                      <TableCell>{vehicle.site}</TableCell>
                      <TableCell className="text-center">
                        <WESScoreBadge score={vehicle.wesScore} />
                      </TableCell>
                      <TableCell className={cn(
                        'text-center font-medium',
                        vehicle.drumRPM === 0 ? 'text-chart-critical' :
                        vehicle.drumRPM < 8 ? 'text-chart-medium' : 'text-primary'
                      )}>
                        {vehicle.drumRPM.toFixed(1)}
                      </TableCell>
                      <TableCell className={cn(
                        'text-center font-medium',
                        vehicle.endNTU > 500 ? 'text-chart-critical' :
                        vehicle.endNTU > 150 ? 'text-chart-medium' : 'text-primary'
                      )}>
                        {vehicle.endNTU}
                      </TableCell>
                      <TableCell>
                        <BuildupRiskIndicator risk={vehicle.buildupRisk} />
                      </TableCell>
                      <TableCell className="font-medium text-chart-critical">
                        {vehicle.dedagETA || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {vehicle.estimatedBuildup ? `${vehicle.estimatedBuildup} kg` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {vehicle.estimatedCost ? `$${vehicle.estimatedCost.toLocaleString()}` : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {moment(vehicle.lastWashout).format('DD MMM HH:mm')}
                      </TableCell>
                      <TableCell>
                        {vehicle.buildupRisk === 'Critical' ? (
                          <Button size="sm" variant="destructive">
                            Escalate
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline">
                            SMS Alert
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select value={String(riskPageSize)} onValueChange={(v) => { setRiskPageSize(Number(v)); setRiskPage(1); }}>
                  <SelectTrigger className="w-[72px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DataPagination
                currentPage={riskPage}
                totalPages={riskTotalPages}
                totalItems={vehiclesAtRisk.length}
                pageSize={riskPageSize}
                onPageChange={setRiskPage}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="gsap-fade-up">
          <CardHeader>
            <CardTitle>Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-4 border-chart-critical bg-chart-critical/10 dark:bg-chart-critical/20 p-4 rounded-r-lg">
              <h4 className="font-semibold text-foreground mb-2">Critical Priority</h4>
              <p className="text-sm text-muted-foreground">
                Vehicles with critical risk require immediate inspection and driver coaching. 
                Schedule drum inspections within 48 hours and implement corrective actions immediately.
              </p>
            </div>
            <div className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600 p-4 rounded-r-lg">
              <h4 className="font-semibold text-orange-900 dark:text-orange-200 mb-2">High Priority</h4>
              <p className="text-sm text-orange-800 dark:text-orange-300">
                Monitor high-risk vehicles closely. Implement driver training on proper washout procedures, 
                emphasizing full 90-second drum rotation cycles and proper RPM maintenance.
              </p>
            </div>
            <div className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10 dark:border-primary p-4 rounded-r-lg">
              <h4 className="font-semibold text-foreground mb-2">Preventive Measures</h4>
              <p className="text-sm text-muted-foreground">
                Regular monitoring of WES scores can prevent dedagging requirements. Establish weekly 
                review process for vehicles showing declining trends.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
