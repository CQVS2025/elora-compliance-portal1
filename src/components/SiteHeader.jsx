import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ModeToggle } from '@/components/mode-toggle';
import AlertNotificationBell from '@/components/AlertNotificationBell';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
 * When breadcrumbs is provided (e.g. admin section), shows breadcrumb nav and explicit back button for nested pages.
 */
export default function SiteHeader({ title, description, breadcrumbs, showBackButton, backTo, children, className }) {
  const navigate = useNavigate();
  const isAdminNested = breadcrumbs && breadcrumbs.length > 1;
  const hasNestedBreadcrumbs = breadcrumbs && breadcrumbs.length > 1;
  const displayBack = showBackButton ?? hasNestedBreadcrumbs;
  const backTarget = backTo ?? (hasNestedBreadcrumbs && breadcrumbs[0]?.path ? breadcrumbs[0].path : isAdminNested ? '/admin' : null);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex min-h-14 sm:min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background px-3 py-2 sm:px-4 sm:py-0 isolate min-w-0',
        className
      )}
    >
      <SidebarTrigger className="-ml-1 h-9 w-9 shrink-0 touch-manipulation md:h-8 md:w-8" aria-label="Toggle sidebar" />
      {displayBack && (
        <>
          {backTarget ? (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9 min-h-[44px] sm:min-h-9 touch-manipulation text-xs sm:text-sm px-3" asChild>
              <Link to={backTarget}>
                <ArrowLeft className="w-4 h-4 shrink-0" />
                Back
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0 h-9 min-h-[44px] sm:min-h-9 touch-manipulation text-xs sm:text-sm px-3" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 shrink-0" />
              Back
            </Button>
          )}
          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" aria-hidden />
        </>
      )}
      <div className="h-4 w-px bg-border shrink-0 hidden sm:block" aria-hidden />
      <div className="flex flex-col min-w-0 flex-1 gap-0.5 overflow-hidden max-w-full">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumb className="shrink-0 min-w-0">
            <BreadcrumbList className="flex flex-nowrap items-center gap-1.5 text-xs font-medium text-muted-foreground [&>li]:flex [&>li]:shrink-0 [&>li]:items-center [&>li]:gap-1.5 [&>li]:leading-none [&>li]:min-w-0">
              {breadcrumbs.map((item, i) => (
                <React.Fragment key={i}>
                  {i > 0 && (
                    <BreadcrumbSeparator className="shrink-0 opacity-60 [&>svg]:w-3 [&>svg]:h-3 text-muted-foreground/70" />
                  )}
                  <BreadcrumbItem className="min-w-0 max-w-[120px] sm:max-w-[200px]">
                    {item.path != null ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.path} className="hover:text-foreground transition-colors rounded px-0.5 -mx-0.5 truncate block">
                          {item.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-foreground font-semibold text-sm truncate block">
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
              <h1 className="truncate text-base sm:text-lg font-semibold leading-tight">{title}</h1>
            )}
            {description && (
              <p className="truncate text-xs sm:text-sm text-muted-foreground leading-tight hidden sm:block">{description}</p>
            )}
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <AlertNotificationBell />
        <ModeToggle />
        {children}
      </div>
    </header>
  );
}
