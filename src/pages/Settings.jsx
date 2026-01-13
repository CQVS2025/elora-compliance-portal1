import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Bell,
  Moon,
  Sun,
  Globe,
  Shield,
  Trash2,
  ChevronRight,
  Mail,
  Clock,
  Gauge,
  Loader2,
  Save,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
  });

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

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
          emailNotifications: notifPrefs.email_notifications_enabled ?? true,
          notifyMaintenanceDue: notifPrefs.notify_maintenance_due ?? true,
          notifyMaintenanceOverdue: notifPrefs.notify_maintenance_overdue ?? true,
          notifyLowCompliance: notifPrefs.notify_low_compliance ?? true,
          maintenanceDueDays: notifPrefs.maintenance_due_days ?? 7,
          complianceThreshold: notifPrefs.compliance_threshold ?? 50,
        }));
      }

      if (digestPrefs) {
        setSettings(prev => ({
          ...prev,
          digestEnabled: digestPrefs.enabled ?? true,
          digestFrequency: digestPrefs.frequency ?? 'daily',
          digestTime: digestPrefs.send_time ?? '08:00',
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to save settings.",
        variant: "destructive",
      });
      return;
    }

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

  // Toggle component
  const Toggle = ({ enabled, onChange }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-12 h-7 rounded-full transition-colors duration-200 relative
                 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`}
    >
      <motion.div
        className="w-5 h-5 rounded-full bg-white shadow-md absolute top-1"
        animate={{ left: enabled ? 24 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );

  // Setting Row component
  const SettingRow = ({ icon: Icon, title, description, children, iconColor = "text-gray-600 dark:text-gray-400" }) => (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-zinc-800
                       flex items-center justify-center">
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          {description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
      </div>
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                      border-b border-gray-200/20 dark:border-zinc-800/50">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-gray-600 dark:text-gray-400
                                   hover:text-gray-900 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="h-10 px-5 rounded-full bg-emerald-500 text-white
                      font-semibold text-sm hover:bg-emerald-600
                      active:scale-95 transition-all duration-150
                      shadow-lg shadow-emerald-500/30
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* Page Title */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-1">Settings</h1>
            <p className="text-gray-500 dark:text-gray-400">Customize your experience</p>
          </div>

          {/* Appearance Section */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                         rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                         shadow-lg shadow-black/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
              <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide">
                Appearance
              </h2>
            </div>
            <div className="px-6 divide-y divide-gray-200/50 dark:divide-zinc-800/50">
              <SettingRow
                icon={darkMode ? Moon : Sun}
                title="Dark Mode"
                description="Switch between light and dark themes"
                iconColor={darkMode ? "text-indigo-500" : "text-yellow-500"}
              >
                <Toggle enabled={darkMode} onChange={setDarkMode} />
              </SettingRow>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                         rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                         shadow-lg shadow-black/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
              <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide">
                Notifications
              </h2>
            </div>
            <div className="px-6 divide-y divide-gray-200/50 dark:divide-zinc-800/50">
              <SettingRow
                icon={Bell}
                title="Email Notifications"
                description="Receive notifications via email"
                iconColor="text-emerald-500"
              >
                <Toggle
                  enabled={settings.emailNotifications}
                  onChange={(val) => setSettings({...settings, emailNotifications: val})}
                />
              </SettingRow>

              <SettingRow
                icon={AlertTriangle}
                title="Maintenance Due Alerts"
                description="Get notified when maintenance is coming up"
                iconColor="text-amber-500"
              >
                <Toggle
                  enabled={settings.notifyMaintenanceDue}
                  onChange={(val) => setSettings({...settings, notifyMaintenanceDue: val})}
                />
              </SettingRow>

              <SettingRow
                icon={AlertTriangle}
                title="Maintenance Overdue Alerts"
                description="Get notified when maintenance is overdue"
                iconColor="text-red-500"
              >
                <Toggle
                  enabled={settings.notifyMaintenanceOverdue}
                  onChange={(val) => setSettings({...settings, notifyMaintenanceOverdue: val})}
                />
              </SettingRow>

              <SettingRow
                icon={Gauge}
                title="Low Compliance Alerts"
                description={`Alert when compliance drops below ${settings.complianceThreshold}%`}
                iconColor="text-orange-500"
              >
                <Toggle
                  enabled={settings.notifyLowCompliance}
                  onChange={(val) => setSettings({...settings, notifyLowCompliance: val})}
                />
              </SettingRow>

              {/* Thresholds */}
              <div className="py-4">
                <div className="mb-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    <Clock className="w-4 h-4" />
                    Maintenance Alert Days: {settings.maintenanceDueDays} days before due
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={settings.maintenanceDueDays}
                    onChange={(e) => setSettings({...settings, maintenanceDueDays: parseInt(e.target.value)})}
                    className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer
                              accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 day</span>
                    <span>30 days</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    <Gauge className="w-4 h-4" />
                    Compliance Alert Threshold: {settings.complianceThreshold}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={settings.complianceThreshold}
                    onChange={(e) => setSettings({...settings, complianceThreshold: parseInt(e.target.value)})}
                    className="w-full h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer
                              accent-emerald-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Email Digest Section */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                         rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                         shadow-lg shadow-black/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
              <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide">
                Email Digest
              </h2>
            </div>
            <div className="px-6 divide-y divide-gray-200/50 dark:divide-zinc-800/50">
              <SettingRow
                icon={Mail}
                title="Enable Email Digest"
                description="Receive periodic summary emails"
                iconColor="text-blue-500"
              >
                <Toggle
                  enabled={settings.digestEnabled}
                  onChange={(val) => setSettings({...settings, digestEnabled: val})}
                />
              </SettingRow>

              {settings.digestEnabled && (
                <div className="py-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Frequency
                    </label>
                    <div className="flex gap-2">
                      {['daily', 'weekly', 'monthly'].map((freq) => (
                        <button
                          key={freq}
                          onClick={() => setSettings({...settings, digestFrequency: freq})}
                          className={`h-10 px-4 rounded-full text-sm font-medium transition-all
                                    ${settings.digestFrequency === freq
                                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                      : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
                                    }`}
                        >
                          {freq.charAt(0).toUpperCase() + freq.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Send Time
                    </label>
                    <select
                      value={settings.digestTime}
                      onChange={(e) => setSettings({...settings, digestTime: e.target.value})}
                      className="h-12 px-4 rounded-xl w-full
                                bg-gray-100 dark:bg-zinc-800
                                border border-gray-200 dark:border-zinc-700
                                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                transition-all outline-none text-base"
                    >
                      <option value="06:00">6:00 AM</option>
                      <option value="08:00">8:00 AM</option>
                      <option value="09:00">9:00 AM</option>
                      <option value="12:00">12:00 PM</option>
                      <option value="17:00">5:00 PM</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Section */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                         rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                         shadow-lg shadow-black/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/50 dark:border-zinc-800/50">
              <h2 className="font-semibold text-gray-500 dark:text-gray-400 text-sm uppercase tracking-wide">
                Account
              </h2>
            </div>
            <div className="px-6 divide-y divide-gray-200/50 dark:divide-zinc-800/50">
              <SettingRow
                icon={Shield}
                title="Privacy & Security"
                iconColor="text-emerald-500"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </SettingRow>

              <SettingRow
                icon={Globe}
                title="Language & Region"
                description="English (Australia)"
                iconColor="text-blue-500"
              >
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </SettingRow>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="backdrop-blur-xl bg-red-50 dark:bg-red-500/10
                         rounded-2xl border border-red-200/50 dark:border-red-500/20
                         overflow-hidden">
            <div className="px-6 py-4">
              <SettingRow
                icon={Trash2}
                title="Delete Account"
                description="Permanently delete your account and data"
                iconColor="text-red-500"
              >
                <button className="h-10 px-4 rounded-full bg-red-500/10 text-red-500
                                  font-semibold text-sm hover:bg-red-500/20
                                  transition-colors">
                  Delete
                </button>
              </SettingRow>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
