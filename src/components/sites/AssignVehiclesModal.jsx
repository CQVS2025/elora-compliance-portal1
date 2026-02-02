import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabaseClient } from "@/api/supabaseClient";
import { Loader2, Search, Truck } from 'lucide-react';
import { toast } from "@/lib/toast";

export default function AssignVehiclesModal({ open, onClose, site, vehicles, onSuccess }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && site) {
      const assigned = vehicles.filter(v => v.site_id === site.id).map(v => v.id);
      setSelectedVehicles(assigned);
    } else {
      setSelectedVehicles([]);
    }
  }, [open, site, vehicles]);

  const handleToggle = (vehicleId) => {
    setSelectedVehicles(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update all vehicles
      const updates = vehicles.map(async (vehicle) => {
        const shouldBeAssigned = selectedVehicles.includes(vehicle.id);
        const isCurrentlyAssigned = vehicle.site_id === site.id;

        if (shouldBeAssigned && !isCurrentlyAssigned) {
          // Assign vehicle to this site
          return supabaseClient.tables.vehicles
            .update({
              site_id: site.id,
              site_name: site.name
            })
            .eq('id', vehicle.id);
        } else if (!shouldBeAssigned && isCurrentlyAssigned) {
          // Unassign vehicle from this site
          return supabaseClient.tables.vehicles
            .update({
              site_id: '',
              site_name: ''
            })
            .eq('id', vehicle.id);
        }
      });

      await Promise.all(updates);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning vehicles:', error);
      toast.error("Failed to assign vehicles. Please try again.", { description: "Error" });
    } finally {
      setLoading(false);
    }
  };

  const filteredVehicles = vehicles.filter(v =>
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.rfid?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const assignedCount = selectedVehicles.length;

  if (!site) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Vehicles to {site.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select which vehicles should be assigned to this site
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

          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {assignedCount} vehicle{assignedCount !== 1 ? 's' : ''} assigned
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {filteredVehicles.map((vehicle) => {
              const isSelected = selectedVehicles.includes(vehicle.id);
              const isAssignedElsewhere = vehicle.site_id && vehicle.site_id !== site.id;

              return (
                <div
                  key={vehicle.id}
                  onClick={() => handleToggle(vehicle.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary'
                      : 'bg-card border-border hover:bg-muted/50'
                  }`}
                >
                  <Checkbox checked={isSelected} />
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{vehicle.rfid}</p>
                  </div>
                  {isAssignedElsewhere && (
                    <Badge variant="outline" className="text-xs">
                      Currently: {vehicle.site_name}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>

          {filteredVehicles.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Truck className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p>No vehicles found</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Assignments
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}