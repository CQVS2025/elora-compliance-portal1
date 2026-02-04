import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  User,
  Phone,
  Briefcase,
  Building2,
  Lock,
  Save,
  Loader2,
  Camera,
  Mail,
  Shield,
} from 'lucide-react';
import { toast, toastError, toastSuccess } from '@/lib/toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function Profile() {
  const { user, userProfile, checkAuth } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
      });
      setAvatarError(false);
    }
  }, [userProfile]);

  const initials = formData.full_name
    ? formData.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.', { description: 'Invalid File Type' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Please select an image smaller than 5MB.', { description: 'File Too Large' });
      return;
    }
    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      if (userProfile?.avatar_url) {
        try {
          const urlParts = userProfile.avatar_url.split('/EloraBucket/');
          if (urlParts.length > 1) {
            await supabase.storage.from('EloraBucket').remove([urlParts[1]]);
          }
        } catch (e) {
          console.warn('Could not delete old avatar:', e);
        }
      }
      const { error: uploadError } = await supabase.storage
        .from('EloraBucket')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('EloraBucket').getPublicUrl(filePath);
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (updateError) throw updateError;
      toastSuccess('upload', 'avatar');
      setAvatarError(false);
      await checkAuth();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toastError(error, 'uploading avatar');
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!user) {
      toastError('You must be logged in', 'updating profile');
      return;
    }
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select();
      if (error) {
        if (error.code === 'PGRST116' || (data && data.length === 0)) {
          toast.error('Please contact your administrator to set up your profile.', { description: 'Profile Not Set Up' });
        } else throw error;
      } else if (!data || data.length === 0) {
        toast.error('Please contact your administrator to set up your profile.', { description: 'Profile Not Set Up' });
      } else {
        toastSuccess('save', 'profile');
        setIsEditing(false);
        await checkAuth();
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toastError(error, 'updating profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Please make sure both passwords are the same.', { description: "Passwords Don't Match" });
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Please use at least 6 characters.', { description: 'Password Too Short' });
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      toast.success('Password Changed', { description: 'Your new password is now active.' });
      setIsChangingPassword(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
      toastError(error, 'changing password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Profile header: avatar + name + email + role */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="relative shrink-0">
          <Avatar className="h-24 w-24 border-2 border-border">
            {userProfile?.avatar_url && !avatarError ? (
              <AvatarImage src={userProfile.avatar_url} alt="Profile" onError={() => setAvatarError(true)} />
            ) : null}
            <AvatarFallback className="text-2xl font-semibold bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <label
            className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground shadow hover:bg-muted/80 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            title="Change photo"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={isUploadingAvatar}
              className="sr-only"
            />
            {isUploadingAvatar ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </label>
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {userProfile?.full_name || 'User Profile'}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground mt-1">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user?.email}</span>
          </div>
          {userProfile?.role && (
            <Badge variant="secondary" className="mt-2 capitalize">
              {userProfile.role.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Profile Information card */}
      <Card className="border-border">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div>
            <CardTitle className="text-base">Profile Information</CardTitle>
            <CardDescription>Update your name and phone</CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({ full_name: userProfile?.full_name || '', phone: userProfile?.phone || '' });
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              Email
            </Label>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {user?.email || '-'}
            </div>
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Full Name
            </Label>
            {isEditing ? (
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter your full name"
                className="h-10"
              />
            ) : (
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                {userProfile?.full_name || '-'}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            {isEditing ? (
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter your phone number"
                className="h-10"
              />
            ) : (
              <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm">
                {userProfile?.phone || '-'}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Job Title
            </Label>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {userProfile?.job_title || '-'}
            </div>
            <p className="text-xs text-muted-foreground">Managed by administrator</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Shield className="h-4 w-4" />
              Role
            </Label>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3">
              {userProfile?.role && (
                <Badge variant="secondary" className="capitalize">
                  {userProfile.role.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Managed by administrator</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              Company
            </Label>
            <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
              {userProfile?.company_name || 'ELORA Solutions'}
            </div>
            <p className="text-xs text-muted-foreground">Managed by administrator</p>
          </div>
        </CardContent>
      </Card>

      {/* Security card */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </CardTitle>
          <CardDescription>Manage your password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isChangingPassword ? (
            <Button variant="outline" size="sm" onClick={() => setIsChangingPassword(true)}>
              <Lock className="mr-2 h-4 w-4" />
              Change Password
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                  className="h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ newPassword: '', confirmPassword: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" onClick={handleChangePassword} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {isSaving ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
