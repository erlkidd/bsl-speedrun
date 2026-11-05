FROM eclipse-temurin:21-jre

ARG BSL_LS_VERSION=1.0.7
ADD https://github.com/1c-syntax/bsl-language-server/releases/download/v${BSL_LS_VERSION}/bsl-language-server-${BSL_LS_VERSION}-exec.jar /app/bsl-language-server.jar

RUN useradd -r -u 1001 bslls && chmod 444 /app/bsl-language-server.jar
USER bslls
WORKDIR /app
EXPOSE 8025

ENV JAVA_TOOL_OPTIONS="-Xmx768m -XX:+UseSerialGC"
CMD ["java", "-jar", "/app/bsl-language-server.jar", "websocket", "--server.port=8025"]
