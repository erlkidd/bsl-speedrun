// Подсветка языка запросов 1С для статического текста и редактора-наложения.
const KW = new Set("ВЫБРАТЬ ИЗ ГДЕ КАК ПО И ИЛИ НЕ В СОЕДИНЕНИЕ ЛЕВОЕ ПРАВОЕ ПОЛНОЕ ВНУТРЕННЕЕ ВНЕШНЕЕ СГРУППИРОВАТЬ ИМЕЮЩИЕ УПОРЯДОЧИТЬ ОБЪЕДИНИТЬ ПОМЕСТИТЬ ИТОГИ ИНДЕКСИРОВАТЬ ВЫБОР КОГДА ТОГДА ИНАЧЕ КОНЕЦ МЕЖДУ ПОДОБНО ЕСТЬ ВОЗР УБЫВ ВСЕ РАЗЛИЧНЫЕ ПЕРВЫЕ РАЗРЕШЕННЫЕ УНИЧТОЖИТЬ ИЕРАРХИИ ОБЩИЕ NULL ИСТИНА ЛОЖЬ НЕОПРЕДЕЛЕНО АВТОУПОРЯДОЧИВАНИЕ".split(" "));
const FN = new Set("СУММА КОЛИЧЕСТВО МАКСИМУМ МИНИМУМ СРЕДНЕЕ ЕСТЬNULL ЗНАЧЕНИЕ ВЫРАЗИТЬ ДАТАВРЕМЯ НАЧАЛОПЕРИОДА КОНЕЦПЕРИОДА ДОБАВИТЬКДАТЕ РАЗНОСТЬДАТ ГОД КВАРТАЛ МЕСЯЦ ДЕНЬ ПОДСТРОКА ПРЕДСТАВЛЕНИЕ ТИПЗНАЧЕНИЯ ТИП".split(" "));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function highlightQuery(code) {
  const re = /(\/\/[^\n]*)|("(?:[^"\n]|"")*"?)|(&[\p{L}_][\p{L}\p{N}_]*)|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)(\s*\()?|([\s\S])/gu;
  let out = "", m;
  while ((m = re.exec(code))) {
    const [t, com, str, par, num, word, call] = m;
    if (com) out += `<span class="t-com">${esc(com)}</span>`;
    else if (str) out += `<span class="t-str">${esc(str)}</span>`;
    else if (par) out += `<span class="t-ann">${esc(par)}</span>`;
    else if (num) out += `<span class="t-num">${num}</span>`;
    else if (word) {
      const u = word.toUpperCase().replace(/Ё/g, "Е");
      out += (KW.has(u) && !(call && FN.has(u)) ? `<span class="t-kw">${word}</span>` : call && FN.has(u) ? `<span class="t-fn">${word}</span>` : word) + (call ? esc(call) : "");
    } else out += esc(t);
  }
  return out;
}
