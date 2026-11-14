import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { tipsFor } from "../lib/tips.js";

const Barsik3D = lazy(() => import("./Barsik3D.jsx"));
const KEY = "bsl-speedrun:helper";

/** Помощник по сайту: 3D-Барсик в углу с контекстной подсказкой для текущей страницы. */
export default function Helper() {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(KEY) === "off"; } catch { return false; } });
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const [nudge, setNudge] = useState(0);
  const seen = useRef(new Set());
  const tips = tipsFor(pathname);
  const group = tips[0];

  // новая страница — один раз показать первую подсказку
  useEffect(() => {
    setIdx(0);
    if (seen.current.has(group)) { setOpen(false); return undefined; }
    seen.current.add(group);
    const t = setTimeout(() => { setOpen(true); setNudge((n) => n + 1); }, 900);
    const c = setTimeout(() => setOpen(false), 9000);
    return () => { clearTimeout(t); clearTimeout(c); };
  }, [group]);

  const persist = (off) => { setHidden(off); try { localStorage.setItem(KEY, off ? "off" : "on"); } catch { /* */ } };
  if (hidden) return <button className="helper-show" onClick={() => persist(false)} title="Показать помощника Барсика" aria-label="Показать помощника">🐾</button>;

  const click = () => { setNudge((n) => n + 1); if (open) setIdx((i) => (i + 1) % tips.length); else setOpen(true); };
  return (
    <aside className="helper" aria-label="Помощник Барсик">
      {open && (
        <div className="helper-bubble" role="status">
          <p>{tips[idx % tips.length]}</p>
          <div className="helper-actions">
            {tips.length > 1 && <button onClick={() => setIdx((i) => (i + 1) % tips.length)}>Ещё совет ({(idx % tips.length) + 1}/{tips.length})</button>}
            <button onClick={() => setOpen(false)}>Понятно</button>
            <button onClick={() => persist(true)} title="Убрать помощника с экрана">Скрыть Барсика</button>
          </div>
        </div>
      )}
      <button className="helper-btn" onClick={click} aria-label="Подсказка от Барсика" aria-expanded={open} title="Нажми — подскажу">
        <Suspense fallback={<span className="helper-fallback">🐆</span>}><Barsik3D nudge={nudge} /></Suspense>
      </button>
    </aside>
  );
}
