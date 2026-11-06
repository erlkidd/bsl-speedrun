// Запуск OneScript: временный каталог, таймаут, лимит вывода, очередь.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OSCRIPT = process.env.OSCRIPT_BIN || "oscript";
const TIMEOUT = Number(process.env.RUN_TIMEOUT_MS || 5000);
const MAX_PARALLEL = Number(process.env.MAX_PARALLEL || 2);
const MAX_QUEUE = Number(process.env.MAX_QUEUE || 20);
const MAX_OUTPUT = 64 * 1024;

let active = 0;
const queue = [];

export class BusyError extends Error {}

async function slot(fn) {
  if (active >= MAX_PARALLEL) {
    if (queue.length >= MAX_QUEUE) throw new BusyError("Сервер занят, попробуй через пару секунд");
    await new Promise((resolve) => queue.push(resolve));
  }
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

function exec(args, cwd) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(OSCRIPT, args, {
      cwd,
      detached: process.platform !== "win32",
      env: {
        PATH: process.env.PATH,
        HOME: cwd,
        TMPDIR: cwd,
        LANG: "C.UTF-8",
        DOTNET_CLI_TELEMETRY_OPTOUT: "1",
        DOTNET_gcServer: "0",
        DOTNET_GCHeapHardLimit: "0x10000000", // 256 МБ кучи на процесс
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
      },
    });
    // OneScript на Windows пишет в OEM-кодировке консоли (cp866), на Linux — UTF-8
    const dec = new TextDecoder(process.env.OSCRIPT_ENCODING || (process.platform === "win32" ? "ibm866" : "utf-8"));
    let out = "";
    let truncated = false;
    let timedOut = false;
    const onData = (chunk) => {
      if (out.length >= MAX_OUTPUT) { truncated = true; return; }
      out += dec.decode(chunk, { stream: true });
      if (out.length > MAX_OUTPUT) { out = out.slice(0, MAX_OUTPUT); truncated = true; kill(); }
    };
    const kill = () => {
      try {
        if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch { /* уже завершён */ }
    };
    const timer = setTimeout(() => { timedOut = true; kill(); }, TIMEOUT);
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ output: `Не удалось запустить OneScript (${OSCRIPT}): ${e.message}`, exitCode: -1, timedOut, truncated, durationMs: 0 });
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ output: out.replace(/^﻿/, ""), exitCode, timedOut, truncated, durationMs: Date.now() - started });
    });
  });
}

/** Ошибки OneScript вида «{Модуль /tmp/x/main.os / Ошибка в строке: 3 / Текст}» → [{line, message}] */
export function parseErrors(output) {
  const errs = [];
  const re = /(?:Ошибка в строке|Error in line)\s*:?\s*(\d+)(?:,\s*\d+)?\s*(?:\/|:)?\s*([^\n}]*)/giu;
  let m;
  while ((m = re.exec(output))) errs.push({ line: Number(m[1]), message: m[2].trim() || "Ошибка" });
  return errs;
}

/**
 * Синтаксическая проверка (oscript -check), затем, если ок и run=true, запуск.
 * @returns {Promise<{phase:'syntax'|'run', ok:boolean, output:string, errors:{line,message}[], exitCode:number, timedOut:boolean, truncated:boolean, durationMs:number}>}
 */
export async function runOneScript(source, { run = true } = {}) {
  return slot(async () => {
    const dir = await mkdtemp(join(tmpdir(), "bsl-"));
    const file = join(dir, "main.os");
    try {
      await writeFile(file, "﻿" + source, "utf8");
      const syntax = await exec(["-check", file], dir);
      const synErrors = parseErrors(syntax.output);
      if (synErrors.length || (syntax.exitCode !== 0 && !syntax.timedOut)) {
        return { phase: "syntax", ok: false, errors: synErrors, ...syntax, output: clean(syntax.output, dir) };
      }
      if (!run) return { phase: "syntax", ok: true, errors: [], ...syntax, output: "" };
      const res = await exec([file], dir);
      const output = clean(res.output, dir);
      return {
        phase: "run",
        ok: res.exitCode === 0 && !res.timedOut,
        errors: res.timedOut ? [] : parseErrors(output),
        ...res,
        output: res.timedOut ? output + `\n⏱ Превышено время выполнения (${TIMEOUT / 1000} с) — бесконечный цикл?` : output,
      };
    } finally {
      rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });
}

const clean = (s, dir) => cleanPaths(s, dir);
const cleanPaths = (s, dir) =>
  s.replace(/\{Модуль [^{}\n]*?main\.os\s*\/\s*/g, "{").replace(/\{Module [^{}\n]*?main\.os\s*\/\s*/g, "{");
const _oldClean = (s, dir) => s.split(join(dir, "main.os")).join("").split(dir).join("").replace(/\{Модуль\s*\/\s*/g, "{");
