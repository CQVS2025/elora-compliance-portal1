import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Bell, Clock, Check, Loader2, Save } from 'lucide-react';
import { supabaseClient } from "@/api/supabaseClient";
import { toast } from 'sonner';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

async function fetchDigestPreferences(userEmail) {
  if (!userEmail) return null;
  try {
    const response = await supabaseClient.digest.getPreferences(userEmail);
    return response?.data ?? response ?? null;
  } catch (error) {
    console.error('Error fetching digest preferences:', error);
    return null;
  }
}

async function saveDigestPreferences(preferences) {
  const response = await supabaseClient.digest.savePreferences(preferences);
  return response?.data ?? response;
}

export default function EmailDigestPreferences({ userEmail }) {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['digestPreferences', userEmail],
    queryFn: () => fetchDigestPreferences(userEmail),
    enabled: !!userEmail,
  });

  const [localPrefs, setLocalPrefs] = useState({
    enabled: true,
    frequency: 'daily',
    sendTime: '08:00',
    includeCompliance: true,
    includeAlerts: true,
    includeActivity: true,
    onlyIfChanges: false,
  });

  React.useEffect(() => {
    if (preferences) {
      setLocalPrefs(preferences);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: saveDigestPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries(['digestPreferences', userEmail]);
      toast.success('Preferences saved successfully');
      setHasChanges(false);
    },
    onError: (error) => {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    }
  });

  const handleChange = (field, value) => {
    setLocalPrefs(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      userEmail,
      ...localPrefs
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
          <Mail className="w-5 h-5 text-[#7CB342]" />
          Email Digest Preferences
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Customize what you receive in your daily or weekly email digest
        </p>
      </div>

      {/* Enable/Disable */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
        <div className="flex-1">
          <Label htmlFor="enabled" className="text-base font-medium text-slate-800">
            Enable Email Digest
          </Label>
          <p className="text-sm text-slate-500 mt-1">
            Receive automated summary emails about your fleet
          </p>
        </div>
        <Switch
          id="enabled"
          checked={localPrefs.enabled}
          onCheckedChange={(checked) => handleChange('enabled', checked)}
        />
      </div>

      {/* Frequency */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Frequency
        </Label>
        <div className="grid grid-cols-3 gap-3">
          {['daily', 'weekly', 'monthly'].map((freq) => (
            <button
              key={freq}
              onClick={() => handleChange('frequency', freq)}
              disabled={!localPrefs.enabled}
              className={`p-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                localPrefs.frequency === freq
                  ? 'border-[#7CB342] bg-[#7CB342]/10 text-[#7CB342]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              } ${!localPrefs.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {freq.charAt(0).toUpperCase() + freq.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Send Time */}
      <div className="space-y-3">
        <Label htmlFor="sendTime" className="text-sm font-medium text-slate-700">
          Preferred Time
        </Label>
        <input
          id="sendTime"
          type="time"
          value={localPrefs.sendTime}
          onChange={(e) => handleChange('sendTime', e.target.value)}
          disabled={!localPrefs.enabled}
          className="w-full px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-[#7CB342] focus:outline-none disabled:opacity-50"
        />
        <p className="text-xs text-slate-500">
          Time is in your local timezone
        </p>
      </div>

      {/* Content Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Include in Digest
        </Label>

        <div className="space-y-3">
          {[
            { key: 'includeCompliance', label: 'Compliance Summary', desc: 'Vehicle wash compliance rates and alerts' },
            { key: 'includeAlerts', label: 'Important Alerts', desc: 'Critical issues requiring attention' },
            { key: 'includeActivity', label: 'Recent Activity', desc: 'Latest changes and updates' },
          ].map((option) => (
            <div key={option.key} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
              <div className="flex-1 pr-4">
                <Label htmlFor={option.key} className="text-sm font-medium text-slate-800">
                  {option.label}
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">
                  {option.desc}
                </p>
              </div>
              <Switch
                id={option.key}
                checked={localPrefs[option.key]}
                onCheckedChange={(checked) => handleChange(option.key, checked)}
                disabled={!localPrefs.enabled}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Only if changes */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
        <div className="flex-1">
          <Label htmlFor="onlyIfChanges" className="text-sm font-medium text-slate-800">
            Only send if there are changes
          </Label>
          <p className="text-xs text-slate-500 mt-1">
            Skip emails when there's nothing new to report
          </p>
        </div>
        <Switch
          id="onlyIfChanges"
          checked={localPrefs.onlyIfChanges}
          onCheckedChange={(checked) => handleChange('onlyIfChanges', checked)}
          disabled={!localPrefs.enabled}
        />
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-slate-200">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className="w-full flex items-center justify-center gap-2 bg-[#7CB342] hover:bg-[#6BA032] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
}
