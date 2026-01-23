import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  User,
  Phone,
  Briefcase,
  Building2,
  Lock,
  Save,
  Loader2,
  Camera,
  CheckCircle,
  Mail
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatErrorForToast, formatSuccessForToast, getUserFriendlyError } from '@/utils/errorMessages';

export default function Profile() {
  const navigate = useNavigate();
  const { user, userProfile, checkAuth } = useAuth();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    job_title: '',
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Initialize form data when userProfile loads
  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        phone: userProfile.phone || '',
        job_title: userProfile.job_title || '',
      });
    }
  }, [userProfile]);

  const initials = formData.full_name
    ? formData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  const handleSaveProfile = async () => {
    if (!user) {
      toast(formatErrorForToast('You must be logged in', 'updating profile'));
      return;
    }

    setIsSaving(true);

    try {
      // Try to update the existing profile
      const { data, error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          job_title: formData.job_title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select();

      if (error) {
        // If the error is "no rows found", the profile doesn't exist
        if (error.code === 'PGRST116' || (data && data.length === 0)) {
          console.log('Profile not found, user may need to be added to a company first');
          toast({
            title: "Profile Not Set Up",
            description: "Please contact your administrator to set up your profile.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else if (!data || data.length === 0) {
        toast({
          title: "Profile Not Set Up",
          description: "Please contact your administrator to set up your profile.",
          variant: "destructive",
        });
      } else {
        toast(formatSuccessForToast('save', 'profile'));
        setIsEditing(false);
        await checkAuth(); // Refresh user data
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast(formatErrorForToast(error, 'updating profile'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Please use at least 8 characters.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) throw error;

      toast({
        title: "Password Changed",
        description: "Your new password is now active.",
      });

      setIsChangingPassword(false);
      setPasswordData({
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error) {
      console.error('Error changing password:', error);
      toast(formatErrorForToast(error, 'changing password'));
    } finally {
      setIsSaving(false);
    }
  };

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
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Profile Header */}
          <div className="text-center mb-12">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600
                             mx-auto mb-4 flex items-center justify-center
                             shadow-lg shadow-emerald-500/30">
                <span className="text-white text-3xl font-bold">{initials}</span>
              </div>
              <button className="absolute bottom-4 right-0 w-8 h-8 bg-white dark:bg-zinc-800
                                rounded-full shadow-md flex items-center justify-center
                                hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors
                                border border-gray-200 dark:border-zinc-700">
                <Camera className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
            <h1 className="text-3xl font-bold mb-1">{userProfile?.full_name || 'User Profile'}</h1>
            <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
              <Mail className="w-4 h-4" />
              <span>{user?.email}</span>
            </div>
            {userProfile?.role && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                             bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 mt-3 capitalize">
                {userProfile.role.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Profile Card */}
          <div className="backdrop-blur-xl bg-white/80 dark:bg-zinc-900/80
                         rounded-2xl border border-gray-200/20 dark:border-zinc-800/50
                         shadow-lg shadow-black/5 overflow-hidden">

            {/* Section Header */}
            <div className="px-8 py-6 border-b border-gray-200/50 dark:border-zinc-800/50
                           flex items-center justify-between">
              <h2 className="text-xl font-semibold">Profile Information</h2>
              <div className="flex gap-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="h-10 px-4 rounded-full text-emerald-600 dark:text-emerald-400
                              hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors
                              font-medium text-sm border border-emerald-200 dark:border-emerald-500/30"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setFormData({
                          full_name: userProfile?.full_name || '',
                          phone: userProfile?.phone || '',
                          job_title: userProfile?.job_title || '',
                        });
                      }}
                      className="h-10 px-4 rounded-full text-gray-600 dark:text-gray-400
                                hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors
                                font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSaving}
                      className="h-10 px-6 rounded-full bg-emerald-500 text-white
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
                  </>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-8 space-y-6">
              {/* Full Name */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700
                                 dark:text-gray-300 mb-2">
                  <User className="w-4 h-4" />
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl
                              bg-gray-100 dark:bg-zinc-800
                              border border-gray-200 dark:border-zinc-700
                              focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                              transition-all outline-none text-base"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <div className="w-full h-12 px-4 rounded-xl
                                 bg-gray-50 dark:bg-zinc-900
                                 border border-gray-200 dark:border-zinc-800
                                 flex items-center text-gray-900 dark:text-gray-100">
                    {userProfile?.full_name || '-'}
                  </div>
                )}
              </div>

              {/* Phone Number */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700
                                 dark:text-gray-300 mb-2">
                  <Phone className="w-4 h-4" />
                  Phone Number
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl
                              bg-gray-100 dark:bg-zinc-800
                              border border-gray-200 dark:border-zinc-700
                              focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                              transition-all outline-none text-base"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="w-full h-12 px-4 rounded-xl
                                 bg-gray-50 dark:bg-zinc-900
                                 border border-gray-200 dark:border-zinc-800
                                 flex items-center text-gray-900 dark:text-gray-100">
                    {userProfile?.phone || '-'}
                  </div>
                )}
              </div>

              {/* Job Title */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700
                                 dark:text-gray-300 mb-2">
                  <Briefcase className="w-4 h-4" />
                  Job Title
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.job_title}
                    onChange={(e) => setFormData({...formData, job_title: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl
                              bg-gray-100 dark:bg-zinc-800
                              border border-gray-200 dark:border-zinc-700
                              focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                              transition-all outline-none text-base"
                    placeholder="Enter your job title"
                  />
                ) : (
                  <div className="w-full h-12 px-4 rounded-xl
                                 bg-gray-50 dark:bg-zinc-900
                                 border border-gray-200 dark:border-zinc-800
                                 flex items-center text-gray-900 dark:text-gray-100">
                    {userProfile?.job_title || '-'}
                  </div>
                )}
              </div>

              {/* Company (Read-only) */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700
                                 dark:text-gray-300 mb-2">
                  <Building2 className="w-4 h-4" />
                  Company
                </label>
                <div className="w-full h-12 px-4 rounded-xl
                               bg-gray-50 dark:bg-zinc-900
                               border border-gray-200 dark:border-zinc-800
                               flex items-center text-gray-500 dark:text-gray-400">
                  {userProfile?.company_name || 'ELORA Solutions'}
                </div>
              </div>
            </div>

            {/* Security Section */}
            <div className="px-8 py-6 border-t border-gray-200/50 dark:border-zinc-800/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Security
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage your password</p>
                </div>
                {!isChangingPassword && (
                  <button
                    onClick={() => setIsChangingPassword(true)}
                    className="h-10 px-4 rounded-full text-gray-600 dark:text-gray-400
                              hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors
                              font-medium text-sm flex items-center gap-2
                              border border-gray-200 dark:border-zinc-700"
                  >
                    <Lock className="w-4 h-4" />
                    Change Password
                  </button>
                )}
              </div>

              {isChangingPassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 p-6 bg-gray-50 dark:bg-zinc-800/50 rounded-xl"
                >
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="w-full h-12 px-4 rounded-xl
                                bg-white dark:bg-zinc-800
                                border border-gray-200 dark:border-zinc-700
                                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                transition-all outline-none text-base"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="w-full h-12 px-4 rounded-xl
                                bg-white dark:bg-zinc-800
                                border border-gray-200 dark:border-zinc-700
                                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20
                                transition-all outline-none text-base"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="flex gap-3 justify-end pt-2">
                    <button
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ newPassword: '', confirmPassword: '' });
                      }}
                      className="h-10 px-4 rounded-full text-gray-600 dark:text-gray-400
                                hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors
                                font-medium text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleChangePassword}
                      disabled={isSaving}
                      className="h-10 px-6 rounded-full bg-emerald-500 text-white
                                font-semibold text-sm hover:bg-emerald-600
                                active:scale-95 transition-all duration-150
                                shadow-lg shadow-emerald-500/30
                                disabled:opacity-50 disabled:cursor-not-allowed
                                flex items-center gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      {isSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
