import { Link } from "react-router-dom";
import { useStore, auth } from "../lib/store.js";
import { achievements, badges, summary, rankOf } from "../lib/achievements.js";
import AuthForms from "../components/AuthForms.jsx";
import { Pig } from "../game/sprites.jsx";
import { fx } from "../components/BgFx.jsx";
import { useState } from "react";

const SYNC = { idle: "", saving: "сохраняю…", saved: "сохранено на сервере", offline: "сервер недоступен — прогресс пока только в браузере" };
const Stat = ({ label, value, total, to }) => (
  <Link to={to} className="stat"><b>{value}{total != null && <small>/{total}</small>}</b><span>{label}</span>{total != null && <div className="progress"><i style={{ width: `${total ? (value / total) * 100 : 0}%` }} /></div>}</Link>
);

export default function Profile() {
  const { session, data, sync } = useStore();
  const [fxOn, setFxOn] = useState(fx.enabled());
  const s = summary(data); const rank = rankOf(s.xp);
  const isUser = session?.mode === "user";

  return (
    <div className="page profile">
      <h1>Профиль</h1>
      {!isUser && (
        <div className="profile-guest">
          <div className="notice">
            <b>{session?.mode === "guest" ? "Ты в гостевом режиме" : "Ты не вошёл"}</b>
            <p>Сохранение прогресса у гостя не гарантируется, достижения и значки не выдаются. Создай профиль — имя и пароль, больше ничего не нужно. Текущий прогресс из этого браузера перенесётся.</p>
          </div>
          <AuthForms allowGuest={!session} />
        </div>
      )}
      {isUser && (
        <div className="profile-head">
          <div className="avatar" aria-hidden="true">{rank.icon}</div>
          <div className="grow">
            <h2>{session.login}</h2>
            <p className="muted">{rank.title} · {s.xp} XP{rank.next ? ` · до звания «${rank.next.title}» ещё ${rank.next.xp - s.xp} XP` : " · высшее звание"}</p>
            <div className="progress xp"><i style={{ width: `${rank.progress * 100}%` }} /></div>
            <p className="small muted" aria-live="polite">{SYNC[sync]}</p>
          </div>
          <button className="btn" onClick={() => auth.logout()}>Выйти</button>
        </div>
      )}

      <h2>Прогресс</h2>
      <div className="stats">
        <Stat to="/practice" label="задачи BSL" value={s.tasks} total={s.tasksTotal} />
        <Stat to="/queries/tasks" label="задачи на запросы" value={s.queries} total={s.queriesTotal} />
        <Stat to="/theory" label="верных ответов" value={s.quizRight} total={s.quizTotal} />
        <Stat to="/game" label="звёзд в игре" value={s.stars} total={s.starsTotal} />
        <Stat to="/game" label="боссов повержено" value={s.bosses} total={s.bossesTotal} />
        <Stat to="/kb" label="статей прочитано" value={s.kb} total={s.kbTotal} />
      </div>

      <h2>Значки тем {!isUser && <small className="muted">— доступны после входа</small>}</h2>
      <div className={`badges ${isUser ? "" : "off"}`}>
        {badges.map((b) => {
          const has = isUser && b.test(data);
          return <div key={b.id} className={`badge ${has ? "has" : ""}`} title={b.text}><span className="medal" style={{ "--c": b.color }}><Pig skin={b.skin} color={b.color} size={46} /></span><b>{b.title}</b><small>{has ? "получен" : b.text}</small></div>;
        })}
      </div>

      <h2>Достижения {isUser ? <small className="muted">{Object.keys(data.achievements).length} из {achievements.length}</small> : <small className="muted">— доступны после входа</small>}</h2>
      <div className={`achievements ${isUser ? "" : "off"}`}>
        {achievements.map((a) => {
          const at = isUser ? data.achievements[a.id] : null;
          return <div key={a.id} className={`ach ${at ? "has" : ""}`}><span className="ach-icon" aria-hidden="true">{a.icon}</span><div><b>{a.title}</b><small>{a.text}</small>{at && <small className="when">{new Date(at).toLocaleDateString("ru-RU")}</small>}</div></div>;
        })}
      </div>

      <h2>Настройки</h2>
      <label className="switch"><input type="checkbox" checked={fxOn} onChange={(e) => { fx.set(e.target.checked); setFxOn(e.target.checked); }} /> Фоновые анимации (пузыри и машинки)</label>
    </div>
  );
}
