// Профиль и прогресс. Режимы: гость (только этот браузер, без достижений) и аккаунт (синхронизация с сервером).
import { useSyncExternalStore } from "react";
import { evaluateAchievements } from "./achievements.js";

const NS = "bsl-speedrun:v2";
const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(`${NS}:${k}`)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`${NS}:${k}`, JSON.stringify(v)); } catch { /* приватный режим / нет места */ } },
  del(k) { try { localStorage.removeItem(`${NS}:${k}`); } catch { /* */ } },
};
const empty = () => ({ solved: [], quiz: {}, drafts: {}, queries: [], game: {}, bosses: [], kb: [], stats: {}, achievements: {} });
const fix = (d) => ({ ...empty(), ...(d && typeof d === "object" ? d : {}) });
const dataKey = (s) => (s?.mode === "user" ? `data:u:${s.login.toLowerCase()}` : "data:guest");

function migrateV1() {
  if (ls.get("data:guest")) return;
  try {
    const old = JSON.parse(localStorage.getItem("bsl-speedrun:v1"));
    if (old) ls.set("data:guest", fix({ solved: old.solved, quiz: old.quiz, drafts: old.drafts }));
  } catch { /* */ }
}
migrateV1();

let session = ls.get("session"); // null | {mode:"guest"} | {mode:"user", login, token}
let data = fix(ls.get(dataKey(session)));
let sync = "idle"; // idle | saving | saved | offline
let toasts = [];
let version = 0;
const listeners = new Set();
let snapshot = null;
const emit = () => { version++; snapshot = null; listeners.forEach((f) => f()); };
const getSnapshot = () => (snapshot ??= { session, data, sync, toasts, version });
export const useStore = () => useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, getSnapshot);
export const getState = getSnapshot;

// ---------- сервер ----------
async function call(method, url, body, token = session?.token) {
  let res;
  try {
    res = await fetch(url, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error("Сервер профилей недоступен. Можно продолжить как гость."), { offline: true }); }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || `Ошибка сервера (${res.status})`), { status: res.status });
  return json;
}

let timer = null;
function scheduleSync() {
  if (session?.mode !== "user") return;
  clearTimeout(timer);
  sync = "saving";
  timer = setTimeout(pushNow, 1500);
}
async function pushNow() {
  if (session?.mode !== "user") return;
  const { drafts, ...rest } = data; // черновики кода остаются в браузере
  try { await call("PUT", "/api/progress", { progress: rest }); sync = "saved"; }
  catch (e) {
    if (e.status === 401) { toast("Сессия закончилась — войди заново", "warn"); setSession({ mode: "guest" }, data); return; }
    sync = "offline";
  }
  emit();
}

// ---------- слияние прогресса ----------
const union = (a = [], b = []) => [...new Set([...a, ...b])];
export function merge(a, b) {
  a = fix(a); b = fix(b);
  const game = { ...a.game }; for (const [k, v] of Object.entries(b.game)) game[k] = Math.max(game[k] ?? 0, v);
  const stats = { ...a.stats }; for (const [k, v] of Object.entries(b.stats)) stats[k] = Math.max(stats[k] ?? 0, v);
  const quiz = { ...a.quiz }; for (const [k, v] of Object.entries(b.quiz)) quiz[k] = quiz[k] || v;
  const achievements = { ...b.achievements }; for (const [k, v] of Object.entries(a.achievements)) achievements[k] = Math.min(achievements[k] ?? v, v);
  return { solved: union(a.solved, b.solved), queries: union(a.queries, b.queries), bosses: union(a.bosses, b.bosses), kb: union(a.kb, b.kb), quiz, game, stats, achievements, drafts: { ...b.drafts, ...a.drafts } };
}

function setSession(s, d) {
  session = s; data = fix(d);
  ls.set("session", s); ls.set(dataKey(s), data);
  award(); emit();
}
async function enter(kind, login, password) {
  const r = await call("POST", `/api/auth/${kind}`, { login, password }, null);
  const guest = ls.get("data:guest");
  const merged = merge(r.progress, merge(ls.get(`data:u:${r.login.toLowerCase()}`), guest));
  ls.del("data:guest"); // гостевой прогресс переезжает в профиль
  setSession({ mode: "user", login: r.login, token: r.token }, merged);
  scheduleSync();
  return r.login;
}
export const auth = {
  register: (login, password) => enter("register", login, password),
  login: (login, password) => enter("login", login, password),
  reset: (login, password) => enter("reset", login, password),
  guest() { setSession({ mode: "guest" }, ls.get("data:guest")); },
  async logout() {
    clearTimeout(timer);
    if (session?.mode === "user") { await pushNow(); call("POST", "/api/auth/logout").catch(() => {}); }
    session = null; data = empty(); ls.del("session"); emit();
  },
  /** При старте: подтянуть серверный прогресс (вход с другого устройства). */
  async refresh() {
    if (session?.mode !== "user") return;
    try {
      const r = await call("GET", "/api/progress");
      data = merge(r.progress, data); ls.set(dataKey(session), data); award(); emit();
    } catch (e) { if (e.status === 401) setSession({ mode: "guest" }, data); }
  },
};

// ---------- изменения ----------
export function toast(text, kind = "info", icon = "") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, kind, icon }];
  emit();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); emit(); }, 5200);
}
function award() {
  if (session?.mode !== "user") return; // достижения и значки — только в профиле
  const fresh = evaluateAchievements(data).filter((a) => !(a.id in data.achievements));
  if (!fresh.length) return;
  const achievements = { ...data.achievements };
  for (const a of fresh) achievements[a.id] = Date.now();
  data = { ...data, achievements };
  ls.set(dataKey(session), data);
  fresh.forEach((a, i) => setTimeout(() => toast(`Достижение: ${a.title}`, "award", a.icon), 400 + i * 900));
}
export function update(fn, { silent = false } = {}) {
  const next = fn(data);
  if (!next || next === data) return;
  data = next;
  ls.set(dataKey(session), data);
  if (!silent) award();
  scheduleSync();
  emit();
}
const addTo = (key, id) => update((d) => (d[key].includes(id) ? d : { ...d, [key]: [...d[key], id] }));
export const bump = (stat, by = 1) => update((d) => ({ ...d, stats: { ...d.stats, [stat]: (d.stats[stat] ?? 0) + by } }));

/** Интерфейс прогресса для страниц (совместим со старым progress из api.js). */
export const progress = {
  get: () => data,
  solved: () => new Set(data.solved),
  markSolved: (id) => addTo("solved", id),
  draft: (key) => data.drafts?.[key],
  saveDraft: (key, code) => update((d) => ({ ...d, drafts: { ...d.drafts, [key]: code } }), { silent: true }),
  quiz: () => data.quiz,
  saveQuizAnswer: (qid, correct) => update((d) => ({ ...d, quiz: { ...d.quiz, [qid]: correct }, stats: { ...d.stats, quizStreak: correct ? (d.stats.quizStreakNow ?? 0) + 1 > (d.stats.quizStreak ?? 0) ? (d.stats.quizStreakNow ?? 0) + 1 : d.stats.quizStreak ?? 0 : d.stats.quizStreak ?? 0, quizStreakNow: correct ? (d.stats.quizStreakNow ?? 0) + 1 : 0 } })),
  queries: () => new Set(data.queries),
  markQuery: (id) => addTo("queries", id),
  stars: (levelId) => data.game[levelId] ?? 0,
  setStars: (levelId, stars) => update((d) => ((d.game[levelId] ?? 0) >= stars ? d : { ...d, game: { ...d.game, [levelId]: stars } })),
  bosses: () => new Set(data.bosses),
  defeatBoss: (id, flawless) => { addTo("bosses", id); if (flawless) bump("flawlessBosses"); },
  readKb: (id) => addTo("kb", id),
};
