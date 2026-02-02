import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import {
  Shield,
  ChevronRight,
  Trash2,
  Loader2,
  Globe,
} from 'lucide-react';
import { toast } from '@/lib/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [settings, setSettings] = useState({
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
      const savedSettings = localStorage.getItem(`settings_${user.id}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) {
      toast.error('You must be logged in to delete your account.', { description: 'Error' });
      return;
    }
    setIsDeleting(true);
    try {
      const response = await supabaseClient.account.deleteMyAccount();
      if (response.error) throw new Error(response.error);
      toast.success('Account Deleted', { description: 'Your account has been permanently deleted.' });
      await logout();
      navigate('/Login');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error.message || 'Failed to delete account. Please try again.', { description: 'Error' });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[280px] gap-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences</p>
      </div>

      <Separator />

      {/* Account section */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Privacy, security, and regional preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Privacy & Security</p>
                <p className="text-sm text-muted-foreground">Manage password and security options</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">Language & Region</p>
                <p className="text-sm text-muted-foreground">English (Australia)</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-border border-destructive/30 bg-destructive/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="font-medium text-foreground">Permanently delete your account and data</p>
              <p className="text-sm text-muted-foreground">All your data will be removed from our systems.</p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="shrink-0"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your account? This action cannot be undone.
              All your data will be permanently deleted from our database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
