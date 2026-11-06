// Smoke-тест API с реальным OneScript: node tools/smoke.mjs
import { readFileSync, readdirSync } from "node:fs";
const B = "http://127.0.0.1:5173";
const post = async (u, b) => (await fetch(B + u, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })).json();
const root = new URL("../content/", import.meta.url);

console.log("RUN", JSON.stringify(await post("/api/run", { code: 'М = Новый Массив; М.Добавить("Привет"); Сообщить(М[0] + ", BSL!");' })));
console.log("SYNTAX", JSON.stringify(await post("/api/run", { code: 'А = 1\nСообщить(А);' })));
console.log("RUNTIME", JSON.stringify(await post("/api/run", { code: 'А = 1;\nБ = А / 0;' })));
console.log("GUARD", JSON.stringify(await post("/api/run", { code: 'Ф = Новый Файл("C:/");' })));
console.log("LOOP", JSON.stringify(await post("/api/run", { code: 'Пока Истина Цикл КонецЦикла;' })).slice(0, 200));

for (const id of readdirSync(new URL("tasks/", root))) {
  const sol = readFileSync(new URL(`tasks/${id}/solution.os`, root), "utf8");
  const st = readFileSync(new URL(`tasks/${id}/starter.os`, root), "utf8");
  const a = await post("/api/check", { taskId: id, code: sol });
  const b = await post("/api/check", { taskId: id, code: st });
  const bad = a.cases?.filter((c) => c.status !== "PASS") ?? [];
  console.log(id, "solution:", a.passed ? "OK" : "FAIL " + JSON.stringify({ stage: a.stage, errors: a.errors, rules: a.rules, bad, out: a.output }), "| starter:", b.passed ? "!!PASSED" : "fails ok");
}
for (const f of readdirSync(new URL("sandbox/", root))) {
  const r = await post("/api/run", { code: readFileSync(new URL(`sandbox/${f}`, root), "utf8") });
  console.log("EXAMPLE", f, r.ok ? "OK" : "FAIL", JSON.stringify(r.output).slice(0, 300));
}
