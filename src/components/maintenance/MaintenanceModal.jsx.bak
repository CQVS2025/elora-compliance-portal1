import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change' },
  { value: 'tire_rotation', label: 'Tire Rotation' },
  { value: 'brake_service', label: 'Brake Service' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'engine_service', label: 'Engine Service' },
  { value: 'transmission', label: 'Transmission' },
  { value: 'general_maintenance', label: 'General Maintenance' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' }
];

export default function MaintenanceModal({ open, onClose, vehicle, maintenance, onSuccess, allVehicles = [] }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    service_date: '',
    service_type: 'oil_change',
    cost: '',
    mileage: '',
    next_service_date: '',
    next_service_mileage: '',
    notes: '',
    status: 'completed'
  });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedVehicle(vehicle);
      if (maintenance) {
        setFormData({
          service_date: maintenance.service_date || '',
          service_type: maintenance.service_type || 'oil_change',
          cost: maintenance.cost || '',
          mileage: maintenance.mileage || '',
          next_service_date: maintenance.next_service_date || '',
          next_service_mileage: maintenance.next_service_mileage || '',
          notes: maintenance.notes || '',
          status: maintenance.status || 'completed'
        });
      } else {
        setFormData({
          service_date: new Date().toISOString().split('T')[0],
          service_type: 'oil_change',
          cost: '',
          mileage: '',
          next_service_date: '',
          next_service_mileage: '',
          notes: '',
          status: 'completed'
        });
      }
    }
  }, [maintenance, open, vehicle]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!selectedVehicle) {
        toast({
          title: "Validation Error",
          description: "Please select a vehicle",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const data = {
        ...formData,
        vehicle_id: selectedVehicle.id,
        vehicle_name: selectedVehicle.name,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        mileage: formData.mileage ? parseInt(formData.mileage) : null,
        next_service_mileage: formData.next_service_mileage ? parseInt(formData.next_service_mileage) : null
      };

      if (maintenance) {
        await base44.entities.Maintenance.update(maintenance.id, data);
      } else {
        await base44.entities.Maintenance.create(data);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving maintenance:', error);
      toast({
        title: "Error",
        description: "Failed to save maintenance record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {maintenance ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Vehicle *</Label>
              <Select 
                value={selectedVehicle?.id} 
                onValueChange={(value) => {
                  const vehicle = allVehicles.find(v => v.id === value);
                  setSelectedVehicle(vehicle);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a vehicle">
                    {selectedVehicle?.name || 'Select a vehicle'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {allVehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} - {v.rfid}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Service Date *</Label>
              <Input
                type="date"
                value={formData.service_date}
                onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>Service Type *</Label>
              <Select value={formData.service_type} onValueChange={(value) => setFormData({ ...formData, service_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Cost ($)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>

            <div>
              <Label>Current Mileage</Label>
              <Input
                type="number"
                placeholder="e.g., 50000"
                value={formData.mileage}
                onChange={(e) => setFormData({ ...formData, mileage: e.target.value })}
              />
            </div>

            <div>
              <Label>Next Service Date</Label>
              <Input
                type="date"
                value={formData.next_service_date}
                onChange={(e) => setFormData({ ...formData, next_service_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Next Service Mileage</Label>
              <Input
                type="number"
                placeholder="e.g., 55000"
                value={formData.next_service_mileage}
                onChange={(e) => setFormData({ ...formData, next_service_mileage: e.target.value })}
              />
            </div>

            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes about the service..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#7CB342] hover:bg-[#689F38]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {maintenance ? 'Update' : 'Create'} Record
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}