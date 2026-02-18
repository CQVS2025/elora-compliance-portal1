import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import DataPagination from '@/components/ui/DataPagination';
import WESScoreBadge from './WESScoreBadge';
import moment from 'moment';
import { cn } from '@/lib/utils';

const WASH_HISTORY_PAGE_SIZES = [5, 10, 25, 50];

/**
 * Wash History Table Component
 * Displays detailed wash event history for a vehicle
 *
 * @param {Array} washHistory - Array of wash event objects
 * @param {string} className - Additional CSS classes
 */
export default function WashHistoryTable({ washHistory, className }) {
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sortedHistory = useMemo(() => {
    if (!washHistory) return [];
    
    let sortableHistory = [...washHistory];
    sortableHistory.sort((a, b) => {
      if (sortConfig.key === 'date') {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (sortConfig.key === 'wesScore') {
        return sortConfig.direction === 'asc' 
          ? a.wesScore - b.wesScore 
          : b.wesScore - a.wesScore;
      }
      
      return 0;
    });
    
    return sortableHistory;
  }, [washHistory, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedHistory.length / pageSize));
  const paginatedHistory = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedHistory.slice(start, start + pageSize);
  }, [sortedHistory, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [washHistory?.length, pageSize]);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  if (!washHistory || washHistory.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Wash History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No wash history available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Wash History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('date')}
                >
                  Date & Time
                  {sortConfig.key === 'date' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Device</TableHead>
                <TableHead className="text-center">Water (L)</TableHead>
                <TableHead className="text-center">Drum RPM</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-center">End NTU</TableHead>
                <TableHead 
                  className="text-center cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('wesScore')}
                >
                  WES
                  {sortConfig.key === 'wesScore' && (
                    <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </TableHead>
                <TableHead>Mix Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.map((wash, index) => (
                <TableRow key={wash.date ? `${wash.date}-${index}` : index}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {moment(wash.date).format('DD MMM HH:mm')}
                  </TableCell>
                  <TableCell>{wash.site}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{wash.device}</TableCell>
                  <TableCell className="text-center">{wash.waterL}</TableCell>
                  <TableCell className={cn(
                    'text-center font-medium',
                    wash.drumRPM === 0 ? 'text-chart-critical' : 
                    wash.drumRPM < 8 ? 'text-chart-medium' : 'text-primary'
                  )}>
                    {wash.drumRPM.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">{wash.duration}</TableCell>
                  <TableCell className={cn(
                    'text-center font-medium',
                    wash.endNTU > 500 ? 'text-chart-critical' :
                    wash.endNTU > 150 ? 'text-chart-medium' : 'text-primary'
                  )}>
                    {wash.endNTU}
                  </TableCell>
                  <TableCell className="text-center">
                    <WESScoreBadge score={wash.wesScore} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{wash.mixType}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      wash.status === 'Excellent' && 'bg-primary/10 text-primary border-primary/30',
                      wash.status === 'Acceptable' && 'bg-chart-low/10 text-chart-low border-chart-low/30',
                      wash.status === 'Marginal' && 'bg-chart-medium/10 text-chart-medium border-chart-medium/30',
                      wash.status === 'Poor' && 'bg-chart-critical/10 text-chart-critical border-chart-critical/30'
                    )}>
                      {wash.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {sortedHistory.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                <SelectTrigger className="w-[72px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASH_HISTORY_PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DataPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={sortedHistory.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
