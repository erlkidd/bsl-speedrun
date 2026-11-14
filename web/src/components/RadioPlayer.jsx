import { useEffect, useRef, useState } from "react";
import { bump } from "../lib/store.js";

// Вещание lo-fi / chill радиостанций. Если первая недоступна, плеер сам переходит к следующей.
// Список можно поменять здесь: нужен прямой HTTPS-адрес потока (mp3/aac).
export const STATIONS = [
  { name: "Lofi · laut.fm", url: "https://stream.laut.fm/lofi" },
  { name: "Groove Salad · SomaFM", url: "https://ice1.somafm.com/groovesalad-128-mp3" },
  { name: "Fluid · SomaFM", url: "https://ice1.somafm.com/fluid-128-mp3" },
];
const KEY = "bsl-speedrun:radio-volume";

/** Мини-плеер: только пауза/воспроизведение и громкость. */
export default function RadioPlayer({ pinned = true }) {
  const audio = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [station, setStation] = useState(0);
  const [volume, setVolume] = useState(() => { try { const v = parseFloat(localStorage.getItem(KEY)); return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.4; } catch { return 0.4; } });
  const [open, setOpen] = useState(false); // для касаний: открыть по нажатию на «ноту»
  const wanted = useRef(false);
  const cur = useRef(0);

  useEffect(() => { if (audio.current) audio.current.volume = volume; try { localStorage.setItem(KEY, String(volume)); } catch { /* */ } }, [volume]);
  useEffect(() => () => { const a = audio.current; if (a) { a.pause(); a.removeAttribute("src"); a.load(); } }, []);

  function start(i) {
    let a = audio.current;
    if (!a) {
      a = audio.current = new Audio();
      a.preload = "none";
      a.addEventListener("playing", () => { setLoading(false); setPlaying(true); setFailed(false); });
      a.addEventListener("waiting", () => setLoading(true));
      a.addEventListener("pause", () => setPlaying(false));
      a.addEventListener("error", () => { if (wanted.current) next(); });
    }
    a.volume = volume;
    a.src = STATIONS[i].url;
    cur.current = i; setStation(i); setLoading(true);
    a.play().catch(() => { if (wanted.current) next(); });
  }
  const tried = useRef(0);
  function next() {
    tried.current += 1;
    if (tried.current >= STATIONS.length) { wanted.current = false; setLoading(false); setPlaying(false); setFailed(true); return; }
    start((cur.current + 1) % STATIONS.length);
  }
  function toggle() {
    const a = audio.current;
    if (playing || loading) { wanted.current = false; a?.pause(); if (a) { a.removeAttribute("src"); a.load(); } setLoading(false); setPlaying(false); return; } // поток не буферизуем на паузе
    wanted.current = true; tried.current = 0; setFailed(false);
    start(cur.current);
    bump("radio");
  }

  const active = playing || loading;
  return (
    // на главной плеер виден всегда; на остальных страницах прячется и выезжает при наведении на левый нижний угол
    <div className={`radio-zone ${pinned ? "pinned" : ""} ${open ? "open" : ""}`} onMouseLeave={() => setOpen(false)}>
      {!pinned && <button className={`radio-peek ${active ? "on" : ""}`} onClick={() => setOpen((o) => !o)} aria-label="Показать плеер радио" aria-expanded={open} title="Радио lo-fi">♪</button>}
      <div className={`radio ${playing ? "on" : ""}`} role="group" aria-label="Радио lo-fi">
        <button className="radio-btn" onClick={toggle} aria-label={active ? "Пауза" : "Включить радио"} title={active ? "Пауза" : "Включить lo-fi радио"}>
          {active ? <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg> : <svg viewBox="0 0 24 24" width="18" height="18"><path d="M7 4l13 8-13 8z" /></svg>}
        </button>
        <div className="radio-info">
          <b>lo-fi радио {playing && <span className="eq" aria-hidden="true"><i /><i /><i /></span>}</b>
          <small aria-live="polite">{failed ? "станции недоступны, попробуй позже" : loading ? "подключаюсь…" : playing ? STATIONS[station].name : "музыка для фокуса"}</small>
        </div>
        <label className="radio-volume" title={`Громкость ${Math.round(volume * 100)}%`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9z" />{volume > 0.02 && <path d="M15 9.5a3.5 3.5 0 0 1 0 5" fill="none" strokeWidth="2" strokeLinecap="round" />}{volume > 0.5 && <path d="M17.5 7a7 7 0 0 1 0 10" fill="none" strokeWidth="2" strokeLinecap="round" />}</svg>
          <input className="radio-vol" type="range" min="0" max="1" step="0.02" value={volume} style={{ "--v": `${volume * 100}%` }} onChange={(e) => setVolume(+e.target.value)} aria-label="Громкость" />
          <output>{Math.round(volume * 100)}</output>
        </label>
      </div>
    </div>
  );
}
