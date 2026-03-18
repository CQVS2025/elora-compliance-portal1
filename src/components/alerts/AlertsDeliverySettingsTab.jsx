import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { alertsApi } from '@/api/alertsApi';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Mail, Phone, Bell, Clock, Shield, Save, Info } from 'lucide-react';

export default function AlertsDeliverySettingsTab() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const userId = userProfile?.id;

  const { data: settings, isLoading } = useQuery({
    queryKey: ['alert-delivery-settings', userId],
    queryFn: () => alertsApi.getDeliverySettings(userId),
    enabled: !!userId,
  });

  const [form, setForm] = useState({
    email: '',
    sms_number: '',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
  });

  useEffect(() => {
    if (settings) {
      const hasQuietHours = !!(settings.quiet_hours_start && settings.quiet_hours_end);
      setForm({
        email: settings.email || '',
        sms_number: settings.sms_number || '',
        quiet_hours_enabled: hasQuietHours,
        quiet_hours_start: settings.quiet_hours_start || '22:00',
        quiet_hours_end: settings.quiet_hours_end || '07:00',
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data) => alertsApi.upsertDeliverySettings(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alert-delivery-settings', userId] });
      toast.success('Delivery preferences saved');
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  const handleSave = (e) => {
    e.preventDefault();
    const payload = {
      email: form.email,
      sms_number: form.sms_number,
      quiet_hours_start: form.quiet_hours_enabled ? form.quiet_hours_start : null,
      quiet_hours_end: form.quiet_hours_enabled ? form.quiet_hours_end : null,
    };
    saveMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground text-sm">Loading delivery settings...</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main form */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Delivery Preferences
            </CardTitle>
            <CardDescription>
              Configure how and where you receive alert notifications. These settings apply to all enabled alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-8">
              {/* Default delivery methods */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Default Delivery Methods
                </Label>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
                    <div className="p-1 rounded-md bg-green-100 dark:bg-green-900">
                      <Mail className="h-4 w-4 text-green-700 dark:text-green-400" />
                    </div>
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Email</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                    <div className="p-1 rounded-md bg-blue-100 dark:bg-blue-900">
                      <Phone className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-400">SMS</span>
                  </div>
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800">
                    <div className="p-1 rounded-md bg-purple-100 dark:bg-purple-900">
                      <Bell className="h-4 w-4 text-purple-700 dark:text-purple-400" />
                    </div>
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-400">Portal</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Alert Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Alert Email
                </Label>
                <Input
                  id="email"
                  type="text"
                  placeholder="jonny@elorasolutions.com.au"
                  value={form.email}
                  onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
              </div>

              {/* SMS Number */}
              <div className="space-y-2">
                <Label htmlFor="sms" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  SMS Number
                </Label>
                <Input
                  id="sms"
                  type="text"
                  placeholder="+61 4XX XXX XXX"
                  value={form.sms_number}
                  onChange={(e) => setForm(prev => ({ ...prev, sms_number: e.target.value }))}
                  className="max-w-lg"
                />
                <p className="text-xs text-muted-foreground">Separate multiple numbers with commas</p>
              </div>

              <Separator />

              {/* Quiet Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between max-w-lg">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Quiet Hours (No SMS)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {form.quiet_hours_enabled
                        ? 'SMS alerts will be suppressed during quiet hours'
                        : 'SMS alerts will be sent at any time'}
                    </p>
                  </div>
                  <Switch
                    checked={form.quiet_hours_enabled}
                    onCheckedChange={(val) => setForm(prev => ({ ...prev, quiet_hours_enabled: val }))}
                  />
                </div>

                {form.quiet_hours_enabled && (
                  <div className="flex items-center gap-3 pl-0.5">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">From</Label>
                      <Input
                        type="time"
                        value={form.quiet_hours_start}
                        onChange={(e) => setForm(prev => ({ ...prev, quiet_hours_start: e.target.value }))}
                        className="w-[140px]"
                      />
                    </div>
                    <span className="text-sm text-muted-foreground mt-5">to</span>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Until</Label>
                      <Input
                        type="time"
                        value={form.quiet_hours_end}
                        onChange={(e) => setForm(prev => ({ ...prev, quiet_hours_end: e.target.value }))}
                        className="w-[140px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <Button
                type="submit"
                className="bg-green-600 hover:bg-green-700 gap-2"
                disabled={saveMutation.isPending}
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Preferences'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Info sidebar */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              How it works
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Portal</span> — Alerts appear instantly in the Live Feed tab and as a notification in the portal.
            </p>
            <Separator />
            <p>
              <span className="font-medium text-foreground">Email</span> — Alert details are sent to the configured email addresses via Mailgun.
            </p>
            <Separator />
            <p>
              <span className="font-medium text-foreground">SMS</span> — Critical and high-priority alerts are sent via Twilio to the configured phone numbers. Quiet hours can suppress SMS during overnight periods.
            </p>
            <Separator />
            <p>
              Each alert trigger on the <span className="font-medium text-foreground">Configured</span> tab can be individually toggled for Portal, Email, and SMS delivery.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Quiet Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              When enabled, SMS notifications will not be sent between the start and end times. Email and Portal notifications are not affected.
            </p>
            <p className="mt-2">
              {form.quiet_hours_enabled
                ? <>Currently set: <span className="font-medium text-foreground">{form.quiet_hours_start}</span> to <span className="font-medium text-foreground">{form.quiet_hours_end}</span></>
                : <span className="font-medium text-foreground">Disabled — SMS sent 24/7</span>
              }
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
