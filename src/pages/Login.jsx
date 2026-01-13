import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Truck, Mail, Lock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Default branding
const DEFAULT_BRANDING = {
  company_name: 'Fleet Compliance Portal',
  logo_url: null,
  primary_color: '#7CB342',
  secondary_color: '#9CCC65',
  login_background_url: null,
  login_background_color: '#0f172a',
  login_tagline: 'Sign in to access your dashboard',
  login_logo_position: 'center',
};

export default function Login() {
  const navigate = useNavigate();
  const { login, resetPassword } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [error, setError] = useState('');

  // Get branding based on custom domain or default
  const { data: branding = DEFAULT_BRANDING } = useQuery({
    queryKey: ['loginBranding'],
    queryFn: async () => {
      try {
        // Check if we're on a custom domain
        const hostname = window.location.hostname;

        // Try to get branding by custom domain first
        if (hostname !== 'localhost' && !hostname.includes('vercel') && !hostname.includes('elora')) {
          const response = await supabaseClient.branding.getByCustomDomain(hostname);
          if (response?.data && response.data.source !== 'default') {
            return { ...DEFAULT_BRANDING, ...response.data };
          }
        }

        // Return default branding
        return DEFAULT_BRANDING;
      } catch (err) {
        console.warn('Failed to fetch branding:', err);
        return DEFAULT_BRANDING;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate('/');
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await resetPassword(email);

      if (result.success) {
        toast({
          title: "Password Reset Email Sent",
          description: "Check your email for a link to reset your password.",
        });
        setShowForgotPassword(false);
      } else {
        setError(result.error || 'Failed to send reset email');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate logo alignment class
  const logoAlignment = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
  }[branding.login_logo_position] || 'justify-center';

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        backgroundColor: branding.login_background_color,
        backgroundImage: branding.login_background_url
          ? `url(${branding.login_background_url})`
          : 'linear-gradient(to bottom right, #0f172a, #1e293b, #0f172a)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Background Pattern (only if no custom background image) */}
      {!branding.login_background_url && (
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
      )}

      {/* Custom CSS injection */}
      {branding.login_custom_css && (
        <style dangerouslySetInnerHTML={{ __html: branding.login_custom_css }} />
      )}

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 login-card">
        <CardHeader className="space-y-1 pb-6">
          <div className={`flex ${logoAlignment} mb-4`}>
            {branding.logo_url ? (
              <img
                src={branding.logo_url}
                alt={branding.company_name}
                className="h-12 object-contain"
              />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  background: `linear-gradient(to bottom right, ${branding.primary_color}, ${branding.secondary_color})`,
                }}
              >
                <Truck className="w-8 h-8 text-white" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-center text-slate-800">
            {branding.company_name || branding.app_name || 'Fleet Compliance Portal'}
          </CardTitle>
          <CardDescription className="text-center text-slate-600">
            {showForgotPassword
              ? 'Enter your email to receive a password reset link'
              : branding.login_tagline || 'Sign in to access your dashboard'
            }
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {showForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                style={{ backgroundColor: branding.primary_color }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setShowForgotPassword(false)}
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4 login-form">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={setRememberMe}
                  />
                  <Label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  className="text-sm font-medium hover:opacity-80"
                  style={{ color: branding.primary_color }}
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                style={{ backgroundColor: branding.primary_color }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-xs text-slate-500">
              {branding.support_email ? (
                <>Need help? Contact <a href={`mailto:${branding.support_email}`} className="underline">{branding.support_email}</a></>
              ) : (
                'Powered by ELORA Solutions'
              )}
            </p>
            {(branding.terms_url || branding.privacy_url) && (
              <div className="flex justify-center gap-4 mt-2">
                {branding.terms_url && (
                  <a href={branding.terms_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:underline">
                    Terms
                  </a>
                )}
                {branding.privacy_url && (
                  <a href={branding.privacy_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:underline">
                    Privacy
                  </a>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
