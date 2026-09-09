'use client';

import * as React from 'react';
import { PaperTemplate } from '@/types';

interface PaperBackgroundProps {
  width: number;
  height: number;
  template: PaperTemplate;
  paperColor: string;
  isDark?: boolean;
}

export const PAPER_COLORS = [
  { label: 'White', value: '#ffffff', darkValue: '#18181b' },
  { label: 'Warm Cream', value: '#faf8f2', darkValue: '#1c1b18' },
  { label: 'Soft Yellow', value: '#fdfbe8', darkValue: '#242316' },
  { label: 'Cool Slate', value: '#f1f5f9', darkValue: '#0f172a' },
  { label: 'Pure Dark', value: '#09090b', darkValue: '#09090b' },
];

export function PaperBackground({
  width,
  height,
  template,
  paperColor,
  isDark = false,
}: PaperBackgroundProps) {
  // If in dark mode and paper is white/light, automatically use dark paper color (#121215)
  const isLightColor =
    !paperColor ||
    paperColor === '#ffffff' ||
    paperColor === '#faf8f2' ||
    paperColor === '#fdfbe8' ||
    paperColor === '#f1f5f9';

  const effectiveBgColor = isDark
    ? isLightColor
      ? '#121215'
      : paperColor
    : paperColor || '#ffffff';

  const isDarkPaper =
    effectiveBgColor === '#09090b' ||
    effectiveBgColor === '#121215' ||
    effectiveBgColor === '#18181b' ||
    effectiveBgColor === '#1c1b18' ||
    isDark;

  const lineColor = isDarkPaper ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)';
  const marginColor = isDarkPaper ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.2)';
  const dotColor = isDarkPaper ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.18)';

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 pointer-events-none select-none"
      style={{ backgroundColor: effectiveBgColor }}
    >
      <defs>
        {/* Ruled Pattern */}
        <pattern
          id="paper-ruled"
          width={width}
          height="34"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="34"
            x2={width}
            y2="34"
            stroke={lineColor}
            strokeWidth="1"
          />
        </pattern>

        {/* Grid Pattern */}
        <pattern
          id="paper-grid"
          width="26"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 26 0 L 0 0 0 26"
            fill="none"
            stroke={lineColor}
            strokeWidth="1"
          />
        </pattern>

        {/* Dot Grid Pattern */}
        <pattern
          id="paper-dotgrid"
          width="26"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="13" cy="13" r="1" fill={dotColor} />
        </pattern>
      </defs>

      {/* Render Template Patterns */}
      {template === 'ruled' && (
        <>
          <rect width={width} height={height} fill="url(#paper-ruled)" />
          {/* Notebook vertical left margin line */}
          <line
            x1="80"
            y1="0"
            x2="80"
            y2={height}
            stroke={marginColor}
            strokeWidth="1.5"
          />
        </>
      )}

      {template === 'grid' && (
        <rect width={width} height={height} fill="url(#paper-grid)" />
      )}

      {template === 'dotgrid' && (
        <rect width={width} height={height} fill="url(#paper-dotgrid)" />
      )}
    </svg>
  );
}
