import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingDown, WifiOff, ChevronRight } from 'lucide-react';
import moment from 'moment';
import { motion } from 'framer-motion';

export default function QuickActions({ vehicles, onOpenVehicle, onOpenDevices }) {

  const { data: devices = [] } = useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await base44.functions.invoke('elora_devices', { status: 'active' });
      return response.data || [];
    }
  });

  const urgentItems = useMemo(() => {
    const items = [];
    const now = moment();

    // Check for vehicles below target
    const underperformingVehicles = vehicles.filter(v => 
      v.washes_completed < v.target * 0.75
    );

    if (underperformingVehicles.length > 0) {
      items.push({
        type: 'underperforming',
        icon: TrendingDown,
        color: 'bg-orange-100 text-orange-800 border-orange-200',
        title: 'Below Target',
        count: underperformingVehicles.length,
        description: `${underperformingVehicles.length} vehicle${underperformingVehicles.length > 1 ? 's are' : ' is'} under 75% compliance`,
        action: 'Review',
        vehicle: underperformingVehicles[0],
        onClick: () => onOpenVehicle && onOpenVehicle(underperformingVehicles[0])
      });
    }

    // Check for offline devices
    const offlineDevices = devices.filter(d => {
      if (!d.lastScanAt) return true;
      const hoursSince = now.diff(moment(d.lastScanAt), 'hours');
      return hoursSince >= 24;
    });

    if (offlineDevices.length > 0) {
      items.push({
        type: 'devices_offline',
        icon: WifiOff,
        color: 'bg-purple-100 text-purple-800 border-purple-200',
        title: 'Devices Offline',
        count: offlineDevices.length,
        description: `${offlineDevices.length} device${offlineDevices.length > 1 ? 's' : ''} not responding`,
        action: 'Check',
        onClick: onOpenDevices
      });
    }

    return items.slice(0, 4); // Show top 4 urgent items
  }, [vehicles, devices, onOpenVehicle, onOpenDevices]);

  if (urgentItems.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 mx-auto mb-3 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ✓
            </motion.div>
          </div>
          <p className="text-lg font-semibold text-green-800">All Clear!</p>
          <p className="text-sm text-green-600 mt-1">No urgent actions required at this time</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          Quick Actions - Requires Attention
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {urgentItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`p-4 border-2 rounded-lg ${item.color} hover:shadow-md transition-shadow relative`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <h4 className="font-semibold">{item.title}</h4>
                  </div>
                  <Badge variant="secondary" className="bg-white/50">
                    {item.count}
                  </Badge>
                </div>
                <p className="text-sm mb-3">{item.description}</p>
                <button 
                  className="w-full px-4 py-2 text-sm font-medium border border-slate-300 rounded-md hover:bg-white transition-all flex items-center justify-center gap-2 cursor-pointer bg-white shadow-sm hover:shadow-md active:scale-95"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (item.onClick) {
                      item.onClick();
                    }
                  }}
                  type="button"
                >
                  {item.action}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}