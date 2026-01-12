import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseClient } from "@/api/supabaseClient";
import { Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

export default function SiteModal({ open, onClose, site, customers, onSuccess }) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    customer_id: '',
    customer_name: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'Australia',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    status: 'active',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (site) {
        setFormData({
          name: site.name || '',
          customer_id: site.customer_id || '',
          customer_name: site.customer_name || '',
          address: site.address || '',
          city: site.city || '',
          state: site.state || '',
          postal_code: site.postal_code || '',
          country: site.country || 'Australia',
          contact_name: site.contact_name || '',
          contact_email: site.contact_email || '',
          contact_phone: site.contact_phone || '',
          status: site.status || 'active',
          notes: site.notes || ''
        });
      } else {
        setFormData({
          name: '',
          customer_id: '',
          customer_name: '',
          address: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'Australia',
          contact_name: '',
          contact_email: '',
          contact_phone: '',
          status: 'active',
          notes: ''
        });
      }
    }
  }, [site, open]);

  const handleCustomerChange = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    setFormData({
      ...formData,
      customer_id: customerId,
      customer_name: customer?.name || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (site) {
        await supabaseClient.tables.sites
          .update(formData)
          .eq('id', site.id);
      } else {
        await supabaseClient.tables.sites
          .insert([formData]);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving site:', error);
      toast({
        title: "Error",
        description: "Failed to save site. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{site ? 'Edit Site' : 'Add New Site'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Site Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Downtown Wash Station"
                required
              />
            </div>

            <div className="col-span-2">
              <Label>Customer</Label>
              <Select value={formData.customer_id} onValueChange={handleCustomerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>No Customer</SelectItem>
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
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
              <Label>State/Province</Label>
              <Input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                placeholder="State"
              />
            </div>

            <div>
              <Label>Postal Code</Label>
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
                placeholder="Country"
              />
            </div>

            <div className="col-span-2 border-t pt-4 mt-2">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Contact Information</h3>
            </div>

            <div>
              <Label>Contact Name</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Contact person"
              />
            </div>

            <div>
              <Label>Contact Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div className="col-span-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Notes</Label>
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
            <Button type="submit" disabled={loading} className="bg-[#7CB342] hover:bg-[#689F38]">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {site ? 'Update Site' : 'Create Site'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}