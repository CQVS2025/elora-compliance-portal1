"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const FieldGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-group"
    className={cn("flex flex-col gap-6", className)}
    {...props}
  />
));
FieldGroup.displayName = "FieldGroup";

const Field = React.forwardRef(({ className, orientation = "vertical", ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field"
    role="group"
    className={cn(
      orientation === "horizontal" && "flex items-center gap-3",
      orientation === "vertical" && "flex flex-col gap-2",
      className
    )}
    {...props}
  />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? "span" : "label";
  return (
    <Comp
      ref={ref}
      data-slot="field-label"
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
});
FieldLabel.displayName = "FieldLabel";

const FieldDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    data-slot="field-description"
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

const FieldSeparator = React.forwardRef(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="field-separator"
    className={cn("relative flex items-center gap-2", className)}
    {...props}
  >
    <div className="flex-1 border-t border-border" />
    {children && (
      <span
        data-slot="field-separator-content"
        className="text-xs text-muted-foreground whitespace-nowrap px-2"
      >
        {children}
      </span>
    )}
    <div className="flex-1 border-t border-border" />
  </div>
));
FieldSeparator.displayName = "FieldSeparator";

export {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldSeparator,
};
