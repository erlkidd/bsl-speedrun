<p align="center">
  <img src="brand/logo-light.png" alt="bsl speedrun" width="320">
</p>

# bsl-speedrun.kz

Тренажёр по языку 1С (BSL): практика с автопроверкой, песочница на OneScript, тесты по теории, база знаний по платформе и БСП.

## Что внутри

| Раздел | Что умеет |
|---|---|
| **Практика** | задачи с условием, подсказками и эталонным решением; проверка: запрещённые вызовы → синтаксис (`oscript -check`) → правила задачи → тесты |
| **Песочница** | любой BSL-код на OneScript: коллекции, строки, даты, `Сообщить()`; без файлов, сети и системных команд, лимит 5 с |
| **Теория** | тесты по темам; при неверном ответе — правильный и объяснение |
| **База знаний** | статьи по платформе и языку, отдельный раздел по БСП |
| **Редактор** | Monaco + BSL Language Server: ошибки и замечания линтера, автодополнение, подсказки по методам, форматирование |

**Стек:** React + Vite + Monaco · Node.js (Fastify) · OneScript 2.2 · BSL Language Server 1.0.7 · Caddy · Docker Compose.

## Запуск (везде одинаково — Docker)

Нужен только Docker (на Windows — Docker Desktop с WSL2).

```bash
cp .env.example .env          # Windows: copy .env.example .env
docker compose up -d --build
```

Сайт: http://localhost. Первая сборка скачивает OneScript и BSL Language Server — 3–5 минут.

| Сервис | Что делает |
|---|---|
| `web` | Caddy: фронтенд, HTTPS, прокси `/api` и `/lsp` |
| `api` | Node.js + OneScript 2.2. **Без сети**, файловая система только для чтения, лимиты памяти/CPU; с Caddy общается через unix-сокет |
| `bsl-ls` | BSL Language Server (websocket): линтер, автодополнение, hover, форматирование |

## Публикация на домене

1. VPS: Ubuntu 22.04+/24.04, **2 vCPU / 4 ГБ RAM** (BSL LS — Java, ~1 ГБ).
2. Установить Docker: `curl -fsSL https://get.docker.com | sh`.
3. У регистратора домена: A-записи `bsl-speedrun.kz` и `www` → IP сервера.
4. На сервере:
   ```bash
   git clone <repo> bsl-speedrun && cd bsl-speedrun
   cp .env.example .env
   # в .env: SITE_ADDRESS=bsl-speedrun.kz, www.bsl-speedrun.kz
   docker compose up -d --build
   ```
   Caddy сам получит сертификат Let's Encrypt (порты 80 и 443 должны быть открыты).
5. Обновление: `git pull && docker compose up -d --build`.

## Разработка без Docker

### Windows (PowerShell)

1. Скачать в папку `tools\` (она в `.gitignore`):
   - [OneScript-2.2.0-win-x64.zip](https://github.com/EvilBeaver/OneScript/releases/tag/v2.2.0) → распаковать в `tools\onescript`;
   - [bsl-language-server_win.zip](https://github.com/1c-syntax/bsl-language-server/releases/tag/v1.0.7) → распаковать в `tools\bsl-ls` (Java внутри, ставить не нужно).
2. Три окна терминала:
   ```powershell
   # 1. API
   cd api; npm.cmd ci
   $env:OSCRIPT_BIN = "$PWD\..\tools\onescript\bin\oscript.exe"; $env:PORT = "8787"; node src/server.js

   # 2. BSL LS
   tools\bsl-ls\bsl-language-server\bsl-language-server.exe websocket --server.port=8025

   # 3. Сайт
   cd web; npm.cmd ci; npm.cmd run dev
   ```
3. Открыть http://127.0.0.1:5173.

### Linux / macOS

```bash
cd api && npm install && OSCRIPT_BIN=путь/к/oscript PORT=8787 npm start
cd web && npm install && npm run dev          # http://localhost:5173
```

В PowerShell вместо `npm` используй `npm.cmd`, если скрипты запрещены политикой. Линтер в dev-режиме ждёт BSL LS на `:8025`:
`java -jar bsl-language-server-exec.jar websocket --server.port=8025`.

## Контент — просто файлы в `content/`

```
content/
  tasks/<id>/        задача практики
    task.md            условие (Markdown)
    meta.yaml          название, сложность, теги, подсказки, тесты, правила
    starter.os         заготовка
    solution.os        эталонное решение
  quiz/*.yaml        теория: вопросы, варианты, номер правильного (с 0), объяснение
  kb/general/*.md    база знаний: платформа и язык
  kb/bsp/*.md        база знаний: БСП
  sandbox/*.os       примеры для песочницы (первая строка-комментарий = название)
```

### Тесты задачи (`meta.yaml`)

```yaml
function: СуммаМассива
cases:
  - args: [[1, 2, 3]]        # массив → Массив
    expected: 6
  - args: [{Имя: "Артур"}]   # объект → Структура
    expected: {$map: [["ключ", 1]]}   # → Соответствие
  - args: [{$date: "2026-01-01"}]     # → Дата
    expected: null           # → Неопределено
rules:
  required:  [{pattern: 'Для\s+Каждого', message: Используй цикл «Для Каждого»}]
  forbidden: [{pattern: '\.\s*Найти\s*\(', message: Без Массив.Найти()}]
```

Для задач «на вывод»: `mode: output` и `expectedOutput: |` с ожидаемым текстом.

Проверка: запрещённые вызовы → `oscript -check` → правила задачи → запуск кода ученика с проверочным кодом (`api/runtime/harness.os`).

## Безопасность песочницы

1. Контейнер `api`: `network_mode: none`, read-only FS, tmpfs `/tmp`, `cap_drop: ALL`, лимиты памяти/CPU/процессов.
2. Таймаут 5 с, лимит вывода 64 КБ, не больше 2 запусков параллельно, 30 запусков в минуту с IP.
3. До запуска отсекаются файлы, сеть, процессы, `Выполнить`/`Вычислить`, `#Использовать` (`api/src/guard.js`).

## Материалы speedrunit.ru

`speedrunit/scrape.py` скачивает вопросы в `speedrunit/` (папка в `.gitignore`, только для личного использования). На сайт тексты оттуда не копируются: по их темам написаны свои вопросы и статьи.
