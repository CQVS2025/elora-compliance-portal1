import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import { Truck } from 'lucide-react';
import { toast } from '@/lib/toast';
import { getUserFriendlyError } from '@/utils/errorMessages';
import { LoginForm } from '@/components/login-form';

const DEFAULT_BRANDING = {
  company_name: 'Fleet Compliance Portal',
  logo_url: null,
  primary_color: '#3b82f6',
  secondary_color: '#60a5fa',
  login_background_url: null,
  login_background_color: 'hsl(var(--muted))',
  login_tagline: 'Sign in to access your dashboard',
  login_logo_position: 'center',
};

export default function LoginShadcn() {
  const navigate = useNavigate();
  const { login, resetPassword, authError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  // const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [error, setError] = useState('');

  const { data: branding = DEFAULT_BRANDING } = useQuery({
    queryKey: ['loginBranding'],
    queryFn: async () => {
      try {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && !hostname.includes('vercel') && !hostname.includes('elora')) {
          const response = await supabaseClient.branding.getByCustomDomain(hostname);
          if (response?.data && response.data.source !== 'default') {
            return { ...DEFAULT_BRANDING, ...response.data };
          }
        }
        return DEFAULT_BRANDING;
      } catch (err) {
        console.warn('Failed to fetch branding:', err);
        return DEFAULT_BRANDING;
      }
    },
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('elora_login_rejection');
      if (!raw) return;
      sessionStorage.removeItem('elora_login_rejection');
      const { type, message } = JSON.parse(raw);
      // Set inline error by type so company vs account deactivation are clear
      if (type === 'company_deactivated') {
        setError('Your company has been deactivated. Please contact your administrator.');
      } else if (type === 'account_deactivated') {
        setError('Your account has been deactivated. Please contact your administrator to reactivate it.');
      } else {
        setError(getUserFriendlyError(message));
      }
      if (type === 'user_unassigned') {
        toast.error('You are not assigned to any company. Please contact your administrator.', { description: 'Not Assigned to a Company' });
      } else if (type === 'account_deactivated') {
        toast.error('Your account has been deactivated. Please contact your administrator.', { description: 'Account Deactivated' });
      } else if (type === 'company_deactivated') {
        toast.error('Your company has been deactivated. Please contact your administrator.', { description: 'Company Deactivated' });
      }
    } catch (_) {}
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        toast.success('Welcome back!', { description: 'Logging you in...' });
        navigate('/');
      } else {
        const errorMessage = result.error || authError?.message || 'Invalid email or password';
        // Set inline error by auth type so company vs account deactivation are clear
        if (authError?.type === 'company_deactivated') {
          setError('Your company has been deactivated. Please contact your administrator.');
        } else if (authError?.type === 'account_deactivated') {
          setError('Your account has been deactivated. Please contact your administrator to reactivate it.');
        } else {
          setError(getUserFriendlyError(errorMessage));
        }
        if (authError?.type === 'company_deactivated' || (errorMessage && errorMessage.toLowerCase().includes('company') && errorMessage.toLowerCase().includes('deactivated'))) {
          toast.error('Your company has been deactivated. Please contact your administrator.', { description: 'Company Deactivated' });
        } else if (errorMessage.toLowerCase().includes('deactivated') || authError?.type === 'account_deactivated') {
          toast.error('Your account has been deactivated. Please contact your administrator.', { description: 'Account Deactivated' });
        }
        if (errorMessage.toLowerCase().includes('not assigned') || errorMessage.toLowerCase().includes('unassigned') || authError?.type === 'user_unassigned') {
          toast.error('You are not assigned to any company. Please contact your administrator.', { description: 'Not Assigned to a Company' });
        }
      }
    } catch (err) {
      setError(getUserFriendlyError(err, 'logging in'));
    } finally {
      setIsLoading(false);
    }
  };

  // Forgot password - commented out for now
  // const handleForgotPassword = async (e) => {
  //   e.preventDefault();
  //   if (!email) {
  //     setError('Please enter your email address first.');
  //     return;
  //   }
  //   setIsLoading(true);
  //   setError('');
  //   try {
  //     const result = await resetPassword(email);
  //     if (result.success) {
  //       toast({
  //         title: 'Email Sent',
  //         description: 'Check your inbox for password reset instructions.',
  //       });
  //       setShowForgotPassword(false);
  //     } else {
  //       setError(getUserFriendlyError(result.error || 'Failed to send reset email'));
  //     }
  //   } catch (err) {
  //     setError(getUserFriendlyError(err, 'sending reset email'));
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  const logoAlignment = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[branding.login_logo_position] || 'justify-center';

  return (
    <div className="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a
          href="/"
          className="flex items-center gap-2 self-center font-medium text-foreground no-underline hover:opacity-90"
          aria-label={branding.company_name}
        >
          <div
            className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-lg"
            style={branding.logo_url ? undefined : { background: `linear-gradient(to bottom right, ${branding.primary_color}, ${branding.secondary_color})` }}
          >
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="" className="size-6 object-contain" />
            ) : (
              <Truck className="size-5" />
            )}
          </div>
          <span>{branding.company_name || DEFAULT_BRANDING.company_name}</span>
        </a>
        <LoginForm
          companyName={branding.company_name}
          loginTagline={branding.login_tagline}
          primaryColor={branding.primary_color}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          rememberMe={false}
          setRememberMe={() => {}}
          showForgotPassword={false}
          setShowForgotPassword={() => {}}
          error={error}
          isLoading={isLoading}
          onSubmitLogin={handleLogin}
          onSubmitForgotPassword={(e) => e.preventDefault()}
          supportEmail={branding.support_email}
          termsUrl={branding.terms_url}
          privacyUrl={branding.privacy_url}
        />
      </div>
    </div>
  );
}
