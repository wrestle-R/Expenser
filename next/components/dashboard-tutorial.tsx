"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpenText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUserContext } from "@/context/UserContext";
import {
  DASHBOARD_TUTORIAL_REPLAY_EVENT,
  DASHBOARD_TUTORIAL_STEPS,
  getDashboardTutorialStep,
} from "@/lib/dashboard-tutorial";

type Placement = "top-start" | "bottom-end" | "right-start" | "left-start";

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const MOBILE_BREAKPOINT = 768;
const VIEWPORT_MARGIN = 12;
const CARD_GAP = 18;

function getStepPath(route: string) {
  return route.split("#")[0] ?? route;
}

function getStepHash(route: string) {
  const [, hash = ""] = route.split("#");
  return hash ? `#${hash}` : "";
}

function isRectOutsideViewport(rect: DOMRect) {
  return (
    rect.top < VIEWPORT_MARGIN ||
    rect.left < VIEWPORT_MARGIN ||
    rect.bottom > window.innerHeight - VIEWPORT_MARGIN ||
    rect.right > window.innerWidth - VIEWPORT_MARGIN
  );
}

function getArrowPlacement(placement: Placement) {
  switch (placement) {
    case "top-start":
      return "bottom";
    case "right-start":
      return "left";
    case "left-start":
      return "right";
    case "bottom-end":
    default:
      return "top";
  }
}

function getArrowClassName(placement: Placement) {
  switch (getArrowPlacement(placement)) {
    case "bottom":
      return "bottom-3 left-5";
    case "left":
      return "left-3 top-5";
    case "right":
      return "right-3 top-5";
    case "top":
    default:
      return "right-5 top-3";
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getCalloutPosition({
  placement,
  rect,
  width,
  height,
}: {
  placement: Placement;
  rect: RectState;
  width: number;
  height: number;
}) {
  let top = rect.top;
  let left = rect.left;

  switch (placement) {
    case "top-start":
      top = rect.top - height - CARD_GAP;
      left = rect.left;
      break;
    case "right-start":
      top = rect.top;
      left = rect.left + rect.width + CARD_GAP;
      break;
    case "left-start":
      top = rect.top;
      left = rect.left - width - CARD_GAP;
      break;
    case "bottom-end":
    default:
      top = rect.top + rect.height + CARD_GAP;
      left = rect.left + rect.width - width;
      break;
  }

  const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
  const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);

  return {
    top: clamp(top, VIEWPORT_MARGIN, maxTop),
    left: clamp(left, VIEWPORT_MARGIN, maxLeft),
  };
}

function shouldIgnoreKeyboardShortcut(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

export function replayDashboardTutorial() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(DASHBOARD_TUTORIAL_REPLAY_EVENT));
}

export function DashboardTutorial() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, authLoaded, isSignedIn, updateProfile } = useUserContext();
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<RectState | null>(null);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const [manualReplay, setManualReplay] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const step = useMemo(() => getDashboardTutorialStep(stepIndex), [stepIndex]);
  const isLastStep = stepIndex === DASHBOARD_TUTORIAL_STEPS.length - 1;
  const targetSelector = step ? `[data-tutorial-target="${step.targetId}"]` : null;
  const stepPath = step ? getStepPath(step.route) : null;
  const stepHash = step ? getStepHash(step.route) : "";

  const markTutorialCompleted = useCallback(() => {
    if (!profile || profile.dashboardTutorialCompleted) {
      return;
    }

    void updateProfile({ dashboardTutorialCompleted: true });
  }, [profile, updateProfile]);

  const closeTutorial = useCallback(
    (options?: { markComplete?: boolean }) => {
      if (options?.markComplete ?? true) {
        markTutorialCompleted();
      }
      setOpen(false);
      setManualReplay(false);
      setTargetRect(null);
    },
    [markTutorialCompleted]
  );

  const nextStep = useCallback(() => {
    if (isLastStep) {
      closeTutorial();
      return;
    }
    setStepIndex((current) => current + 1);
  }, [closeTutorial, isLastStep]);

  const previousStep = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const openFromReplay = useCallback(() => {
    setStepIndex(0);
    setManualReplay(true);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!authLoaded || loading || !isSignedIn || !profile || profile.dashboardTutorialCompleted) {
      return;
    }

    const openTimer = window.setTimeout(() => {
      setStepIndex(0);
      setOpen(true);
    }, 0);

    return () => {
      window.clearTimeout(openTimer);
    };
  }, [authLoaded, isSignedIn, loading, profile]);

  useEffect(() => {
    window.addEventListener(DASHBOARD_TUTORIAL_REPLAY_EVENT, openFromReplay);
    return () => {
      window.removeEventListener(DASHBOARD_TUTORIAL_REPLAY_EVENT, openFromReplay);
    };
  }, [openFromReplay]);

  useEffect(() => {
    if (!open || !step?.route || !stepPath) {
      return;
    }

    const currentHash = typeof window === "undefined" ? "" : window.location.hash;
    if (pathname === stepPath && currentHash === stepHash) {
      return;
    }

    router.push(step.route);
  }, [open, pathname, router, step?.route, stepHash, stepPath]);

  useEffect(() => {
    if (!open || !step || pathname !== stepPath || !targetSelector) {
      const resetTimer = window.setTimeout(() => {
        setTargetRect(null);
      }, 0);
      return () => {
        window.clearTimeout(resetTimer);
      };
    }

    if (typeof window === "undefined") {
      return;
    }

    let disposed = false;
    let frame = 0;
    let cleanupMeasure = () => {};

    const attachToTarget = (target: HTMLElement) => {
      const measure = () => {
        if (disposed) {
          return;
        }

        const rect = target.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      };

      const shouldScrollTarget =
        window.innerWidth < MOBILE_BREAKPOINT || isRectOutsideViewport(target.getBoundingClientRect());

      if (shouldScrollTarget) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }

      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      cleanupMeasure = () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
      };
    };

    const findTarget = (attempt = 0) => {
      const target = document.querySelector(targetSelector);
      if (target instanceof HTMLElement) {
        attachToTarget(target);
        return;
      }

      if (attempt < 30) {
        frame = window.requestAnimationFrame(() => findTarget(attempt + 1));
      } else {
        setTargetRect(null);
      }
    };

    findTarget();

    return () => {
      disposed = true;
      cleanupMeasure();
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [open, pathname, step, stepPath, targetSelector]);

  useEffect(() => {
    if (!open || !step || !targetRect || !cardRef.current) {
      return;
    }

    const width = cardRef.current.offsetWidth;
    const height = cardRef.current.offsetHeight;
    const placement = step.placement as Placement;

    setCardStyle(getCalloutPosition({ placement, rect: targetRect, width, height }));
  }, [open, step, targetRect]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreKeyboardShortcut(event.target)) {
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        nextStep();
      } else if (event.key === "Escape") {
        event.preventDefault();
        closeTutorial({ markComplete: !manualReplay || !profile?.dashboardTutorialCompleted });
      } else if (event.key === "ArrowLeft" && stepIndex > 0) {
        event.preventDefault();
        previousStep();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextStep();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    closeTutorial,
    manualReplay,
    nextStep,
    open,
    previousStep,
    profile?.dashboardTutorialCompleted,
    stepIndex,
  ]);

  if (!open || !step) {
    return null;
  }

  const isHero = step.layout === "hero";
  const tutorialCardClassName = isHero
    ? "w-[min(26rem,calc(100vw-1rem))] rounded-[1.6rem] border-white/10 bg-[#171717]/96 p-0 text-white shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
    : "w-[min(20rem,calc(100vw-1rem))] rounded-[1.35rem] border-white/10 bg-[#171717]/96 p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.48)]";
  const placement = step.placement as Placement;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/18" />

      {targetRect ? (
        <div
          aria-hidden="true"
          className="absolute rounded-[1.4rem] border border-emerald-400/75 shadow-[0_0_0_9999px_rgba(0,0,0,0.24)] transition-all duration-300"
          style={{
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
          }}
        />
      ) : null}

      <Card
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-tutorial-title"
        className={`pointer-events-auto fixed overflow-hidden border ${tutorialCardClassName}`}
        style={cardStyle}
      >
        <span
          aria-hidden="true"
          className={`absolute size-3.5 rotate-45 border border-white/10 bg-[#171717] ${getArrowClassName(placement)}`}
        />

        <div className="relative z-10">
          <div className={`flex items-start justify-between gap-3 ${isHero ? "px-4 pb-2 pt-4 sm:px-5" : "px-4 pb-2 pt-4"}`}>
            <div className="min-w-0">
              <div className="mb-2.5 flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-emerald-300 sm:text-[0.7rem]">
                <BookOpenText className="size-3.5" />
                <span>{step.eyebrow}</span>
              </div>
              <h2 id="dashboard-tutorial-title" className={`${isHero ? "text-[1.15rem] sm:text-[1.28rem]" : "text-base sm:text-lg"} pr-2 font-semibold tracking-tight text-white`}>
                {step.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => closeTutorial()}
              className="pointer-events-auto shrink-0 rounded-full px-1.5 py-1 text-sm font-medium text-white/80 transition hover:bg-white/8 hover:text-white"
            >
              Skip
            </button>
          </div>

          <div className={`${isHero ? "px-4 pb-4 sm:px-5" : "px-4 pb-4"} space-y-2.5`}>
            <p className={`${isHero ? "text-[0.92rem] leading-[1.35rem] sm:text-[0.97rem] sm:leading-6" : "text-sm leading-5"} text-white/92`}>
              {step.body}
            </p>
            {step.helper ? (
              <p className="text-[0.82rem] leading-5 text-white/65 sm:text-sm">{step.helper}</p>
            ) : null}
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {DASHBOARD_TUTORIAL_STEPS.map((item, index) => (
                  <span
                    key={item.id}
                    className={
                      index === stepIndex
                        ? "h-1.5 w-5 rounded-full bg-emerald-500"
                        : index < stepIndex
                          ? "h-1.5 w-3.5 rounded-full bg-white/45"
                          : "h-1.5 w-3.5 rounded-full bg-white/15"
                    }
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={previousStep}
                  disabled={stepIndex === 0}
                  className="h-9 w-9 bg-white/6 text-white hover:bg-white/12 hover:text-white disabled:bg-white/4 disabled:text-white/35"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  onClick={nextStep}
                  className="h-9 w-9 bg-emerald-500 text-white hover:bg-emerald-400"
                >
                  {isLastStep ? <X className="size-4" /> : <ArrowRight className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
