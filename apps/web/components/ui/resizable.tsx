'use client';

import * as React from 'react';
import { GripVertical } from 'lucide-react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@/lib/utils';

export function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      className={cn(
        'flex h-full w-full data-[panel-group-direction=vertical]:flex-col',
        className,
      )}
      {...props}
    />
  );
}

export const ResizablePanel = ResizablePrimitive.Panel;

export function ResizableHandle({
  withHandle = true,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      className={cn(
        'relative flex w-px items-center justify-center bg-border transition-colors hover:bg-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        'data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full',
        'data-[resize-handle-state=hover]:bg-foreground/30',
        'data-[resize-handle-state=drag]:bg-foreground/40',
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border text-muted-foreground data-[panel-group-direction=vertical]:h-3 data-[panel-group-direction=vertical]:w-4 data-[panel-group-direction=vertical]:rotate-90">
          <GripVertical className="h-2.5 w-2.5" />
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}
