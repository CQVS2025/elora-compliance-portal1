import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card px-4 py-3 rounded-lg shadow-lg border border-border">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function WashAnalytics({ data, vehicles, scans }) {
  const [viewMode, setViewMode] = useState('trends'); // trends, sites, outliers

  // Calculate analytics data
  const analytics = useMemo(() => {
    if (!vehicles || !scans) return null;

    // Average washes per vehicle
    const avgWashesPerVehicle = vehicles.length > 0 
      ? (vehicles.reduce((sum, v) => sum + v.washes_completed, 0) / vehicles.length).toFixed(1)
      : 0;

    // Site comparison
    const siteStats = {};
    scans.forEach(scan => {
      const site = scan.siteName;
      if (!siteStats[site]) {
        siteStats[site] = { name: site, washes: 0 };
      }
      siteStats[site].washes += 1;
    });
    const siteData = Object.values(siteStats).sort((a, b) => b.washes - a.washes).slice(0, 10);

    // Identify outliers
    const washCounts = vehicles.map(v => v.washes_completed);
    const avg = washCounts.reduce((a, b) => a + b, 0) / washCounts.length || 0;
    const stdDev = Math.sqrt(washCounts.reduce((sq, n) => sq + Math.pow(n - avg, 2), 0) / washCounts.length);
    
    const highPerformers = vehicles
      .filter(v => v.washes_completed > avg + stdDev)
      .sort((a, b) => b.washes_completed - a.washes_completed)
      .slice(0, 5);
    
    const lowPerformers = vehicles
      .filter(v => v.washes_completed < avg - stdDev && v.washes_completed > 0)
      .sort((a, b) => a.washes_completed - b.washes_completed)
      .slice(0, 5);

    return {
      avgWashesPerVehicle,
      siteData,
      highPerformers,
      lowPerformers,
      totalWashes: scans.length
    };
  }, [vehicles, scans]);

  if (!analytics) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100"
    >
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">Wash Frequency Analytics</h3>
            <div className="w-10 h-[3px] bg-primary rounded-full mt-2" />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'trends' ? 'default' : 'outline'}
              onClick={() => setViewMode('trends')}
              className={viewMode === 'trends' ? '' : ''}
            >
              Trends
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'sites' ? 'default' : 'outline'}
              onClick={() => setViewMode('sites')}
              className={viewMode === 'sites' ? '' : ''}
            >
              By Site
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'outliers' ? 'default' : 'outline'}
              onClick={() => setViewMode('outliers')}
              className={viewMode === 'outliers' ? '' : ''}
            >
              Outliers
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span className="text-xs text-slate-600">Avg per Vehicle</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{analytics.avgWashesPerVehicle}</p>
          </div>
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-slate-600">High Performers</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{analytics.highPerformers.length}</p>
          </div>
          <div className="bg-gradient-to-br from-destructive/10 to-destructive/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-destructive" />
              <span className="text-xs text-slate-600">Low Performers</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{analytics.lowPerformers.length}</p>
          </div>
        </div>
      </div>
      
      {/* Chart Views */}
      <div className="h-[320px]">
        {viewMode === 'trends' && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="washGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                domain={[0, 'auto']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="washes"
                name="Washes"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fill="url(#washGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {viewMode === 'sites' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.siteData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="washes" name="Washes" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {viewMode === 'outliers' && (
          <div className="space-y-4 h-full overflow-y-auto">
            {/* High Performers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h4 className="font-semibold text-slate-800">High Performers (Above Average)</h4>
              </div>
              {analytics.highPerformers.length === 0 ? (
                <p className="text-sm text-slate-500">No high performers in current period</p>
              ) : (
                <div className="space-y-2">
                  {analytics.highPerformers.map((vehicle, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-[#7CB342]/10 rounded-lg border border-[#7CB342]/20">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.name}</p>
                        <p className="text-xs text-slate-600">{vehicle.site_name}</p>
                      </div>
                      <Badge>
                        {vehicle.washes_completed} washes
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Performers */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-orange-500" />
                <h4 className="font-semibold text-slate-800">Low Performers (Below Average)</h4>
              </div>
              {analytics.lowPerformers.length === 0 ? (
                <p className="text-sm text-slate-500">No low performers detected</p>
              ) : (
                <div className="space-y-2">
                  {analytics.lowPerformers.map((vehicle, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div>
                        <p className="font-semibold text-slate-800">{vehicle.name}</p>
                        <p className="text-xs text-slate-600">{vehicle.site_name}</p>
                      </div>
                      <Badge className="bg-orange-500 hover:bg-orange-600">
                        {vehicle.washes_completed} washes
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}