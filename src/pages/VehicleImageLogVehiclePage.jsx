import React, { useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { ArrowLeft, ImageIcon, Upload, Loader2, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { vehiclesOptions } from '@/query/options';
import { vehicleImageLogOptions, getVehicleImageUrl } from '@/query/options/vehicleImageLog';
import { useUploadVehicleImage, useDeleteVehicleImage } from '@/query/mutations/vehicleImageLog';
import { usePermissions } from '@/components/auth/PermissionGuard';
import { useAuth } from '@/lib/AuthContext';

export default function VehicleImageLogVehiclePage() {
  const { vehicleRef } = useParams();
  const permissions = usePermissions();
  const { user } = useAuth();
  const companyId = permissions.userProfile?.company_id;
  const fileInputRef = useRef(null);

  const { data: allVehicles = [], isLoading: vehiclesLoading } = useQuery({
    ...vehiclesOptions(companyId, {}),
    enabled: !!companyId && !!vehicleRef,
  });

  const vehicle = React.useMemo(() => {
    if (!vehicleRef || !Array.isArray(allVehicles)) return null;
    return allVehicles.find(
      (v) =>
        String(v.vehicleRef ?? '') === String(vehicleRef) ||
        String(v.internalVehicleId ?? '') === String(vehicleRef)
    ) ?? null;
  }, [allVehicles, vehicleRef]);

  const { data: imageLogEntries = [], isLoading: imageLogLoading } = useQuery(
    vehicleImageLogOptions(vehicleRef)
  );
  const uploadImageMutation = useUploadVehicleImage(vehicleRef);
  const deleteImageMutation = useDeleteVehicleImage(vehicleRef);
  const canManageVehicleImages = permissions.effectiveTabValues?.includes('vehicle-image-log') ?? false;

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      uploadImageMutation.mutate({ file, userId: user?.id });
    }
    e.target.value = '';
  };

  const displayName = vehicle?.vehicleName ?? vehicle?.vehicleRef ?? vehicleRef ?? '—';
  const customerName = vehicle?.customerName ?? '—';
  const siteName = vehicle?.siteName ?? '—';

  if (!vehicleRef) {
    return (
      <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
        <Button variant="outline" size="sm" asChild>
          <Link to="/vehicle-image-log" className="flex items-center gap-2">
            <ArrowLeft className="size-5" /> Back
          </Link>
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center text-muted-foreground">
            Vehicle reference is missing.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (vehiclesLoading && !vehicle) {
    return (
      <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
        <Button variant="outline" size="sm" asChild>
          <Link to="/vehicle-image-log" className="flex items-center gap-2">
            <ArrowLeft className="size-5" /> Back
          </Link>
        </Button>
        <Card className="mt-4 flex-1 flex flex-col">
          <CardContent className="flex-1 flex items-center justify-center py-16">
            <Loader2 className="size-10 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!vehicle && allVehicles.length > 0) {
    return (
      <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
        <Button variant="outline" size="sm" asChild>
          <Link to="/vehicle-image-log" className="flex items-center gap-2">
            <ArrowLeft className="size-5" /> Back
          </Link>
        </Button>
        <Card className="mt-4">
          <CardContent className="py-12 text-center text-muted-foreground">
            Vehicle not found. It may be outside your access.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-h-0 flex flex-col p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center gap-2 mb-4 shrink-0">
        <Button variant="outline" size="sm" asChild>
          <Link to="/vehicle-image-log" className="flex items-center gap-2">
            <ArrowLeft className="size-5" />
            Back
          </Link>
        </Button>
        <span className="text-sm font-medium text-muted-foreground">Vehicle Image Log</span>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="border-b bg-muted/30 px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Truck className="size-6 text-primary" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl sm:text-2xl truncate">{displayName}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {customerName} — {siteName}
                </p>
              </div>
            </div>
            {canManageVehicleImages && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={uploadImageMutation.isPending}
                  className="gap-2"
                >
                  {uploadImageMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Upload image
                </Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 lg:px-8 py-6 flex-1 min-h-0 overflow-auto">
          {imageLogLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            </div>
          ) : imageLogEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No images for this vehicle yet.
              {canManageVehicleImages && ' Use "Upload image" above to add photos.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {imageLogEntries.map((entry) => {
                const url = getVehicleImageUrl(entry.file_path);
                return (
                  <div
                    key={entry.id}
                    className="group relative rounded-xl border bg-muted/30 overflow-hidden aspect-square"
                  >
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full"
                      >
                        <img
                          src={url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                        <ImageIcon className="size-10" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2 text-white text-xs">
                      {entry.uploaded_at
                        ? moment(entry.uploaded_at).format('D MMM YYYY, HH:mm')
                        : '—'}
                    </div>
                    {canManageVehicleImages && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() =>
                          deleteImageMutation.mutate({
                            id: entry.id,
                            filePath: entry.file_path,
                          })
                        }
                        disabled={deleteImageMutation.isPending}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
