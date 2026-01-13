import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabaseClient } from '@/api/supabaseClient';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
  Palette,
  Image,
  Mail,
  FileText,
  Globe,
  Save,
  Loader2,
  Upload,
  Eye,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export default function BrandingManagement() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const companyId = userProfile?.company_id;

  const [formData, setFormData] = useState({
    // Basic
    company_name: '',
    app_name: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#7CB342',
    secondary_color: '#9CCC65',

    // Login Page
    login_background_url: '',
    login_background_color: '#f8fafc',
    login_tagline: '',
    login_custom_css: '',
    login_logo_position: 'center',

    // Email
    email_header_html: '',
    email_footer_html: '',
    email_accent_color: '#7CB342',
    email_font_family: 'Arial, sans-serif',
    email_from_name: '',
    email_reply_to: '',

    // Custom Domain
    custom_domain: '',
    custom_domain_verified: false,
    custom_domain_verification_token: '',
    custom_domain_ssl_status: 'pending',

    // PDF
    pdf_logo_url: '',
    pdf_header_html: '',
    pdf_footer_html: '',
    pdf_accent_color: '#7CB342',
    pdf_include_cover_page: true,
    pdf_cover_page_html: '',

    // Support
    support_email: '',
    support_phone: '',
    terms_url: '',
    privacy_url: '',
  });

  // Fetch existing branding
  const { data: branding, isLoading } = useQuery({
    queryKey: ['companyBranding', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_branding')
        .select('*')
        .eq('company_id', companyId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Update form when branding data loads
  useEffect(() => {
    if (branding) {
      setFormData(prev => ({
        ...prev,
        ...branding,
      }));
    }
  }, [branding]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        ...data,
        company_id: companyId,
        client_email_domain: userProfile?.email?.split('@')[1] || 'default',
      };

      if (branding?.id) {
        payload.id = branding.id;
      }

      const response = await supabaseClient.branding.save(payload);
      if (!response?.success) {
        throw new Error(response?.error || 'Failed to save branding');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['companyBranding']);
      toast({ title: 'Branding Saved', description: 'Your branding settings have been updated.' });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Copied to clipboard' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Palette className="w-5 h-5 text-emerald-500" />
            White-Label Branding
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Customize the portal appearance for your brand
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-gray-200/20 dark:border-zinc-800/50 rounded-xl p-1">
          <TabsTrigger value="general" className="rounded-lg">
            <Palette className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="login" className="rounded-lg">
            <Image className="w-4 h-4 mr-2" />
            Login Page
          </TabsTrigger>
          <TabsTrigger value="email" className="rounded-lg">
            <Mail className="w-4 h-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger value="pdf" className="rounded-lg">
            <FileText className="w-4 h-4 mr-2" />
            PDF Reports
          </TabsTrigger>
          <TabsTrigger value="domain" className="rounded-lg">
            <Globe className="w-4 h-4 mr-2" />
            Custom Domain
          </TabsTrigger>
        </TabsList>

        {/* General Branding */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>General Branding</CardTitle>
              <CardDescription>Basic brand identity settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Your Company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>App Name</Label>
                  <Input
                    value={formData.app_name}
                    onChange={(e) => setFormData({ ...formData, app_name: e.target.value })}
                    placeholder="Fleet Portal"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                  {formData.logo_url && (
                    <div className="p-4 bg-gray-100 dark:bg-zinc-800 rounded-lg">
                      <img src={formData.logo_url} alt="Logo preview" className="h-12 object-contain" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Favicon URL</Label>
                  <Input
                    value={formData.favicon_url}
                    onChange={(e) => setFormData({ ...formData, favicon_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.primary_color}
                      onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                      placeholder="#7CB342"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.secondary_color}
                      onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                      placeholder="#9CCC65"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Support Email</Label>
                  <Input
                    type="email"
                    value={formData.support_email}
                    onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                    placeholder="support@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Support Phone</Label>
                  <Input
                    value={formData.support_phone}
                    onChange={(e) => setFormData({ ...formData, support_phone: e.target.value })}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Terms of Service URL</Label>
                  <Input
                    value={formData.terms_url}
                    onChange={(e) => setFormData({ ...formData, terms_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Privacy Policy URL</Label>
                  <Input
                    value={formData.privacy_url}
                    onChange={(e) => setFormData({ ...formData, privacy_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login Page */}
        <TabsContent value="login" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Login Page Branding</CardTitle>
              <CardDescription>Customize the login experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Login Tagline</Label>
                <Input
                  value={formData.login_tagline}
                  onChange={(e) => setFormData({ ...formData, login_tagline: e.target.value })}
                  placeholder="Fleet Compliance Portal"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Background Image URL</Label>
                  <Input
                    value={formData.login_background_url}
                    onChange={(e) => setFormData({ ...formData, login_background_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Background Color (fallback)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.login_background_color}
                      onChange={(e) => setFormData({ ...formData, login_background_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.login_background_color}
                      onChange={(e) => setFormData({ ...formData, login_background_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Logo Position</Label>
                <Select
                  value={formData.login_logo_position}
                  onValueChange={(value) => setFormData({ ...formData, login_logo_position: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Custom CSS (Advanced)</Label>
                <Textarea
                  value={formData.login_custom_css}
                  onChange={(e) => setFormData({ ...formData, login_custom_css: e.target.value })}
                  placeholder=".login-form { ... }"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div
                  className="rounded-xl border overflow-hidden h-64 flex items-center justify-center"
                  style={{
                    backgroundColor: formData.login_background_color,
                    backgroundImage: formData.login_background_url ? `url(${formData.login_background_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-xl p-8 shadow-xl max-w-sm w-full mx-4">
                    <div className={`mb-4 text-${formData.login_logo_position}`}>
                      {formData.logo_url ? (
                        <img src={formData.logo_url} alt="Logo" className="h-10 inline-block" />
                      ) : (
                        <div className="h-10 w-32 bg-gray-200 dark:bg-zinc-700 rounded" />
                      )}
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                      {formData.login_tagline || 'Fleet Compliance Portal'}
                    </p>
                    <div className="space-y-3">
                      <div className="h-10 bg-gray-100 dark:bg-zinc-800 rounded" />
                      <div className="h-10 bg-gray-100 dark:bg-zinc-800 rounded" />
                      <div
                        className="h-10 rounded flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: formData.primary_color }}
                      >
                        Sign In
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates */}
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Branding</CardTitle>
              <CardDescription>Customize email appearance and templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    value={formData.email_from_name}
                    onChange={(e) => setFormData({ ...formData, email_from_name: e.target.value })}
                    placeholder="Your Company Fleet"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reply-To Email</Label>
                  <Input
                    type="email"
                    value={formData.email_reply_to}
                    onChange={(e) => setFormData({ ...formData, email_reply_to: e.target.value })}
                    placeholder="noreply@company.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.email_accent_color}
                      onChange={(e) => setFormData({ ...formData, email_accent_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.email_accent_color}
                      onChange={(e) => setFormData({ ...formData, email_accent_color: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={formData.email_font_family}
                    onValueChange={(value) => setFormData({ ...formData, email_font_family: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                      <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                      <SelectItem value="Georgia, serif">Georgia</SelectItem>
                      <SelectItem value="'Trebuchet MS', sans-serif">Trebuchet MS</SelectItem>
                      <SelectItem value="Verdana, sans-serif">Verdana</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Header HTML</Label>
                <Textarea
                  value={formData.email_header_html}
                  onChange={(e) => setFormData({ ...formData, email_header_html: e.target.value })}
                  placeholder='<div style="background: #f0f0f0; padding: 20px; text-align: center;">...'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Email Footer HTML</Label>
                <Textarea
                  value={formData.email_footer_html}
                  onChange={(e) => setFormData({ ...formData, email_footer_html: e.target.value })}
                  placeholder='<div style="padding: 20px; text-align: center; color: #666;">...'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PDF Reports */}
        <TabsContent value="pdf" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>PDF Report Branding</CardTitle>
              <CardDescription>Customize exported PDF reports</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>PDF Logo URL</Label>
                  <Input
                    value={formData.pdf_logo_url}
                    onChange={(e) => setFormData({ ...formData, pdf_logo_url: e.target.value })}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-gray-500">Recommended: High-res PNG with transparent background</p>
                </div>
                <div className="space-y-2">
                  <Label>Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.pdf_accent_color}
                      onChange={(e) => setFormData({ ...formData, pdf_accent_color: e.target.value })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={formData.pdf_accent_color}
                      onChange={(e) => setFormData({ ...formData, pdf_accent_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <div>
                  <Label>Include Cover Page</Label>
                  <p className="text-xs text-gray-500">Add a branded cover page to PDF exports</p>
                </div>
                <Switch
                  checked={formData.pdf_include_cover_page}
                  onCheckedChange={(checked) => setFormData({ ...formData, pdf_include_cover_page: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>PDF Header HTML</Label>
                <Textarea
                  value={formData.pdf_header_html}
                  onChange={(e) => setFormData({ ...formData, pdf_header_html: e.target.value })}
                  placeholder="<div>...</div>"
                  rows={3}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>PDF Footer HTML</Label>
                <Textarea
                  value={formData.pdf_footer_html}
                  onChange={(e) => setFormData({ ...formData, pdf_footer_html: e.target.value })}
                  placeholder="<div>Page {{page}} of {{pages}}</div>"
                  rows={3}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-gray-500">
                  Available variables: {'{{page}}'}, {'{{pages}}'}, {'{{date}}'}, {'{{company_name}}'}
                </p>
              </div>

              {formData.pdf_include_cover_page && (
                <div className="space-y-2">
                  <Label>Cover Page HTML</Label>
                  <Textarea
                    value={formData.pdf_cover_page_html}
                    onChange={(e) => setFormData({ ...formData, pdf_cover_page_html: e.target.value })}
                    placeholder="<div style='text-align: center; padding: 100px;'>..."
                    rows={6}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Domain */}
        <TabsContent value="domain" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Domain (CNAME)</CardTitle>
              <CardDescription>Use your own domain for the portal</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Custom Domain</Label>
                <Input
                  value={formData.custom_domain}
                  onChange={(e) => setFormData({ ...formData, custom_domain: e.target.value })}
                  placeholder="fleet.yourcompany.com"
                />
              </div>

              {formData.custom_domain && (
                <>
                  <div className="p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                    <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">DNS Configuration Required</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mb-4">
                      Add the following DNS records to your domain:
                    </p>

                    <div className="space-y-3">
                      <div className="bg-white dark:bg-zinc-900 p-3 rounded border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500">CNAME Record</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard('portal.elora.com.au')}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <code className="text-sm">
                          {formData.custom_domain} CNAME portal.elora.com.au
                        </code>
                      </div>

                      {formData.custom_domain_verification_token && (
                        <div className="bg-white dark:bg-zinc-900 p-3 rounded border">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-gray-500">TXT Record (Verification)</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(formData.custom_domain_verification_token)}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                          <code className="text-sm">
                            _elora-verify.{formData.custom_domain} TXT {formData.custom_domain_verification_token}
                          </code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {formData.custom_domain_verified ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Pending Verification
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">SSL:</span>
                      {formData.custom_domain_ssl_status === 'active' ? (
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      ) : formData.custom_domain_ssl_status === 'failed' ? (
                        <Badge variant="destructive">Failed</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>

                    <Button variant="outline" size="sm">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Verify DNS
                    </Button>
                  </div>
                </>
              )}

              <div className="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
                <h4 className="font-medium mb-2">How Custom Domains Work</h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>1. Enter your desired subdomain above</li>
                  <li>2. Add the CNAME record to your DNS provider</li>
                  <li>3. Add the TXT verification record</li>
                  <li>4. Click "Verify DNS" to confirm configuration</li>
                  <li>5. SSL certificate will be provisioned automatically</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
