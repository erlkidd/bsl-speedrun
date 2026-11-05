// Статическая проверка кода ученика ДО запуска (второй рубеж — главный это контейнер без сети/RO-FS).

const L = "[\\p{L}\\p{N}_]";
const word = (w) => new RegExp(`(?<!${L})${w}(?!${L})`, "iu");

/** Убирает комментарии и содержимое строковых литералов (с учётом многострочных строк через |). */
export function stripCode(code) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (inStr) {
      if (c === '"') {
        if (code[i + 1] === '"') { i++; continue; }
        inStr = false;
        out += '"';
      } else if (c === "\n") {
        out += "\n"; // многострочная строка продолжается после |
      }
      continue;
    }
    if (c === "/" && code[i + 1] === "/") {
      while (i < code.length && code[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    if (c === '"') { inStr = true; out += '"'; continue; }
    out += c;
  }
  return out;
}

const DENY = [
  [["КомандаСистемы", "System"], "запуск системных команд"],
  [["ЗапуститьПриложение", "RunApp", "СоздатьПроцесс", "CreateProcess", "НайтиПроцессПоИдентификатору", "НайтиПроцессыПоИмени"], "запуск процессов"],
  [["Файл", "File", "ЧтениеТекста", "TextReader", "ЗаписьТекста", "TextWriter", "ОткрытьФайл", "OpenFile",
    "КопироватьФайл", "CopyFile", "ПереместитьФайл", "MoveFile", "УдалитьФайлы", "DeleteFiles", "СоздатьКаталог",
    "CreateDirectory", "НайтиФайлы", "FindFiles", "ТекущийКаталог", "CurrentDirectory", "КаталогВременныхФайлов",
    "TempFilesDir", "ПолучитьИмяВременногоФайла", "GetTempFileName", "ФайловыйПоток", "FileStream",
    "МенеджерФайловыхПотоков", "FileStreamsManager", "ЧтениеZipФайла", "ЗаписьZipФайла", "Прочитать", "Записать",
    "Read", "Write"], "работа с файлами"],
  [["HTTPСоединение", "HTTPConnection", "FTPСоединение", "FTPConnection", "ИнтернетПочта", "InternetMail",
    "TCPСоединение", "TCPСервер", "TCPClient", "TCPServer", "WSПрокси", "WSProxy", "WSОпределения", "WSDefinitions",
    "ВебСервер"], "сеть"],
  [["COMОбъект", "COMObject", "ПодключитьВнешнююКомпоненту", "AttachAddIn", "ЗагрузитьВнешнююКомпоненту"], "внешние компоненты"],
  [["ПодключитьСценарий", "AttachScript", "ЗагрузитьСценарий", "LoadScript", "ЗагрузитьСценарийИзСтроки",
    "LoadScriptFromString", "Вычислить", "Eval", "Выполнить", "Execute"], "динамический код"],
  [["ПолучитьПеременнуюСреды", "GetEnvironmentVariable", "УстановитьПеременнуюСреды", "SetEnvironmentVariable",
    "ПеременныеСреды", "EnvironmentVariables", "СистемнаяИнформация", "SystemInfo"], "окружение"],
  [["ФоновыеЗадания", "BackgroundJobs", "Приостановить", "Sleep"], "фоновые задания/паузы"],
].flatMap(([words, why]) => words.map((w) => ({ w, re: word(w), why })));

/** @returns {{line:number, message:string}[]} */
export function checkForbidden(code) {
  const problems = [];
  const lines = stripCode(code).split("\n");
  lines.forEach((ln, idx) => {
    if (/^\s*#/u.test(ln)) {
      problems.push({ line: idx + 1, message: "Директивы препроцессора (#Использовать и т.п.) в тренажёре запрещены" });
      return;
    }
    if (/(?<![\p{L}\p{N}_])(Новый|New)\s*\(/iu.test(ln)) {
      problems.push({ line: idx + 1, message: "Динамический конструктор Новый(\"Тип\") запрещён — пиши Новый ИмяТипа()" });
    }
    for (const d of DENY) {
      if (d.re.test(ln)) {
        problems.push({ line: idx + 1, message: `«${d.w}» недоступно в песочнице (${d.why})` });
        break;
      }
    }
  });
  return problems;
}

/** Правила задачи: required / forbidden — регэкспы по коду без комментариев и строк. */
export function checkTaskRules(code, rules = {}) {
  const src = stripCode(code);
  const out = [];
  for (const r of rules.required ?? []) {
    if (!new RegExp(r.pattern, "iu").test(src)) out.push({ kind: "required", message: r.message });
  }
  for (const r of rules.forbidden ?? []) {
    if (new RegExp(r.pattern, "iu").test(src)) out.push({ kind: "forbidden", message: r.message });
  }
  return out;
}
