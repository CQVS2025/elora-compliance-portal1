import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Search, Plus, Edit, Lock, Users, Settings,
  CheckCircle, XCircle, AlertCircle, Copy, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export default function MultiTenantConfig() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [configCopied, setConfigCopied] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    userEmail: '',
    restrictedCustomer: '',
    lockCustomerFilter: false,
    showAllData: true,
    defaultSite: 'all',
    selectedTabs: []
  });

  const availableTabs = [
    'compliance',
    'maintenance',
    'costs',
    'refills',
    'devices',
    'sites',
    'reports',
    'users'
  ];

  // Simulated user configs - In production, fetch from database/API
  const mockUserConfigs = [
    {
      id: '1',
      userEmail: 'jonny@elora.com.au',
      restrictedCustomer: 'HEIDELBERG MATERIALS',
      lockCustomerFilter: true,
      showAllData: false,
      visibleTabs: ['compliance', 'maintenance', 'reports', 'users'],
      configType: 'Restricted Client'
    },
    // Add more as needed from database
  ];

  const handleAddNew = () => {
    setSelectedConfig(null);
    setFormData({
      userEmail: '',
      restrictedCustomer: '',
      lockCustomerFilter: false,
      showAllData: true,
      defaultSite: 'all',
      selectedTabs: availableTabs
    });
    setModalOpen(true);
  };

  const handleEdit = (config) => {
    setSelectedConfig(config);
    setFormData({
      userEmail: config.userEmail,
      restrictedCustomer: config.restrictedCustomer || '',
      lockCustomerFilter: config.lockCustomerFilter || false,
      showAllData: config.showAllData !== false,
      defaultSite: config.defaultSite || 'all',
      selectedTabs: config.visibleTabs || availableTabs
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    // In production, save to database/API
    console.log('Saving config:', formData);

    // For now, generate the code snippet
    const configCode = generateConfigCode(formData);
    console.log('Generated config:', configCode);

    setModalOpen(false);

    // Show success message
    alert('Configuration saved! See console for generated code snippet.');
  };

  const generateConfigCode = (data) => {
    const config = {
      restrictedCustomer: data.restrictedCustomer || undefined,
      lockCustomerFilter: data.lockCustomerFilter,
      showAllData: data.showAllData,
      defaultSite: data.defaultSite,
      visibleTabs: data.selectedTabs
    };

    // Remove undefined values
    Object.keys(config).forEach(key =>
      config[key] === undefined && delete config[key]
    );

    return `'${data.userEmail}': ${JSON.stringify(config, null, 2)}`;
  };

  const handleCopyConfig = (config) => {
    const code = generateConfigCode({
      userEmail: config.userEmail,
      restrictedCustomer: config.restrictedCustomer,
      lockCustomerFilter: config.lockCustomerFilter,
      showAllData: config.showAllData,
      defaultSite: config.defaultSite || 'all',
      selectedTabs: config.visibleTabs
    });

    navigator.clipboard.writeText(code);
    setConfigCopied(true);
    setTimeout(() => setConfigCopied(false), 2000);
  };

  const handleToggleTab = (tab) => {
    setFormData(prev => ({
      ...prev,
      selectedTabs: prev.selectedTabs.includes(tab)
        ? prev.selectedTabs.filter(t => t !== tab)
        : [...prev.selectedTabs, tab]
    }));
  };

  const applyTemplate = (templateType) => {
    const templates = {
      restrictedClient: {
        lockCustomerFilter: true,
        showAllData: false,
        selectedTabs: ['compliance', 'maintenance', 'reports']
      },
      clientAdmin: {
        lockCustomerFilter: true,
        showAllData: false,
        selectedTabs: availableTabs
      },
      siteManager: {
        lockCustomerFilter: true,
        showAllData: false,
        selectedTabs: availableTabs.filter(t => t !== 'users')
      },
      superAdmin: {
        lockCustomerFilter: false,
        showAllData: true,
        selectedTabs: availableTabs
      }
    };

    setFormData(prev => ({
      ...prev,
      ...templates[templateType]
    }));
  };

  const filteredConfigs = mockUserConfigs.filter(config =>
    config.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (config.restrictedCustomer && config.restrictedCustomer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#7CB342]" />
            Multi-Tenant Configuration
          </h2>
          <p className="text-slate-600 mt-1">
            Manage user access and customer restrictions without editing code
          </p>
        </div>
        <Button onClick={handleAddNew} className="bg-[#7CB342] hover:bg-[#689F38]">
          <Plus className="w-4 h-4 mr-2" />
          Add User Config
        </Button>
      </div>

      {/* Warning Banner */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-amber-900 mb-1">
                Important: Configuration Management
              </h3>
              <p className="text-sm text-amber-700">
                Currently, user configurations are stored in code. This admin panel helps you generate
                configuration snippets that must be manually added to <code className="bg-amber-100 px-1 rounded">
                /src/components/auth/PermissionGuard.jsx</code>. Future versions will support database-backed configurations.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by email or customer name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-slate-200"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{mockUserConfigs.length}</p>
                <p className="text-sm text-slate-600">Total Configs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {mockUserConfigs.filter(c => c.lockCustomerFilter).length}
                </p>
                <p className="text-sm text-slate-600">Restricted Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {mockUserConfigs.filter(c => !c.lockCustomerFilter).length}
                </p>
                <p className="text-sm text-slate-600">Full Access</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">
                  {new Set(mockUserConfigs.map(c => c.restrictedCustomer).filter(Boolean)).size}
                </p>
                <p className="text-sm text-slate-600">Unique Customers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence>
          {filteredConfigs.map((config, index) => (
            <motion.div
              key={config.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{config.userEmail}</CardTitle>
                      <CardDescription className="mt-1">
                        {config.restrictedCustomer || 'No customer restriction'}
                      </CardDescription>
                    </div>
                    <Badge className={
                      config.lockCustomerFilter
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-500 text-white'
                    }>
                      {config.configType}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Access Details */}
                    <div className="flex items-center gap-2 text-sm">
                      {config.lockCustomerFilter ? (
                        <Lock className="w-4 h-4 text-amber-600" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      )}
                      <span className="text-slate-600">
                        {config.lockCustomerFilter ? 'Locked to customer' : 'All customers accessible'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {config.showAllData ? (
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-slate-600">
                        {config.showAllData ? 'Can see all data' : 'Restricted data access'}
                      </span>
                    </div>

                    {/* Visible Tabs */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">Visible Tabs:</p>
                      <div className="flex flex-wrap gap-1">
                        {config.visibleTabs.map(tab => (
                          <Badge key={tab} variant="outline" className="text-xs">
                            {tab}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(config)}
                        className="flex-1"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyConfig(config)}
                        className="flex-1"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        {configCopied ? 'Copied!' : 'Copy Code'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredConfigs.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">
            {searchQuery ? 'No configurations found matching your search' : 'No user configurations yet. Add your first configuration to get started.'}
          </p>
        </div>
      )}

      {/* Configuration Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedConfig ? 'Edit User Configuration' : 'Add User Configuration'}
            </DialogTitle>
            <DialogDescription>
              Configure user access, customer restrictions, and visible tabs
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Quick Templates */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Quick Templates</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate('restrictedClient')}
                  className="text-sm"
                >
                  Restricted Client (Heidelberg)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate('clientAdmin')}
                  className="text-sm"
                >
                  Client Admin
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate('siteManager')}
                  className="text-sm"
                >
                  Site Manager
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => applyTemplate('superAdmin')}
                  className="text-sm"
                >
                  Super Admin
                </Button>
              </div>
            </div>

            {/* User Email */}
            <div>
              <Label htmlFor="userEmail">User Email *</Label>
              <Input
                id="userEmail"
                type="email"
                value={formData.userEmail}
                onChange={(e) => setFormData({ ...formData, userEmail: e.target.value })}
                placeholder="user@example.com"
                className="mt-1"
              />
            </div>

            {/* Restricted Customer */}
            <div>
              <Label htmlFor="restrictedCustomer">Restricted Customer (Optional)</Label>
              <Input
                id="restrictedCustomer"
                value={formData.restrictedCustomer}
                onChange={(e) => setFormData({ ...formData, restrictedCustomer: e.target.value })}
                placeholder="e.g., HEIDELBERG MATERIALS"
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave blank for unrestricted access. Customer name must match database exactly.
              </p>
            </div>

            {/* Lock Customer Filter */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="lockCustomerFilter"
                checked={formData.lockCustomerFilter}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, lockCustomerFilter: checked })
                }
              />
              <Label
                htmlFor="lockCustomerFilter"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Lock customer filter (user cannot change customer selection)
              </Label>
            </div>

            {/* Show All Data */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showAllData"
                checked={formData.showAllData}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, showAllData: checked })
                }
              />
              <Label
                htmlFor="showAllData"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Show all data (uncheck for restricted data access)
              </Label>
            </div>

            {/* Visible Tabs */}
            <div>
              <Label className="mb-2 block">Visible Tabs</Label>
              <div className="grid grid-cols-2 gap-2">
                {availableTabs.map(tab => (
                  <div key={tab} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tab-${tab}`}
                      checked={formData.selectedTabs.includes(tab)}
                      onCheckedChange={() => handleToggleTab(tab)}
                    />
                    <Label
                      htmlFor={`tab-${tab}`}
                      className="text-sm font-normal capitalize cursor-pointer"
                    >
                      {tab}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated Code Preview */}
            <div>
              <Label className="mb-2 block">Generated Configuration</Label>
              <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
                {generateConfigCode(formData)}
              </pre>
              <p className="text-xs text-slate-500 mt-2">
                Copy this code and add it to <code className="bg-slate-100 px-1 rounded">
                  USER_SPECIFIC_CONFIG
                </code> in <code className="bg-slate-100 px-1 rounded">
                  /src/components/auth/PermissionGuard.jsx
                </code>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#7CB342] hover:bg-[#689F38]">
              <Save className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
