import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layout, Eye, EyeOff, GripVertical, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_WIDGETS = [
  { id: 'stats', name: 'Statistics Cards', enabled: true, order: 0 },
  { id: 'recentActivity', name: 'Recent Activity', enabled: true, order: 1 },
  { id: 'favorites', name: 'Favorite Vehicles', enabled: true, order: 2 },
  { id: 'costForecast', name: 'Cost Forecast', enabled: true, order: 3 },
  { id: 'leaderboard', name: 'Leaderboard Link', enabled: true, order: 4 },
  { id: 'vehicleTable', name: 'Vehicle Table', enabled: true, order: 5 },
  { id: 'washAnalytics', name: 'Wash Analytics', enabled: true, order: 6 },
  { id: 'performanceChart', name: 'Performance Chart', enabled: true, order: 7 },
  { id: 'washPatterns', name: 'Wash Patterns', enabled: true, order: 8 },
];

export function useDashboardCustomization(userEmail) {
  const [widgets, setWidgets] = useState(DEFAULT_WIDGETS);
  const storageKey = `dashboard_layout_${userEmail}`;

  useEffect(() => {
    if (userEmail) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setWidgets(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading dashboard layout:', error);
      }
    }
  }, [userEmail, storageKey]);

  const saveLayout = (newWidgets) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newWidgets));
      setWidgets(newWidgets);
      toast.success('Dashboard layout saved');
    } catch (error) {
      console.error('Error saving dashboard layout:', error);
      toast.error('Failed to save layout');
    }
  };

  const toggleWidget = (widgetId) => {
    const newWidgets = widgets.map(w =>
      w.id === widgetId ? { ...w, enabled: !w.enabled } : w
    );
    saveLayout(newWidgets);
  };

  const resetToDefault = () => {
    saveLayout(DEFAULT_WIDGETS);
    toast.success('Dashboard reset to default');
  };

  const isWidgetEnabled = (widgetId) => {
    const widget = widgets.find(w => w.id === widgetId);
    return widget ? widget.enabled : true;
  };

  return {
    widgets,
    toggleWidget,
    resetToDefault,
    isWidgetEnabled,
    saveLayout
  };
}

export default function DashboardCustomizer({ userEmail, onClose }) {
  const { widgets, toggleWidget, resetToDefault } = useDashboardCustomization(userEmail);
  const [draggedItem, setDraggedItem] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newWidgets = [...widgets];
    const draggedWidget = newWidgets[draggedItem];
    newWidgets.splice(draggedItem, 1);
    newWidgets.splice(index, 0, draggedWidget);

    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const enabledCount = widgets.filter(w => w.enabled).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#7CB342] to-[#9CCC65] p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Layout className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Customize Dashboard</h2>
                <p className="text-white/80 text-sm">
                  {enabledCount} of {widgets.length} widgets visible
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-600">
              Toggle widgets on/off or drag to reorder
            </p>
            <button
              onClick={resetToDefault}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Default
            </button>
          </div>

          <div className="space-y-2">
            {widgets.map((widget, index) => (
              <div
                key={widget.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-4 border-2 rounded-lg transition-all cursor-move ${
                  draggedItem === index
                    ? 'border-[#7CB342] bg-[#7CB342]/10 shadow-lg'
                    : 'border-slate-200 hover:border-slate-300'
                } ${!widget.enabled ? 'opacity-50' : ''}`}
              >
                <GripVertical className="w-5 h-5 text-slate-400 flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{widget.name}</div>
                  <div className="text-xs text-slate-500">
                    {widget.enabled ? 'Visible' : 'Hidden'}
                  </div>
                </div>

                <button
                  onClick={() => toggleWidget(widget.id)}
                  className={`p-2 rounded-lg transition-colors ${
                    widget.enabled
                      ? 'text-[#7CB342] hover:bg-[#7CB342]/10'
                      : 'text-slate-400 hover:bg-slate-100'
                  }`}
                >
                  {widget.enabled ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Close
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 bg-[#7CB342] hover:bg-[#6BA032] text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            <Save className="w-4 h-4" />
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
}
