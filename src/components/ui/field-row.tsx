import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { FieldHint } from "./field-hint";

type SliderScrubHandler = (event: ReactPointerEvent<HTMLDivElement>) => void;

interface FieldSliderScrubContextValue {
  register: (handler: SliderScrubHandler | null) => () => void;
}

const FieldSliderScrubContext = createContext<FieldSliderScrubContextValue | null>(null);

/** Register a slider so its FieldRow label can act as a horizontal scrub handle. */
export function useFieldSliderScrub(handler: SliderScrubHandler | null): void {
  const context = useContext(FieldSliderScrubContext);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!context || !handlerRef.current) return undefined;
    return context.register((event) => handlerRef.current?.(event));
  }, [context]);
}

export function FieldRow({
  label,
  hint,
  tooltip,
  control,
}: {
  label: string;
  hint?: string;
  tooltip?: string;
  control: ReactNode;
}) {
  const scrubHandlerRef = useRef<SliderScrubHandler | null>(null);
  const [canScrub, setCanScrub] = useState(false);
  const scrubContext = useMemo<FieldSliderScrubContextValue>(() => ({
    register(handler) {
      scrubHandlerRef.current = handler;
      setCanScrub(Boolean(handler));
      return () => {
        if (scrubHandlerRef.current === handler) {
          scrubHandlerRef.current = null;
          setCanScrub(false);
        }
      };
    },
  }), []);

  return (
    <FieldSliderScrubContext.Provider value={scrubContext}>
      <div className="field-row grid min-w-0 gap-1.5 py-2">
        <div className="field-row-label">
          <div
            className={canScrub ? "flex cursor-ew-resize select-none items-center gap-1.5 text-xs font-medium text-slate-600" : "flex items-center gap-1.5 text-xs font-medium text-slate-600"}
            title={canScrub ? "左右拖动可微调数值" : undefined}
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("button")) return;
              scrubHandlerRef.current?.(event);
            }}
          >
            {label}
            {tooltip ? <FieldHint content={tooltip} /> : null}
          </div>
          {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
        </div>
        <div className="min-w-0">{control}</div>
      </div>
    </FieldSliderScrubContext.Provider>
  );
}
