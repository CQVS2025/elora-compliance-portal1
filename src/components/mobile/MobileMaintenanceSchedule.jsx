import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, TrendingUp } from 'lucide-react';
import moment from 'moment';

export default function MobileMaintenanceSchedule({ maintenance }) {
  if (!maintenance || maintenance.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">No upcoming maintenance</p>
          <p className="text-sm text-slate-500 mt-2">All vehicles are up to date</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-slate-800 mb-4">Upcoming Service</h2>
      
      {maintenance.map((record, idx) => {
        const daysUntil = moment(record.next_service_date).diff(moment(), 'days');
        const isUrgent = daysUntil <= 7;

        return (
          <Card key={idx} className={isUrgent ? 'border-orange-500 border-2' : ''}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-slate-800">{record.vehicle_name}</h3>
                  <p className="text-sm text-slate-600">
                    {record.service_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                </div>
                <Badge className={isUrgent ? 'bg-orange-500' : 'bg-[#7CB342]'}>
                  {daysUntil} days
                </Badge>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Calendar className="w-4 h-4" />
                  <span>{moment(record.next_service_date).format('MMM D, YYYY')}</span>
                </div>

                {record.next_service_mileage && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>At {record.next_service_mileage.toLocaleString()} miles</span>
                  </div>
                )}

                {record.notes && (
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                    {record.notes}
                  </div>
                )}
              </div>

              {isUrgent && (
                <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs text-orange-700 font-semibold">
                    ⚠️ Service due soon - please schedule
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}