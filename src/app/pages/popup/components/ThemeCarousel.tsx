import { ChevronLeft, ChevronRight } from "lucide-react";
import { themeAccent, themeIcon } from "./ThemeIdentityCard";

const CARD_SIZE = 56;
const CARD_GAP = 52;

export function ThemeCarousel({ themes, activeId, onSelect, accent }) {
  const n = themes.length;
  const idx = Math.max(0, themes.findIndex((t) => t.id === activeId));

  if (!activeId || n === 0) return null;

  return (
    <div className="relative flex flex-col items-center" role="region" aria-label="主题轮播">
      <div className="relative flex h-[76px] w-full items-center justify-center overflow-hidden">
        {themes.map((t, i) => {
          let raw = i - idx;
          if (raw > n / 2) raw -= n;
          if (raw < -n / 2) raw += n;
          if (Math.abs(raw) > 2) return null;
          const active = raw === 0;
          const tAccent = themeAccent(t.actionConfig);
          const CardIcon = t.icon ? themeIcon(t) : null;

          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              aria-label={`切换到 ${t.name}`}
              className="absolute flex shrink-0 flex-col items-center gap-1 transition-[transform,opacity] duration-300 ease-out"
              style={{
                opacity: active ? 1 : Math.abs(raw) === 1 ? 0.4 : 0.15,
                zIndex: active ? 10 : 1,
                transform: `perspective(320px) translateX(${raw * CARD_GAP}px) scale(${active ? 1 : 0.78}) rotateY(${raw * 22}deg)`,
              }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: CARD_SIZE,
                  height: CARD_SIZE,
                  ...(active
                    ? {
                        backgroundColor: `${tAccent}10`,
                        boxShadow: `0 0 0 1.5px ${tAccent}28, 0 4px 12px ${tAccent}12`,
                      }
                    : {
                        backgroundColor: "#f1f5f9",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                      }),
                }}
              >
                {CardIcon ? (
                  <CardIcon className="size-5" style={{ color: active ? tAccent : "#94a3b8" }} />
                ) : (
                  <span
                    className="text-base font-semibold"
                    style={{ color: active ? tAccent : "#94a3b8" }}
                  >
                    {t.name.length <= 2 ? t.name : t.name.slice(0, 2)}
                  </span>
                )}
              </div>
              <span
                className="text-xs font-semibold"
                style={{
                  color: active ? tAccent : "#cbd5e1",
                  opacity: active ? 1 : Math.abs(raw) <= 1 ? 0.6 : 0,
                }}
              >
                {t.name}
              </span>
            </button>
          );
        })}

        {n > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(themes[(idx - 1 + n) % n].id); }}
              aria-label="上一个主题"
              className="absolute left-0.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronLeft className="size-3.5 text-slate-500" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onSelect(themes[(idx + 1 + n) % n].id); }}
              aria-label="下一个主题"
              className="absolute right-0.5 z-10 flex size-7 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-slate-200 backdrop-blur-sm hover:bg-white active:scale-[0.95]"
            >
              <ChevronRight className="size-3.5 text-slate-500" />
            </button>
          </>
        )}
      </div>

      {n > 1 && (
        <div className="flex items-center gap-1 pt-1">
          {themes.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`第 ${i + 1} 个主题`}
              onClick={() => onSelect(themes[i].id)}
              className="rounded-full transition-[width,height,background-color,opacity] duration-300"
              style={{
                width: i === idx ? 6 : 3,
                height: i === idx ? 6 : 3,
                backgroundColor: i === idx ? accent : "#cbd5e1",
                opacity: i === idx ? 1 : 0.5,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
