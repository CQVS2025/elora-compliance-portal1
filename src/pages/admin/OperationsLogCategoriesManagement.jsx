import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';
import { ClipboardList, Plus, Edit, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { queryKeys } from '@/query/keys';
import { allOperationsLogCategoriesOptions } from '@/query/options';
import { toastError, toastSuccess } from '@/lib/toast';

export default function OperationsLogCategoriesManagement() {
  const { userProfile } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (userProfile && userProfile.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState(null);
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const { data: categories = [], isLoading } = useQuery(allOperationsLogCategoriesOptions());

  const saveMutation = useMutation({
    mutationFn: async ({ id, name: n, sort_order: so, is_active: active }) => {
      if (id) {
        const { error } = await supabase
          .from('operations_log_categories')
          .update({ name: n, sort_order: so, is_active: active, updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw error;
        return { id };
      }
      const { data, error } = await supabase
        .from('operations_log_categories')
        .insert({ name: n, sort_order: so, is_active: active })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.operationsLogCategories() });
      setDialogOpen(false);
      setEditingCategory(null);
      resetForm();
    },
    onError: (e) => console.error(e),
  });

  const resetForm = () => {
    setName('');
    setSortOrder(0);
    setIsActive(true);
    setEditingCategory(null);
  };

  const openCreate = () => {
    resetForm();
    setSortOrder((categories.length + 1) * 10);
    setDialogOpen(true);
  };

  const openEdit = (c) => {
    setEditingCategory(c);
    setName(c.name);
    setSortOrder(c.sort_order ?? 0);
    setIsActive(c.is_active !== false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    saveMutation.mutate({
      id: editingCategory?.id,
      name: name.trim(),
      sort_order: Number(sortOrder) || 0,
      is_active: isActive,
    });
  };

  const deleteMutation = useMutation({
    mutationFn: async (categoryId) => {
      const { count, error: countError } = await supabase
        .from('operations_log_entries')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId);
      if (countError) throw countError;
      if (count > 0) {
        const err = new Error(`This category is in use by ${count} entr${count === 1 ? 'y' : 'ies'} and cannot be deleted.`);
        err.userFriendly = true;
        throw err;
      }
      const { error } = await supabase
        .from('operations_log_categories')
        .delete()
        .eq('id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.operationsLogCategories() });
      setDeleteConfirmCategory(null);
      toastSuccess('delete', 'category');
    },
    onError: (e) => {
      toastError(e, 'deleting category');
      setDeleteConfirmCategory(null);
    },
  });

  const handleConfirmDelete = () => {
    if (!deleteConfirmCategory) return;
    deleteMutation.mutate(deleteConfirmCategory.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Operations Log Categories</h1>
          <p className="text-muted-foreground">Keep the default ones and add more. Used in the New Entry form.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          Add Category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            Categories
          </CardTitle>
          <CardDescription>Active categories appear in the Operations Log category dropdown.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Sort order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.sort_order ?? 0}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active !== false ? 'default' : 'secondary'}>
                        {c.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(c)} title="Edit">
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmCategory(c)}
                          title="Delete"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && categories.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No categories yet.</p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirmCategory} onOpenChange={(open) => !open && setDeleteConfirmCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &quot;{deleteConfirmCategory?.name}&quot;? This cannot be undone.
              If any operations log entries use this category, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit category' : 'Add category'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Safety" />
            </div>
            <div className="grid gap-2">
              <Label>Sort order</Label>
              <Input
                type="number"
                min={0}
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="active">Active (show in dropdown)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {editingCategory ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
