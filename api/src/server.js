import Fastify from "fastify";
import { existsSync, unlinkSync, chmodSync } from "node:fs";
import { runOneScript, BusyError } from "./runner.js";
import { checkForbidden, checkTaskRules } from "./guard.js";
import { loadTasks, getTask, buildHarness, parseCases, compareOutput } from "./tasks.js";

const MAX_CODE = 20_000;
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" }, bodyLimit: 64 * 1024, trustProxy: true });

loadTasks();

// простой rate limit по IP: 30 запусков в минуту
const hits = new Map();
app.addHook("onRequest", async (req, reply) => {
  if (req.method !== "POST") return;
  const ip = req.headers["x-forwarded-for"]?.split(",")[0].trim() || req.ip || "local";
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (arr.length > 30) return reply.code(429).send({ error: "Слишком много запусков, подожди минуту" });
});
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.every((t) => now - t > 60_000)) hits.delete(k); }, 60_000).unref();

const validate = (code) => {
  if (typeof code !== "string") return "Нет кода";
  if (code.length > MAX_CODE) return `Код длиннее ${MAX_CODE} символов`;
  return null;
};

app.get("/api/health", async () => ({ ok: true, tasks: loadTasks().size }));

/** Песочница: проверка синтаксиса + запуск. */
app.post("/api/run", async (req, reply) => {
  const { code } = req.body ?? {};
  const err = validate(code);
  if (err) return reply.code(400).send({ error: err });
  const forbidden = checkForbidden(code);
  if (forbidden.length) return { phase: "guard", ok: false, errors: forbidden, output: "" };
  return runOneScript(code);
});

/** Только синтаксис (без запуска). */
app.post("/api/syntax", async (req, reply) => {
  const { code } = req.body ?? {};
  const err = validate(code);
  if (err) return reply.code(400).send({ error: err });
  return runOneScript(code, { run: false });
});

/** Практика: синтаксис → запреты → правила задачи → тесты. */
app.post("/api/check", async (req, reply) => {
  const { taskId, code } = req.body ?? {};
  const err = validate(code);
  if (err) return reply.code(400).send({ error: err });
  const task = getTask(taskId);
  if (!task) return reply.code(404).send({ error: "Задача не найдена" });

  const forbidden = checkForbidden(code);
  if (forbidden.length) return { passed: false, stage: "guard", errors: forbidden, rules: [], cases: [] };

  const syntax = await runOneScript(code, { run: false });
  if (!syntax.ok) return { passed: false, stage: "syntax", errors: syntax.errors, output: syntax.output, rules: [], cases: [] };

  const rules = checkTaskRules(code, task.rules);

  if (task.mode === "output") {
    const res = await runOneScript(code);
    const ok = res.ok && compareOutput(res.output, task.expectedOutput);
    return {
      passed: ok && rules.length === 0, stage: "tests", rules, errors: res.errors, output: res.output,
      cases: [{ status: ok ? "PASS" : res.timedOut ? "ERROR" : "FAIL", name: "Вывод программы", expected: String(task.expectedOutput).trim(), actual: res.output.trim() }],
    };
  }

  const userLines = code.split("\n").length;
  const res = await runOneScript(buildHarness(task, code));
  const { cases, stdout } = parseCases(res.output);
  const errors = res.errors.map((e) =>
    e.line > userLines
      ? { line: 0, message: `${e.message} (проверь, что функция называется «${task.function}», и что после методов нет кода тела модуля)` }
      : e,
  );
  if (res.timedOut) errors.push({ line: 0, message: "Превышено время выполнения — возможно, бесконечный цикл" });
  const allPass = cases.length === (task.cases?.length ?? 0) && cases.every((c) => c.status === "PASS");
  return { passed: allPass && rules.length === 0 && res.ok, stage: "tests", rules, errors, cases, output: stdout };
});

app.setErrorHandler((e, req, reply) => {
  if (e instanceof BusyError) return reply.code(503).send({ error: e.message });
  req.log.error(e);
  reply.code(e.statusCode || 500).send({ error: e.statusCode ? e.message : "Внутренняя ошибка" });
});

const socketPath = process.env.SOCKET_PATH;
if (socketPath) {
  if (existsSync(socketPath)) unlinkSync(socketPath);
  await app.listen({ path: socketPath });
  chmodSync(socketPath, 0o666);
} else {
  await app.listen({ port: Number(process.env.PORT || 8787), host: "127.0.0.1" });
}
