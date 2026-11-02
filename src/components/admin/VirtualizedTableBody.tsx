import React from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualizedTableBodyProps<T> {
  data: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  rowHeight?: number;
  overscan?: number;
  totalColumns: number;
  scrollElementRef: React.RefObject<HTMLDivElement | null>;
}

export function VirtualizedTableBody<T>({
  data,
  renderRow,
  rowHeight = 44,
  overscan = 6,
  totalColumns,
  scrollElementRef
}: VirtualizedTableBodyProps<T>) {
  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => rowHeight,
    overscan
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  if (data.length === 0) return null;

  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <tbody className="divide-y divide-slate-800/60 font-medium">
      {paddingTop > 0 && (
        <tr style={{ height: `${paddingTop}px` }}>
          <td colSpan={totalColumns} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
      {virtualItems.map((virtualRow) => (
        <React.Fragment key={virtualRow.index}>
          {renderRow(data[virtualRow.index], virtualRow.index)}
        </React.Fragment>
      ))}
      {paddingBottom > 0 && (
        <tr style={{ height: `${paddingBottom}px` }}>
          <td colSpan={totalColumns} style={{ padding: 0, border: 0 }} />
        </tr>
      )}
    </tbody>
  );
}
