# Скачивает вопросы speedrunit.ru (1С разработчик / аналитик) в Markdown + JSON.
# Запуск: python scrape.py   (только stdlib). Повторный запуск берёт уже скачанные HTML из _html.
import html, json, os, re, time, urllib.request

BASE = "https://speedrunit.ru"
CATS = {"1c-developer": "1С Разработчик", "1c-analyst": "1С Аналитик"}
OUT = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "Mozilla/5.0 (bsl-speedrun personal study)"}


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8")
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 + i * 3)


def list_ids(cat):
    ids, page = [], 1
    while True:
        h = get(f"{BASE}/questions/{cat}/?page={page}")
        found = list(dict.fromkeys(i for i in re.findall(r'href="/question/(\d+)/', h) if i not in ids))
        if not found:
            break
        ids += found
        total = re.search(r"Всего записей:\s*(\d+)", h)
        print(f"  {cat} page {page}: +{len(found)} (на сайте {total.group(1) if total else '?'})", flush=True)
        page += 1
        time.sleep(0.5)
    return ids


def md(fragment):
    s = fragment

    def code(m):
        lang = (m.group(1) or "").lower()
        body = html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).replace("​", "").rstrip()
        lang = "bsl" if lang in ("1c", "bsl") else lang
        return f"\n```{lang}\n{body}\n```\n"

    s = re.sub(r'<pre><code(?: class="language-([^"]+)")?>(.*?)</code></pre>', code, s, flags=re.S)
    s = re.sub(r"<h(\d)[^>]*>(.*?)</h\1>", lambda m: "\n" + "#" * (int(m.group(1)) + 1) + " " + m.group(2) + "\n", s, flags=re.S)
    s = re.sub(r"<li[^>]*>(.*?)</li>", r"\n- \1", s, flags=re.S)
    s = re.sub(r"</?(ul|ol)[^>]*>", "\n", s)
    s = re.sub(r"<(strong|b)>(.*?)</\1>", r"**\2**", s, flags=re.S)
    s = re.sub(r"<(em|i)>(.*?)</\1>", r"*\2*", s, flags=re.S)
    s = re.sub(r"<code>(.*?)</code>", r"`\1`", s, flags=re.S)
    s = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"[\2](\1)", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"</?p[^>]*>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s).replace("​", "")
    return re.sub(r"\n{3,}", "\n\n", s).strip()


def parse(qid, h):
    title = html.unescape(re.search(r'<h1 class="question-title">(.*?)</h1>', h, re.S).group(1).strip())
    m = re.search(r'<div class="markdown-content">(.*?)</div>\s*</div>\s*<!-- Теги', h, re.S)
    topic = re.search(r'<strong>Тема:</strong>\s*<span class="tag">(.*?)</span>', h, re.S)
    stage = re.search(r'<span class="tag stage[^"]*">\s*(.*?)\s*</span>', h, re.S)
    body = md(m.group(1) if m else "")
    short = re.search(r"#+ 1️⃣[^\n]*\n(.*?)(?=\n#+ 2️⃣|\Z)", body, re.S)
    return {
        "id": int(qid),
        "url": f"{BASE}/question/{qid}/",
        "title": title,
        "topic": html.unescape(topic.group(1).strip()) if topic else "Без темы",
        "stage": stage.group(1).strip() if stage else "",
        "short_answer": short.group(1).strip() if short else "",
        "answer_md": body,
    }


def slug(s, n=60):
    s = re.sub(r'[<>:"/\\|?*\n\r\t]', "", s).strip().rstrip(".")
    return s[:n].strip()


def main():
    for cat, cat_name in CATS.items():
        print(f"== {cat_name}", flush=True)
        ids = list_ids(cat)
        cat_dir = os.path.join(OUT, cat)
        raw_dir = os.path.join(cat_dir, "_html")
        os.makedirs(raw_dir, exist_ok=True)
        items = []
        for n, qid in enumerate(ids, 1):
            raw = os.path.join(raw_dir, f"{qid}.html")
            if os.path.exists(raw):
                h = open(raw, encoding="utf-8").read()
            else:
                h = get(f"{BASE}/question/{qid}/")
                open(raw, "w", encoding="utf-8").write(h)
                time.sleep(0.4)
            try:
                q = parse(qid, h)
            except Exception as e:
                print(f"  !! {qid}: {e}", flush=True)
                continue
            q["category"] = cat_name
            items.append(q)
            tdir = os.path.join(cat_dir, slug(q["topic"], 80))
            os.makedirs(tdir, exist_ok=True)
            with open(os.path.join(tdir, f"{qid}-{slug(q['title'])}.md"), "w", encoding="utf-8") as f:
                f.write(f"---\nid: {qid}\ntitle: {json.dumps(q['title'], ensure_ascii=False)}\n"
                        f"category: {cat_name}\ntopic: {json.dumps(q['topic'], ensure_ascii=False)}\n"
                        f"stage: {q['stage']}\nsource: {q['url']}\n---\n\n# {q['title']}\n\n{q['answer_md']}\n")
            if n % 20 == 0:
                print(f"  {n}/{len(ids)}", flush=True)
        with open(os.path.join(cat_dir, "questions.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=1)
        by_topic = {}
        for q in items:
            by_topic.setdefault(q["topic"], []).append(q)
        with open(os.path.join(cat_dir, "INDEX.md"), "w", encoding="utf-8") as f:
            f.write(f"# {cat_name} — {len(items)} вопросов\n\nИсточник: {BASE}/questions/{cat}/\n")
            for t in sorted(by_topic):
                f.write(f"\n## {t} ({len(by_topic[t])})\n\n")
                for q in sorted(by_topic[t], key=lambda x: x["id"]):
                    link = f"{slug(t, 80)}/{q['id']}-{slug(q['title'])}.md".replace(" ", "%20")
                    f.write(f"- [{q['title']}]({link}) · {q['stage']}\n")
        print(f"  готово: {len(items)} вопросов", flush=True)


if __name__ == "__main__":
    main()
