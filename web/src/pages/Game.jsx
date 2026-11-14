import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chapters } from "../game/levels.js";
import { Barsik, Pig, Heart, StarRow } from "../game/sprites.jsx";
import { progress, useStore } from "../lib/store.js";
import { run, checkAnswer, fillTemplate } from "../lib/q1c/check.js";
import QueryEditor from "../components/QueryEditor.jsx";
import { BatchResult } from "../components/ResultSheet.jsx";
import Markdown from "../components/Markdown.jsx";
import { QueryCode } from "./Queries.jsx";
import { highlightQuery } from "../lib/q1c/highlight.js";

const TYPE = { order: "Собери запрос", fill: "Заполни пропуски", read: "Прочитай запрос", write: "Напиши запрос", fix: "Почини запрос" };
const unlocked = {
  chapter: (i, bosses) => i === 0 || bosses.has(chapters[i - 1].boss.id),
  level: (c, j, game) => j === 0 || !!game[c.levels[j - 1].id],
  boss: (c, game) => c.levels.every((l) => game[l.id]),
};
function seeded(list, seed) {
  let h = 0; for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const r = list.map((x, i) => i);
  for (let i = r.length - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; const j = h % (i + 1); [r[i], r[j]] = [r[j], r[i]]; }
  if (r.every((x, i) => x === i) && r.length > 1) r.push(r.shift());
  return r.map((i) => list[i]);
}

export default function Game() {
  const { chapter, level } = useParams();
  useStore();
  const c = chapters.find((x) => x.id === chapter);
  if (!chapter) return <GameMap />;
  if (!c) return <div className="page"><h1>Такой главы нет</h1><Link to="/game">К карте</Link></div>;
  if (!level) return <Chapter c={c} />;
  if (level === "boss") return <BossFight key={c.id} c={c} />;
  const l = c.levels.find((x) => x.id === level);
  if (!l) return <div className="page"><h1>Такого уровня нет</h1><Link to={`/game/${c.id}`}>К главе</Link></div>;
  return <LevelPlay key={l.id} c={c} level={l} />;
}

function GameMap() {
  const d = progress.get(); const bosses = progress.bosses();
  const current = chapters.findIndex((c, i) => unlocked.chapter(i, bosses) && !bosses.has(c.boss.id));
  return (
    <div className="page game">
      <div className="game-hero">
        <Barsik size={130} pose={bosses.size === chapters.length ? "win" : "idle"} />
        <div>
          <p className="eyebrow">мини-игра</p>
          <h1>Барсик против Пятачков</h1>
          <p className="lead">Злые хрюшки захватили базу «Барсик-Трейд». Оружие Барсика — язык запросов 1С: каждая тема заканчивается боссом, которого можно победить только правильными запросами.</p>
        </div>
      </div>
      <ol className="gmap">
        {chapters.map((c, i) => {
          const open = unlocked.chapter(i, bosses); const done = bosses.has(c.boss.id);
          const stars = [...c.levels, ...c.boss.phases].reduce((s, l) => s + (d.game[l.id] ?? 0), 0);
          const body = (
            <>
              <span className="gmap-n" style={{ background: c.color }}>{done ? "✓" : i + 1}</span>
              <span className="gmap-t"><b>{c.title}</b><small>{c.topic}</small></span>
              <span className="gmap-s"><StarRow n={Math.round(stars / 6)} /> <small>{stars}/18</small></span>
              <Pig skin={c.boss.skin} color={c.color} size={64} state={done ? "dead" : "idle"} title={c.boss.name} />
              {i === current && <span className="gmap-here">ты здесь</span>}
            </>
          );
          return <li key={c.id} className={`gmap-item ${open ? "" : "locked"} ${done ? "done" : ""}`}>{open ? <Link to={`/game/${c.id}`}>{body}</Link> : <div aria-disabled="true" title="Сначала победи босса предыдущей темы">{body}<span className="gmap-lock">🔒 победи предыдущего босса</span></div>}</li>;
        })}
      </ol>
    </div>
  );
}

function Chapter({ c }) {
  const d = progress.get(); const bosses = progress.bosses();
  const i = chapters.indexOf(c);
  if (!unlocked.chapter(i, bosses)) return <div className="page"><h1>Глава ещё закрыта</h1><p>Сначала победи босса предыдущей темы.</p><Link className="btn" to="/game">← К карте</Link></div>;
  const bossOpen = unlocked.boss(c, d.game); const bossDone = bosses.has(c.boss.id);
  return (
    <div className="page game">
      <Link to="/game" className="muted">← Карта</Link>
      <h1 style={{ marginTop: 8 }}>{c.title}</h1>
      <p className="lead">{c.intro}</p>
      <p className="small muted">Тема: {c.topic}. {c.kb && <Link to={`/kb/${c.kb}`}>Шпаргалка в базе знаний →</Link>}</p>
      <div className="lvl-grid">
        {c.levels.map((l, j) => {
          const open = unlocked.level(c, j, d.game);
          const inner = <><span className="lvl-n">{j + 1}</span><b>{l.title}</b><small>{TYPE[l.type]}</small><StarRow n={d.game[l.id] ?? 0} /></>;
          return open ? <Link key={l.id} className="lvl" to={`/game/${c.id}/${l.id}`}>{inner}</Link> : <div key={l.id} className="lvl locked">{inner}</div>;
        })}
        {bossOpen
          ? <Link className={`lvl boss ${bossDone ? "done" : ""}`} to={`/game/${c.id}/boss`}><Pig skin={c.boss.skin} color={c.color} size={74} state={bossDone ? "dead" : "idle"} /><b>Босс: {c.boss.name}</b><small>{bossDone ? "повержен — можно переиграть" : "3 раунда, 3 жизни"}</small></Link>
          : <div className="lvl boss locked"><Pig skin={c.boss.skin} color={c.color} size={74} /><b>Босс: {c.boss.name}</b><small>🔒 пройди все уровни темы</small></div>}
      </div>
    </div>
  );
}

/** Головоломка любого типа. onResult(ok, {hintUsed}) вызывается после каждой проверки. */
function Puzzle({ spec, onResult, locked, attackLabel = "Проверить" }) {
  const [text, setText] = useState(spec.starter ?? "");
  const [order, setOrder] = useState(() => (spec.type === "order" ? seeded(spec.lines.map((line, id) => ({ line, id })), spec.id) : []));
  const [slots, setSlots] = useState(() => (spec.type === "fill" ? spec.answers.map(() => null) : []));
  const chips = useMemo(() => (spec.type === "fill" ? seeded([...spec.answers, ...spec.pool], spec.id + "c") : []), [spec]);
  const [picked, setPicked] = useState(null);
  const [res, setRes] = useState(null);
  const [hint, setHint] = useState(false);
  const solved = res?.ok;
  const busy = locked || solved;

  const answerText = () => (spec.type === "order" ? order.map((x) => x.line).join("\n") : spec.type === "fill" ? fillTemplate(spec.template, slots.map((s) => (s === null ? "" : chips[s]))) : text);
  function check() {
    if (busy) return;
    let r;
    if (spec.type === "read") {
      if (picked === null) return;
      r = { ok: picked === spec.correct, why: picked === spec.correct ? "" : "Неверно. Перечитай запрос по разделам: откуда берём, как отбираем, как сворачиваем." };
      const ex = run(spec.query, spec.params); if (ex.ok) r.exec = ex.exec;
    } else {
      if (spec.type === "fill" && slots.includes(null)) { setRes({ ok: false, why: "Заполни все пропуски.", soft: true }); return; }
      r = checkAnswer(spec, answerText());
    }
    setRes(r);
    onResult(r.ok, { hintUsed: hint });
  }
  const justRun = () => { const r = run(answerText(), spec.params); setRes(r.ok ? { exec: r.exec, soft: true, ok: false, why: "" } : { ok: false, error: r.error, why: `Ошибка в строке ${r.error.line}: ${r.error.message}`, soft: true }); };
  const move = (i, d) => setOrder((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const drag = useRef(null);

  return (
    <div className="puzzle">
      <div className="puzzle-kind">{TYPE[spec.type]}</div>
      {spec.type === "order" && (
        <ol className="order">
          {order.map((x, i) => (
            <li key={x.id} draggable={!busy} onDragStart={() => { drag.current = i; }} onDragOver={(e) => e.preventDefault()}
              onDrop={() => { const from = drag.current; if (from === null || from === i) return; setOrder((o) => { const n = [...o]; const [it] = n.splice(from, 1); n.splice(i, 0, it); return n; }); drag.current = null; }}>
              <code dangerouslySetInnerHTML={{ __html: highlightQuery(x.line) || "&nbsp;" }} />
              <span className="order-btns"><button onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label="Выше">▲</button><button onClick={() => move(i, 1)} disabled={busy || i === order.length - 1} aria-label="Ниже">▼</button></span>
            </li>
          ))}
        </ol>
      )}
      {spec.type === "fill" && (
        <>
          <pre className="code fill">{spec.template.split(/(\{\{\d+\}\})/).map((part, i) => {
            const m = part.match(/\{\{(\d+)\}\}/);
            if (!m) return <code key={i} dangerouslySetInnerHTML={{ __html: highlightQuery(part) }} />;
            const k = +m[1];
            return <button key={i} className={`slot ${slots[k] === null ? "" : "set"}`} disabled={busy} onClick={() => setSlots((s) => s.map((v, j) => (j === k ? null : v)))} aria-label={`Пропуск ${k + 1}`}>{slots[k] === null ? "?" : chips[slots[k]]}</button>;
          })}</pre>
          <div className="chips">{chips.map((w, i) => <button key={i} className="chip word" disabled={busy || slots.includes(i)} onClick={() => setSlots((s) => { const j = s.indexOf(null); if (j < 0) return s; const n = [...s]; n[j] = i; return n; })}>{w}</button>)}</div>
        </>
      )}
      {spec.type === "read" && (
        <>
          <QueryCode text={spec.query} />
          <p className="read-q">{spec.question}</p>
          <div className="options">{spec.options.map((o, i) => <button key={i} disabled={busy} className={`option ${picked === i ? "picked" : ""} ${solved && i === spec.correct ? "right" : ""}`} onClick={() => setPicked(i)}>{o}</button>)}</div>
        </>
      )}
      {(spec.type === "write" || spec.type === "fix") && <QueryEditor value={text} onChange={setText} onRun={check} errorLine={res?.error?.line ?? 0} minRows={7} />}
      {spec.params && <div className="params"><b>Параметры</b>{Object.entries(spec.params).map(([k, v]) => <label key={k}><span>&amp;{k}</span><input readOnly value={v} /></label>)}</div>}

      <div className="toolbar">
        <button className="btn primary big" onClick={check} disabled={busy || (spec.type === "read" && picked === null)}>{attackLabel}</button>
        {spec.type !== "read" && <button className="btn" onClick={justRun} disabled={busy}>Выполнить и посмотреть</button>}
        {spec.hint && !hint && <button className="btn ghost" onClick={() => setHint(true)}>Подсказка (−1 ★)</button>}
      </div>
      {hint && <div className="hint"><b>Подсказка.</b> <Markdown text={spec.hint} /></div>}
      {res && (res.why || res.ok) && <div className={`verdict ${res.ok ? "ok" : res.soft ? "soft" : "bad"}`}>{res.ok ? "Верно!" : res.why}{res.ok && spec.explain ? ` ${spec.explain}` : ""}</div>}
      {res?.exec && <BatchResult exec={res.exec} />}
    </div>
  );
}

function LevelPlay({ c, level }) {
  const nav = useNavigate();
  const [mistakes, setMistakes] = useState(0);
  const [stars, setStars] = useState(null);
  const [pose, setPose] = useState("idle");
  const idx = c.levels.indexOf(level);
  const next = c.levels[idx + 1];
  if (!unlocked.chapter(chapters.indexOf(c), progress.bosses()) || !unlocked.level(c, idx, progress.get().game)) return <div className="page"><h1>Уровень ещё закрыт</h1><Link className="btn" to={`/game/${c.id}`}>← К главе</Link></div>;

  const onResult = (ok, { hintUsed }) => {
    if (!ok) { setMistakes((m) => m + 1); setPose("hurt"); setTimeout(() => setPose("idle"), 700); return; }
    const s = Math.max(1, 3 - mistakes - (hintUsed ? 1 : 0));
    setStars(s); setPose("win"); progress.setStars(level.id, s);
  };
  return (
    <div className="page game">
      <Link to={`/game/${c.id}`} className="muted">← {c.title}</Link>
      <div className="scene" style={{ "--scene": c.color }}>
        <Barsik pose={pose} size={120} />
        <div className="bubble"><b>Уровень {idx + 1}. {level.title}</b>{level.text ? <Markdown text={level.text} /> : <p>Прочитай запрос и ответь на вопрос.</p>}</div>
      </div>
      <Puzzle spec={level} onResult={onResult} />
      {stars !== null && (
        <div className="win-bar">
          <StarRow n={stars} /> <b>Уровень пройден!</b>
          {next ? <button className="btn primary" onClick={() => nav(`/game/${c.id}/${next.id}`)} autoFocus>Следующий уровень →</button>
            : <button className="btn primary" onClick={() => nav(`/game/${c.id}/boss`)} autoFocus>К боссу: {c.boss.name} →</button>}
        </div>
      )}
    </div>
  );
}

function BossFight({ c }) {
  const boss = c.boss;
  const [phase, setPhase] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [mistakes, setMistakes] = useState(0); // в текущем раунде
  const [anim, setAnim] = useState("idle"); // idle | strike | pigAttack | win | lose
  const [run_, setRun] = useState(0);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const nav = useNavigate();
  const ci = chapters.indexOf(c);
  if (!unlocked.chapter(ci, progress.bosses()) || !unlocked.boss(c, progress.get().game)) return <div className="page"><h1>Босс ещё не вышел</h1><p>Пройди все уровни темы.</p><Link className="btn" to={`/game/${c.id}`}>← К главе</Link></div>;

  const hp = boss.phases.length - phase;
  const spec = boss.phases[phase];
  const onResult = (ok, { hintUsed }) => {
    if (!ok) {
      setMistakes((m) => m + 1); setAnim("pigAttack");
      const left = hearts - 1; setHearts(left);
      later(() => setAnim(left <= 0 ? "lose" : "idle"), 800);
      return;
    }
    progress.setStars(spec.id, Math.max(1, 3 - mistakes - (hintUsed ? 1 : 0)));
    setAnim("strike");
    later(() => {
      if (phase + 1 >= boss.phases.length) { setAnim("win"); setPhase(phase + 1); progress.defeatBoss(boss.id, hearts === 3); }
      else { setAnim("idle"); setPhase(phase + 1); setMistakes(0); }
    }, 1300);
  };
  const retry = () => { setPhase(0); setHearts(3); setMistakes(0); setAnim("idle"); setRun((r) => r + 1); };
  const nextChapter = chapters[ci + 1];

  return (
    <div className="page game">
      <Link to={`/game/${c.id}`} className="muted">← {c.title}</Link>
      <div className={`arena a-${anim}`} style={{ "--scene": c.color }}>
        <div className="fighter left">
          <div className="hearts" aria-label={`Жизни: ${hearts} из 3`}>{[0, 1, 2].map((i) => <Heart key={i} on={i < hearts} />)}</div>
          <Barsik pose={anim === "strike" ? "attack" : anim === "pigAttack" || anim === "lose" ? "hurt" : anim === "win" ? "win" : "idle"} size={130} />
        </div>
        <div className="arena-mid">
          <b className="boss-name">{boss.name}</b>
          <div className="hpbar" aria-label={`Здоровье босса: ${hp} из ${boss.phases.length}`}>{boss.phases.map((_, i) => <i key={i} className={i < hp ? "on" : ""} />)}</div>
          <p className="taunt">{anim === "win" ? "Хрю… мой план был идеален…" : anim === "lose" ? "Ха! Иди учи теорию, хрю!" : `«${boss.taunt}»`}</p>
          <span className="shot" aria-hidden="true">ВЫБРАТЬ</span>
        </div>
        <div className="fighter right"><Pig skin={boss.skin} color={c.color} size={140} state={anim === "strike" ? "hit" : anim === "pigAttack" ? "attack" : anim === "win" ? "dead" : "idle"} title={boss.name} /></div>
      </div>

      {anim === "win" ? (
        <div className="result ok boss-end">
          <h3>Победа! {boss.name} повержен{hearts === 3 ? " — и без единой потерянной жизни" : ""}</h3>
          <p>Тема «{c.topic}» закрыта. Значок темы и звёзды сохранены в профиле (у гостя — только в этом браузере).</p>
          <div className="toolbar">
            {nextChapter ? <button className="btn primary" onClick={() => nav(`/game/${nextChapter.id}`)} autoFocus>Дальше: {nextChapter.title} →</button> : <Link className="btn primary" to="/profile">Все боссы повержены — в профиль</Link>}
            <Link className="btn" to="/game">К карте</Link>
          </div>
        </div>
      ) : anim === "lose" ? (
        <div className="result bad boss-end">
          <h3>Барсик отступил</h3>
          <p>Жизни закончились. Загляни в шпаргалку по теме и попробуй снова — раунды начнутся с первого.</p>
          <div className="toolbar"><button className="btn primary" onClick={retry} autoFocus>Сразиться ещё раз</button>{c.kb && <Link className="btn" to={`/kb/${c.kb}`}>Шпаргалка</Link>}</div>
        </div>
      ) : (
        <>
          <div className="round"><b>Раунд {phase + 1} из {boss.phases.length}. {spec.title}</b>{spec.text && <Markdown text={spec.text} />}</div>
          <Puzzle key={`${run_}-${spec.id}`} spec={spec} onResult={onResult} locked={anim !== "idle"} attackLabel="Атаковать запросом!" />
        </>
      )}
    </div>
  );
}
