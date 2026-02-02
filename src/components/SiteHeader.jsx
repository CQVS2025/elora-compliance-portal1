import React from 'react';
import { Link } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ModeToggle } from '@/components/mode-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

/**
 * Dashboard header with sidebar trigger, optional breadcrumbs, page title, dark mode toggle, and optional actions.
 * Matches dashboard-01 structure. When breadcrumbs is provided (e.g. admin section), shows breadcrumb nav for back navigation.
 */
export default function SiteHeader({ title, description, breadcrumbs, children, className }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4 isolate',
        className
      )}
    >
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <div className="h-4 w-px bg-border" aria-hidden />
      <div className="flex flex-col min-w-0 gap-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="shrink-0">
            <BreadcrumbList className="flex flex-nowrap items-center gap-2 text-xs font-medium text-muted-foreground break-normal [&>li]:flex [&>li]:shrink-0 [&>li]:items-center [&>li]:gap-2 [&>li]:leading-none">
              {breadcrumbs.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <BreadcrumbSeparator className="shrink-0 opacity-60 [&>svg]:w-3 [&>svg]:h-3 text-muted-foreground/70" />
                  )}
                  <BreadcrumbItem>
                    {item.path != null ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.path} className="hover:text-foreground transition-colors rounded px-0.5 -mx-0.5 whitespace-nowrap">
                          {item.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-foreground font-semibold text-sm whitespace-nowrap">
                        {item.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        {(title || description) && (
          <>
            {title && !(breadcrumbs?.length && breadcrumbs[breadcrumbs.length - 1]?.label === title) && (
              <h1 className="truncate text-lg font-semibold leading-tight">{title}</h1>
            )}
            {description && (
              <p className="truncate text-sm text-muted-foreground leading-tight">{description}</p>
            )}
          </>
        )}
      </div>
      <div className="flex-1" />
      <ModeToggle />
      {children}
    </header>
  );
}
