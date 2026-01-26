import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Shield,
  ChevronRight,
  Trash2,
  Loader2,
  Save,
  Globe
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [settings, setSettings] = useState({
    // Display Preferences
    timezone: 'Australia/Sydney',
    language: 'en',
    region: 'Australia',
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
      // Load user preferences from profile or local storage
      const savedSettings = localStorage.getItem(`settings_${user.id}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({
          ...prev,
          ...parsed
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
      // Save to local storage
      localStorage.setItem(`settings_${user.id}`, JSON.stringify(settings));

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
            <p className="text-gray-500 dark:text-gray-400">Manage your account preferences</p>
          </div>

          {/* Privacy & Security Section */}
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
