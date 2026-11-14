import { useSyncExternalStore } from "react";

// Фон: редкие жёлтые мыльные пузыри и жёлтые машинки. Чистый CSS, без JS-циклов; уважает prefers-reduced-motion.
const KEY = "bsl-speedrun:fx";
const subs = new Set();
export const fx = {
  enabled() { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } },
  set(on) { try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* */ } subs.forEach((f) => f()); },
};
const BUBBLES = [[6, 46, 26, 0], [17, 22, 34, 9], [29, 64, 30, 17], [43, 30, 38, 4], [57, 52, 28, 21], [69, 20, 36, 12], [81, 40, 32, 2], [92, 26, 40, 25]];

const Car = ({ kind }) => (
  <svg viewBox="0 0 120 50" width="96" height="40" aria-hidden="true">
    {kind === "van"
      ? <path d="M6 38 V14 Q6 8 12 8 H74 Q80 8 84 14 L98 26 H108 Q114 26 114 32 V38 Z" fill="#ffcc33" stroke="#b8860b" strokeWidth="2" />
      : <path d="M6 38 V28 Q6 24 12 24 H28 L40 10 Q42 8 46 8 H76 Q80 8 82 10 L94 24 H108 Q114 24 114 30 V38 Z" fill="#ffcc33" stroke="#b8860b" strokeWidth="2" />}
    {kind === "van" ? <path d="M70 14 H80 L92 26 H70 Z M14 14 H62 V26 H14 Z" fill="#fff8d6" /> : <path d="M44 13 H59 V24 H34 Z M64 13 H78 L88 24 H64 Z" fill="#fff8d6" />}
    {kind === "taxi" && <g><rect x="52" y="2" width="18" height="7" rx="2" fill="#1b1c1f" /><path d="M20 30 h80" stroke="#1b1c1f" strokeWidth="3" strokeDasharray="6 6" /></g>}
    <circle cx="32" cy="39" r="9" fill="#1b1c1f" /><circle cx="32" cy="39" r="4" fill="#bbb" /><circle cx="90" cy="39" r="9" fill="#1b1c1f" /><circle cx="90" cy="39" r="4" fill="#bbb" />
  </svg>
);

export default function BgFx() {
  const on = useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, fx.enabled, () => true);
  if (!on) return null;
  return (
    <div className="bgfx" aria-hidden="true">
      {BUBBLES.map(([left, size, dur, delay], i) => <i key={i} className="bubble-fx" style={{ left: `${left}%`, width: size, height: size, animationDuration: `${dur}s`, animationDelay: `-${delay}s` }} />)}
      <span className="car car-1"><Car kind="taxi" /></span>
      <span className="car car-2"><Car kind="van" /></span>
      <span className="car car-3"><Car kind="sedan" /></span>
    </div>
  );
}
