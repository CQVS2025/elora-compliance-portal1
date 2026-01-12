import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseClient } from "@/api/supabaseClient";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function VehicleModal({ open, onClose, vehicle, sites, onSuccess }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    rfid: '',
    site_id: '',
    site_name: '',
    target: 12
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (vehicle) {
        setFormData({
          name: vehicle.name || '',
          rfid: vehicle.rfid || '',
          site_id: vehicle.site_id || '',
          site_name: vehicle.site_name || '',
          target: vehicle.target || 12
        });
      } else {
        setFormData({
          name: '',
          rfid: '',
          site_id: '',
          site_name: '',
          target: 12
        });
      }
    }
  }, [vehicle, open]);

  const handleSiteChange = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    setFormData({
      ...formData,
      site_id: siteId,
      site_name: site?.name || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (vehicle) {
        await supabaseClient.tables.vehicles
          .update(formData)
          .eq('id', vehicle.id);
      } else {
        await supabaseClient.tables.vehicles
          .insert([{
            ...formData,
            washes_completed: 0,
            last_scan: new Date().toISOString()
          }]);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving vehicle:', error);
      toast({
        title: "Error",
        description: "Failed to save vehicle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label>Vehicle Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Truck 101"
              required
            />
          </div>

          <div>
            <Label>RFID Tag *</Label>
            <Input
              value={formData.rfid}
              onChange={(e) => setFormData({ ...formData, rfid: e.target.value })}
              placeholder="RFID identifier"
              required
            />
          </div>

          <div>
            <Label>Assigned Site</Label>
            <Select value={formData.site_id} onValueChange={handleSiteChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select site">
                  {formData.site_name || 'Select site'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No Site</SelectItem>
                {sites.map(site => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Wash Target (per period)</Label>
            <Input
              type="number"
              value={formData.target}
              onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) || 12 })}
              min="1"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#7CB342] hover:bg-[#689F38]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {vehicle ? 'Update' : 'Create'} Vehicle
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}