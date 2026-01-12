import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import { base44 } from "@/api/base44Client";
import { toast } from 'sonner';
import { Label } from "@/components/ui/label";

async function fetchComplianceTargets(customerRef) {
  try {
    const response = await base44.functions.invoke('elora_get_compliance_targets', { customerRef });
    return response.data || [];
  } catch (error) {
    console.error('Error fetching compliance targets:', error);
    return [];
  }
}

async function saveComplianceTarget(target) {
  const response = await base44.functions.invoke('elora_save_compliance_target', target);
  return response.data;
}

async function deleteComplianceTarget(targetId) {
  const response = await base44.functions.invoke('elora_delete_compliance_target', { targetId });
  return response.data;
}

export default function CustomComplianceTargets({ customerRef, vehicles, sites }) {
  const queryClient = useQueryClient();
  const [editingTarget, setEditingTarget] = useState(null);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['complianceTargets', customerRef],
    queryFn: () => fetchComplianceTargets(customerRef),
    enabled: !!customerRef && customerRef !== 'all',
  });

  const saveMutation = useMutation({
    mutationFn: saveComplianceTarget,
    onSuccess: () => {
      queryClient.invalidateQueries(['complianceTargets', customerRef]);
      toast.success('Compliance target saved');
      setEditingTarget(null);
    },
    onError: (error) => {
      console.error('Error saving target:', error);
      toast.error('Failed to save target');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteComplianceTarget,
    onSuccess: () => {
      queryClient.invalidateQueries(['complianceTargets', customerRef]);
      toast.success('Compliance target deleted');
    },
    onError: (error) => {
      console.error('Error deleting target:', error);
      toast.error('Failed to delete target');
    }
  });

  const handleAddNew = () => {
    setEditingTarget({
      type: 'vehicle_type',
      name: '',
      target_washes_per_week: 12,
      applies_to: 'all'
    });
  };

  const handleSave = () => {
    if (!editingTarget.name || !editingTarget.target_washes_per_week) {
      toast.error('Please fill in all fields');
      return;
    }

    saveMutation.mutate({
      ...editingTarget,
      customerRef
    });
  };

  if (!customerRef || customerRef === 'all') {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <p className="text-slate-500 text-sm text-center py-8">
          Please select a specific customer to manage compliance targets
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#7CB342] animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-[#7CB342]" />
            Custom Compliance Targets
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Set different wash targets for vehicle types or specific sites
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 bg-[#7CB342] hover:bg-[#6BA032] text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Target
        </button>
      </div>

      {/* Existing Targets */}
      <div className="space-y-3">
        {targets.map((target) => (
          <div key={target.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{target.name}</span>
                <span className="text-xs px-2 py-1 bg-[#7CB342] text-white rounded-full">
                  {target.type === 'vehicle_type' ? 'Vehicle Type' : 'Site'}
                </span>
              </div>
              <p className="text-sm text-slate-600 mt-1">
                Target: <span className="font-medium">{target.target_washes_per_week} washes/week</span>
              </p>
              {target.applies_to !== 'all' && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Applies to: {target.applies_to}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteMutation.mutate(target.id)}
              disabled={deleteMutation.isPending}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {targets.length === 0 && !editingTarget && (
          <p className="text-slate-500 text-sm text-center py-8">
            No custom targets configured. Click "Add Target" to create one.
          </p>
        )}
      </div>

      {/* Edit Form */}
      {editingTarget && (
        <div className="border-2 border-[#7CB342] rounded-lg p-4 space-y-4 bg-[#7CB342]/5">
          <h4 className="font-medium text-slate-800">New Compliance Target</h4>

          <div className="space-y-3">
            <div>
              <Label className="text-sm font-medium text-slate-700">Target Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setEditingTarget({ ...editingTarget, type: 'vehicle_type' })}
                  className={`p-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                    editingTarget.type === 'vehicle_type'
                      ? 'border-[#7CB342] bg-[#7CB342]/10 text-[#7CB342]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Vehicle Type
                </button>
                <button
                  onClick={() => setEditingTarget({ ...editingTarget, type: 'site' })}
                  className={`p-3 rounded-lg border-2 font-medium text-sm transition-colors ${
                    editingTarget.type === 'site'
                      ? 'border-[#7CB342] bg-[#7CB342]/10 text-[#7CB342]'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Site
                </button>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">Name</Label>
              <input
                type="text"
                value={editingTarget.name}
                onChange={(e) => setEditingTarget({ ...editingTarget, name: e.target.value })}
                placeholder={editingTarget.type === 'vehicle_type' ? 'e.g., Heavy Trucks' : 'e.g., Melbourne Site'}
                className="w-full mt-2 px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-[#7CB342] focus:outline-none"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">Target Washes per Week</Label>
              <input
                type="number"
                min="1"
                max="50"
                value={editingTarget.target_washes_per_week}
                onChange={(e) => setEditingTarget({ ...editingTarget, target_washes_per_week: parseInt(e.target.value) })}
                className="w-full mt-2 px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-[#7CB342] focus:outline-none"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-slate-700">Applies To</Label>
              <select
                value={editingTarget.applies_to}
                onChange={(e) => setEditingTarget({ ...editingTarget, applies_to: e.target.value })}
                className="w-full mt-2 px-4 py-2 border-2 border-slate-200 rounded-lg focus:border-[#7CB342] focus:outline-none"
              >
                <option value="all">All {editingTarget.type === 'vehicle_type' ? 'Vehicles' : 'Sites'}</option>
                {editingTarget.type === 'site' && sites?.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-[#7CB342] hover:bg-[#6BA032] text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Target
                </>
              )}
            </button>
            <button
              onClick={() => setEditingTarget(null)}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
