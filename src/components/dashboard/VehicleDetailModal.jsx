import React from 'react';
import { Truck, MapPin, Target, Calendar, Activity, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import moment from 'moment';

export default function VehicleDetailModal({ vehicle, open, onClose }) {
  if (!vehicle) return null;

  const isCompliant = vehicle.washes_completed >= vehicle.target;
  const progress = Math.min(100, Math.round((vehicle.washes_completed / vehicle.target) * 100));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <Truck className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <span className="text-xl font-bold">{vehicle.name}</span>
              <p className="text-sm font-mono text-slate-500">{vehicle.rfid}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50">
            <span className="text-sm font-medium text-slate-600">Compliance Status</span>
            <Badge 
              className={`px-4 py-1.5 text-sm font-semibold ${
                isCompliant 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-red-500 text-white'
              }`}
            >
              {isCompliant ? (
                <><CheckCircle className="w-4 h-4 mr-1" /> Compliant</>
              ) : (
                <><XCircle className="w-4 h-4 mr-1" /> Non-Compliant</>
              )}
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Wash Progress</span>
              <span className="font-semibold text-slate-800">
                {vehicle.washes_completed} / {vehicle.target}
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #7CB342 0%, #9CCC65 100%)'
                }}
              />
            </div>
            <p className="text-xs text-slate-500 text-right">{progress}% complete</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <MapPin className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Site</span>
              </div>
              <p className="font-semibold text-slate-800">{vehicle.site_name}</p>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Target</span>
              </div>
              <p className="font-semibold text-slate-800">{vehicle.target} washes</p>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Completed</span>
              </div>
              <p className="font-semibold text-slate-800">{vehicle.washes_completed} washes</p>
            </div>
            
            <div className="p-4 rounded-xl bg-slate-50">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wide">Last Scan</span>
              </div>
              <p className="font-semibold text-slate-800">{moment(vehicle.last_scan).fromNow()}</p>
            </div>
          </div>

          {/* Washes Remaining */}
          {!isCompliant && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">
                <span className="font-semibold">{vehicle.target - vehicle.washes_completed} more washes</span> needed to reach compliance
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}