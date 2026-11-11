import React from 'react';
import type { FlyoutResizeDirection } from '../services/tauriBridge';

interface FlyoutResizeHandlesProps {
  onResizePointerDown: (
    direction: FlyoutResizeDirection,
    e: React.PointerEvent<HTMLDivElement>,
  ) => void;
}

const EDGE_HANDLES: ReadonlyArray<{
  direction: FlyoutResizeDirection;
  className: string;
}> = [
  {
    direction: 'North',
    className: 'inset-x-3 top-0 h-[5px] cursor-ns-resize',
  },
  {
    direction: 'South',
    className: 'inset-x-3 bottom-0 h-[5px] cursor-ns-resize',
  },
  {
    direction: 'West',
    className: 'inset-y-3 left-0 w-[5px] cursor-ew-resize',
  },
  {
    direction: 'East',
    className: 'inset-y-3 right-0 w-[5px] cursor-ew-resize',
  },
  {
    direction: 'NorthWest',
    className: 'left-0 top-0 h-3 w-3 cursor-nwse-resize',
  },
  {
    direction: 'NorthEast',
    className: 'right-0 top-0 h-3 w-3 cursor-nesw-resize',
  },
  {
    direction: 'SouthWest',
    className: 'bottom-0 left-0 h-3 w-3 cursor-nesw-resize',
  },
];

export const FlyoutResizeHandles: React.FC<FlyoutResizeHandlesProps> = ({
  onResizePointerDown,
}) => {
  const bindHandle =
    (direction: FlyoutResizeDirection) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onResizePointerDown(direction, e);
    };

  return (
    <>
      {EDGE_HANDLES.map(({ direction, className }) => (
        <div
          key={direction}
          data-no-drag="true"
          aria-hidden="true"
          onPointerDown={bindHandle(direction)}
          className={`absolute z-30 select-none ${className}`}
        />
      ))}

      {/* Angle inférieur droit avec indicateur visuel discret */}
      <div
        data-no-drag="true"
        aria-hidden="true"
        onPointerDown={bindHandle('SouthEast')}
        className="group/se absolute bottom-0 right-0 z-30 flex h-4 w-4 cursor-nwse-resize select-none items-end justify-end p-0.5"
      >
        <svg
          viewBox="0 0 10 10"
          className="h-2.5 w-2.5 text-fluent-muted/70 transition-colors duration-150 group-hover/se:text-fluent-ink"
          fill="none"
        >
          <path
            d="M8.5 2.5L2.5 8.5M8.5 5.75L5.75 8.5"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </>
  );
};
