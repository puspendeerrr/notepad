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
} from '@/types';
import { PaperBackground } from './paper-background';

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

// Standard Notebook Page Virtual Resolution (A4 / iPad Pro aspect ratio)
export const VIRTUAL_WIDTH = 1000;
export const VIRTUAL_HEIGHT = 1414;

let canvasElementCounter = 0;
function getCanvasId(prefix: string): string {
  canvasElementCounter += 1;
  return `${prefix}-${canvasElementCounter}`;
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

  // Multi-touch tracking for pinch-zoom and palm rejection
  const activePointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const pinchStartPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  // Convert client viewport coordinates to canvas virtual coordinates (100% exact 1:1 mapping)
  const clientToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - rect.left) / rect.width) * VIRTUAL_WIDTH,
        y: ((clientY - rect.top) / rect.height) * VIRTUAL_HEIGHT,
      };
    },
    []
  );

  // Full Redraw of Canvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Device pixel ratio scaling for crisp retina rendering
    ctx.scale(dpr, dpr);

    // 1. Draw Images
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

    // 2. Draw Vector Strokes
    const renderStroke = (stroke: Stroke) => {
      if (!stroke.points || stroke.points.length === 0) return;
      ctx.save();

      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = stroke.opacity || 0.38;
        ctx.globalCompositeOperation = 'multiply';
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else if (stroke.tool === 'pencil') {
        ctx.globalAlpha = (stroke.opacity || 0.8) * 0.85;
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else if (stroke.tool === 'marker') {
        ctx.globalAlpha = stroke.opacity || 0.65;
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

      if (stroke.points.length === 1) {
        const p = stroke.points[0];
        const radius = Math.max(1, (stroke.size * (p.pressure || 0.5)) / 2);
        ctx.fillStyle = stroke.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      // Smooth Catmull-Rom or Quadratic Midpoint Bezier Curves
      for (let i = 0; i < stroke.points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];

        // Dynamic line width from Apple Pencil pressure
        const pressure1 = p1.pressure !== undefined && p1.pressure > 0 ? p1.pressure : 0.5;
        const pressure2 = p2.pressure !== undefined && p2.pressure > 0 ? p2.pressure : 0.5;
        const avgPressure = (pressure1 + pressure2) / 2;
        const currentWidth = Math.max(1, stroke.size * (0.4 + avgPressure * 0.9));

        ctx.lineWidth = currentWidth;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);

        if (i < stroke.points.length - 2) {
          const p3 = stroke.points[i + 2];
          const midX = (p2.x + p3.x) / 2;
          const midY = (p2.y + p3.y) / 2;
          ctx.quadraticCurveTo(p2.x, p2.y, midX, midY);
        } else {
          ctx.lineTo(p2.x, p2.y);
        }
        ctx.stroke();
      }

      ctx.restore();
    };

    page.strokes.forEach(renderStroke);

    // Active live stroke preview
    if (currentStrokeRef.current) {
      renderStroke(currentStrokeRef.current);
    }

    // 3. Draw Shapes
    const renderShape = (shape: CanvasShape) => {
      ctx.save();
      ctx.globalAlpha = shape.opacity || 1;
      ctx.strokeStyle = shape.strokeColor;
      ctx.lineWidth = shape.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.fillColor) {
        ctx.fillStyle = shape.fillColor;
      }

      if (shape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(shape.x, shape.y);
        ctx.lineTo(shape.x + shape.width, shape.y + shape.height);
        ctx.stroke();
      } else if (shape.type === 'arrow') {
        const fromX = shape.x;
        const fromY = shape.y;
        const toX = shape.x + shape.width;
        const toY = shape.y + shape.height;
        const headLen = Math.max(12, shape.strokeWidth * 3);
        const angle = Math.atan2(toY - fromY, toX - fromX);

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fillStyle = shape.strokeColor;
        ctx.fill();
      } else if (shape.type === 'rectangle') {
        ctx.beginPath();
        ctx.rect(shape.x, shape.y, shape.width, shape.height);
        if (shape.fillColor) ctx.fill();
        ctx.stroke();
      } else if (shape.type === 'circle') {
        const radiusX = Math.abs(shape.width / 2);
        const radiusY = Math.abs(shape.height / 2);
        const centerX = shape.x + shape.width / 2;
        const centerY = shape.y + shape.height / 2;

        ctx.beginPath();
        ctx.ellipse(centerX, centerY, Math.max(1, radiusX), Math.max(1, radiusY), 0, 0, Math.PI * 2);
        if (shape.fillColor) ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    };

    page.shapes.forEach(renderShape);

    // Active live shape preview
    if (currentShapePreviewRef.current) {
      renderShape(currentShapePreviewRef.current);
    }

    // 4. Draw Text Boxes
    page.textBoxes.forEach((tb) => {
      ctx.save();
      ctx.font = `${tb.fontSize || 16}px ${tb.fontFamily || 'sans-serif'}`;
      ctx.fillStyle = tb.color || '#09090b';
      const lines = tb.text.split('\n');
      lines.forEach((line, lineIdx) => {
        ctx.fillText(line, tb.x, tb.y + (lineIdx + 1) * (tb.fontSize * 1.25));
      });
      ctx.restore();
    });

    // 5. Draw Lasso Path Preview
    if (lassoPointsRef.current.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#4f46e5';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(lassoPointsRef.current[0].x, lassoPointsRef.current[0].y);
      for (let i = 1; i < lassoPointsRef.current.length; i++) {
        ctx.lineTo(lassoPointsRef.current[i].x, lassoPointsRef.current[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 6. Draw Selected Items Bounding Outline
    if (selectedItemIds.length > 0) {
      const selectedStrokes = page.strokes.filter((s) => selectedItemIds.includes(s.id));
      const selectedShapes = page.shapes.filter((s) => selectedItemIds.includes(s.id));

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      selectedStrokes.forEach((s) => {
        s.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
        });
      });

      selectedShapes.forEach((s) => {
        if (s.x < minX) minX = s.x;
        if (s.y < minY) minY = s.y;
        if (s.x + s.width > maxX) maxX = s.x + s.width;
        if (s.y + s.height > maxY) maxY = s.y + s.height;
      });

      if (minX !== Infinity) {
        ctx.save();
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const pad = 8;
        ctx.strokeRect(minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2);
        ctx.restore();
      }
    }

    ctx.restore();
  }, [page, selectedItemIds]);

  // Sync canvas dimensions with device pixel ratio
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = VIRTUAL_WIDTH * dpr;
    canvas.height = VIRTUAL_HEIGHT * dpr;

    redrawCanvas();
  }, [redrawCanvas]);

  // Trigger redraw when dependencies update
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Pointer Down (Draw / Pan / Lasso / Eraser)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Prevent default touch gestures (scrolling, zooming)
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

    // 2. Palm Rejection:
    // If user is drawing with Apple Pencil (pen), reject touches
    const hasPenActive = Array.from(activePointersRef.current.values()).some((p) => p.type === 'pen');
    if (hasPenActive && e.pointerType === 'touch') {
      return;
    }

    // If finger drawing is disabled and input is touch, treat as pan
    if (!allowFingerDrawing && e.pointerType === 'touch' && currentTool !== 'hand') {
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // 3. Hand / Pan tool
    if (currentTool === 'hand') {
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    const pt = clientToCanvas(e.clientX, e.clientY);
    const rawPressure = e.pressure > 0 ? e.pressure : e.pointerType === 'pen' ? 0.5 : 0.5;

    // 4. Text Tool: Click to place text box
    if (currentTool === 'text') {
      const newBox: CanvasTextBox = {
        id: getCanvasId('text'),
        x: pt.x,
        y: pt.y,
        width: 200,
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
    else if (currentTool === 'marker') toolOpacity = 0.65;
    else if (currentTool === 'pencil') toolOpacity = 0.85;

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

  // Erase stroke or object intersecting point
  const eraseAtPoint = (pt: { x: number; y: number }) => {
    const threshold = strokeWidth * 2.5;

    if (eraserMode === 'stroke') {
      // Whole-stroke eraser: remove entire stroke if clicked anywhere near it
      const filteredStrokes = page.strokes.filter((s) => {
        return !s.points.some(
          (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < threshold
        );
      });

      const filteredShapes = page.shapes.filter((s) => {
        return !(
          pt.x >= s.x - threshold &&
          pt.x <= s.x + s.width + threshold &&
          pt.y >= s.y - threshold &&
          pt.y <= s.y + s.height + threshold
        );
      });

      if (
        filteredStrokes.length !== page.strokes.length ||
        filteredShapes.length !== page.shapes.length
      ) {
        onChangePage({
          ...page,
          strokes: filteredStrokes,
          shapes: filteredShapes,
        });
      }
    } else {
      // Partial eraser: filter points along stroke
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

  // Pointer Move (Coalesced high-frequency Apple Pencil drawing & gestures)
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
      const nextZoom = Math.max(0.5, Math.min(3.5, pinchStartZoomRef.current * scaleDelta));

      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      onUpdateTransform(nextZoom, {
        x: pinchStartPanRef.current.x + (midX - (pts[0].x + pts[1].x) / 2),
        y: pinchStartPanRef.current.y + (midY - (pts[0].y + pts[1].y) / 2),
      });
      return;
    }

    // 2. Hand / Pan drag
    if (panStartRef.current) {
      onUpdateTransform(zoom, {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    const pt = clientToCanvas(e.clientX, e.clientY);

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
    // Process sub-frame coalesced events if available for 120Hz/240Hz ProMotion smoothness
    if (currentStrokeRef.current) {
      const nativeEv = e.nativeEvent as unknown as { getCoalescedEvents?: () => PointerEvent[] };
      const coalescedEvents =
        typeof nativeEv.getCoalescedEvents === 'function' ? nativeEv.getCoalescedEvents() : [e];

      coalescedEvents.forEach((ev: PointerEvent | React.PointerEvent<HTMLCanvasElement>) => {
        const subPt = clientToCanvas(ev.clientX, ev.clientY);
        const subPressure = ev.pressure > 0 ? ev.pressure : 0.5;

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
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (activePointersRef.current.size === 0) {
      pinchStartDistanceRef.current = null;
      panStartRef.current = null;
    }

    // 1. Finalize Drawing Stroke
    if (currentStrokeRef.current) {
      const finalStroke = currentStrokeRef.current;
      currentStrokeRef.current = null;

      if (finalStroke.points.length > 0) {
        onChangePage({
          ...page,
          strokes: [...page.strokes, finalStroke],
        });
      }
      redrawCanvas();
      return;
    }

    // 2. Finalize Shape
    if (currentShapePreviewRef.current) {
      const finalShape = currentShapePreviewRef.current;
      currentShapePreviewRef.current = null;

      if (Math.abs(finalShape.width) > 4 || Math.abs(finalShape.height) > 4) {
        onChangePage({
          ...page,
          shapes: [...page.shapes, finalShape],
        });
      }
      redrawCanvas();
      return;
    }

    // 3. Finalize Lasso Selection
    if (currentTool === 'lasso' && lassoPointsRef.current.length > 2) {
      const lasso = lassoPointsRef.current;
      lassoPointsRef.current = [];

      // Find strokes within lasso polygon bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      lasso.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex items-center justify-center select-none touch-none cursor-crosshair bg-zinc-100 dark:bg-[#0b0c0e]"
      style={{ touchAction: 'none' }}
    >
      {/* Paper Page Surface */}
      <div
        className="relative rounded-lg border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xl transition-transform"
        style={{
          width: `${VIRTUAL_WIDTH}px`,
          height: `${VIRTUAL_HEIGHT}px`,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Notebook Template Background */}
        <PaperBackground
          width={VIRTUAL_WIDTH}
          height={VIRTUAL_HEIGHT}
          template={page.template || (isDark ? 'dark' : 'ruled')}
          paperColor={page.paperColor}
          isDark={isDark}
        />

        {/* High-Performance Canvas */}
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
          style={{
            width: `${VIRTUAL_WIDTH}px`,
            height: `${VIRTUAL_HEIGHT}px`,
            touchAction: 'none',
          }}
        />

        {/* Text Boxes Overlay */}
        {page.textBoxes.map((tb) => (
          <div
            key={tb.id}
            style={{
              position: 'absolute',
              left: tb.x,
              top: tb.y,
              color: tb.color,
              fontSize: `${tb.fontSize}px`,
              fontFamily: tb.fontFamily,
            }}
            className={`p-1 border border-dashed rounded cursor-text ${
              activeTextBoxId === tb.id
                ? 'border-indigo-500'
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
              className="bg-transparent border-0 outline-none p-0 w-full font-inherit text-inherit"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
