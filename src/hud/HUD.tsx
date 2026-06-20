import { useState, useEffect } from 'react';
import { useNavigationStore } from '../stores/navigationStore';
import { useUIStore } from '../stores/uiStore';
import { useProximityStore } from '../stores/proximityStore';
import { formatRealDistance } from '../data/scaleConfig';
import { xrStore } from '../stores/xrStore';

/** Touch / small-screen devices: hide desktop-only chrome, shrink the HUD. */
function useIsMobile() {
  const compute = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820);
  const [mobile, setMobile] = useState(compute);
  useEffect(() => {
    const check = () => setMobile(compute());
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);
  return mobile;
}

const LABEL = {
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: 'rgba(0, 136, 255, 0.8)',
  marginBottom: 2,
  fontFamily: "'Orbitron', monospace",
};

export default function HUD() {
  const displaySpeed = useNavigationStore((s) => s.displaySpeed);
  const warpProgress = useNavigationStore((s) => s.warpProgress);
  const crosshairName = useNavigationStore((s) => s.crosshairName);
  const locationBreadcrumb = useUIStore((s) => s.locationBreadcrumb);
  const nearest = useProximityStore((s) => s.nearest);
  const mobile = useIsMobile();

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        fontFamily: "'Exo 2', 'Orbitron', system-ui, sans-serif",
        color: 'rgba(255, 255, 255, 0.9)',
        // Stop the HUD text (controls hint, readouts) from being selected when
        // dragging the joystick / panning on touch.
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {/* Top-left: Location breadcrumb — desktop only (declutters mobile top). */}
      {!mobile && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 24,
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0, 136, 255, 0.2)',
            borderRadius: 8,
            padding: '8px 16px',
          }}
        >
          <div style={LABEL}>Location</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{locationBreadcrumb}</div>
        </div>
      )}

      {/* Top-right: Speed indicator */}
      <div
        style={{
          position: 'absolute',
          top: mobile ? 10 : 20,
          right: mobile ? 12 : 24,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 136, 255, 0.2)',
          borderRadius: 8,
          padding: mobile ? '5px 10px' : '8px 16px',
          textAlign: 'right',
        }}
      >
        <div style={{ ...LABEL, fontSize: mobile ? 8 : 10, marginBottom: mobile ? 1 : 2 }}>
          Speed
        </div>
        <div
          style={{
            fontSize: mobile ? 13 : 18,
            fontWeight: 700,
            fontFamily: "'Orbitron', monospace",
            letterSpacing: '0.05em',
          }}
        >
          {displaySpeed || '0 m/s'}
        </div>
        {warpProgress > 0.02 && !mobile && (
          <div style={{ marginTop: 6 }}>
            <div
              style={{
                fontSize: 8,
                letterSpacing: '0.2em',
                color: 'rgba(0,180,255,0.8)',
                fontFamily: "'Orbitron', monospace",
                textAlign: 'right',
                marginBottom: 2,
              }}
            >
              WARP
            </div>
            <div
              style={{
                width: 90,
                height: 3,
                background: 'rgba(255,255,255,0.12)',
                borderRadius: 2,
                overflow: 'hidden',
                marginLeft: 'auto',
              }}
            >
              <div
                style={{
                  width: `${Math.round(warpProgress * 100)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, rgba(0,136,255,0.8), rgba(120,220,255,1))',
                  boxShadow: '0 0 8px rgba(0,180,255,0.8)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Top-left on mobile / top-center on desktop: Nearest body + distance */}
      {nearest && (
        <div
          style={{
            position: 'absolute',
            top: mobile ? 10 : 20,
            left: mobile ? 12 : '50%',
            transform: mobile ? 'none' : 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0, 136, 255, 0.3)',
            borderRadius: 8,
            padding: mobile ? '5px 10px' : '8px 20px',
            textAlign: mobile ? 'left' : 'center',
            minWidth: mobile ? 0 : 200,
            maxWidth: mobile ? '52vw' : undefined,
          }}
        >
          <div
            style={{
              ...LABEL,
              fontSize: mobile ? 8 : 10,
              marginBottom: mobile ? 1 : 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Nearest · {nearest.name}
          </div>
          <div
            style={{
              fontSize: mobile ? 13 : 16,
              fontWeight: 700,
              fontFamily: "'Orbitron', monospace",
              letterSpacing: '0.04em',
            }}
          >
            {formatRealDistance(nearest.distanceUnits)}
          </div>
        </div>
      )}

      {/* Bottom-center: Control buttons (VR hidden on mobile — WebXR VR is
          desktop/headset only). Smaller on mobile. */}
      <div
        style={{
          position: 'absolute',
          bottom: mobile ? 14 : 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        {[
          { label: 'SEARCH', icon: '🔍', onClick: () => useUIStore.getState().toggleSearch() },
          { label: 'TIME', icon: '⏱', onClick: () => useUIStore.getState().toggleTime() },
          ...(mobile ? [] : [{ label: 'VR', icon: '🥽', onClick: () => xrStore.enterVR() }]),
        ].map(({ label, icon, onClick }) => (
          <button
            key={label}
            onClick={(e) => {
              onClick();
              e.currentTarget.blur();
            }}
            style={{
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(0, 136, 255, 0.3)',
              borderRadius: 8,
              padding: mobile ? '6px 10px' : '8px 14px',
              color: 'rgba(255, 255, 255, 0.85)',
              fontSize: mobile ? 9 : 11,
              fontFamily: "'Orbitron', monospace",
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              minWidth: mobile ? 44 : 56,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 136, 255, 0.7)';
              e.currentTarget.style.background = 'rgba(0, 136, 255, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0, 136, 255, 0.3)';
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
            }}
          >
            <span style={{ fontSize: mobile ? 13 : 16 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Bottom-left: Controls hint — desktop only (irrelevant + selectable on touch). */}
      {!mobile && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            left: 24,
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.35)',
            lineHeight: 1.6,
          }}
        >
          <div>WASD — Move</div>
          <div>Mouse — Look</div>
          <div>Scroll — Speed</div>
          <div>Shift — Boost</div>
          <div>Click — Lock cursor</div>
          <div>Double-click — Fly to target</div>
        </div>
      )}

      {/* Crosshair / targeting scope — turns amber and names the locked body. */}
      {(() => {
        const locked = !!crosshairName;
        const ring = locked ? 'rgba(255, 190, 70, 0.95)' : 'rgba(0, 136, 255, 0.5)';
        const tick = locked ? 'rgba(255, 190, 70, 0.8)' : 'rgba(0, 136, 255, 0.4)';
        return (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ transition: 'all 0.15s' }}
            >
              <circle cx="12" cy="12" r={locked ? 5 : 3} stroke={ring} strokeWidth="0.6" />
              {locked && <circle cx="12" cy="12" r="0.8" fill={ring} />}
              <line x1="12" y1="3" x2="12" y2="8" stroke={tick} strokeWidth="0.6" />
              <line x1="12" y1="16" x2="12" y2="21" stroke={tick} strokeWidth="0.6" />
              <line x1="3" y1="12" x2="8" y2="12" stroke={tick} strokeWidth="0.6" />
              <line x1="16" y1="12" x2="21" y2="12" stroke={tick} strokeWidth="0.6" />
            </svg>
            {locked && (
              <div
                style={{
                  marginTop: 8,
                  padding: '3px 12px',
                  background: 'rgba(20, 12, 0, 0.55)',
                  border: '1px solid rgba(255, 190, 70, 0.5)',
                  borderRadius: 6,
                  color: 'rgba(255, 215, 150, 0.98)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontFamily: "'Orbitron', monospace",
                  whiteSpace: 'nowrap',
                  textShadow: '0 0 8px rgba(255,170,40,0.5)',
                }}
              >
                {crosshairName}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
