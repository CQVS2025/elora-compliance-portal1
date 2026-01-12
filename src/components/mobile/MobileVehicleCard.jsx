import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, MapPin, Clock, AlertCircle } from 'lucide-react';
import moment from 'moment';

export default function MobileVehicleCard({ vehicle, onReportIssue }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-r from-[#7CB342] to-[#9CCC65] p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              <h3 className="font-bold text-lg">{vehicle.name}</h3>
            </div>
          </div>
          <p className="text-sm opacity-90">RFID: {vehicle.rfid}</p>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-slate-400" />
            <span className="text-slate-700">{vehicle.site_name || 'No site assigned'}</span>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">
              Last scan: {vehicle.last_scan ? moment(vehicle.last_scan).fromNow() : 'Never'}
            </span>
          </div>

          <Button 
            variant="outline" 
            className="w-full border-orange-500 text-orange-700 hover:bg-orange-50"
            onClick={onReportIssue}
          >
            <AlertCircle className="w-4 h-4 mr-2" />
            Report Issue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}