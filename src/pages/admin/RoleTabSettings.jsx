import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { getAccessibleTabs } from '@/lib/permissions';
import { roleTabSettingsOptions } from '@/query/options';
import { useSaveRoleTabSettings, useResetRoleTabSettings } from '@/query/mutations/roleTabSettings';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Shield, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const ALL_TABS = [
  { value: 'compliance', label: 'Compliance' },
  { value: 'costs', label: 'Usage Costs' },
  { value: 'refills', label: 'Refills' },
  { value: 'devices', label: 'Device Health' },
  { value: 'sites', label: 'Sites' },
  { value: 'reports', label: 'Reports' },
  { value: 'email-reports', label: 'Email Reports' },
  { value: 'branding', label: 'Branding' },
];

const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'user', label: 'User' },
  { value: 'batcher', label: 'Batcher' },
  { value: 'driver', label: 'Driver' },
  { value: 'viewer', label: 'Viewer' },
];

const ROLE_COLORS = {
  super_admin: 'bg-red-500',
  admin: 'bg-purple-500',
  manager: 'bg-blue-500',
  user: 'bg-slate-500',
  batcher: 'bg-teal-500',
  driver: 'bg-green-500',
  viewer: 'bg-gray-500',
};

function getDefaultTabsForRole(role) {
  return getAccessibleTabs({ role });
}

export default function RoleTabSettings() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { data: roleOverrides = {}, isLoading } = useQuery(roleTabSettingsOptions());
  const saveMutation = useSaveRoleTabSettings();
  const resetMutation = useResetRoleTabSettings();

  const [localOverrides, setLocalOverrides] = useState({});

  const getTabsForRole = useCallback(
    (role) => {
      if (localOverrides[role]) return localOverrides[role];
      if (roleOverrides[role]?.length > 0) return roleOverrides[role];
      return getDefaultTabsForRole(role);
    },
    [roleOverrides, localOverrides]
  );

  const isTabEnabled = (role, tabValue) => getTabsForRole(role).includes(tabValue);

  const hasOverride = (role) =>
    roleOverrides[role]?.length > 0 || (localOverrides[role] && Object.keys(localOverrides).includes(role));

  const handleToggle = (role, tabValue, enabled) => {
    const currentTabs = getTabsForRole(role);
    let newTabs;
    if (enabled) {
      newTabs = [...currentTabs, tabValue];
    } else {
      newTabs = currentTabs.filter((t) => t !== tabValue);
    }
    setLocalOverrides((prev) => ({ ...prev, [role]: newTabs }));
  };

  const handleSave = async (role) => {
    const tabs = localOverrides[role];
    if (!tabs) return;
    try {
      await saveMutation.mutateAsync({ role, visibleTabs: tabs });
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      toast.success(`Tabs saved for ${ROLES.find((r) => r.value === role)?.label}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to save');
    }
  };

  const handleReset = async (role) => {
    try {
      await resetMutation.mutateAsync(role);
      setLocalOverrides((prev) => {
        const next = { ...prev };
        delete next[role];
        return next;
      });
      toast.success(`Reset to default for ${ROLES.find((r) => r.value === role)?.label}`);
    } catch (err) {
      toast.error(err?.message || 'Failed to reset');
    }
  };

  if (userProfile?.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <p className="text-slate-600">Only Super Admin can configure role tab visibility.</p>
            <Button className="mt-4" onClick={() => navigate('/admin')}>
              Back to Admin
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white dark:from-zinc-900 dark:to-zinc-950">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
              onClick={() => navigate('/admin')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </div>
          <div className="mt-2">
            <h1 className="text-2xl font-bold">Tab Visibility by Role</h1>
            <p className="text-slate-300 text-sm mt-1">
              Override default tabs for each role. When no override is set, role defaults apply.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {ROLES.map((roleConfig) => {
              const role = roleConfig.value;
              const defaultTabs = getDefaultTabsForRole(role);
              const effectiveTabs = getTabsForRole(role);
              const hasLocalChanges = localOverrides[role] !== undefined;

              return (
                <Card key={role}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 ${ROLE_COLORS[role]} rounded-lg flex items-center justify-center shrink-0`}
                        >
                          <Shield className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle>{roleConfig.label}</CardTitle>
                          <CardDescription>
                            Default: {defaultTabs.join(', ') || 'none'}
                            {hasOverride(role) && (
                              <span className="ml-2 text-amber-600">(custom)</span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasOverride(role) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReset(role)}
                            disabled={resetMutation.isPending}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reset to default
                          </Button>
                        )}
                        {hasLocalChanges && (
                          <Button
                            size="sm"
                            onClick={() => handleSave(role)}
                            disabled={saveMutation.isPending}
                          >
                            {saveMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Save'
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
                      {ALL_TABS.map((tab) => (
                        <div
                          key={tab.value}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-zinc-800"
                        >
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {tab.label}
                          </span>
                          <Switch
                            checked={isTabEnabled(role, tab.value)}
                            onCheckedChange={(checked) => handleToggle(role, tab.value, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
