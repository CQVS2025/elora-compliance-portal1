import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { aiSettingsOptions } from '@/query/options/aiInsights';
import { queryKeys } from '@/query/keys';

const MODEL_LABELS = {
  'claude-sonnet-4-20250514': 'Claude Sonnet (default, cost-efficient)',
  'claude-opus-4-20250514': 'Claude Opus (optional deep analysis)',
};

export default function AIInsightsModelSwitcher() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: aiSettings = {} } = useQuery(aiSettingsOptions());
  const currentModel = aiSettings.default_ai_model || 'claude-sonnet-4-20250514';

  const updateSetting = useMutation({
    mutationFn: async (value) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('ai_settings')
        .upsert(
          { key: 'default_ai_model', value, updated_at: new Date().toISOString(), updated_by: user?.id ?? null },
          { onConflict: 'key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.global.aiSettings() });
      toast({ title: 'AI model updated', description: 'Future analyses will use the selected model.' });
    },
    onError: (err) => {
      toast({ title: 'Failed to update model', description: err?.message, variant: 'destructive' });
    },
  });

  return (
    <div className="flex items-center gap-2">
      <Bot className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentModel}
        onValueChange={(v) => updateSetting.mutate(v)}
        disabled={updateSetting.isPending}
      >
        <SelectTrigger className="w-[280px] h-9 bg-background">
          <SelectValue placeholder="AI model" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="claude-sonnet-4-20250514">
            {MODEL_LABELS['claude-sonnet-4-20250514']}
          </SelectItem>
          <SelectItem value="claude-opus-4-20250514">
            {MODEL_LABELS['claude-opus-4-20250514']}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
