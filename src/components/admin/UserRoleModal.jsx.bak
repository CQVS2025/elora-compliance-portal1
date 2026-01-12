import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, Shield } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function UserRoleModal({ open, onClose, user, vehicles, sites, onSuccess }) {
  const { toast } = useToast();
  const [role, setRole] = useState('driver');
  const [assignedSites, setAssignedSites] = useState([]);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      setRole(user.role || 'driver');
      setAssignedSites(user.assigned_sites || []);
      setAssignedVehicles(user.assigned_vehicles || []);
    }
  }, [open, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await base44.entities.User.update(user.id, {
        role,
        assigned_sites: role === 'site_manager' ? assignedSites : [],
        assigned_vehicles: role === 'driver' ? assignedVehicles : []
      });

      onSuccess();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "Failed to update user role. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleSite = (siteId) => {
    setAssignedSites(prev =>
      prev.includes(siteId) ? prev.filter(id => id !== siteId) : [...prev, siteId]
    );
  };

  const toggleVehicle = (vehicleId) => {
    setAssignedVehicles(prev =>
      prev.includes(vehicleId) ? prev.filter(id => id !== vehicleId) : [...prev, vehicleId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Edit User Role - {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Role Selection */}
          <div>
            <Label className="text-base font-semibold mb-3 block">User Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">
                  <div className="flex flex-col">
                    <span className="font-semibold">Administrator</span>
                    <span className="text-xs text-slate-500">Full system access, user management</span>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex flex-col">
                    <span className="font-semibold">Manager</span>
                    <span className="text-xs text-slate-500">Fleet operations, reports, data export</span>
                  </div>
                </SelectItem>
                <SelectItem value="technician">
                  <div className="flex flex-col">
                    <span className="font-semibold">Technician</span>
                    <span className="text-xs text-slate-500">Maintenance management and vehicle viewing</span>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div className="flex flex-col">
                    <span className="font-semibold">Viewer</span>
                    <span className="text-xs text-slate-500">Read-only access to dashboards and reports</span>
                  </div>
                </SelectItem>
                <SelectItem value="site_manager">
                  <div className="flex flex-col">
                    <span className="font-semibold">Site Manager</span>
                    <span className="text-xs text-slate-500">Manage assigned sites and vehicles</span>
                  </div>
                </SelectItem>
                <SelectItem value="driver">
                  <div className="flex flex-col">
                    <span className="font-semibold">Driver</span>
                    <span className="text-xs text-slate-500">View assigned vehicles only</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Site Manager - Assign Sites */}
          {role === 'site_manager' && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Assigned Sites</Label>
              <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                {sites.length === 0 ? (
                  <p className="text-sm text-slate-500">No sites available</p>
                ) : (
                  sites.map((site) => (
                    <div key={site.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`site-${site.id}`}
                        checked={assignedSites.includes(site.id)}
                        onCheckedChange={() => toggleSite(site.id)}
                      />
                      <label
                        htmlFor={`site-${site.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {site.name} {site.city ? `- ${site.city}` : ''}
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {assignedSites.length} site{assignedSites.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* Driver - Assign Vehicles */}
          {role === 'driver' && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Assigned Vehicles</Label>
              <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                {vehicles.length === 0 ? (
                  <p className="text-sm text-slate-500">No vehicles available</p>
                ) : (
                  vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`vehicle-${vehicle.id}`}
                        checked={assignedVehicles.includes(vehicle.id)}
                        onCheckedChange={() => toggleVehicle(vehicle.id)}
                      />
                      <label
                        htmlFor={`vehicle-${vehicle.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {vehicle.name} - {vehicle.rfid} ({vehicle.site_name})
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {assignedVehicles.length} vehicle{assignedVehicles.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* Role Notes */}
          {role === 'admin' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Administrator:</strong> Full system access including user management, 
                settings, and all data. Use with caution.
              </p>
            </div>
          )}
          {role === 'manager' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Manager:</strong> Can view and edit all fleet data, generate reports, 
                and export data. Cannot manage users or system settings.
              </p>
            </div>
          )}
          {role === 'technician' && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>Technician:</strong> Focused on maintenance tasks. Can add, view, and edit 
                maintenance records. View-only access to vehicle data.
              </p>
            </div>
          )}
          {role === 'viewer' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm text-slate-800">
                <strong>Viewer:</strong> Read-only access to dashboards and reports. 
                Cannot edit any data or perform actions.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#7CB342] hover:bg-[#689F38]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Role
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}