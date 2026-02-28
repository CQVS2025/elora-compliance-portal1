import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  MapPin,
  Calendar,
  Image as ImageIcon,
  Building2,
  Car,
  FileText,
  Loader2,
  ArrowLeft,
  Pencil,
  CloudUpload,
  X,
  Trash2,
} from 'lucide-react';
import { toastError, toastSuccess } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  customersOptions,
  sitesOptions,
  vehiclesOptions,
  operationsLogEntryOptions,
  operationsLogCategoriesOptions,
  productsOptions,
} from '@/query/options';
import { useUpdateOperationsLogStatus, useUpdateOperationsLogEntry, useAddOperationsLogAttachment, useDeleteOperationsLogAttachment, useDeleteOperationsLogEntry } from '@/query/mutations';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
];

const PRIORITY_COLORS = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

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

function getInitials(name) {
  if (!name) return '?';
  return name.split(/\s+/).map((s) => s[0]).join('').toUpperCase().slice(0, 2);
}

function isImageMime(mime) {
  return mime && /^image\//.test(mime);
}

export default function OperationsLogEntryPage() {
  const { id: entryId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const permissions = usePermissions();
  const effectiveCompanyId = userProfile?.company_id ?? (permissions.isSuperAdmin ? 'all' : null);

  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNewFiles, setEditNewFiles] = useState([]);
  const [editDragOver, setEditDragOver] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState(null);
  const [deleteEntryConfirmOpen, setDeleteEntryConfirmOpen] = useState(false);

  const { data: entry, isLoading } = useQuery({
    ...operationsLogEntryOptions(effectiveCompanyId, entryId),
    enabled: !!entryId,
  });

  const { data: companyForCustomer, isLoading: isCompanyLoading } = useQuery({
    queryKey: ['companyForEloraCustomer', entry?.customer_ref],
    queryFn: async () => {
      if (!entry?.customer_ref) return null;
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('elora_customer_ref', entry.customer_ref)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!entry?.customer_ref && (effectiveCompanyId === 'all' || !effectiveCompanyId),
  });

  const companyForQueries =
    effectiveCompanyId && effectiveCompanyId !== 'all'
      ? effectiveCompanyId
      : entry?.customer_ref
        ? companyForCustomer
        : effectiveCompanyId;

  const { data: customers = [], isLoading: isCustomersLoading } = useQuery({
    ...customersOptions(effectiveCompanyId),
    enabled: !!effectiveCompanyId,
  });

  const { data: sitesRaw = [], isLoading: isSitesLoading } = useQuery({
    ...sitesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: entry?.customer_ref || undefined,
    }),
    enabled: !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref,
  });

  const { data: vehiclesRaw = [], isLoading: isVehiclesLoading } = useQuery({
    ...vehiclesOptions(companyForQueries ?? effectiveCompanyId, {
      customerId: entry?.customer_ref || undefined,
      siteId: entry?.site_ref || undefined,
    }),
    enabled: !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref,
  });

  const needsCompany = !!entry?.customer_ref && (effectiveCompanyId === 'all' || !effectiveCompanyId);
  const needsCustomers = !!effectiveCompanyId && !!entry?.customer_ref;
  const needsSites = !!(companyForQueries ?? effectiveCompanyId) && !!entry?.customer_ref;
  const needsVehicles = needsSites && !!entry?.operations_log_vehicle_links?.length;

  const isResolvingNames =
    (needsCompany && isCompanyLoading) ||
    (needsCustomers && isCustomersLoading) ||
    (needsSites && isSitesLoading) ||
    (needsVehicles && isVehiclesLoading);

  const showLoader = isLoading || isResolvingNames;

  const customerName = useMemo(() => {
    if (!entry?.customer_ref) return null;
    const c = (customers || []).find((x) => String(x.id ?? x.ref ?? '') === String(entry.customer_ref));
    return c?.name ?? entry.customer_ref;
  }, [customers, entry?.customer_ref]);

  const siteName = useMemo(() => {
    if (!entry?.site_ref) return null;
    const s = (sitesRaw || []).find((x) => String(x.id ?? x.ref ?? '') === String(entry.site_ref));
    return s?.name ?? s?.siteName ?? entry.site_ref;
  }, [sitesRaw, entry?.site_ref]);

  const vehicleIdToName = useMemo(() => {
    const map = {};
    (vehiclesRaw || []).forEach((v) => {
      const id = String(v.vehicleRef ?? v.ref ?? v.id ?? '');
      if (id) map[id] = v.vehicleName ?? v.name ?? v.vehicleRef ?? v.ref ?? id;
    });
    return map;
  }, [vehiclesRaw]);

  const updateStatus = useUpdateOperationsLogStatus();
  const updateEntry = useUpdateOperationsLogEntry();
  const addAttachmentMutation = useAddOperationsLogAttachment();
  const deleteAttachmentMutation = useDeleteOperationsLogAttachment();
  const deleteEntryMutation = useDeleteOperationsLogEntry();

  const handleStatusChange = (newStatus) => {
    if (!entryId || newStatus === entry?.status) return;
    updateStatus.mutate(
      { entryId, status: newStatus },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
          toastSuccess('update', 'status');
        },
        onError: (err) => toastError(err, 'updating status'),
      }
    );
  };

  const getSignedUrl = async (path) => {
    const { data } = await supabase.storage.from('operations-log').createSignedUrl(path, 3600);
    return data?.signedUrl;
  };

  const goToAttachment = (path) => {
    navigate(`/operations-log/entry/${entryId}/attachment?path=${encodeURIComponent(path)}`);
  };

  const canEdit = permissions.canEditOperationsLog;

  const startEdit = () => {
    if (!entry) return;
    setEditTitle(entry.title ?? '');
    setEditCategoryId(entry.category_id ?? '');
    setEditPriority(entry.priority ?? '');
    setEditAssignedTo(entry.assigned_to ?? '');
    setEditDueDate(entry.due_date ?? '');
    setEditDescription(entry.description ?? '');
    setEditNewFiles([]);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditNewFiles([]);
    setEditMode(false);
  };

  const companyIdForStorage = effectiveCompanyId && effectiveCompanyId !== 'all'
    ? effectiveCompanyId
    : (entry?.company_id ?? effectiveCompanyId);

  const processEditNewFiles = (fileList) => {
    const chosen = Array.from(fileList ?? []);
    const valid = chosen.filter((f) => {
      if (f.size > MAX_FILE_SIZE) return false;
      if (!ALLOWED_MIME.includes(f.type)) return false;
      return true;
    });
    setEditNewFiles((prev) => [...prev, ...valid]);
  };

  const removeEditNewFile = (index) => setEditNewFiles((prev) => prev.filter((_, i) => i !== index));

  const handleDeleteAttachment = (attachmentId) => {
    if (!attachmentId) return;
    setDeletingAttachmentId(attachmentId);
    deleteAttachmentMutation.mutate(
      { attachmentId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
          toastSuccess('Attachment removed.');
        },
        onError: (err) => toastError(err, 'removing attachment'),
        onSettled: () => setDeletingAttachmentId(null),
      }
    );
  };

  const saveEdit = async () => {
    if (!entryId || !entry) return;
    setIsSavingEdit(true);
    try {
      await updateEntry.mutateAsync({
        entryId,
        payload: {
          title: editTitle.trim(),
          category_id: editCategoryId || null,
          priority: editPriority,
          assigned_to: editAssignedTo || null,
          due_date: editDueDate || null,
          description: editDescription.trim() || null,
        },
      });
      const cid = companyIdForStorage || entry.company_id;
      for (const file of editNewFiles) {
        const path = `${cid}/${entryId}/${crypto.randomUUID()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('operations-log')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (!uploadError) {
          await addAttachmentMutation.mutateAsync({
            entryId,
            storagePath: path,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['tenant'], exact: false });
      toastSuccess('update', 'entry');
      setEditNewFiles([]);
      setEditMode(false);
    } catch (err) {
      toastError(err, 'updating entry');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const { data: categories = [] } = useQuery(operationsLogCategoriesOptions());
  const { data: products = [] } = useQuery(productsOptions());

  if (!entryId) {
    navigate('/operations-log', { replace: true });
    return null;
  }

  return (
    <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-2 mb-4 sm:mb-6 shrink-0">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/operations-log">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Operations Log</span>
      </div>

      {showLoader ? (
        <Card className="flex-1 min-h-[50vh] flex flex-col">
          <CardContent className="flex flex-1 items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="size-10 animate-spin" aria-hidden />
              <span className="text-sm">{isLoading ? 'Loading entry…' : 'Loading details…'}</span>
            </div>
          </CardContent>
        </Card>
      ) : !entry ? (
        <Card className="flex-1">
          <CardContent className="flex flex-1 items-center justify-center py-16 text-center text-muted-foreground">
            Entry not found.
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 min-w-0 space-y-6 lg:space-y-8">
          <Card>
            <CardHeader className="border-b bg-muted/30 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-xl sm:text-2xl">Entry details</CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  {!editMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap flex items-center gap-1.5">
                        Update status
                        {updateStatus.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                      </span>
                      <Select
                        value={entry.status}
                        onValueChange={handleStatusChange}
                        disabled={updateStatus.isPending}
                      >
                        <SelectTrigger className={cn('w-[140px] sm:w-[160px]', updateStatus.isPending && 'opacity-70')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {canEdit && !editMode && (
                    <Button variant="outline" size="sm" onClick={startEdit}>
                      <Pencil className="size-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  {permissions.isSuperAdmin && !editMode && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeleteEntryConfirmOpen(true)}
                      disabled={deleteEntryMutation.isPending}
                    >
                      {deleteEntryMutation.isPending ? (
                        <Loader2 className="size-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 mr-2" />
                      )}
                      Delete entry
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 lg:space-y-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={entry.status === 'resolved' ? 'default' : 'secondary'} className="font-medium">
                  {STATUS_OPTIONS.find((s) => s.value === entry.status)?.label ?? entry.status}
                </Badge>
                <Badge variant={PRIORITY_COLORS[entry.priority] ?? 'outline'} className="uppercase">
                  {entry.priority}
                </Badge>
                {entry.category?.name && (
                  <Badge variant="outline" className="font-normal">
                    {entry.category.name}
                  </Badge>
                )}
              </div>

              {!editMode ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight">{entry.title}</h2>
                    {entry.brief && <p className="text-sm text-muted-foreground mt-1">{entry.brief}</p>}
                  </div>

                  <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4 min-w-0">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Location & vehicles
                    </h3>
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-muted p-2">
                          <Building2 className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Customer</p>
                          <p className="font-medium truncate">{customerName ?? entry.customer_ref ?? '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-muted p-2">
                          <MapPin className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Site</p>
                          <p className="font-medium truncate">{siteName ?? entry.site_ref ?? '—'}</p>
                        </div>
                      </div>
                    </div>
                    {entry.operations_log_vehicle_links?.length > 0 && (
                      <div className="flex items-start gap-3 pt-1">
                        <div className="rounded-md bg-muted p-2 shrink-0">
                          <Car className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Linked vehicles</p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.operations_log_vehicle_links.map((l) => {
                              const name = vehicleIdToName[l.vehicle_id] ?? l.vehicle_id;
                              return (
                                <Badge key={l.id ?? l.vehicle_id} variant="secondary" className="font-normal">
                                  {name}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {entry.assigned_to && (
                      <div className="flex items-center gap-3 rounded-lg border p-3">
                        <Avatar className="size-9">
                          <AvatarFallback className="text-sm bg-primary/10 text-primary">
                            {getInitials(entry.assigned_to)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">Assigned to</p>
                          <p className="font-medium truncate">{entry.assigned_to}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <Calendar className="size-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="font-medium">
                          {format(new Date(entry.created_at), 'd MMM yyyy')}
                          {entry.due_date && (
                            <span className="text-muted-foreground font-normal ml-1">
                              · Due {format(new Date(entry.due_date), 'd MMM yyyy')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-card p-4 sm:p-5">
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <FileText className="size-4 text-muted-foreground" />
                      Description
                    </h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {entry.description || '—'}
                    </p>
                  </div>

                  {entry.operations_log_attachments?.length > 0 && (
                    <div className="rounded-xl border bg-card p-4 sm:p-5">
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
                        <ImageIcon className="size-4 text-muted-foreground" />
                        Attachments
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {entry.operations_log_attachments.map((att) => {
                          const isImg = isImageMime(att.mime_type);
                          return (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => goToAttachment(att.storage_path)}
                              className={cn(
                                'rounded-xl border overflow-hidden text-left transition-all hover:shadow-md hover:ring-2 hover:ring-primary/20 focus:outline-none focus:ring-2 focus:ring-primary',
                                isImg ? 'aspect-[4/3] w-full' : 'p-4 flex items-center gap-3 min-h-[80px]'
                              )}
                            >
                              {isImg ? (
                                <div className="w-full h-full min-h-[200px]">
                                  <AttachmentThumb path={att.storage_path} getSignedUrl={getSignedUrl} />
                                </div>
                              ) : (
                                <>
                                  <FileText className="size-10 text-muted-foreground shrink-0" />
                                  <div className="min-w-0 flex-1 text-left">
                                    <span className="block truncate text-sm font-medium">{att.file_name}</span>
                                    {att.file_size != null && (
                                      <span className="text-xs text-muted-foreground">{(att.file_size / 1024).toFixed(1)} KB</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {entry.status === 'resolved' && entry.resolved_at && (
                    <p className="text-sm text-muted-foreground">
                      Resolved {format(new Date(entry.resolved_at), 'd MMM yyyy')}
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Brief description of the issue or activity"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Category</Label>
                      <Select value={editCategoryId} onValueChange={setEditCategoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Priority</Label>
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Assigned to</Label>
                      <Select value={editAssignedTo} onValueChange={setEditAssignedTo}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNEES.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Due date</Label>
                      <Input
                        type="date"
                        value={editDueDate || ''}
                        onChange={(e) => setEditDueDate(e.target.value || '')}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Description</Label>
                    <Textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="resize-y"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Attachments</Label>
                    {entry.operations_log_attachments?.length > 0 && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <p className="text-xs text-muted-foreground mb-2">Existing attachments — preview and click X to remove</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {entry.operations_log_attachments.map((att) => {
                            const isDeleting = deletingAttachmentId === att.id;
                            return (
                              <div
                                key={att.id}
                                className={cn(
                                  'rounded-lg border bg-card overflow-hidden flex flex-col relative',
                                  isDeleting && 'opacity-70 pointer-events-none'
                                )}
                              >
                                {isDeleting && (
                                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
                                    <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
                                  </div>
                                )}
                                {isImageMime(att.mime_type) ? (
                                  <div className="w-full aspect-[4/3] min-h-[100px] bg-muted shrink-0 overflow-hidden">
                                    <AttachmentThumb path={att.storage_path} getSignedUrl={getSignedUrl} compact />
                                  </div>
                                ) : (
                                  <div className="w-full aspect-[4/3] min-h-[100px] bg-muted flex items-center justify-center shrink-0">
                                    <FileText className="size-10 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="p-2 flex items-center justify-between gap-2 min-w-0">
                                  <span className="truncate text-xs font-medium" title={att.file_name}>{att.file_name}</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => handleDeleteAttachment(att.id)}
                                    disabled={deleteAttachmentMutation.isPending}
                                  >
                                    <X className="size-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setEditDragOver(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setEditDragOver(false); }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditDragOver(false);
                        processEditNewFiles(e.dataTransfer?.files);
                      }}
                      onClick={() => document.getElementById('edit-ops-log-files')?.click()}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.currentTarget.click(); }}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 cursor-pointer text-muted-foreground hover:bg-muted/50 transition-colors',
                        editDragOver && 'border-primary bg-primary/5'
                      )}
                    >
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf"
                        multiple
                        className="hidden"
                        id="edit-ops-log-files"
                        onChange={(e) => { processEditNewFiles(e.target.files); e.target.value = ''; }}
                      />
                      <CloudUpload className="size-6 mb-1" />
                      <span className="text-xs">Add more images or PDFs (PNG, JPG, PDF up to 10MB each)</span>
                      {editNewFiles.length > 0 && (
                        <ul className="mt-2 w-full space-y-1 text-sm" onClick={(e) => e.stopPropagation()}>
                          {editNewFiles.map((f, i) => (
                            <li key={i} className="flex items-center justify-between gap-2">
                              <span className="truncate">{f.name}</span>
                              <Button type="button" variant="ghost" size="sm" onClick={() => removeEditNewFile(i)}>
                                <X className="size-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEdit} disabled={isSavingEdit || !editTitle.trim()}>
                      {isSavingEdit && <Loader2 className="size-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} disabled={isSavingEdit}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Created {format(new Date(entry.created_at), 'PPpp')}
            {entry.updated_at && entry.updated_at !== entry.created_at &&
              ` · Updated ${format(new Date(entry.updated_at), 'PPpp')}`}
          </p>

          <AlertDialog open={deleteEntryConfirmOpen} onOpenChange={setDeleteEntryConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entry</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this operations log entry and all its attachments. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteEntryMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteEntryMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault();
                    deleteEntryMutation.mutate(
                      { entryId },
                      {
                        onSuccess: () => {
                          setDeleteEntryConfirmOpen(false);
                          toastSuccess('Entry deleted');
                          navigate('/operations-log');
                        },
                        onError: (err) => toastError(err, 'deleting entry'),
                      }
                    );
                  }}
                >
                  {deleteEntryMutation.isPending ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function AttachmentThumb({ path, getSignedUrl, compact }) {
  const [url, setUrl] = React.useState(null);
  const [err, setErr] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    getSignedUrl(path).then((u) => {
      if (!cancelled) setUrl(u);
    }).catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [path, getSignedUrl]);
  if (err || !url) {
    return (
      <div className={cn('w-full bg-muted flex items-center justify-center', compact ? 'aspect-[4/3] min-h-0' : 'h-full min-h-[200px]')}>
        <ImageIcon className={compact ? 'size-8 text-muted-foreground' : 'size-12 text-muted-foreground'} />
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      className={cn(
        'w-full bg-muted/30',
        compact ? 'aspect-[4/3] object-cover min-h-0' : 'h-full min-h-[200px] object-contain'
      )}
    />
  );
}
