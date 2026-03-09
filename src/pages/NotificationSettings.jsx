import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseClient } from "@/api/supabaseClient";
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, Mail, Save } from 'lucide-react';
import { toast } from '@/lib/toast';

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

  const loadPreferences = async () => {
    try {
      const { data: prefs, error } = await supabaseClient.tables.notificationPreferences
        .select('*')
        .eq('user_email', user.email);

      if (prefs && prefs.length > 0) {
        setPreferences(prefs[0]);
      } else {
        // Create default preferences
        const defaultPrefs = {
          user_email: user.email,
          email_notifications_enabled: true,
          notify_low_compliance: true,
          notify_vehicle_assigned: true,
          notify_issue_updates: true,
          compliance_threshold: 50
        };
        const { data: created, error: createError } = await supabaseClient.tables.notificationPreferences
          .insert([defaultPrefs])
          .select()
          .single();
        setPreferences(created);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (updatedPrefs) => {
      await supabaseClient.tables.notificationPreferences
        .update(updatedPrefs)
        .eq('id', preferences.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationPreferences']);
      toast.success('Notification preferences saved');
    },
    onError: () => {
      toast.error('Failed to save preferences');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(preferences);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Notification Settings</h1>
        <p className="text-muted-foreground mt-2">Manage how you receive alerts and notifications</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>Receive important alerts via email</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Enable Email Notifications</p>
              <p className="text-sm text-muted-foreground">Get notified via email for critical events</p>
            </div>
            <Switch
              checked={preferences?.email_notifications_enabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, email_notifications_enabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Low Compliance Rate</p>
              <p className="text-sm text-muted-foreground">Alert when vehicle compliance drops below threshold</p>
            </div>
            <Switch
              checked={preferences?.notify_low_compliance}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_low_compliance: checked })
              }
            />
          </div>

          {preferences?.notify_low_compliance && (
            <div className="ml-4 sm:ml-6 space-y-2">
              <Label>Compliance Threshold (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={preferences?.compliance_threshold}
                onChange={(e) =>
                  setPreferences({ ...preferences, compliance_threshold: parseInt(e.target.value) })
                }
                className="w-full sm:w-32"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Vehicle Assignments</p>
              <p className="text-sm text-muted-foreground">Alert when vehicles are assigned to you</p>
            </div>
            <Switch
              checked={preferences?.notify_vehicle_assigned}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_vehicle_assigned: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-medium">Issue Updates</p>
              <p className="text-sm text-muted-foreground">Alert on issue status changes</p>
            </div>
            <Switch
              checked={preferences?.notify_issue_updates}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, notify_issue_updates: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full sm:w-auto"
        >
          {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Save className="w-4 h-4 mr-2" />
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
