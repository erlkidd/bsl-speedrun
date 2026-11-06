// Лёгкий LSP-клиент поверх WebSocket для BSL Language Server.
// Диагностики → маркеры Monaco; автодополнение, hover, форматирование.

// Правила BSL LS, которые в тренажёре только мешают (Сообщить — основной способ вывода и т.п.)
const IGNORED_DIAGNOSTICS = new Set(["DeprecatedMessage", "UnusedLocalMethod", "CodeOutOfRegion", "MissingCodeTryCatchEx", "MagicNumber"]);

const listeners = new Set();
let client = null;

export function onLspStatus(fn) {
  listeners.add(fn);
  fn(client?.status ?? "off");
  return () => listeners.delete(fn);
}
const emit = (s) => listeners.forEach((fn) => fn(s));

class LspClient {
  constructor(monaco) {
    this.monaco = monaco;
    this.id = 0;
    this.pending = new Map();
    this.docs = new Map(); // uri -> {model, version, timer}
    this.status = "connecting";
    this.retry = 0;
    this.capabilities = {};
    this.connect();
  }

  connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    this.ready = new Promise((resolve) => (this._resolveReady = resolve));
    this.setStatus("connecting");
    let ws;
    try {
      ws = new WebSocket(`${proto}://${location.host}/lsp`);
    } catch {
      return this.scheduleReconnect();
    }
    this.ws = ws;
    ws.onopen = async () => {
      this.retry = 0;
      try {
        const res = await this.request("initialize", {
          processId: null,
          clientInfo: { name: "bsl-speedrun" },
          rootUri: null,
          workspaceFolders: null,
          capabilities: {
            textDocument: {
              synchronization: { dynamicRegistration: false, didSave: false },
              publishDiagnostics: { relatedInformation: false },
              completion: { completionItem: { snippetSupport: true, documentationFormat: ["markdown", "plaintext"] } },
              hover: { contentFormat: ["markdown", "plaintext"] },
              formatting: {},
              signatureHelp: { signatureInformation: { documentationFormat: ["markdown", "plaintext"] } },
            },
          },
        });
        this.capabilities = res?.capabilities ?? {};
        this.notify("initialized", {});
        this.setStatus("ready");
        for (const [uri, d] of this.docs) this.sendOpen(uri, d);
        this._resolveReady();
      } catch {
        ws.close();
      }
    };
    ws.onmessage = (e) => this.handle(e.data);
    ws.onclose = () => {
      for (const { reject } of this.pending.values()) reject(new Error("closed"));
      this.pending.clear();
      this.scheduleReconnect();
    };
    ws.onerror = () => {};
  }

  scheduleReconnect() {
    this.setStatus("off");
    const delay = Math.min(30000, 2000 * 2 ** this.retry++);
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  setStatus(s) { this.status = s; emit(s); }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ jsonrpc: "2.0", ...msg }));
  }
  request(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("timeout")); }
      }, 15000);
    });
  }
  notify(method, params) { this.send({ method, params }); }

  handle(data) {
    let text = typeof data === "string" ? data : "";
    const hdr = text.indexOf("\r\n\r\n");
    if (text.startsWith("Content-Length") && hdr > 0) text = text.slice(hdr + 4);
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.id !== undefined && !msg.method) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
      return;
    }
    if (msg.method === "textDocument/publishDiagnostics") this.applyDiagnostics(msg.params);
    else if (msg.id !== undefined) this.send({ id: msg.id, result: null }); // запросы сервера (workspace/configuration и пр.)
  }

  // ---------- документы ----------
  open(model) {
    const uri = model.uri.toString();
    const d = { model, version: 1, timer: null };
    this.docs.set(uri, d);
    if (this.status === "ready") this.sendOpen(uri, d);
    const sub = model.onDidChangeContent(() => {
      clearTimeout(d.timer);
      d.timer = setTimeout(() => {
        d.version++;
        this.notify("textDocument/didChange", { textDocument: { uri, version: d.version }, contentChanges: [{ text: model.getValue() }] });
      }, 300);
    });
    return () => {
      sub.dispose();
      clearTimeout(d.timer);
      this.docs.delete(uri);
      this.notify("textDocument/didClose", { textDocument: { uri } });
    };
  }
  sendOpen(uri, d) {
    this.notify("textDocument/didOpen", { textDocument: { uri, languageId: "bsl", version: d.version, text: d.model.getValue() } });
  }

  applyDiagnostics({ uri, diagnostics }) {
    const d = this.docs.get(uri);
    if (!d || d.model.isDisposed()) return;
    const S = this.monaco.MarkerSeverity;
    const sev = { 1: S.Error, 2: S.Warning, 3: S.Info, 4: S.Hint };
    const code = (x) => (typeof x.code === "object" ? x.code?.value : x.code);
    this.monaco.editor.setModelMarkers(d.model, "bsl-ls", diagnostics.filter((x) => !IGNORED_DIAGNOSTICS.has(code(x))).map((x) => ({
      ...toRange(x.range),
      severity: sev[x.severity] ?? S.Info,
      message: x.message,
      code: code(x),
      source: "BSL LS",
    })));
  }
}

const toRange = (r) => ({
  startLineNumber: r.start.line + 1, startColumn: r.start.character + 1,
  endLineNumber: r.end.line + 1, endColumn: r.end.character + 1,
});
const toPos = (p) => ({ line: p.lineNumber - 1, character: p.column - 1 });
// BSL LS добавляет в подсказки ссылку «перейти к определению» вида file:///…/Module.bsl#1 —
// это виртуальный документ редактора, а не файл, но ссылка бесполезна и смущает: оставляем только https.
const safeMd = (s) =>
  String(s ?? "")
    .replace(/^\s*\[[^\]]*\]\((?!https:\/\/)[^)]*\)\s*$/gm, "")
    .replace(/\[([^\]]*)\]\((?!https:\/\/)[^)]*\)/g, "$1")
    .replace(/(\n---\s*){2,}/g, "\n---\n")
    .trim();
const md = (c) => {
  if (!c) return [];
  if (typeof c === "string") return [{ value: safeMd(c) }];
  if (Array.isArray(c)) return c.flatMap(md);
  if (c.kind) return [{ value: safeMd(c.value) }];
  if (c.language) return [{ value: "```" + c.language + "\n" + c.value + "\n```" }];
  return [];
};

let providersRegistered = false;
function registerProviders(monaco) {
  if (providersRegistered) return;
  providersRegistered = true;
  const K = monaco.languages.CompletionItemKind;
  const kinds = { 2: K.Method, 3: K.Function, 5: K.Field, 6: K.Variable, 7: K.Class, 9: K.Module, 10: K.Property, 12: K.Value, 14: K.Keyword, 15: K.Snippet, 21: K.Constant };

  monaco.languages.registerCompletionItemProvider("bsl", {
    triggerCharacters: ["."],
    async provideCompletionItems(model, position) {
      if (client?.status !== "ready") return { suggestions: [] };
      const word = model.getWordUntilPosition(position);
      const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
      try {
        const res = await client.request("textDocument/completion", { textDocument: { uri: model.uri.toString() }, position: toPos(position) });
        const items = Array.isArray(res) ? res : res?.items ?? [];
        return {
          suggestions: items.map((it) => ({
            label: it.label,
            kind: kinds[it.kind] ?? K.Text,
            detail: it.detail,
            documentation: it.documentation ? (typeof it.documentation === "string" ? safeMd(it.documentation) : { value: safeMd(it.documentation.value) }) : undefined,
            insertText: it.textEdit?.newText ?? it.insertText ?? it.label,
            insertTextRules: it.insertTextFormat === 2 ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet : undefined,
            range: it.textEdit?.range ? toRange(it.textEdit.range) : range,
            sortText: it.sortText,
            filterText: it.filterText,
          })),
        };
      } catch { return { suggestions: [] }; }
    },
  });

  monaco.languages.registerHoverProvider("bsl", {
    async provideHover(model, position) {
      if (client?.status !== "ready") return null;
      try {
        const res = await client.request("textDocument/hover", { textDocument: { uri: model.uri.toString() }, position: toPos(position) });
        if (!res?.contents) return null;
        return { contents: md(res.contents), range: res.range ? toRange(res.range) : undefined };
      } catch { return null; }
    },
  });

  monaco.languages.registerDocumentFormattingEditProvider("bsl", {
    async provideDocumentFormattingEdits(model, options) {
      if (client?.status !== "ready") return [];
      try {
        const edits = await client.request("textDocument/formatting", {
          textDocument: { uri: model.uri.toString() },
          options: { tabSize: options.tabSize, insertSpaces: options.insertSpaces },
        });
        return (edits ?? []).map((e) => ({ range: toRange(e.range), text: e.newText }));
      } catch { return []; }
    },
  });
}

/** Подключить модель к BSL LS. Возвращает функцию отключения. */
export function attachLsp(monaco, model) {
  if (!client) client = new LspClient(monaco);
  registerProviders(monaco);
  return client.open(model);
}
