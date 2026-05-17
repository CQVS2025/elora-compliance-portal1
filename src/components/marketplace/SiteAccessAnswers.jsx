import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Renders order.site_access_answers as a human-readable Q&A list by hydrating
 * the underlying question text from marketplace_product_checkout_questions.
 *
 * Answers are stored on the order as { [question_id]: value } so by themselves
 * they look like raw UUIDs to admins. This component resolves question_id →
 * question_text + question_type and formats the value appropriately.
 *
 * Props:
 *   - answers: object  (order.site_access_answers)
 *   - productIds: string[]  (product_ids in this order — used to scope the query)
 */
export function SiteAccessAnswers({ answers, productIds }) {
  const ids = useMemo(() => Array.from(new Set((productIds ?? []).filter(Boolean))), [productIds]);
  const questionIds = useMemo(() => Object.keys(answers ?? {}), [answers]);

  const { data: questions = [] } = useQuery({
    queryKey: ['marketplace', 'checkout-questions-by-product', ids.length, ids.join(','), questionIds.length, questionIds.join(',')],
    queryFn: async () => {
      if (ids.length === 0 && questionIds.length === 0) return [];
      let query = supabase
        .from('marketplace_product_checkout_questions')
        .select('id, product_id, question_text, question_type, options, display_order')
        .order('display_order', { ascending: true });
      if (ids.length > 0) {
        query = query.in('product_id', ids);
      } else if (questionIds.length > 0) {
        // Fallback: order has no products mapped — look up by question id directly
        query = query.in('id', questionIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: questionIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  if (!answers || questionIds.length === 0) return null;

  const byId = new Map(questions.map((q) => [q.id, q]));

  return (
    <ul className="space-y-3 text-sm">
      {questionIds.map((qid) => {
        const q = byId.get(qid);
        const value = answers[qid];
        return (
          <li key={qid} className="border-l-2 border-border pl-3">
            <p className="font-medium text-foreground">
              {q?.question_text ?? <span className="italic text-muted-foreground">Question no longer available</span>}
            </p>
            <p className="text-muted-foreground mt-0.5">{formatAnswer(value, q?.question_type)}</p>
          </li>
        );
      })}
    </ul>
  );
}

function formatAnswer(value, type) {
  if (value === null || value === undefined || value === '') {
    return <span className="italic">No answer</span>;
  }
  if (type === 'boolean' || typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (type === 'number' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? <span className="italic">No selections</span> : value.join(', ');
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
