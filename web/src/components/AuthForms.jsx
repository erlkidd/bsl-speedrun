import { useState } from "react";
import { auth } from "../lib/store.js";

const MODES = { login: ["Вход", "Войти"], register: ["Новый профиль", "Создать профиль"], reset: ["Сброс пароля", "Задать новый пароль"] };

/** Вход / регистрация / сброс пароля по имени / гостевой режим. */
export default function AuthForms({ onDone, allowGuest = true }) {
  const [mode, setMode] = useState("login");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guestWarn, setGuestWarn] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try { await auth[mode](login.trim(), password); onDone?.(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const tab = (m) => <button type="button" role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setError(""); }}>{MODES[m][0]}</button>;

  if (guestWarn) return (
    <div className="auth">
      <h3>Гостевой вход</h3>
      <ul className="guest-warn">
        <li>Сохранение прогресса <b>не гарантируется</b>: он лежит только в этом браузере и пропадёт при очистке данных, в режиме инкогнито или на другом устройстве.</li>
        <li><b>Достижения и значки</b> гостям не выдаются.</li>
        <li>Профиль можно создать позже — накопленный в этом браузере прогресс перенесётся в него.</li>
      </ul>
      <div className="toolbar">
        <button className="btn primary" onClick={() => { auth.guest(); onDone?.(); }}>Понятно, продолжить гостем</button>
        <button className="btn" onClick={() => setGuestWarn(false)}>Назад</button>
      </div>
    </div>
  );

  return (
    <form className="auth" onSubmit={submit}>
      <div className="auth-tabs" role="tablist">{tab("login")}{tab("register")}{tab("reset")}</div>
      <label>Имя профиля<input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required minLength={3} maxLength={24} placeholder="например, artur" /></label>
      <label>{mode === "reset" ? "Новый пароль" : "Пароль"}<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} maxLength={72} placeholder="не короче 6 символов" /></label>
      {mode === "reset" && <p className="small muted">Сброс пока работает только по имени профиля, без подтверждения: укажи имя и новый пароль. Все прежние входы в этот профиль будут завершены.</p>}
      {mode === "register" && <p className="small muted">Почта и телефон не нужны. Прогресс, достижения и значки сохраняются на сервере и доступны с любого устройства.</p>}
      {error && <div className="alert" role="alert">{error}</div>}
      <div className="toolbar">
        <button className="btn primary" disabled={busy}>{busy ? "Секунду…" : MODES[mode][1]}</button>
        {allowGuest && <button type="button" className="btn ghost" onClick={() => setGuestWarn(true)}>Продолжить как гость</button>}
      </div>
    </form>
  );
}
