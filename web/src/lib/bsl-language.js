// Подсветка BSL (Monarch) + темы. Регистрируется один раз.
const keywords = [
  "Если", "Тогда", "ИначеЕсли", "Иначе", "КонецЕсли", "Для", "Каждого", "Из", "По", "Цикл", "КонецЦикла",
  "Пока", "Прервать", "Продолжить", "Процедура", "КонецПроцедуры", "Функция", "КонецФункции", "Возврат",
  "Перем", "Экспорт", "Знач", "Попытка", "Исключение", "КонецПопытки", "ВызватьИсключение", "Новый",
  "Перейти", "И", "ИЛИ", "НЕ", "Истина", "Ложь", "Неопределено", "Null", "Выполнить", "ДобавитьОбработчик",
  "УдалитьОбработчик", "Асинх", "Ждать",
  "If", "Then", "ElsIf", "Else", "EndIf", "For", "Each", "In", "To", "Do", "EndDo", "While", "Break", "Continue",
  "Procedure", "EndProcedure", "Function", "EndFunction", "Return", "Var", "Export", "Val", "Try", "Except",
  "EndTry", "Raise", "New", "Goto", "And", "Or", "Not", "True", "False", "Undefined", "Async", "Await",
];

const builtins = [
  "Сообщить", "СтрДлина", "Сред", "Лев", "Прав", "СтрНайти", "СтрЗаменить", "СтрРазделить", "СтрСоединить",
  "СтрШаблон", "ВРег", "НРег", "ТРег", "СокрЛП", "СокрЛ", "СокрП", "Формат", "Строка", "Число", "Дата",
  "Булево", "Тип", "ТипЗнч", "ТекущаяДата", "НачалоДня", "КонецДня", "НачалоМесяца", "КонецМесяца",
  "НачалоГода", "Год", "Месяц", "День", "Час", "Минута", "Секунда", "ДобавитьМесяц", "Окр", "Цел", "Макс",
  "Мин", "Pow", "Sqrt", "ЗначениеЗаполнено", "ЗаполнитьЗначенияСвойств", "ОписаниеОшибки",
  "ИнформацияОбОшибке", "КраткоеПредставлениеОшибки", "ПодробноеПредставлениеОшибки", "Символы", "НСтр",
  "Массив", "Структура", "Соответствие", "ТаблицаЗначений", "СписокЗначений", "ДеревоЗначений",
  "ФиксированныйМассив", "ФиксированнаяСтруктура", "ФиксированноеСоответствие", "ОписаниеТипов",
];

export function registerBsl(monaco) {
  if (monaco.languages.getLanguages().some((l) => l.id === "bsl")) return;
  monaco.languages.register({ id: "bsl", extensions: [".bsl", ".os"], aliases: ["BSL", "1С"] });
  monaco.languages.setLanguageConfiguration("bsl", {
    comments: { lineComment: "//" },
    brackets: [["(", ")"], ["[", "]"]],
    autoClosingPairs: [{ open: "(", close: ")" }, { open: "[", close: "]" }, { open: '"', close: '"', notIn: ["string"] }],
    wordPattern: /[\p{L}_][\p{L}\p{N}_]*/u,
    indentationRules: {
      increaseIndentPattern: /^\s*(Если|ИначеЕсли|Иначе|Для|Пока|Процедура|Функция|Попытка|Исключение|If|ElsIf|Else|For|While|Procedure|Function|Try|Except)\b.*$/iu,
      decreaseIndentPattern: /^\s*(КонецЕсли|ИначеЕсли|Иначе|КонецЦикла|КонецПроцедуры|КонецФункции|Исключение|КонецПопытки|EndIf|ElsIf|Else|EndDo|EndProcedure|EndFunction|Except|EndTry)\b.*$/iu,
    },
  });
  monaco.languages.setMonarchTokensProvider("bsl", {
    ignoreCase: true,
    unicode: true,
    keywords,
    builtins,
    tokenizer: {
      root: [
        [/\/\/.*$/, "comment"],
        [/^\s*#.*$/, "keyword.directive"],
        [/^\s*&[\p{L}]+/u, "annotation"],
        [/"/, "string", "@string"],
        [/^\s*\|/, "string", "@string"],
        [/'[0-9.\-: ]*'/, "number.date"],
        [/\d+(\.\d+)?/, "number"],
        [/[\p{L}_][\p{L}\p{N}_]*/u, { cases: { "@keywords": "keyword", "@builtins": "type", "@default": "identifier" } }],
        [/[=<>+\-*/%?]+/, "operator"],
        [/[;,.()[\]]/, "delimiter"],
      ],
      string: [
        [/[^"]+$/, "string", "@pop"], // многострочная строка: продолжение на следующей строке с |
        [/[^"]+/, "string"],
        [/""/, "string.escape"],
        [/"/, "string", "@pop"],
      ],
    },
  });
  const rules = (dark) => [
    { token: "keyword", foreground: dark ? "ff7b72" : "c0262d", fontStyle: "bold" },
    { token: "keyword.directive", foreground: dark ? "d2a8ff" : "8250df" },
    { token: "annotation", foreground: dark ? "d2a8ff" : "8250df" },
    { token: "type", foreground: dark ? "79c0ff" : "0550ae" },
    { token: "string", foreground: dark ? "a5d6ff" : "0a3069" },
    { token: "string.escape", foreground: dark ? "ffa657" : "953800" },
    { token: "number", foreground: dark ? "ffcc66" : "953800" },
    { token: "number.date", foreground: dark ? "ffcc66" : "953800" },
    { token: "comment", foreground: dark ? "8b949e" : "6e7781", fontStyle: "italic" },
  ];
  monaco.editor.defineTheme("bsl-dark", { base: "vs-dark", inherit: true, rules: rules(true), colors: { "editor.background": "#14161b" } });
  monaco.editor.defineTheme("bsl-light", { base: "vs", inherit: true, rules: rules(false), colors: { "editor.background": "#fbfaf7" } });
}

export const prefersDark = () => document.documentElement.dataset.theme === "dark";
