'use client';

import React from 'react';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const tabTitles = ['add', 'remove'];

export function MultiSelection({
  onValueSelected,
  value,
  options = [],
  isLoading = false,
}) {
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('add');

  const ids = React.useMemo(() => new Set((value || []).filter(Boolean)), [value]);

  const data = React.useMemo(() => {
    if (!options.length) return { add: [], remove: [] };
    const add = options.filter((item) => !ids.has(item.value));
    const remove = options.filter((item) => ids.has(item.value));
    return { add, remove };
  }, [ids, options]);

  const handleClosePopover = React.useCallback(() => setIsPopoverOpen(false), []);
  const handleTogglePopover = React.useCallback(() => setIsPopoverOpen((prev) => !prev), []);

  const handleSelect = React.useCallback(
    (item) => {
      const newList =
        activeTab === 'add'
          ? [...data.remove, item]
          : data.remove.filter((d) => d.value !== item.value);
      onValueSelected(newList.map((d) => d.value));
    },
    [activeTab, data, onValueSelected]
  );

  const handleSelectAll = React.useCallback(() => {
    onValueSelected(activeTab === 'add' ? options.map((d) => d.value) : []);
  }, [activeTab, onValueSelected, options]);

  const handleUnselect = React.useCallback(
    (item) => {
      const newList = data.remove.filter((d) => d.value !== item.value);
      onValueSelected(newList.map((d) => d.value));
    },
    [data.remove, onValueSelected]
  );

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <SelectedProperty
        isLoading={isLoading}
        selected={data.remove}
        handleUnselect={handleUnselect}
        handleTogglePopover={handleTogglePopover}
      />
      <PopoverContent
        className="min-w-[var(--radix-popper-anchor-width)] p-0 max-h-[300px] overflow-hidden"
        align="start"
      >
        <PropertiesList
          onClose={handleClosePopover}
          selectAll={handleSelectAll}
          onSelect={handleSelect}
          list={data}
          onTabValueChange={(tab) => setActiveTab(tab)}
          selectedTab={activeTab}
        />
      </PopoverContent>
    </Popover>
  );
}

function SelectedProperty({
  selected = [],
  isLoading,
  handleTogglePopover,
  handleUnselect,
  className,
  ...props
}) {
  return (
    <TooltipProvider>
      <PopoverTrigger asChild>
        <Button
          onClick={handleTogglePopover}
          disabled={isLoading}
          variant="outline"
          className={cn(
            'flex h-auto min-h-10 w-full items-center justify-between rounded-md border bg-background p-1 hover:bg-accent',
            className
          )}
          {...props}
        >
          {selected.length > 0 ? (
            <Tooltip delayDuration={100}>
              <ScrollArea className="w-full">
                <TooltipTrigger asChild>
                  <div className="flex w-max gap-1 flex-wrap">
                    {selected.map((item) => (
                      <Badge
                        key={item.value}
                        variant="secondary"
                        className="flex-shrink-0 rounded-sm text-xs font-medium capitalize"
                      >
                        {item.label}
                        <span
                          className="ml-1 rounded-full outline-none ring-offset-background cursor-pointer hover:opacity-80"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleUnselect?.(item);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleUnselect?.(item);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Remove ${item.label}`}
                        >
                          <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </span>
                      </Badge>
                    ))}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px]">
                  <p className="text-xs">Click X on a badge to remove</p>
                </TooltipContent>
              </ScrollArea>
            </Tooltip>
          ) : (
            <>
              {isLoading ? (
                <div className="ml-2 mt-1 flex h-6 flex-1 items-center bg-transparent text-muted-foreground outline-none">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="mx-auto flex w-full items-center justify-between">
                  <span className="mx-3 text-sm capitalize text-muted-foreground">Select drivers</span>
                  <ChevronDown className="mx-2 h-4 cursor-pointer text-muted-foreground" />
                </div>
              )}
            </>
          )}
        </Button>
      </PopoverTrigger>
    </TooltipProvider>
  );
}

function PropertiesList({
  list,
  onTabValueChange,
  selectedTab,
  selectAll,
  onClose,
  onSelect,
}) {
  return (
    <Tabs
      value={selectedTab}
      onValueChange={onTabValueChange}
      className="w-full flex flex-col h-full"
    >
      <TabsList className="w-full rounded-b-none sticky top-0 z-10 bg-background">
        {tabTitles.map((title) => (
          <TabsTrigger key={title} className="w-full capitalize" value={title}>
            {title}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-grow overflow-auto min-h-[120px]">
        {tabTitles.map((title) => (
          <TabsContent key={title} value={title} className="h-full m-0 mt-0">
            <PropertyCommand
              items={list[title] || []}
              selectedTab={selectedTab}
              onSelect={onSelect}
              selectAll={selectAll}
              onClose={onClose}
            />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

function PropertyCommand({ items, onSelect, selectedTab, selectAll, onClose }) {
  const [searchValue, setSearchValue] = React.useState('');

  const searchResults =
    searchValue.length > 0
      ? items.filter((item) =>
          String(item.label).toLowerCase().includes(searchValue.toLowerCase())
        )
      : items;

  const isEmpty =
    (searchValue.length > 0 && searchResults.length === 0) ||
    (searchValue.length === 0 && items.length === 0);

  return (
    <Command
      className="overflow-hidden flex flex-col"
      shouldFilter={false}
      filter={() => 1}
    >
      <CommandInput
        value={searchValue}
        onValueChange={setSearchValue}
        className="placeholder:capitalize h-10 border-0 border-b sticky top-0 z-10 bg-background rounded-none"
        placeholder="Search..."
      />
      <CommandList className="overflow-auto flex-1">
        <div
          className={cn(
            'py-6 capitalize text-center text-sm text-muted-foreground',
            !isEmpty && 'hidden'
          )}
        >
          {items.length === 0 ? 'Select customer/site first' : 'No matches'}
        </div>
        <CommandGroup className={cn(isEmpty && 'hidden')}>
          {searchResults.map((item) => (
            <CommandItem
              className="cursor-pointer"
              key={item.value}
              onSelect={() => onSelect?.(item)}
            >
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="border-t p-2 bg-background sticky bottom-0 z-10">
        <div className="flex gap-2 items-center">
          <Badge variant="outline" className="max-w-max text-xs">
            {searchValue.length > 0
              ? `${searchResults.length} of ${items.length}`
              : items.length}
          </Badge>
          <div
            className={cn(
              'flex flex-1 gap-2',
              (searchValue.length > 0 || items.length < 1) && 'hidden'
            )}
          >
            <span
              onClick={selectAll}
              className="flex justify-center gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted flex-1 text-center capitalize"
            >
              {selectedTab === 'remove' ? 'Remove all' : 'Add all'}
            </span>
            <Separator orientation="vertical" className="h-5" />
          </div>
          <span
            onClick={onClose}
            className="flex justify-center gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm cursor-pointer hover:bg-muted flex-1 text-center capitalize"
          >
            Close
          </span>
        </div>
      </div>
    </Command>
  );
}
