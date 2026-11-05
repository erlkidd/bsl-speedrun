import { useMemo } from "react";
import { Marked } from "marked";

const KW = /^(Если|Тогда|ИначеЕсли|Иначе|КонецЕсли|Для|Каждого|Из|По|Цикл|КонецЦикла|Пока|Прервать|Продолжить|Процедура|КонецПроцедуры|Функция|КонецФункции|Возврат|Перем|Экспорт|Знач|Попытка|Исключение|КонецПопытки|ВызватьИсключение|Новый|И|ИЛИ|НЕ|Истина|Ложь|Неопределено|ВЫБРАТЬ|ИЗ|ГДЕ|КАК|СГРУППИРОВАТЬ|УПОРЯДОЧИТЬ|ЛЕВОЕ|ВНУТРЕННЕЕ|СОЕДИНЕНИЕ|ПО|ПОМЕСТИТЬ|ИМЕЮЩИЕ|РАЗРЕШЕННЫЕ|ПЕРВЫЕ|РАЗЛИЧНЫЕ)$/i;
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Простая подсветка BSL для статического текста (без Monaco). */
export function highlightBsl(code) {
  const re = /(\/\/[^\n]*)|("(?:[^"\n]|"")*"?)|('[\d.\-: ]*')|(&[\p{L}]+)|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)|([\s\S])/gu;
  let out = "";
  let m;
  while ((m = re.exec(code))) {
    const [t, com, str, date, ann, num, word] = m;
    if (com) out += `<span class="t-com">${esc(com)}</span>`;
    else if (str) out += `<span class="t-str">${esc(str)}</span>`;
    else if (date || num) out += `<span class="t-num">${esc(t)}</span>`;
    else if (ann) out += `<span class="t-ann">${esc(ann)}</span>`;
    else if (word) out += KW.test(word) ? `<span class="t-kw">${word}</span>` : esc(word);
    else out += esc(t);
  }
  return out;
}

const marked = new Marked({
  gfm: true,
  renderer: {
    code({ text, lang }) {
      const l = (lang || "").toLowerCase();
      const body = ["bsl", "1c", "1с", "os", ""].includes(l) ? highlightBsl(text) : esc(text);
      return `<pre class="code"><code>${body}</code></pre>`;
    },
  },
});

export default function Markdown({ text, className = "" }) {
  const html = useMemo(() => marked.parse(text ?? ""), [text]);
  return <div className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
