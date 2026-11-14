import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore, auth } from "../lib/store.js";
import { summary, rankOf } from "../lib/achievements.js";
import AuthForms from "./AuthForms.jsx";

export function Toasts() {
  const { toasts } = useStore();
  return <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.icon && <span aria-hidden="true">{t.icon}</span>}{t.text}</div>)}</div>;
}

/** Кнопка профиля в шапке. */
export function ProfileChip() {
  const { session, data } = useStore();
  const rank = rankOf(summary(data).xp);
  if (session?.mode === "user") return <Link to="/profile" className="chip-profile" title="Профиль"><span aria-hidden="true">{rank.icon}</span><b>{session.login}</b><small>{rank.title}</small></Link>;
  return <Link to="/profile" className="chip-profile guest" title="Гостевой режим: прогресс не гарантируется"><span aria-hidden="true">👤</span><b>{session ? "Гость" : "Войти"}</b></Link>;
}

/** Первое посещение: предложить войти, создать профиль или продолжить гостем. */
export function AuthGate() {
  const { session } = useStore();
  const [closed, setClosed] = useState(false);
  useEffect(() => { auth.refresh(); }, []);
  const { pathname } = useLocation();
  if (session || closed || pathname === "/profile") return null; // на странице профиля формы входа уже есть
  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <h2 id="gate-title">Добро пожаловать в BSL Speedrun</h2>
        <p className="muted">Создай профиль, чтобы прогресс, достижения и значки сохранялись. Нужны только имя и пароль.</p>
        <AuthForms onDone={() => setClosed(true)} />
      </div>
    </div>
  );
}
