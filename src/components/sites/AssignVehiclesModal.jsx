import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Truck } from 'lucide-react';

export default function AssignVehiclesModal({ open, onClose, site, vehicles }) {
  const [searchQuery, setSearchQuery] = useState('');

  const assignedVehicles = useMemo(() => {
    if (!site || !vehicles) return [];
    return vehicles.filter(v => v.site_id === site.id);
  }, [site, vehicles]);

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return assignedVehicles;
    const q = searchQuery.toLowerCase();
    return assignedVehicles.filter(v =>
      v.name?.toLowerCase().includes(q) ||
      v.rfid?.toLowerCase().includes(q)
    );
  }, [assignedVehicles, searchQuery]);

  if (!site) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Vehicles at {site.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Read-only view of vehicles assigned to this site
          </p>
        </DialogHeader>

        <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
            <Truck className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              {assignedVehicles.length} vehicle{assignedVehicles.length !== 1 ? 's' : ''} assigned
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredVehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card"
              >
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{vehicle.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{vehicle.rfid}</p>
                </div>
              </div>
            ))}
          </div>

          {filteredVehicles.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p>{assignedVehicles.length === 0 ? 'No vehicles assigned to this site' : 'No vehicles match your search'}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
