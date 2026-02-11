import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Search,
  Loader2,
  Check,
  X,
  ChevronDown,
  Settings,
  BarChart2,
  FileText,
  DollarSign,
  Truck,
  MapPin,
  Palette
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from '@/lib/toast';

// Available tabs for visibility control
const ALL_TABS = [
  { value: 'compliance', label: 'Compliance', icon: Check },
  { value: 'costs', label: 'Usage Costs', icon: DollarSign },
  { value: 'refills', label: 'Tank Levels', icon: Truck },
  { value: 'devices', label: 'Device Health', icon: Settings },
  { value: 'sites', label: 'Sites', icon: MapPin },
  { value: 'reports', label: 'Reports', icon: FileText },
  { value: 'email-reports', label: 'Email Reports', icon: FileText },
  { value: 'branding', label: 'Branding', icon: Palette },
];

const DEFAULT_FORM = {
  scope: 'user',
  user_email: '',
  email_domain: '',
  restricted_customer: '',
  lock_customer_filter: false,
  show_all_data: true,
  default_site: 'all',
  visible_tabs: [],
  hidden_tabs: [],
  hide_cost_forecast: false,
  hide_leaderboard: false,
  hide_usage_costs: false,
  can_view_compliance: true,
  can_view_reports: true,
  can_manage_sites: true,
  can_manage_users: false,
  can_export_data: true,
  can_view_costs: true,
  can_edit_vehicles: true,
  can_edit_sites: true,
  can_delete_records: false,
  is_active: true,
};

export default function PermissionsManagement() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPermission, setEditingPermission] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [tabVisibilityMode, setTabVisibilityMode] = useState('all'); // 'all', 'visible', 'hidden'

  const companyId = userProfile?.company_id;
  const isSuperAdmin = userProfile?.role === 'super_admin';

  // Fetch permissions
  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ['adminPermissions', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch customers for restricted customer dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await supabaseClient.elora.customers();
      return response?.data ?? response ?? [];
    },
  });

  // Save permission mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        company_id: companyId,
        visible_tabs: tabVisibilityMode === 'visible' && data.visible_tabs?.length > 0 ? data.visible_tabs : null,
        hidden_tabs: tabVisibilityMode === 'hidden' && data.hidden_tabs?.length > 0 ? data.hidden_tabs : null,
      };

      const response = await supabaseClient.permissions.save(payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save permissions');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPermissions']);
      setShowModal(false);
      setEditingPermission(null);
      setFormData(DEFAULT_FORM);
      toast.success('Permissions Saved', { description: 'User permissions have been updated.' });
    },
    onError: (error) => {
      toast.error(error.message, { description: 'Error' });
    },
  });

  // Delete permission mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('user_permissions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['adminPermissions']);
      toast.success('Deleted', { description: 'Permission configuration has been removed.' });
    },
    onError: (error) => {
      toast.error(error.message, { description: 'Error' });
    },
  });

  const handleEdit = (permission) => {
    setEditingPermission(permission);
    setFormData({
      ...DEFAULT_FORM,
      ...permission,
    });

    // Set tab visibility mode based on existing data
    if (permission.visible_tabs?.length > 0) {
      setTabVisibilityMode('visible');
    } else if (permission.hidden_tabs?.length > 0) {
      setTabVisibilityMode('hidden');
    } else {
      setTabVisibilityMode('all');
    }

    setShowModal(true);
  };

  const handleCreate = () => {
    setEditingPermission(null);
    setFormData(DEFAULT_FORM);
    setTabVisibilityMode('all');
    setShowModal(true);
  };

  const handleSubmit = () => {
    if (formData.scope === 'user' && !formData.user_email) {
      toast.error('User email is required', { description: 'Error' });
      return;
    }
    if (formData.scope === 'domain' && !formData.email_domain) {
      toast.error('Email domain is required', { description: 'Error' });
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingPermission?.id,
    });
  };

  const toggleTab = (tabValue, listType) => {
    const list = listType === 'visible' ? 'visible_tabs' : 'hidden_tabs';
    const currentList = formData[list] || [];

    if (currentList.includes(tabValue)) {
      setFormData({
        ...formData,
        [list]: currentList.filter(t => t !== tabValue),
      });
    } else {
      setFormData({
        ...formData,
        [list]: [...currentList, tabValue],
      });
    }
  };

  // Filter permissions
  const filteredPermissions = permissions.filter(p => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.user_email?.toLowerCase().includes(query) ||
      p.email_domain?.toLowerCase().includes(query) ||
      p.restricted_customer?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            User Permissions
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure access controls and visibility settings for users
          </p>
        </div>
        <Button onClick={handleCreate} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Permission
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by email, domain, or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Permissions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filteredPermissions.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-2xl border border-border">
          <Shield className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
          <p className="text-muted-foreground">No permission configurations found</p>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
            All users have default full access. Create a permission to restrict access.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {filteredPermissions.map((permission) => (
              <motion.div
                key={permission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-card rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      permission.scope === 'domain'
                        ? 'bg-purple-100 dark:bg-purple-500/20'
                        : 'bg-blue-100 dark:bg-blue-500/20'
                    }`}>
                      {permission.scope === 'domain' ? (
                        <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {permission.scope === 'domain'
                            ? `@${permission.email_domain}`
                            : permission.user_email}
                        </span>
                        <Badge variant={permission.scope === 'domain' ? 'secondary' : 'outline'}>
                          {permission.scope === 'domain' ? 'Domain' : 'User'}
                        </Badge>
                        {!permission.is_active && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-2">
                        {permission.restricted_customer && (
                          <Badge variant="outline" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            {permission.restricted_customer}
                          </Badge>
                        )}
                        {permission.lock_customer_filter && (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            Filter Locked
                          </Badge>
                        )}
                        {permission.hide_cost_forecast && (
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Cost Forecast
                          </Badge>
                        )}
                        {permission.hide_leaderboard && (
                          <Badge variant="outline" className="text-xs">
                            <EyeOff className="w-3 h-3 mr-1" />
                            Leaderboard
                          </Badge>
                        )}
                        {permission.visible_tabs?.length > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            <Eye className="w-3 h-3 mr-1" />
                            {permission.visible_tabs.length} tabs visible
                          </Badge>
                        )}
                        {permission.hidden_tabs?.length > 0 && (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                            <EyeOff className="w-3 h-3 mr-1" />
                            {permission.hidden_tabs.length} tabs hidden
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(permission)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(permission.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {editingPermission ? 'Edit Permission' : 'Create Permission'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Scope Selection */}
            <div className="space-y-2">
              <Label>Permission Scope</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => setFormData({ ...formData, scope: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span>Specific User</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="domain">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>Email Domain (all users)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* User Email or Domain */}
            {formData.scope === 'user' ? (
              <div className="space-y-2">
                <Label>User Email *</Label>
                <Input
                  type="email"
                  value={formData.user_email}
                  onChange={(e) => setFormData({ ...formData, user_email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Email Domain *</Label>
                <Input
                  value={formData.email_domain}
                  onChange={(e) => setFormData({ ...formData, email_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Applies to all users with this email domain
                </p>
              </div>
            )}

            <Accordion type="single" collapsible className="w-full">
              {/* Data Restrictions */}
              <AccordionItem value="data">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Data Restrictions
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Restricted to Customer</Label>
                      <Select
                        value={formData.restricted_customer || 'all'}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          restricted_customer: value === 'all' ? '' : value
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All customers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Customers</SelectItem>
                          {customers.map((c) => (
                            <SelectItem key={c.ref} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Lock Customer Filter</Label>
                        <p className="text-xs text-muted-foreground">Prevent changing customer selection</p>
                      </div>
                      <Switch
                        checked={formData.lock_customer_filter}
                        onCheckedChange={(checked) => setFormData({ ...formData, lock_customer_filter: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Show All Data</Label>
                        <p className="text-xs text-muted-foreground">Access to all fleet data</p>
                      </div>
                      <Switch
                        checked={formData.show_all_data}
                        onCheckedChange={(checked) => setFormData({ ...formData, show_all_data: checked })}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Tab Visibility */}
              <AccordionItem value="tabs">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Tab Visibility
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Visibility Mode</Label>
                      <Select
                        value={tabVisibilityMode}
                        onValueChange={setTabVisibilityMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Show All Tabs</SelectItem>
                          <SelectItem value="visible">Only Show Selected Tabs</SelectItem>
                          <SelectItem value="hidden">Hide Selected Tabs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {tabVisibilityMode !== 'all' && (
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_TABS.map((tab) => {
                          const Icon = tab.icon;
                          const listType = tabVisibilityMode === 'visible' ? 'visible_tabs' : 'hidden_tabs';
                          const isSelected = (formData[listType] || []).includes(tab.value);

                          return (
                            <div
                              key={tab.value}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? tabVisibilityMode === 'visible'
                                    ? 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/30'
                                    : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30'
                                  : 'hover:bg-muted/50 border-border'
                              }`}
                              onClick={() => toggleTab(tab.value, listType.replace('_tabs', ''))}
                            >
                              <Checkbox checked={isSelected} />
                              <Icon className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{tab.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* UI Elements */}
              <AccordionItem value="ui">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    Hidden UI Elements
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Hide Cost Forecast</Label>
                        <p className="text-xs text-muted-foreground">Hide cost forecasting section</p>
                      </div>
                      <Switch
                        checked={formData.hide_cost_forecast}
                        onCheckedChange={(checked) => setFormData({ ...formData, hide_cost_forecast: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Hide Leaderboard</Label>
                        <p className="text-xs text-muted-foreground">Hide driver leaderboard link</p>
                      </div>
                      <Switch
                        checked={formData.hide_leaderboard}
                        onCheckedChange={(checked) => setFormData({ ...formData, hide_leaderboard: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Hide Usage Costs in Vehicle Profile</Label>
                        <p className="text-xs text-muted-foreground">Hide cost data in vehicle details</p>
                      </div>
                      <Switch
                        checked={formData.hide_usage_costs}
                        onCheckedChange={(checked) => setFormData({ ...formData, hide_usage_costs: checked })}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Module Permissions */}
              <AccordionItem value="modules">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Module Permissions
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {[
                      { key: 'can_view_compliance', label: 'View Compliance', desc: 'Access compliance dashboard' },
                      { key: 'can_view_reports', label: 'View Reports', desc: 'Access reports and analytics' },
                      { key: 'can_view_costs', label: 'View Costs', desc: 'Access cost information' },
                      { key: 'can_manage_sites', label: 'Manage Sites', desc: 'Create and edit sites' },
                      { key: 'can_manage_users', label: 'Manage Users', desc: 'User administration' },
                      { key: 'can_export_data', label: 'Export Data', desc: 'Export data to CSV/Excel' },
                      { key: 'can_edit_vehicles', label: 'Edit Vehicles', desc: 'Modify vehicle data' },
                      { key: 'can_edit_sites', label: 'Edit Sites', desc: 'Modify site data' },
                      { key: 'can_delete_records', label: 'Delete Records', desc: 'Delete data permanently' },
                    ].map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between">
                        <div>
                          <Label>{perm.label}</Label>
                          <p className="text-xs text-muted-foreground">{perm.desc}</p>
                        </div>
                        <Switch
                          checked={formData[perm.key]}
                          onCheckedChange={(checked) => setFormData({ ...formData, [perm.key]: checked })}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Active Status */}
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <Label>Permission Active</Label>
                <p className="text-xs text-muted-foreground">Enable or disable this permission configuration</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Save Permission'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
