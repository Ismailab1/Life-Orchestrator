/**
 * DESIGN DECISION: Interactive Tutorial Overlay
 *
 * Implements a step-by-step onboarding tour with:
 * - SVG spotlight mask: dims everything except the target element
 * - Animated transitions: SVG hole and pulse ring slide smoothly between steps
 *   (no snap-to-center flicker). Old spotlight rect is kept during scroll+measure;
 *   only replaced once the new rect is ready.
 * - Auto-scroll: scrolls the target into view before computing its rect
 * - Dynamic card positioning: card floats beside the highlighted element using
 *   pixel coords throughout (enables CSS transition on top/left), flipping sides
 *   when space is tight
 * - Pulsing indigo ring: draws attention to the spotlit element
 * - Mobile-aware: step 3 (Calendar) falls back to center card + mobile description
 *   when viewport < 1024 px (sidebar is hidden on mobile)
 * - Backdrop click is intentionally inert — only the Skip button exits permanently
 *
 * Each Step declares a `targetId` matching a `data-tutorial="..."` attribute
 * placed on the relevant DOM element in App/ChatInterface/CareerInventory.
 */

import React, { useState, useEffect, useRef } from 'react';

interface Step {
  title: string;
  description: string;
  mobileDescription?: string;  // shown on mobile when sidebar/component is hidden
  targetId?: string;           // must match data-tutorial="..." on a DOM element
  cardSide?: 'right' | 'left' | 'above' | 'below' | 'center';
  spotPad?: number;            // per-step override for spotlight padding
}

interface SpotPos { top: number; left: number; width: number; height: number; }

interface Props {
  onComplete: () => void;
  onSkip: () => void;
  isDemo?: boolean;
}

const CARD_W  = 320;   // px — width of the tutorial card
const CARD_H  = 250;   // px — estimated card height for pixel-based centering
const S_PAD   = 12;    // px — default padding around the spotlight rect
const C_GAP   = 20;    // px — gap between spotlight edge and card
const EDGE    = 16;    // px — minimum distance from viewport edges
const SLIDE   = 0.42;  // s  — transition duration for spotlight + card

export const TutorialOverlay: React.FC<Props> = ({ onComplete, onSkip, isDemo = false }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [fadeIn, setFadeIn]           = useState(false);
  // spotPos is never cleared to null during a step change — the old rect stays
  // visible while the new one is being measured, enabling smooth slide.
  const [spotPos, setSpotPos]         = useState<SpotPos | null>(null);
  const [vp, setVp]                   = useState({ w: window.innerWidth, h: window.innerHeight });
  const scrollTimer                   = useRef<ReturnType<typeof setTimeout>>();
  const clearTimer                    = useRef<ReturnType<typeof setTimeout>>();

  const isMobile = vp.w < 1024;

  // Fade in on mount
  useEffect(() => { const t = setTimeout(() => setFadeIn(true), 30); return () => clearTimeout(t); }, []);

  // Track viewport size
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const steps: Step[] = [
    {
      title: isDemo ? 'Welcome to Demo Mode' : 'Welcome to Life Orchestrator',
      description: isDemo
        ? "You're in a sandbox pre-loaded with a realistic week of tasks, contacts, and AI memories. Interact naturally — say \"I just met with Alex\" and watch the Kinship Ledger update automatically. Nothing here is saved."
        : "Your personal AI life-agent powered by Gemini. It manages the tension between career momentum and real-world relationships — not just a calendar, but a reasoning partner that actively monitors your commitments and the people who matter.",
      cardSide: 'center',
    },
    {
      title: 'Kinship Ledger',
      description: "Tracks the health of every relationship with a priority score and last-contact timer. Contacts escalate from Stable → Needs Attention → Overdue → Critical as time passes. When you complete a task linked to a contact, the AI auto-logs a check-in for every person involved — even multi-person meetings.",
      targetId: 'kinship-ledger',
      cardSide: 'right',
    },
    {
      title: 'Life Inventory',
      description: "Tasks are Fixed (non-negotiable anchors) or Flexible (blocks the AI schedules optimally). Each task can link to one or more Kinship Ledger contacts — completing it auto-updates all their check-in timers. Task cards show the linked contact's avatar, category badge, and priority indicator at a glance.",
      targetId: 'life-inventory',
      cardSide: 'right',
    },
    {
      title: 'Calendar Sidebar',
      description: "The calendar lives persistently beside the chat. Hover any day to see a rich task preview — times, durations, categories, and priorities. Click a day to put the AI into Reflection (past), Active (today), or Planning (future) mode; its tone and tool behavior adapt automatically.",
      mobileDescription: "On desktop, the calendar sits as a persistent sidebar beside the chat. On mobile, tap the calendar icon in the header to access it. Hover or tap any day to preview tasks — click to switch between Reflection, Active, and Planning modes.",
      targetId: 'calendar-sidebar',
      cardSide: 'left',
    },
    {
      title: 'Natural Language Updates',
      description: "Just talk. \"I grabbed coffee with Sarah\" logs a check-in. \"Move my gym session to Thursday\" reschedules it. \"Add a dentist appointment Friday at 2pm\" creates a task. The AI always calls the right tool behind the scenes — you never need to tap a form.",
      targetId: 'chat-input',
      cardSide: 'above',
    },
    {
      title: 'Orchestrate My Day',
      description: "Hit \"Orchestrate Day\" and the AI reads your full inventory, relationship ledger, and learned preferences to propose an optimized schedule — with relationship check-ins woven in. Accept it to lock the plan, or keep editing. Connect Google Calendar to import real meetings and export the final schedule back with one click.",
      targetId: 'orchestrate-btn',
      cardSide: 'right',
      spotPad: 20,  // wider spotlight — the button is small
    },
  ];

  // When step changes: scroll target into view, then measure its rect.
  // We do NOT clear spotPos here — the old spotlight stays visible during
  // the scroll+measure delay, so the mask slides rather than snapping to center.
  useEffect(() => {
    clearTimeout(scrollTimer.current);
    clearTimeout(clearTimer.current);

    const step = steps[currentStep];
    const { targetId } = step;

    // Center steps (no target, or mobile hiding the target): fade out spotlight
    const isCalendarOnMobile = targetId === 'calendar-sidebar' && isMobile;
    if (!targetId || isCalendarOnMobile) {
      clearTimer.current = setTimeout(() => setSpotPos(null), 200);
      return;
    }

    const el = document.querySelector(`[data-tutorial="${targetId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    scrollTimer.current = setTimeout(() => {
      const el2 = document.querySelector(`[data-tutorial="${targetId}"]`);
      if (!el2) { setSpotPos(null); return; }
      const r = el2.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setSpotPos({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setSpotPos(null);
      }
    }, 420);

    return () => { clearTimeout(scrollTimer.current); clearTimeout(clearTimer.current); };
  }, [currentStep, isMobile]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(p => p + 1);
    else onComplete();
  };

  const step = steps[currentStep];
  const { w: vw, h: vh } = vp;
  const pad = step.spotPad ?? S_PAD;

  // SVG mask hole values (use spotPos, not a cleared null)
  const sx = spotPos ? spotPos.left  - pad : vw / 2 - 1;
  const sy = spotPos ? spotPos.top   - pad : vh / 2 - 1;
  const sw = spotPos ? spotPos.width  + pad * 2 : 2;
  const sh = spotPos ? spotPos.height + pad * 2 : 2;

  // Description — swap for mobile on the calendar step
  const isCalendarOnMobile = step.targetId === 'calendar-sidebar' && isMobile;
  const description = (isCalendarOnMobile && step.mobileDescription) ? step.mobileDescription : step.description;

  // Compute the card's fixed position using pixel coords throughout.
  // This allows a CSS transition on `top` and `left` to animate the card between steps.
  const getCardStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      width: CARD_W,
      maxWidth: `calc(100vw - ${EDGE * 2}px)`,
      zIndex: 152,
      transition: `top ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), left ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94)`,
    };

    const clampT = (t: number) => Math.max(EDGE, Math.min(t, vh - CARD_H - EDGE));
    const clampL = (l: number) => Math.max(EDGE, Math.min(l, vw - CARD_W - EDGE));
    const centerTop  = clampT(Math.round(vh / 2 - CARD_H / 2));
    const centerLeft = clampL(Math.round(vw / 2 - CARD_W / 2));

    if (!spotPos || step.cardSide === 'center' || isCalendarOnMobile) {
      return { ...base, top: centerTop, left: centerLeft };
    }

    const { top, left, width, height } = spotPos;

    if (step.cardSide === 'right') {
      let cl = left + width + pad + C_GAP;
      if (cl + CARD_W > vw - EDGE) cl = left - pad - C_GAP - CARD_W; // flip left
      return { ...base, top: clampT(top), left: clampL(cl) };
    }
    if (step.cardSide === 'left') {
      let cl = left - pad - C_GAP - CARD_W;
      if (cl < EDGE) cl = left + width + pad + C_GAP; // flip right
      return { ...base, top: clampT(top), left: clampL(cl) };
    }
    if (step.cardSide === 'above') {
      const cardBottom = top - pad - C_GAP - 48; // extra clearance so card clears the chat input
      const ct = clampT(cardBottom - CARD_H);
      return { ...base, top: ct, left: clampL(left) };
    }
    // below
    return { ...base, top: clampT(top + height + pad + C_GAP), left: clampL(left) };
  };

  const spotTransition = `x ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), y ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), width ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), height ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94)`;

  return (
    <div className={`fixed inset-0 z-[150] transition-opacity duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>

      {/* ── Backdrop + SVG spotlight hole ────────────────────────────── */}
      {/* onClick intentionally absent — backdrop click does nothing.
          Only the Skip button inside the card triggers a permanent exit. */}
      {spotPos ? (
        <svg
          className="absolute inset-0"
          style={{ pointerEvents: 'none' }}
          width={vw} height={vh}
        >
          <defs>
            <mask id="tut-spotlight" maskUnits="userSpaceOnUse">
              <rect x={0} y={0} width={vw} height={vh} fill="white" />
              {/* Animated hole — transitions slide it to the new position */}
              <rect
                x={sx} y={sy} width={sw} height={sh} rx={14} fill="black"
                style={{ transition: spotTransition }}
              />
            </mask>
          </defs>
          <rect x={0} y={0} width={vw} height={vh} fill="rgba(15,23,42,0.65)" mask="url(#tut-spotlight)" />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] pointer-events-none" />
      )}

      {/* ── Pulsing highlight ring around target ─────────────────────── */}
      {spotPos && (
        <div
          className="pointer-events-none"
          style={{
            position: 'fixed',
            top: sy, left: sx, width: sw, height: sh,
            borderRadius: pad + 4,
            boxShadow: '0 0 0 2.5px #6366f1, 0 0 0 6px rgba(99,102,241,0.28), 0 0 28px 8px rgba(99,102,241,0.15)',
            zIndex: 151,
            animation: 'pulse 2s ease-in-out infinite',
            transition: `top ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), left ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), width ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94), height ${SLIDE}s cubic-bezier(0.25,0.46,0.45,0.94)`,
          }}
        />
      )}

      {/* ── Tutorial card ─────────────────────────────────────────────── */}
      <div
        className="pointer-events-auto bg-white text-slate-800 p-6 rounded-2xl shadow-2xl border-2 border-indigo-200 ring-4 ring-indigo-500/20"
        style={getCardStyle()}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
              {currentStep + 1}
            </span>
            <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
          </div>
          <button onClick={onSkip} className="text-slate-400 hover:text-slate-600 text-xs font-medium uppercase tracking-wider">
            Skip
          </button>
        </div>

        <p className="text-slate-600 mb-6 leading-relaxed text-sm">{description}</p>

        <div className="flex justify-between items-center">
          <div className="flex space-x-1">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-200 hover:bg-slate-300'}`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/30"
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};
