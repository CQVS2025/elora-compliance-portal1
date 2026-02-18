import React, { useState, useMemo, useRef } from 'react';
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
import DataPagination from '@/components/ui/DataPagination';
import {
  Droplets,
  CreditCard,
  RotateCw,
  Waves,
  Thermometer,
  Cpu,
  Package,
  MapPin,
  Truck,
  Calendar,
  Settings,
  Radio,
  Cloud,
  Database,
  Brain,
  Monitor,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { SENSOR_DATA_SOURCES, EXTERNAL_INTEGRATIONS } from '@/data/washout-dummy-data';
import WashoutEmptyState from '@/components/washout-compliance/WashoutEmptyState';
import { useWashoutFilteredData } from '@/hooks/useWashoutFilteredData';
import { cn } from '@/lib/utils';

const iconMap = {
  Droplets,
  CreditCard,
  RotateCw,
  Waves,
  Thermometer,
  Cpu,
  Package,
  MapPin,
  Truck,
  Calendar,
  Settings,
  Radio,
  Cloud,
  Database,
  Brain,
  Monitor
};

const ADDITIONAL_DATA_FIELDS = [
  { field: 'Mix type / grade (MPa)', source: 'Command Alkon', status: 'Live', impact: 'Higher MPa = more aggressive set → tighter washout window, higher WES weight' },
  { field: 'Load size (m³)', source: 'Command Alkon', status: 'Live', impact: 'Larger loads require more water. Adjusts volume target dynamically' },
  { field: 'Admixture type', source: 'Command Alkon', status: 'Live', impact: 'Accelerators reduce window 30–50%. Retarders extend it. Critical for urgency' },
  { field: 'GPS position', source: 'Teletrac Navman', status: 'Planned', impact: 'Geofencing confirms truck at washout bay (not just card tap somewhere else)' },
  { field: 'PTO status', source: 'Teletrac Navman', status: 'Planned', impact: 'Independent drum rotation confirmation. Cross-validates Dingtek sensor' },
  { field: 'Return-to-plant time', source: 'Teletrac Navman', status: 'Planned', impact: 'Calculates time-since-batch. Longer = more set = more water needed' },
  { field: 'Ambient temperature', source: 'Bureau of Met API', status: 'Live', impact: 'Urgency multiplier: 1 + 0.02 × max(0, temp - 20°C). 40°C = 40% more sensitive' },
  { field: 'Delivery schedule', source: 'Auto Allocations', status: 'Future', impact: 'Optimal wash window recommendations based on upcoming delivery gaps' },
  { field: 'Weight/fuel data', source: 'Volvo Connect', status: 'Future', impact: 'Correlate weight changes with buildup estimates. Independent verification' },
];

const SENSOR_TABLE_PAGE_SIZES = [5, 10, 25];

export default function SensorData() {
  const navigate = useNavigate();
  const washoutData = useWashoutFilteredData();
  const { showEmptyState, isLoading, emptyMessage } = washoutData;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (showEmptyState) {
    return <WashoutEmptyState message={emptyMessage} title="Data Integration" subtitle="Sensor data and external system integrations" />;
  }

  const [dataFieldsPage, setDataFieldsPage] = useState(1);
  const [dataFieldsPageSize, setDataFieldsPageSize] = useState(5);
  const dataFieldsTotalPages = Math.max(1, Math.ceil(ADDITIONAL_DATA_FIELDS.length / dataFieldsPageSize));
  const paginatedDataFields = useMemo(() => {
    const start = (dataFieldsPage - 1) * dataFieldsPageSize;
    return ADDITIONAL_DATA_FIELDS.slice(start, start + dataFieldsPageSize);
  }, [dataFieldsPage, dataFieldsPageSize]);

  const mainRef = useRef(null);
  useGSAP(() => {
    const ctx = mainRef.current;
    if (!ctx) return;
    const els = ctx.querySelectorAll('.gsap-fade-up');
    if (els.length) gsap.from(els, { opacity: 0, y: 18, duration: 0.4, stagger: 0.07, ease: 'power2.out' });
  }, { scope: mainRef });

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'live':
        return <Badge className="bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/40"><CheckCircle className="w-3 h-3 mr-1" />Live</Badge>;
      case 'planned':
        return <Badge className="bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary dark:border-primary/40"><Clock className="w-3 h-3 mr-1" />Planned</Badge>;
      case 'future':
        return <Badge className="bg-muted text-muted-foreground"><AlertCircle className="w-3 h-3 mr-1" />Future</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Data Integration Architecture</h1>
              <p className="text-muted-foreground mt-1">How washout sensor data flows into the ELORA portal</p>
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
              className="px-4 py-2 text-sm font-medium border-b-2 border-primary text-primary transition-colors"
            >
              Data Integration
            </button>
          </div>
        </div>
      </div>

      <main ref={mainRef} className="max-w-[1600px] mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Info Banner */}
        <Card className="gsap-fade-up bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30">
          <CardContent className="p-6">
            <p className="text-sm text-foreground leading-relaxed">
              ℹ️ The washout compliance module extends the existing ELORA portal with additional sensor inputs, 
              AI scoring, and batching system integration. All data flows through the same MQTT → Cloud → Portal pipeline.
            </p>
          </CardContent>
        </Card>

        {/* Data Pipeline Visualization */}
        <Card className="gsap-fade-up">
          <CardHeader>
            <CardTitle>Data Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">End-to-end data flow from sensors to portal</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between overflow-x-auto py-4">
              {[
                { icon: Settings, label: 'Sensors', color: 'bg-purple-100 text-purple-600' },
                { icon: Cpu, label: 'Edge Computer', color: 'bg-blue-100 text-blue-600' },
                { icon: Radio, label: 'MQTT', color: 'bg-green-100 text-green-600' },
                { icon: Cloud, label: 'AWS IoT Core', color: 'bg-orange-100 text-orange-600' },
                { icon: Database, label: 'Timestream DB', color: 'bg-red-100 text-red-600' },
                { icon: Brain, label: 'WES Scoring', color: 'bg-pink-100 text-pink-600' },
                { icon: Monitor, label: 'ELORA Portal', color: 'bg-indigo-100 text-indigo-600' }
              ].map((step, index, array) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-center gap-2 min-w-[120px]">
                    <div className={cn('w-16 h-16 rounded-lg flex items-center justify-center', step.color)}>
                      <step.icon className="w-8 h-8" />
                    </div>
                    <span className="text-sm font-medium text-center">{step.label}</span>
                  </div>
                  {index < array.length - 1 && (
                    <ArrowRight className="w-6 h-6 text-muted-foreground flex-shrink-0 mx-2" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sensor Data Sources */}
        <div className="gsap-fade-up">
          <h2 className="text-2xl font-bold text-foreground mb-4">Sensor Data Sources (New Hardware)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SENSOR_DATA_SOURCES.map((sensor, index) => {
              const Icon = iconMap[sensor.icon] || Settings;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-primary/10 dark:bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-foreground mb-1">{sensor.name}</h3>
                        <p className="text-sm text-muted-foreground">{sensor.model}</p>
                      </div>
                      {getStatusBadge(sensor.status)}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {sensor.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* External System Integrations */}
        <div className="gsap-fade-up">
          <h2 className="text-2xl font-bold text-foreground mb-4">External System Integrations</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {EXTERNAL_INTEGRATIONS.map((integration, index) => {
              const Icon = iconMap[integration.icon] || Package;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-12 h-12 bg-chart-2/10 dark:bg-chart-2/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-6 h-6 text-chart-2" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-foreground mb-1">{integration.name}</h3>
                        {getStatusBadge(integration.status)}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                      {integration.description}
                    </p>
                    <div className="bg-primary/5 border border-primary/20 dark:bg-primary/10 dark:border-primary/30 rounded-lg p-3">
                      <p className="text-xs font-medium text-foreground mb-1">Impact on WES Scoring:</p>
                      <p className="text-xs text-muted-foreground">{integration.impact}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Additional Data Fields Table */}
        <Card className="gsap-fade-up">
          <CardHeader>
            <CardTitle>Additional Data Fields from Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data Field</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Impact on WES Scoring</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDataFields.map((row) => (
                    <TableRow key={row.field}>
                      <TableCell className="font-medium">{row.field}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell>{getStatusBadge(row.status)}</TableCell>
                      <TableCell className="text-sm">{row.impact}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page</span>
                <Select value={String(dataFieldsPageSize)} onValueChange={(v) => { setDataFieldsPageSize(Number(v)); setDataFieldsPage(1); }}>
                  <SelectTrigger className="w-[72px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENSOR_TABLE_PAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DataPagination
                currentPage={dataFieldsPage}
                totalPages={dataFieldsTotalPages}
                totalItems={ADDITIONAL_DATA_FIELDS.length}
                pageSize={dataFieldsPageSize}
                onPageChange={setDataFieldsPage}
              />
            </div>
          </CardContent>
        </Card>

        {/* Key Insight */}
        <Card className="gsap-fade-up bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground mb-2">✓ Key Insight</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The washout compliance module plugs into your existing ELORA infrastructure. Scan cards, 
                  cloud pipeline, and portal are already built. We're adding sensors to the wash station and 
                  intelligence to the data. Most of the heavy lifting is already done.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
