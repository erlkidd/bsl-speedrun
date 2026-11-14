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

// прогресс и профиль живут в store.js
export { progress } from "./store.js";
