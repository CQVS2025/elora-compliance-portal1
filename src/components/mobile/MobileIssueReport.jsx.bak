import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Loader2, Camera, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/components/ui/use-toast";

const ISSUE_TYPES = [
  { value: 'mechanical', label: 'Mechanical Problem' },
  { value: 'wash_equipment', label: 'Wash Equipment Issue' },
  { value: 'rfid_scanner', label: 'RFID Scanner Problem' },
  { value: 'damage', label: 'Vehicle Damage' },
  { value: 'cleanliness', label: 'Cleanliness Issue' },
  { value: 'other', label: 'Other' }
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' }
];

export default function MobileIssueReport({ open, onClose, vehicles, preselectedVehicle }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    vehicle_id: '',
    issue_type: 'mechanical',
    severity: 'medium',
    description: '',
    photo_url: ''
  });
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (preselectedVehicle) {
      setFormData(prev => ({
        ...prev,
        vehicle_id: preselectedVehicle.id
      }));
    }
  }, [preselectedVehicle]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await base44.auth.me();
      
      let photoUrl = '';
      if (photoFile) {
        const uploadResult = await base44.integrations.Core.UploadFile({ file: photoFile });
        photoUrl = uploadResult.file_url;
      }

      const selectedVehicle = vehicles.find(v => v.id === formData.vehicle_id);

      await base44.entities.Issue.create({
        ...formData,
        vehicle_name: selectedVehicle?.name || 'Unknown',
        reported_by: user.email,
        reporter_name: user.full_name,
        photo_url: photoUrl,
        status: 'open'
      });

      queryClient.invalidateQueries(['mobile-issues']);
      onClose();
    } catch (error) {
      console.error('Error reporting issue:', error);
      toast({
        title: "Error",
        description: "Failed to report issue. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report an Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <Label>Vehicle *</Label>
            <Select 
              value={formData.vehicle_id} 
              onValueChange={(value) => setFormData({ ...formData, vehicle_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name} - {v.rfid}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Issue Type *</Label>
            <Select 
              value={formData.issue_type} 
              onValueChange={(value) => setFormData({ ...formData, issue_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Severity *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {SEVERITY_LEVELS.map(level => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, severity: level.value })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.severity === level.value
                      ? `${level.color} text-white border-transparent`
                      : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              placeholder="Describe the issue in detail..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              required
            />
          </div>

          <div>
            <Label>Photo (Optional)</Label>
            {photoPreview ? (
              <div className="relative mt-2">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="mt-2 flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50">
                <Camera className="w-8 h-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600">Tap to add photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !formData.vehicle_id || !formData.description}
              className="flex-1 bg-[#7CB342] hover:bg-[#689F38]"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}