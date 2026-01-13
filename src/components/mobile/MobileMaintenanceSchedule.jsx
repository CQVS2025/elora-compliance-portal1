import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench, Calendar, Clock, AlertTriangle } from 'lucide-react';
import moment from 'moment';

export default function MobileMaintenanceSchedule({ maintenance = [] }) {
  const getUrgencyBadge = (nextServiceDate) => {
    if (!nextServiceDate) return null;
    const daysUntil = moment(nextServiceDate).diff(moment(), 'days');

    if (daysUntil < 0) {
      return <Badge className="bg-red-500">Overdue</Badge>;
    } else if (daysUntil <= 7) {
      return <Badge className="bg-orange-500">Due Soon</Badge>;
    } else if (daysUntil <= 14) {
      return <Badge className="bg-yellow-500 text-yellow-900">Upcoming</Badge>;
    }
    return <Badge className="bg-blue-500">Scheduled</Badge>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">Upcoming Maintenance</h2>
        <Badge variant="outline" className="border-[#7CB342] text-[#7CB342]">
          {maintenance.length} scheduled
        </Badge>
      </div>

      {maintenance.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Wrench className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-1">No upcoming maintenance</p>
            <p className="text-sm text-slate-500">All vehicles are up to date</p>
          </CardContent>
        </Card>
      ) : (
        maintenance.map((record) => (
          <Card key={record.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="bg-gradient-to-r from-slate-700 to-slate-600 p-3 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    <h3 className="font-semibold">{record.vehicle_name || 'Vehicle'}</h3>
                  </div>
                  {getUrgencyBadge(record.next_service_date)}
                </div>
              </div>

              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-700">
                    Next service: {record.next_service_date
                      ? moment(record.next_service_date).format('MMM D, YYYY')
                      : 'Not scheduled'}
                  </span>
                </div>

                {record.service_type && (
                  <div className="flex items-center gap-2 text-sm">
                    <Wrench className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">{record.service_type}</span>
                  </div>
                )}

                {record.service_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500">
                      Last service: {moment(record.service_date).fromNow()}
                    </span>
                  </div>
                )}

                {record.next_service_date && moment(record.next_service_date).diff(moment(), 'days') < 0 && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Service is overdue by {Math.abs(moment(record.next_service_date).diff(moment(), 'days'))} days</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
