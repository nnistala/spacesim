import type React from 'react';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useJoystickStore } from '../stores/joystickStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vec2 {
  x: number;
  y: number;
}

interface SingleJoystickProps {
  /** Which side this joystick sits on. */
  side: 'left' | 'right';
  /** Callback with normalized -1..1 values. */
  onChange: (x: number, y: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Outer ring radius in CSS pixels. */
const OUTER_RADIUS = 64;

/** Inner thumb radius in CSS pixels. */
const THUMB_RADIUS = 26;

/** Dead zone — ignore deflections smaller than this fraction. */
const DEAD_ZONE = 0.1;

/** Spring-back animation duration in ms. */
const SPRING_DURATION = 120;

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function clampLength(v: Vec2, maxLen: number): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len <= maxLen) return v;
  const scale = maxLen / len;
  return { x: v.x * scale, y: v.y * scale };
}

// ---------------------------------------------------------------------------
// SingleJoystick — a reusable touch joystick component
// ---------------------------------------------------------------------------

function SingleJoystick({ side, onChange }: SingleJoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [thumbOffset, setThumbOffset] = useState<Vec2>({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  const centerRef = useRef<Vec2>({ x: 0, y: 0 });
  const animFrameRef = useRef<number>(0);

  const handleStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchIdRef.current !== null) return; // already tracking a finger
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      setActive(true);

      // Record center position as the initial touch point
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        centerRef.current = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }

      // Also compute initial offset from the center
      const dx = touch.clientX - centerRef.current.x;
      const dy = touch.clientY - centerRef.current.y;
      const clamped = clampLength({ x: dx, y: dy }, OUTER_RADIUS - THUMB_RADIUS);
      setThumbOffset(clamped);

      const nx = clamped.x / (OUTER_RADIUS - THUMB_RADIUS);
      const ny = -clamped.y / (OUTER_RADIUS - THUMB_RADIUS); // invert Y for "up is positive"
      onChange(
        Math.abs(nx) < DEAD_ZONE ? 0 : nx,
        Math.abs(ny) < DEAD_ZONE ? 0 : ny,
      );
    },
    [onChange],
  );

  const handleMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier !== touchIdRef.current) continue;

        const dx = touch.clientX - centerRef.current.x;
        const dy = touch.clientY - centerRef.current.y;
        const clamped = clampLength(
          { x: dx, y: dy },
          OUTER_RADIUS - THUMB_RADIUS,
        );
        setThumbOffset(clamped);

        const nx = clamped.x / (OUTER_RADIUS - THUMB_RADIUS);
        const ny = -clamped.y / (OUTER_RADIUS - THUMB_RADIUS);
        onChange(
          Math.abs(nx) < DEAD_ZONE ? 0 : nx,
          Math.abs(ny) < DEAD_ZONE ? 0 : ny,
        );
        break;
      }
    },
    [onChange],
  );

  const handleEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier !== touchIdRef.current) continue;
        touchIdRef.current = null;
        setActive(false);
        onChange(0, 0);

        // Animate spring-back
        const startOffset = { ...thumbOffset };
        const startTime = performance.now();

        const animate = (now: number) => {
          const elapsed = now - startTime;
          const t = Math.min(elapsed / SPRING_DURATION, 1);
          // Ease-out cubic
          const ease = 1 - Math.pow(1 - t, 3);
          setThumbOffset({
            x: startOffset.x * (1 - ease),
            y: startOffset.y * (1 - ease),
          });
          if (t < 1) {
            animFrameRef.current = requestAnimationFrame(animate);
          }
        };
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(animate);
        break;
      }
    },
    [onChange, thumbOffset],
  );

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const isLeft = side === 'left';

  return (
    <div
      ref={containerRef}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      style={{
        position: 'fixed',
        bottom: 40,
        left: isLeft ? 40 : undefined,
        right: isLeft ? undefined : 40,
        width: OUTER_RADIUS * 2,
        height: OUTER_RADIUS * 2,
        borderRadius: '50%',
        background: active
          ? 'radial-gradient(circle, rgba(100,160,255,0.18) 0%, rgba(100,160,255,0.08) 70%, transparent 100%)'
          : 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 70%, transparent 100%)',
        border: `1.5px solid ${active ? 'rgba(100,160,255,0.45)' : 'rgba(255,255,255,0.15)'}`,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        zIndex: 1000,
        transition: 'border-color 0.2s, background 0.2s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label={`${side} joystick`}
      role="slider"
      aria-valuemin={-1}
      aria-valuemax={1}
    >
      {/* Thumb */}
      <div
        style={{
          width: THUMB_RADIUS * 2,
          height: THUMB_RADIUS * 2,
          borderRadius: '50%',
          background: active
            ? 'radial-gradient(circle, rgba(130,180,255,0.65) 0%, rgba(100,160,255,0.35) 100%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.15) 100%)',
          border: `1px solid ${active ? 'rgba(130,180,255,0.7)' : 'rgba(255,255,255,0.25)'}`,
          transform: `translate(${thumbOffset.x}px, ${thumbOffset.y}px)`,
          transition: active ? 'none' : 'background 0.2s, border-color 0.2s',
          boxShadow: active
            ? '0 0 12px rgba(100,160,255,0.3)'
            : '0 0 6px rgba(255,255,255,0.1)',
          pointerEvents: 'none',
        }}
      />

      {/* Label */}
      <span
        style={{
          position: 'absolute',
          bottom: -22,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 10,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {isLeft ? 'Move' : 'Look'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Joystick — the exported wrapper that renders both joysticks
// ---------------------------------------------------------------------------

/**
 * Virtual dual-joystick overlay for mobile / touch devices.
 *
 * - Left joystick: movement (forward/back + strafe)
 * - Right joystick: look (pitch + yaw)
 *
 * Values are written to `joystickStore` so that `SpaceNavigator` can
 * read them each frame without extra coupling.
 *
 * The component only renders when the device supports touch input.
 */
export default function Joystick() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detect touch support
    const check =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches;
    setIsTouchDevice(check);
  }, []);

  const setMove = useJoystickStore((s) => s.setMove);
  const setLook = useJoystickStore((s) => s.setLook);

  const onMoveChange = useCallback(
    (x: number, y: number) => {
      setMove(x, y);
    },
    [setMove],
  );

  const onLookChange = useCallback(
    (x: number, y: number) => {
      setLook(x, y);
    },
    [setLook],
  );

  if (!isTouchDevice) return null;

  return (
    <>
      <SingleJoystick side="left" onChange={onMoveChange} />
      <SingleJoystick side="right" onChange={onLookChange} />
    </>
  );
}
