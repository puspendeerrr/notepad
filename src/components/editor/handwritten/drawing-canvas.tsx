'use client';

import * as React from 'react';
import { useRef, useEffect, useState, useCallback } from 'react';
import {
  DrawingTool,
  ShapeType,
  EraserMode,
  NotebookPage,
  Stroke,
  CanvasShape,
  CanvasTextBox,
  PaperTemplate,
} from '@/types';

interface DrawingCanvasProps {
  page: NotebookPage;
  onChangePage: (page: NotebookPage) => void;
  currentTool: DrawingTool;
  currentColor: string;
  strokeWidth: number;
  eraserMode: EraserMode;
  currentShape: ShapeType;
  allowFingerDrawing: boolean;
  zoom: number;
  pan: { x: number; y: number };
  onUpdateTransform: (zoom: number, pan: { x: number; y: number }) => void;
  isDark?: boolean;
}

let canvasElementCounter = 0;
function getCanvasId(prefix: string): string {
  canvasElementCounter += 1;
  return `${prefix}-${canvasElementCounter}`;
}

// Compute infinite CSS background style based on template, pan, zoom, and theme
export function getInfiniteBackgroundStyle(
  template: PaperTemplate = 'dotgrid',
  isDark: boolean = false,
  pan: { x: number; y: number } = { x: 0, y: 0 },
  zoom: number = 1
): React.CSSProperties {
  const baseBg = isDark ? '#0b0c0e' : '#fafafa';
  const gridSize = Math.max(12, 28 * zoom);
  const offsetX = ((pan.x % gridSize) + gridSize) % gridSize;
  const offsetY = ((pan.y % gridSize) + gridSize) % gridSize;

  if (template === 'dotgrid') {
    const dotColor = isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.18)';
    const dotRadius = Math.max(0.8, Math.min(1.8, 1.2 * zoom));
    return {
      backgroundColor: baseBg,
      backgroundImage: `radial-gradient(circle, ${dotColor} ${dotRadius}px, transparent ${dotRadius}px)`,
      backgroundSize: `${gridSize}px ${gridSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  }

  if (template === 'grid') {
    const lineColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)';
    return {
      backgroundColor: baseBg,
      backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
      backgroundSize: `${gridSize}px ${gridSize}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`,
    };
  }

  if (template === 'ruled') {
    const lineColor = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.08)';
    const ruledSize = Math.max(16, 34 * zoom);
    const ruledOffsetY = ((pan.y % ruledSize) + ruledSize) % ruledSize;
    return {
      backgroundColor: baseBg,
      backgroundImage: `linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
      backgroundSize: `100% ${ruledSize}px`,
      backgroundPosition: `0px ${ruledOffsetY}px`,
    };
  }

  // Blank
  return {
    backgroundColor: baseBg,
  };
}

// Render vector stroke smoothly with zero dotted or beaded artifacts
export function renderSmoothStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  isDark = false
) {
  if (!stroke.points || stroke.points.length === 0) return;
  ctx.save();

  if (stroke.tool === 'highlighter') {
    ctx.globalAlpha = stroke.opacity || 0.35;
    ctx.globalCompositeOperation = isDark ? 'screen' : 'multiply';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (stroke.tool === 'pencil') {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  } else if (stroke.tool === 'marker') {
    ctx.globalAlpha = stroke.opacity || 0.85;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';
  } else {
    // Pen
    ctx.globalAlpha = stroke.opacity || 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // 1. Filter out redundant jitter points (< 1.2px)
  const raw = stroke.points;
  const pts: typeof raw = [raw[0]];
  for (let i = 1; i < raw.length; i++) {
    const prev = pts[pts.length - 1];
    const dx = raw[i].x - prev.x;
    const dy = raw[i].y - prev.y;
    if (dx * dx + dy * dy >= 1.44 || i === raw.length - 1) {
      pts.push(raw[i]);
    }
  }

  // Single point tap
  if (pts.length === 1) {
    const p = pts[0];
    const r = Math.max(1, (stroke.size * (p.pressure || 0.5)) / 2);
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Two points
  if (pts.length === 2) {
    const p1 = pts[0];
    const p2 = pts[1];
    const press = ((p1.pressure || 0.5) + (p2.pressure || 0.5)) / 2;
    ctx.lineWidth = Math.max(1, stroke.size * (0.4 + press * 0.85));
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // Calculate weighted pressure
  let totalPressure = 0;
  for (let i = 0; i < pts.length; i++) {
    totalPressure += pts[i].pressure || 0.5;
  }
  const avgPress = totalPressure / pts.length;

  // Single continuous Bezier spline stroke with zero intermediate joints or dots
  ctx.lineWidth = Math.max(1, stroke.size * (0.35 + avgPress * 0.95));
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.stroke();
  ctx.restore();
}

export function DrawingCanvas({
  page,
  onChangePage,
  currentTool,
  currentColor,
  strokeWidth,
  eraserMode,
  currentShape,
  allowFingerDrawing,
  zoom,
  pan,
  onUpdateTransform,
  isDark = false,
}: DrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Active drawing stroke / shape state
  const currentStrokeRef = useRef<Stroke | null>(null);
  const currentShapePreviewRef = useRef<CanvasShape | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [activeTextBoxId, setActiveTextBoxId] = useState<string | null>(null);

  // Spacebar pan tracking (Figma / Miro style)
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Multi-touch tracking for pinch-zoom and palm rejection
  const activePointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const pinchStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Track space key for click-to-pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (e.code === 'Space' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        setIsSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Convert client viewport screen coordinates to canvas world coordinates
  const clientToWorld = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      return {
        x: (screenX - pan.x) / zoom,
        y: (screenY - pan.y) / zoom,
      };
    },
    [pan, zoom]
  );

  // Full Redraw of Canvas in World Coordinates
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // 1. Device pixel ratio scaling for crisp retina rendering
    ctx.scale(dpr, dpr);

    // 2. Camera View Transform (Pan & Zoom)
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 3. Draw Images in World Coordinates
    page.images.forEach((imgItem) => {
      const img = new Image();
      img.src = imgItem.src;
      if (img.complete) {
        ctx.save();
        ctx.translate(imgItem.x + imgItem.width / 2, imgItem.y + imgItem.height / 2);
        if (imgItem.rotation) ctx.rotate((imgItem.rotation * Math.PI) / 180);
        ctx.drawImage(img, -imgItem.width / 2, -imgItem.height / 2, imgItem.width, imgItem.height);
        ctx.restore();
      }
    });

    // 4. Draw Vector Strokes in World Coordinates (Smooth Bezier Splines - No Dotted Artifacts)
    page.strokes.forEach((s) => renderSmoothStroke(ctx, s, isDark));

    // 5. Draw Shapes in World Coordinates
    const renderShape = (s: CanvasShape) => {
      ctx.save();
      ctx.strokeStyle = s.strokeColor;
      ctx.lineWidth = s.strokeWidth;
      ctx.globalAlpha = s.opacity || 1;

      if (s.type === 'rectangle') {
        ctx.strokeRect(s.x, s.y, s.width, s.height);
      } else if (s.type === 'circle') {
        const rx = Math.abs(s.width) / 2;
        const ry = Math.abs(s.height) / 2;
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.width, s.y + s.height);
        ctx.stroke();
      } else if (s.type === 'arrow') {
        const toX = s.x + s.width;
        const toY = s.y + s.height;
        const angle = Math.atan2(s.height, s.width);
        const headlen = 16;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(toX, toY);
        ctx.lineTo(
          toX - headlen * Math.cos(angle - Math.PI / 6),
          toY - headlen * Math.sin(angle - Math.PI / 6)
        );
        ctx.moveTo(toX, toY);
        ctx.lineTo(
          toX - headlen * Math.cos(angle + Math.PI / 6),
          toY - headlen * Math.sin(angle + Math.PI / 6)
        );
        ctx.stroke();
      }
      ctx.restore();
    };

    page.shapes.forEach((s) => renderShape(s));

    // 6. In-progress Live Stroke
    if (currentStrokeRef.current) {
      renderSmoothStroke(ctx, currentStrokeRef.current, isDark);
    }

    // 7. In-progress Live Shape Preview
    if (currentShapePreviewRef.current) {
      renderShape(currentShapePreviewRef.current);
    }

    // 8. In-progress Lasso Selection Path
    if (lassoPointsRef.current.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
      for (let i = 1; i < lassoPointsRef.current.length; i++) {
        ctx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 9. Selected Items Bounding Box
    if (selectedItemIds.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      page.strokes
        .filter((s) => selectedItemIds.includes(s.id))
        .forEach((s) => {
          s.points.forEach((p) => {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          });
        });

      page.shapes
        .filter((s) => selectedItemIds.includes(s.id))
        .forEach((s) => {
          minX = Math.min(minX, s.x, s.x + s.width);
          minY = Math.min(minY, s.y, s.y + s.height);
          maxX = Math.max(maxX, s.x, s.x + s.width);
          maxY = Math.max(maxY, s.y, s.y + s.height);
        });

      if (minX !== Infinity) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const pad = 8;
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        ctx.restore();
      }
    }

    ctx.restore();
  }, [page, pan, zoom, selectedItemIds, isDark]);

  // Sync canvas dimensions to fill 100% of viewport and handle orientation changes
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      const w = container.clientWidth;
      const h = container.clientHeight;

      if (w > 0 && h > 0) {
        const targetW = Math.round(w * dpr);
        const targetH = Math.round(h * dpr);
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }
      }
      redrawCanvas();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      ro = new ResizeObserver(() => handleResize());
      ro.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (ro) ro.disconnect();
    };
  }, [redrawCanvas]);

  // Trigger redraw on state change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Trackpad pinch-to-zoom & mouse wheel pan
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered at cursor position
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const nextZoom = Math.max(0.15, Math.min(4.0, Number((zoom * zoomFactor).toFixed(3))));

      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newPanX = mouseX - (mouseX - pan.x) * (nextZoom / zoom);
        const newPanY = mouseY - (mouseY - pan.y) * (nextZoom / zoom);
        onUpdateTransform(nextZoom, { x: newPanX, y: newPanY });
      }
    } else {
      // Two-finger trackpad scroll or mouse wheel pan
      onUpdateTransform(zoom, {
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY,
      });
    }
  };

  // Erase items around world point
  const eraseAtPoint = (pt: { x: number; y: number }) => {
    const threshold = (strokeWidth * 6) / zoom;

    if (eraserMode === 'stroke') {
      const filteredStrokes = page.strokes.filter((s) => {
        return !s.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold);
      });

      const filteredShapes = page.shapes.filter((s) => {
        const cx = s.x + s.width / 2;
        const cy = s.y + s.height / 2;
        return Math.hypot(cx - pt.x, cy - pt.y) > Math.max(s.width, s.height) / 2 + threshold;
      });

      if (filteredStrokes.length !== page.strokes.length || filteredShapes.length !== page.shapes.length) {
        onChangePage({
          ...page,
          strokes: filteredStrokes,
          shapes: filteredShapes,
        });
      }
    } else {
      const nextStrokes: Stroke[] = [];
      page.strokes.forEach((s) => {
        const remainingPoints = s.points.filter(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) >= threshold
        );
        if (remainingPoints.length > 1) {
          nextStrokes.push({ ...s, points: remainingPoints });
        }
      });
      onChangePage({
        ...page,
        strokes: nextStrokes,
      });
    }
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    activePointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
    });

    // 1. Two-finger pinch-to-zoom & pan initialization
    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartDistanceRef.current = dist;
      pinchStartZoomRef.current = zoom;
      pinchStartPanRef.current = { ...pan };
      currentStrokeRef.current = null;
      redrawCanvas();
      return;
    }

    // 2. Palm Rejection: If Apple Pencil is active, reject touch drawing
    const hasPenActive = Array.from(activePointersRef.current.values()).some((p) => p.type === 'pen');
    if (hasPenActive && e.pointerType === 'touch') {
      return;
    }

    // 3. Pan gestures (Space key, Hand tool, or Finger when finger drawing disabled)
    const isPanning =
      isSpacePressed ||
      currentTool === 'hand' ||
      (!allowFingerDrawing && e.pointerType === 'touch');

    if (isPanning) {
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const pt = clientToWorld(e.clientX, e.clientY);
    const rawPressure = e.pressure > 0 ? e.pressure : 0.5;

    // 4. Text Tool: Click to place text box at world point
    if (currentTool === 'text') {
      const newBox: CanvasTextBox = {
        id: getCanvasId('text'),
        x: pt.x,
        y: pt.y,
        width: 220,
        height: 60,
        text: 'Type text here…',
        fontSize: 18,
        fontFamily: 'sans-serif',
        color: currentColor,
      };
      onChangePage({
        ...page,
        textBoxes: [...page.textBoxes, newBox],
      });
      setActiveTextBoxId(newBox.id);
      return;
    }

    // 5. Eraser Tool
    if (currentTool === 'eraser') {
      eraseAtPoint(pt);
      return;
    }

    // 6. Lasso Tool
    if (currentTool === 'lasso') {
      setSelectedItemIds([]);
      lassoPointsRef.current = [{ x: pt.x, y: pt.y }];
      redrawCanvas();
      return;
    }

    // 7. Shape Tool
    if (currentTool === 'shape') {
      currentShapePreviewRef.current = {
        id: getCanvasId('shape'),
        type: currentShape,
        x: pt.x,
        y: pt.y,
        width: 0,
        height: 0,
        strokeColor: currentColor,
        strokeWidth,
        opacity: 1,
      };
      redrawCanvas();
      return;
    }

    // 8. Drawing Tools (Pen, Pencil, Marker, Highlighter)
    let toolOpacity = 1;
    if (currentTool === 'highlighter') toolOpacity = 0.38;
    else if (currentTool === 'marker') toolOpacity = 0.85;
    else if (currentTool === 'pencil') toolOpacity = 1;

    const strokeSize = currentTool === 'highlighter' ? strokeWidth * 2.5 : strokeWidth;

    currentStrokeRef.current = {
      id: getCanvasId('stroke'),
      tool: currentTool as 'pen' | 'pencil' | 'marker' | 'highlighter',
      color: currentColor,
      size: strokeSize,
      opacity: toolOpacity,
      points: [
        {
          x: pt.x,
          y: pt.y,
          pressure: rawPressure,
          tiltX: e.tiltX,
          tiltY: e.tiltY,
        },
      ],
    };

    redrawCanvas();
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;

    activePointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
    });

    // 1. Two-finger pinch-to-zoom & pan
    if (activePointersRef.current.size === 2 && pinchStartDistanceRef.current !== null) {
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const scaleDelta = currentDist / pinchStartDistanceRef.current;
      const nextZoom = Math.max(0.15, Math.min(4.0, Number((pinchStartZoomRef.current * scaleDelta).toFixed(3))));

      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      onUpdateTransform(nextZoom, {
        x: pinchStartPanRef.current.x + (midX - (pts[0].x + pts[1].x) / 2),
        y: pinchStartPanRef.current.y + (midY - (pts[0].y + pts[1].y) / 2),
      });
      return;
    }

    // 2. Pan Drag
    if (panStartRef.current) {
      onUpdateTransform(zoom, {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const pt = clientToWorld(e.clientX, e.clientY);

    // 3. Eraser continuous drag
    if (currentTool === 'eraser') {
      eraseAtPoint(pt);
      return;
    }

    // 4. Lasso selection path
    if (currentTool === 'lasso' && lassoPointsRef.current.length > 0) {
      lassoPointsRef.current.push({ x: pt.x, y: pt.y });
      redrawCanvas();
      return;
    }

    // 5. Shape live drag
    if (currentTool === 'shape' && currentShapePreviewRef.current) {
      const s = currentShapePreviewRef.current;
      s.width = pt.x - s.x;
      s.height = pt.y - s.y;
      redrawCanvas();
      return;
    }

    // 6. Apple Pencil / Pen Vector Drawing
    // Process sub-frame coalesced events for 120Hz/240Hz ProMotion smoothness
    if (currentStrokeRef.current) {
      const nativeEv = e.nativeEvent as unknown as { getCoalescedEvents?: () => PointerEvent[] };
      const coalescedEvents =
        typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : [e];

      coalescedEvents.forEach((ev: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
        const subPt = clientToWorld(ev.clientX, ev.clientY);
        const subPressure = ev.pressure > 0 ? ev.pressure : 0.5;

        const pts = currentStrokeRef.current?.points;
        if (pts && pts.length > 0) {
          const last = pts[pts.length - 1];
          const distSq = (subPt.x - last.x) ** 2 + (subPt.y - last.y) ** 2;
          if (distSq < 1.0) return; // Skip sub-pixel noise to prevent clustering
        }

        currentStrokeRef.current?.points.push({
          x: subPt.x,
          y: subPt.y,
          pressure: subPressure,
          tiltX: ev.tiltX,
          tiltY: ev.tiltY,
        });
      });

      redrawCanvas();
    }
  };

  // Pointer Up / Cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size < 2) {
      pinchStartDistanceRef.current = null;
    }

    if (panStartRef.current) {
      panStartRef.current = null;
    }

    // Save completed stroke
    if (currentStrokeRef.current) {
      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (stroke.points.length > 0) {
        onChangePage({
          ...page,
          strokes: [...page.strokes, stroke],
        });
      }
      redrawCanvas();
      return;
    }

    // Save completed shape
    if (currentShapePreviewRef.current) {
      const shape = currentShapePreviewRef.current;
      currentShapePreviewRef.current = null;
      if (Math.abs(shape.width) > 4 || Math.abs(shape.height) > 4) {
        onChangePage({
          ...page,
          shapes: [...page.shapes, shape],
        });
      }
      redrawCanvas();
      return;
    }

    // Complete Lasso Selection
    if (currentTool === 'lasso' && lassoPointsRef.current.length > 2) {
      const pts = lassoPointsRef.current;
      lassoPointsRef.current = [];

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      pts.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      });

      const selectedIds: string[] = [];
      page.strokes.forEach((s) => {
        const hasPointInBounds = s.points.some(
          (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY
        );
        if (hasPointInBounds) selectedIds.push(s.id);
      });

      page.shapes.forEach((s) => {
        if (s.x >= minX && s.x + s.width <= maxX && s.y >= minY && s.y + s.height <= maxY) {
          selectedIds.push(s.id);
        }
      });

      setSelectedItemIds(selectedIds);
      redrawCanvas();
    }
  };

  const bgStyle = getInfiniteBackgroundStyle(page.template || 'dotgrid', isDark, pan, zoom);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`relative w-full h-full overflow-hidden select-none touch-none ${
        isSpacePressed || currentTool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'
      }`}
      style={{
        touchAction: 'none',
        ...bgStyle,
      }}
    >
      {/* Full-Screen Infinite Drawing Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ touchAction: 'none' }}
      />

      {/* Floating World Text Boxes Overlay */}
      {page.textBoxes.map((tb) => (
        <div
          key={tb.id}
          style={{
            position: 'absolute',
            left: `${tb.x * zoom + pan.x}px`,
            top: `${tb.y * zoom + pan.y}px`,
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            color: tb.color,
            fontSize: `${tb.fontSize}px`,
            fontFamily: tb.fontFamily,
          }}
          className={`p-1 border border-dashed rounded cursor-text z-20 ${
            activeTextBoxId === tb.id
              ? 'border-indigo-500 bg-white/80 dark:bg-zinc-900/80 shadow-sm'
              : 'border-transparent hover:border-zinc-400'
          }`}
          onClick={() => setActiveTextBoxId(tb.id)}
        >
          <input
            type="text"
            defaultValue={tb.text}
            onBlur={(e) => {
              const nextBoxes = page.textBoxes.map((b) =>
                b.id === tb.id ? { ...b, text: e.target.value } : b
              );
              onChangePage({ ...page, textBoxes: nextBoxes });
            }}
            className="bg-transparent border-0 outline-none p-0 font-inherit text-inherit min-w-[120px]"
          />
        </div>
      ))}
    </div>
  );
}
