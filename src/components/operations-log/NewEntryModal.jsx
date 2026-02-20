import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, X, CloudUpload, ChevronsUpDown, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { MultiSelection } from '@/components/ui/multi-selection';
import { useCreateOperationsLogEntry, useAddOperationsLogAttachment } from '@/query/mutations';
import { customersOptions, sitesOptions, vehiclesOptions } from '@/query/options';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

const ASSIGNEES = [
  'Bruce Cunningham',
  'Greg Hutchings',
  'Peter Moore',
  'Shaun Sayer',
  'Nigel Beckham',
  'Jonny Harper',
  'Blair McDonough',
];

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function SearchableSelect({
  value,
  onValueChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  emptyText = 'No results.',
  className,
}) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)),
    [options, value]
  );
  const displayLabel = selected ? selected.label : placeholder;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popper-anchor-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search…" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function NewEntryModal({
  open,
  onOpenChange,
  customers: customersProp = [],
  sites: _sitesProp,
  categories = [],
  products = [],
  effectiveCompanyId,
  onSuccess,
}) {
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [customerRef, setCustomerRef] = useState('');
  const [siteRef, setSiteRef] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState('');
  const [productId, setProductId] = useState('');
  const [productQuantity, setProductQuantity] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [vehicleIds, setVehicleIds] = useState([]);
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const { data: customersFromQuery = [] } = useQuery({
    ...customersOptions(effectiveCompanyId),
    enabled: open && !!effectiveCompanyId,
  });
  const customers = (customersFromQuery?.length ? customersFromQuery : customersProp) ?? [];

  // Resolve company_id from selected customer when super_admin (effectiveCompanyId is 'all') so sites/vehicles APIs return tenant-scoped data (same as compliance page)
  const { data: companyForCustomer } = useQuery({
    queryKey: ['companyForEloraCustomer', customerRef],
    queryFn: async () => {
      if (!customerRef) return null;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', customerRef)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: open && !!customerRef && (effectiveCompanyId === 'all' || !effectiveCompanyId),
  });

  const companyForQueries = effectiveCompanyId && effectiveCompanyId !== 'all'
    ? effectiveCompanyId
    : (customerRef ? companyForCustomer : null);

  const { data: sitesForCustomerRaw = [] } = useQuery({
    ...sitesOptions(companyForQueries ?? effectiveCompanyId, { customerId: customerRef || undefined }),
    enabled: open && !!(companyForQueries ?? effectiveCompanyId) && !!customerRef,
  });

  const { data: vehiclesRaw = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: customerRef || undefined,
      siteId: siteRef || undefined,
    }),
    enabled: open && !!(companyForQueries ?? effectiveCompanyId) && !!customerRef,
  });

  const vehicleOptions = useMemo(() => {
    let list = vehiclesRaw || [];
    if (siteRef && list.length > 0) {
      list = list.filter(
        (v) =>
          String(v.siteId ?? v.siteRef ?? v.site_id ?? '') === String(siteRef)
      );
    }
    return list
      .map((v) => ({
        value: String(v.vehicleRef ?? v.ref ?? v.id ?? ''),
        label: v.vehicleName ?? v.name ?? v.vehicleRef ?? v.ref ?? '—',
      }))
      .filter((o) => o.value);
  }, [vehiclesRaw, siteRef]);

  const customerOptions = useMemo(
    () =>
      (customers || []).map((c) => ({
        value: String(c.id ?? c.ref ?? ''),
        label: c.name ?? String(c.id ?? c.ref ?? ''),
      })),
    [customers]
  );

  const siteOptions = useMemo(() => {
    const list = sitesForCustomerRaw || [];
    const forCustomer = !customerRef
      ? []
      : list.filter(
          (s) =>
            String(s.customer_ref ?? '') === String(customerRef) ||
            String(s.id ?? s.ref ?? '') === String(customerRef)
        );
    return forCustomer.map((s) => ({
      value: String(s.id ?? s.ref ?? ''),
      label: s.name ?? s.siteName ?? String(s.id ?? s.ref ?? ''),
    }));
  }, [sitesForCustomerRaw, customerRef]);

  const productOptions = useMemo(
    () =>
      (products || []).map((p) => ({
        value: String(p.id),
        label: `${p.name ?? ''}${p.price_cents != null ? ` — $${(p.price_cents / 100).toFixed(2)}` : ''}`,
      })),
    [products]
  );

  useEffect(() => {
    if (open && customers.length === 1 && !customerRef) {
      const c = customers[0];
      setCustomerRef(String(c?.id ?? c?.ref ?? ''));
    }
  }, [open, customers, customerRef]);

  const createMutation = useCreateOperationsLogEntry();
  const addAttachmentMutation = useAddOperationsLogAttachment();

  const reset = () => {
    setTitle('');
    setBrief('');
    setCustomerRef('');
    setSiteRef('');
    setCategoryId('');
    setPriority('');
    setProductId('');
    setProductQuantity('');
    setAssignedTo('');
    setDueDate('');
    setVehicleIds([]);
    setDescription('');
    setFiles([]);
  };

  const handleClose = (openState) => {
    if (!openState) {
      reset();
      onOpenChange(false);
    }
  };

  const onCustomerChange = (v) => {
    setCustomerRef(v);
    setSiteRef('');
    setVehicleIds([]);
  };

  const onSiteChange = (v) => {
    setSiteRef(v);
    setVehicleIds([]);
  };

  const processFiles = (fileList) => {
    const chosen = Array.from(fileList ?? []);
    const valid = chosen.filter((f) => {
      if (f.size > MAX_FILE_SIZE) return false;
      if (!ALLOWED_MIME.includes(f.type)) return false;
      return true;
    });
    setFiles((prev) => [...prev, ...valid]);
  };

  const handleFileChange = (e) => {
    processFiles(e.target.files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer?.files);
  };

  const removeFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!title.trim() || !siteRef || !categoryId || !priority || !description.trim()) return;
    if (customers.length > 1 && !customerRef) return;

    const payload = {
      customer_ref: customerRef || (customers[0]?.id ?? ''),
      site_ref: siteRef,
      title: title.trim(),
      brief: brief.trim() || null,
      description: description.trim(),
      category_id: categoryId,
      priority: priority.toLowerCase(),
      product_id: productId || null,
      product_quantity: productQuantity ? parseInt(productQuantity, 10) : null,
      assigned_to: assignedTo || null,
      due_date: dueDate || null,
    };

    try {
      const entry = await createMutation.mutateAsync({
        companyId: effectiveCompanyId,
        payload,
        vehicleIds,
      });

      for (const file of files) {
        const path = `${effectiveCompanyId}/${entry.id}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('operations-log')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (!uploadError) {
          await addAttachmentMutation.mutateAsync({
            entryId: entry.id,
            storagePath: path,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          });
        }
      }

      onSuccess?.();
      handleClose(false);
    } catch (err) {
      console.error(err);
    }
  };

  const isSubmitting = createMutation.isPending;
  const requiresCustomer = customers.length > 1;
  const canSubmit =
    title.trim() &&
    siteRef &&
    categoryId &&
    priority &&
    description.trim() &&
    (!requiresCustomer || customerRef);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-2xl max-h-[90vh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader className="px-0 sm:px-0">
          <DialogTitle className="text-lg sm:text-xl pr-8">New Operations Log Entry</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:py-4 min-w-0">
          <div className="grid gap-2 min-w-0">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue or activity"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{customers.length > 1 ? 'Customer *' : 'Customer'}</Label>
              <SearchableSelect
                value={customerRef}
                onValueChange={onCustomerChange}
                options={customerOptions}
                placeholder="All Customers"
                emptyText="No customers found."
              />
            </div>
            <div className="grid gap-2">
              <Label>Site *</Label>
              <SearchableSelect
                value={siteRef}
                onValueChange={onSiteChange}
                options={siteOptions}
                placeholder="Select site…"
                disabled={!customerRef}
                emptyText="No sites for this customer."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2 min-w-0">
              <Label>Category *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category…">
                    {categoryId ? categories.find((c) => c.id === categoryId)?.name : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent modal={false}>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority *</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority…">
                    {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent modal={false}>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Product</Label>
            <SearchableSelect
              value={productId}
              onValueChange={setProductId}
              options={productOptions}
              placeholder={productOptions.length ? 'Select product (optional)…' : 'No products — add in Admin → Products'}
              emptyText={productOptions.length ? 'No match.' : 'Add products in Admin → Products.'}
            />
            {productId && (
              <div className="grid gap-2 max-w-[120px]">
                <Label htmlFor="product-qty">Quantity</Label>
                <Input
                  id="product-qty"
                  type="number"
                  min={1}
                  placeholder="1"
                  value={productQuantity}
                  onChange={(e) => setProductQuantity(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2 min-w-0">
              <Label>Assign To</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member…">
                    {assignedTo || null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent modal={false}>
                  {ASSIGNEES.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !dueDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(new Date(dueDate), 'dd/MM/yyyy') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate) : undefined}
                    onSelect={(d) => setDueDate(d ? format(d, 'yyyy-MM-dd') : '')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Link to Vehicles</Label>
            <MultiSelection
              value={vehicleIds}
              options={vehicleOptions}
              onValueSelected={setVehicleIds}
              isLoading={vehiclesLoading}
            />
            {!siteRef && (
              <p className="text-xs text-muted-foreground">Select a customer and site to choose vehicles.</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Description *</Label>
            <Textarea
              placeholder="Detailed description of the issue, observation, or work completed."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-y"
            />
          </div>

          <div className="grid gap-2">
            <Label>Photos / Attachments</Label>
            <div
              role="button"
              tabIndex={0}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('ops-log-files')?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 cursor-pointer',
                'text-muted-foreground hover:bg-muted/50 transition-colors',
                isDragging && 'border-primary bg-primary/5'
              )}
            >
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                multiple
                className="hidden"
                id="ops-log-files"
                onChange={handleFileChange}
              />
              <div className="flex flex-col items-center gap-2 pointer-events-none">
                <CloudUpload className="size-8" />
                <span className="text-sm">Click to upload or drag and drop</span>
                <span className="text-xs">PNG, JPG, PDF up to 10MB each</span>
              </div>
              {files.length > 0 && (
                <ul className="mt-2 w-full space-y-1 text-sm pointer-events-auto" onClick={(e) => e.stopPropagation()}>
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="truncate">{f.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                      >
                        <X className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={isSubmitting} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} className="w-full sm:w-auto">
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            Create Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
