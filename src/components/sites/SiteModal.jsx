import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, ImageIcon } from 'lucide-react';
import { toast } from "@/lib/toast";
import { useSaveSiteOverride } from '@/query/mutations/siteOverrides';
import { uploadSiteLogo, removeSiteLogoFromStorage } from '@/lib/siteLogoUpload';

export default function SiteModal({ open, onClose, site, customers = [], onSuccess }) {
  const saveMutation = useSaveSiteOverride();
  const [formData, setFormData] = useState({
    name: '',
    customer_ref: '',
    customer_name: '',
    street_address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Australia',
    contact_person: '',
    contact_phone: '',
    contact_email: '',
    is_active: true,
    notes: '',
    logo_url: '',
  });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useEffect(() => {
    if (open && site) {
      setFormData({
        name: site.name || '',
        customer_ref: site.customer_ref || '',
        customer_name: site.customer_name || '',
        street_address: site.street_address ?? site.address ?? '',
        city: site.city || '',
        state: site.state || '',
        postal_code: site.postal_code ?? site.postcode ?? '',
        country: site.country || 'Australia',
        contact_person: site.contact_person ?? site.contact_name ?? '',
        contact_phone: site.contact_phone ?? '',
        contact_email: site.contact_email ?? site.contact_email ?? '',
        is_active: site.is_active !== false && site.status !== 'inactive',
        notes: site.notes || '',
        logo_url: site.logo_url || '',
      });
    }
  }, [site, open]);

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_ref: customerId || '',
      customer_name: customer?.name || ''
    });
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !site?.id) return;
    setIsUploadingLogo(true);
    try {
      const url = await uploadSiteLogo(file, site.id);
      setFormData({ ...formData, logo_url: url });
      toast.success('Logo uploaded', { description: 'Image saved. Click Update Site to apply.' });
    } catch (err) {
      toast.error(err.message || 'Upload failed', { description: 'Error' });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!site?.id) return;

    const prevLogo = site.logo_url;
    const newLogo = formData.logo_url;
    if (prevLogo && prevLogo !== newLogo) {
      try {
        await removeSiteLogoFromStorage(prevLogo);
      } catch (_) {}
    }

    saveMutation.mutate(
      {
        site_ref: site.id,
        customer_ref: formData.customer_ref || null,
        customer_name: formData.customer_name || null,
        name: formData.name || null,
        street_address: formData.street_address || null,
        city: formData.city || null,
        state: formData.state || null,
        postal_code: formData.postal_code || null,
        country: formData.country || 'Australia',
        contact_person: formData.contact_person || null,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        logo_url: formData.logo_url || null,
        is_active: formData.is_active,
        notes: formData.notes || null,
      },
      {
        onSuccess: () => {
          toast.success('Site updated', { description: 'Changes saved.' });
          onSuccess?.();
          onClose();
        },
        onError: (err) => {
          toast.error(err?.message || 'Failed to save site.', { description: 'Error' });
        },
      }
    );
  };

  const loading = saveMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Site</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Site Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Downtown Wash Station"
              />
            </div>

            <div className="col-span-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                {formData.logo_url ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={formData.logo_url}
                      alt="Site logo"
                      className="h-16 w-16 object-contain rounded-lg border border-border bg-muted"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingLogo}
                        onClick={() => document.getElementById('site-logo-upload').click()}
                        className="gap-2"
                      >
                        {isUploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isUploadingLogo ? 'Uploading…' : 'Replace'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setFormData({ ...formData, logo_url: '' })}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors">
                    <input
                      id="site-logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={isUploadingLogo || !site?.id}
                    />
                    {isUploadingLogo ? (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground mt-1">Upload</span>
                  </label>
                )}
              </div>
            </div>

            <div className="col-span-2">
              <Label>Customer</Label>
              <Select value={formData.customer_ref || 'none'} onValueChange={(v) => handleCustomerChange(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Customer</SelectItem>
                  {(customers || []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Street address</Label>
              <Input
                value={formData.street_address}
                onChange={(e) => setFormData({ ...formData, street_address: e.target.value })}
                placeholder="Street address"
              />
            </div>

            <div>
              <Label>City</Label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="City"
              />
            </div>

            <div>
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State"
              />
            </div>

            <div>
              <Label>Postal code</Label>
              <Input
                value={formData.postal_code}
                onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                placeholder="Postal code"
              />
            </div>

            <div>
              <Label>Country</Label>
              <Input
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="Australia"
              />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-foreground mb-3">Contact Information</h3>
            </div>

            <div>
              <Label>Contact person</Label>
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="Contact person"
              />
            </div>

            <div>
              <Label>Phone number</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div className="col-span-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="col-span-2">
              <Label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                Active
              </Label>
            </div>

            <div className="col-span-2">
              <Label>Additional information</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about this site..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Site
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
