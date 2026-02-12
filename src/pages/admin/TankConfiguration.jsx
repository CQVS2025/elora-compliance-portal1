import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Droplet, Edit, Save, X, Plus, AlertCircle } from 'lucide-react';
import { toast } from '@/lib/toast';
import { tankConfigurationsAdminOptions } from '@/query/options/tankLevels';

export default function TankConfiguration() {
  const queryClient = useQueryClient();
  const [editingConfig, setEditingConfig] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all tank configurations (including inactive) for admin
  const { data: configs = [], isLoading, error } = useQuery(tankConfigurationsAdminOptions());

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (config) => {
      const { error } = await supabase
        .from('tank_configurations')
        .update({
          max_capacity_litres: config.max_capacity_litres,
          calibration_rate_per_60s: config.calibration_rate_per_60s,
          warning_threshold_pct: config.warning_threshold_pct,
          critical_threshold_pct: config.critical_threshold_pct,
          active: config.active,
          alert_contact: config.alert_contact,
          notes: config.notes,
        })
        .eq('id', config.id);
      
      if (error) throw error;
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tankConfigurations'] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tenant' });
      toast.success('Tank configuration updated successfully');
      setIsDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (error) => {
      toast.error(`Failed to update configuration: ${error.message}`);
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (config) => {
      const { error } = await supabase
        .from('tank_configurations')
        .insert([{
          site_ref: config.site_ref || null,
          device_ref: config.device_ref || null,
          device_serial: config.device_serial,
          product_type: config.product_type,
          tank_number: config.tank_number,
          max_capacity_litres: config.max_capacity_litres,
          calibration_rate_per_60s: config.calibration_rate_per_60s,
          warning_threshold_pct: config.warning_threshold_pct,
          critical_threshold_pct: config.critical_threshold_pct,
          active: config.active,
          alert_contact: config.alert_contact || null,
          notes: config.notes || null,
        }]);
      
      if (error) throw error;
      return config;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tankConfigurations'] });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'tenant' });
      toast.success('Tank configuration created successfully');
      setIsDialogOpen(false);
      setEditingConfig(null);
    },
    onError: (error) => {
      toast.error(`Failed to create configuration: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!editingConfig) return;
    if (!editingConfig.id && !(editingConfig.device_serial || '').trim()) {
      toast.error('Device serial is required for new configurations');
      return;
    }
    if (editingConfig.id) {
      updateMutation.mutate(editingConfig);
    } else {
      createMutation.mutate(editingConfig);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig({ ...config });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingConfig({
      site_ref: '',
      device_ref: '',
      device_serial: '',
      product_type: 'CONC',
      tank_number: 1,
      max_capacity_litres: 1000,
      calibration_rate_per_60s: 5.0,
      warning_threshold_pct: 20,
      critical_threshold_pct: 10,
      active: true,
      alert_contact: '',
      notes: '',
    });
    setIsDialogOpen(true);
  };

  // Filter configs
  const filteredConfigs = configs.filter(config => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      config.site_ref?.toLowerCase().includes(query) ||
      config.device_ref?.toLowerCase().includes(query) ||
      config.product_type?.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Droplet className="w-12 h-12 text-primary animate-bounce" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="w-12 h-12 text-destructive" />
              <h3 className="text-lg font-semibold">Error Loading Configurations</h3>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Droplet className="w-6 h-6 text-primary" />
            Tank Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage tank capacities, calibration rates, and thresholds
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Tank capacity and calibration rate are not provided by the ACATC API. This table stores them per device so we can calculate % full and consumption. Viewing and editing here lets you add new sites, fix mismatches, and update thresholds without code changes.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Add Configuration
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <Input
            placeholder="Search by site, device, or product type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{configs.length}</div>
            <div className="text-sm text-muted-foreground">Total Configurations</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">
              {configs.filter(c => c.active).length}
            </div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">
              {configs.filter(c => c.calibration_rate_per_60s === 2.5).length}
            </div>
            <div className="text-sm text-muted-foreground">2.5 L/60s</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {configs.filter(c => c.calibration_rate_per_60s === 5.0).length}
            </div>
            <div className="text-sm text-muted-foreground">5.0 L/60s</div>
          </CardContent>
        </Card>
      </div>

      {/* Configurations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tank Configurations ({filteredConfigs.length})</CardTitle>
          <CardDescription>
            Click on a row to edit configuration details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Site</th>
                  <th className="text-left p-3 text-sm font-semibold">Device</th>
                  <th className="text-left p-3 text-sm font-semibold">Serial</th>
                  <th className="text-center p-3 text-sm font-semibold">Product</th>
                  <th className="text-center p-3 text-sm font-semibold">Tank #</th>
                  <th className="text-right p-3 text-sm font-semibold">Capacity (L)</th>
                  <th className="text-right p-3 text-sm font-semibold">Rate (L/60s)</th>
                  <th className="text-center p-3 text-sm font-semibold">Thresholds</th>
                  <th className="text-center p-3 text-sm font-semibold">Status</th>
                  <th className="text-center p-3 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredConfigs.map((config) => (
                  <tr key={config.id} className="hover:bg-muted/30">
                    <td className="p-3 text-sm font-medium">{config.site_ref}</td>
                    <td className="p-3 text-sm">{config.device_ref}</td>
                    <td className="p-3 text-xs font-mono">{config.device_serial}</td>
                    <td className="p-3 text-center">
                      <Badge variant="secondary">{config.product_type}</Badge>
                    </td>
                    <td className="p-3 text-center text-sm">{config.tank_number}</td>
                    <td className="p-3 text-right text-sm">{config.max_capacity_litres}</td>
                    <td className="p-3 text-right text-sm">{config.calibration_rate_per_60s}</td>
                    <td className="p-3 text-center text-xs">
                      <span className="text-orange-600">{config.warning_threshold_pct}%</span>
                      {' / '}
                      <span className="text-red-600">{config.critical_threshold_pct}%</span>
                    </td>
                    <td className="p-3 text-center">
                      <Badge variant={config.active ? 'success' : 'secondary'}>
                        {config.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig?.id ? 'Edit Tank Configuration' : 'Create Tank Configuration'}
            </DialogTitle>
            <DialogDescription>
              Update tank capacity, calibration rate, and threshold settings
            </DialogDescription>
          </DialogHeader>

          {editingConfig && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site_ref">Site Reference</Label>
                  <Input
                    id="site_ref"
                    value={editingConfig.site_ref}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, site_ref: e.target.value })
                    }
                    disabled={!!editingConfig.id}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="device_ref">Device Reference</Label>
                  <Input
                    id="device_ref"
                    value={editingConfig.device_ref}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, device_ref: e.target.value })
                    }
                    disabled={!!editingConfig.id}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="device_serial">Device Serial (matches ACATC computerSerialId) *</Label>
                <Input
                  id="device_serial"
                  value={editingConfig.device_serial || ''}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, device_serial: e.target.value.trim() })
                  }
                  disabled={!!editingConfig.id}
                  placeholder="e.g. 0000000072d8d4f3"
                />
                {!editingConfig.id && (
                  <p className="text-xs text-muted-foreground">
                    Required for new configs. Must match the device serial from /api/devices so tank level can be calculated.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product_type">Product Type</Label>
                  <Select
                    value={editingConfig.product_type}
                    onValueChange={(value) =>
                      setEditingConfig({ ...editingConfig, product_type: value })
                    }
                    disabled={!!editingConfig.id}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CONC">CONC</SelectItem>
                      <SelectItem value="FOAM">FOAM</SelectItem>
                      <SelectItem value="TW">TW</SelectItem>
                      <SelectItem value="GEL">GEL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tank_number">Tank Number</Label>
                  <Select
                    value={String(editingConfig.tank_number)}
                    onValueChange={(value) =>
                      setEditingConfig({ ...editingConfig, tank_number: parseInt(value) })
                    }
                    disabled={!!editingConfig.id}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_capacity_litres">Max Capacity (Litres)</Label>
                  <Input
                    id="max_capacity_litres"
                    type="number"
                    value={editingConfig.max_capacity_litres}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        max_capacity_litres: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calibration_rate_per_60s">Calibration Rate (L/60s)</Label>
                  <Select
                    value={String(editingConfig.calibration_rate_per_60s)}
                    onValueChange={(value) =>
                      setEditingConfig({
                        ...editingConfig,
                        calibration_rate_per_60s: parseFloat(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2.5">2.5 L/60s</SelectItem>
                      <SelectItem value="5.0">5.0 L/60s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="warning_threshold_pct">Warning Threshold (%)</Label>
                  <Input
                    id="warning_threshold_pct"
                    type="number"
                    min="0"
                    max="100"
                    value={editingConfig.warning_threshold_pct}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        warning_threshold_pct: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="critical_threshold_pct">Critical Threshold (%)</Label>
                  <Input
                    id="critical_threshold_pct"
                    type="number"
                    min="0"
                    max="100"
                    value={editingConfig.critical_threshold_pct}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        critical_threshold_pct: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alert_contact">Alert Contact (Email/Phone)</Label>
                <Input
                  id="alert_contact"
                  value={editingConfig.alert_contact || ''}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, alert_contact: e.target.value })
                  }
                  placeholder="jonny@elora.com.au"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={editingConfig.notes || ''}
                  onChange={(e) =>
                    setEditingConfig({ ...editingConfig, notes: e.target.value })
                  }
                  placeholder="Additional notes..."
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={editingConfig.active}
                  onCheckedChange={(checked) =>
                    setEditingConfig({ ...editingConfig, active: checked })
                  }
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || createMutation.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              {updateMutation.isPending || createMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
