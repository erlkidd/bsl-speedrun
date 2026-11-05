async function post(url, body) {
  let res;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("Сервер недоступен");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Ошибка сервера (${res.status})`);
  return data;
}

export const runCode = (code) => post("/api/run", { code });
export const checkTask = (taskId, code) => post("/api/check", { taskId, code });

// ---------- прогресс (localStorage, безопасно) ----------
const KEY = "bsl-speedrun:v1";
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
}
export const progress = {
  get: load,
  solved: () => new Set(load().solved ?? []),
  markSolved(id) { const s = load(); s.solved = [...new Set([...(s.solved ?? []), id])]; save(s); },
  draft: (key) => load().drafts?.[key],
  saveDraft(key, code) { const s = load(); s.drafts = { ...(s.drafts ?? {}), [key]: code }; save(s); },
  quiz: () => load().quiz ?? {},
  saveQuizAnswer(qid, correct) { const s = load(); s.quiz = { ...(s.quiz ?? {}), [qid]: correct }; save(s); },
};
