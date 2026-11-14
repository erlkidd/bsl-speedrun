# Сборка из корня репозитория: docker build -f api/Dockerfile .
FROM node:22-bookworm-slim

ARG ONESCRIPT_VERSION=2.2.0
RUN apt-get update \
 && apt-get install -y --no-install-recommends unzip libicu72 ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ADD https://github.com/EvilBeaver/OneScript/releases/download/v${ONESCRIPT_VERSION}/OneScript-${ONESCRIPT_VERSION}-linux-x64.zip /tmp/onescript.zip
RUN mkdir -p /opt/onescript \
 && unzip -q /tmp/onescript.zip -d /opt/onescript \
 && rm /tmp/onescript.zip \
 && BIN="$(find /opt/onescript -type f -name oscript | head -n 1)" \
 && test -n "$BIN" \
 && chmod -R a+rX /opt/onescript && chmod +x "$BIN" \
 && ln -s "$BIN" /usr/local/bin/oscript \
 # дымовой тест: OneScript запускается и печатает кириллицу
 && printf 'Сообщить("OneScript OK: " + Строка(2 + 2));\n' > /tmp/smoke.os \
 && oscript /tmp/smoke.os && rm /tmp/smoke.os

ENV DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_gcServer=0 \
    NODE_ENV=production \
    OSCRIPT_BIN=oscript \
    CONTENT_DIR=/app/content

WORKDIR /app/api
COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev
COPY api/src ./src
COPY api/runtime ./runtime
COPY content /app/content

# каталог сокета принадлежит node — именованный том унаследует права
RUN mkdir -p /sock /data && chown node:node /sock /data
USER node
CMD ["node", "src/server.js"]
