import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import {
  ArrowLeft,
  Loader2,
  Save,
  Bell,
  Mail,
  Clock,
  Gauge,
  Sun,
  Moon,
  Globe
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [settings, setSettings] = useState({
    // Notification Preferences
    emailNotifications: true,
    notifyMaintenanceDue: true,
    notifyMaintenanceOverdue: true,
    notifyLowCompliance: true,
    maintenanceDueDays: 7,
    complianceThreshold: 50,

    // Email Digest
    digestEnabled: true,
    digestFrequency: 'daily',
    digestTime: '08:00',

    // Display Preferences
    timezone: 'Australia/Sydney',
    theme: 'light',
    dashboardRefreshInterval: 5,
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Load notification preferences
      const { data: notifPrefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      // Load email digest preferences
      const { data: digestPrefs } = await supabase
        .from('email_digest_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (notifPrefs) {
        setSettings(prev => ({
          ...prev,
          emailNotifications: notifPrefs.email_notifications_enabled,
          notifyMaintenanceDue: notifPrefs.notify_maintenance_due,
          notifyMaintenanceOverdue: notifPrefs.notify_maintenance_overdue,
          notifyLowCompliance: notifPrefs.notify_low_compliance,
          maintenanceDueDays: notifPrefs.maintenance_due_days,
          complianceThreshold: notifPrefs.compliance_threshold,
        }));
      }

      if (digestPrefs) {
        setSettings(prev => ({
          ...prev,
          digestEnabled: digestPrefs.enabled,
          digestFrequency: digestPrefs.frequency,
          digestTime: digestPrefs.send_time,
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);

    try {
      // Upsert notification preferences
      const { error: notifError } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          user_email: user.email,
          company_id: user.user_metadata?.company_id || null,
          email_notifications_enabled: settings.emailNotifications,
          notify_maintenance_due: settings.notifyMaintenanceDue,
          notify_maintenance_overdue: settings.notifyMaintenanceOverdue,
          notify_low_compliance: settings.notifyLowCompliance,
          maintenance_due_days: settings.maintenanceDueDays,
          compliance_threshold: settings.complianceThreshold,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email'
        });

      if (notifError) throw notifError;

      // Upsert email digest preferences
      const { error: digestError } = await supabase
        .from('email_digest_preferences')
        .upsert({
          user_id: user.id,
          user_email: user.email,
          company_id: user.user_metadata?.company_id || null,
          enabled: settings.digestEnabled,
          frequency: settings.digestFrequency,
          send_time: settings.digestTime,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_email'
        });

      if (digestError) throw digestError;

      toast({
        title: "Settings Saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <div className="space-y-6">
          {/* Notification Settings */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#7CB342]" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Email Notifications</Label>
                  <p className="text-sm text-slate-500">Receive notifications via email</p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Due Alerts</Label>
                    <p className="text-sm text-slate-500">Get notified when maintenance is coming up</p>
                  </div>
                  <Switch
                    checked={settings.notifyMaintenanceDue}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifyMaintenanceDue: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Overdue Alerts</Label>
                    <p className="text-sm text-slate-500">Get notified when maintenance is overdue</p>
                  </div>
                  <Switch
                    checked={settings.notifyMaintenanceOverdue}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifyMaintenanceOverdue: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Low Compliance Alerts</Label>
                    <p className="text-sm text-slate-500">Get notified when compliance drops below threshold</p>
                  </div>
                  <Switch
                    checked={settings.notifyLowCompliance}
                    onCheckedChange={(checked) => setSettings({ ...settings, notifyLowCompliance: checked })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4" />
                    Maintenance Alert Days: {settings.maintenanceDueDays} days before due
                  </Label>
                  <Slider
                    value={[settings.maintenanceDueDays]}
                    onValueChange={([value]) => setSettings({ ...settings, maintenanceDueDays: value })}
                    min={1}
                    max={30}
                    step={1}
                    className="w-full"
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Gauge className="w-4 h-4" />
                    Compliance Alert Threshold: {settings.complianceThreshold}%
                  </Label>
                  <Slider
                    value={[settings.complianceThreshold]}
                    onValueChange={([value]) => setSettings({ ...settings, complianceThreshold: value })}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email Digest Settings */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#7CB342]" />
                Email Digest
              </CardTitle>
              <CardDescription>
                Configure your daily/weekly email summary
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Enable Email Digest</Label>
                  <p className="text-sm text-slate-500">Receive periodic summary emails</p>
                </div>
                <Switch
                  checked={settings.digestEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, digestEnabled: checked })}
                />
              </div>

              {settings.digestEnabled && (
                <>
                  <Separator />

                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <Label>Frequency</Label>
                      <Select
                        value={settings.digestFrequency}
                        onValueChange={(value) => setSettings({ ...settings, digestFrequency: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Send Time</Label>
                      <Select
                        value={settings.digestTime}
                        onValueChange={(value) => setSettings({ ...settings, digestTime: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="06:00">6:00 AM</SelectItem>
                          <SelectItem value="08:00">8:00 AM</SelectItem>
                          <SelectItem value="09:00">9:00 AM</SelectItem>
                          <SelectItem value="12:00">12:00 PM</SelectItem>
                          <SelectItem value="17:00">5:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Display Preferences */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#7CB342]" />
                Display Preferences
              </CardTitle>
              <CardDescription>
                Customize your dashboard experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Australia/Sydney">Sydney (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Melbourne">Melbourne (AEST/AEDT)</SelectItem>
                    <SelectItem value="Australia/Brisbane">Brisbane (AEST)</SelectItem>
                    <SelectItem value="Australia/Perth">Perth (AWST)</SelectItem>
                    <SelectItem value="Australia/Adelaide">Adelaide (ACST/ACDT)</SelectItem>
                    <SelectItem value="Pacific/Auckland">Auckland (NZST/NZDT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Theme</Label>
                <div className="flex gap-2">
                  <Button
                    variant={settings.theme === 'light' ? 'default' : 'outline'}
                    className={settings.theme === 'light' ? 'bg-[#7CB342] hover:bg-[#689F38]' : ''}
                    onClick={() => setSettings({ ...settings, theme: 'light' })}
                  >
                    <Sun className="w-4 h-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={settings.theme === 'dark' ? 'default' : 'outline'}
                    className={settings.theme === 'dark' ? 'bg-[#7CB342] hover:bg-[#689F38]' : ''}
                    onClick={() => setSettings({ ...settings, theme: 'dark' })}
                  >
                    <Moon className="w-4 h-4 mr-2" />
                    Dark
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              className="bg-[#7CB342] hover:bg-[#689F38]"
              onClick={handleSaveSettings}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
