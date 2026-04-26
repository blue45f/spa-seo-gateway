# syntax=docker/dockerfile:1.6
FROM node:24-slim AS deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/admin-ui/package.json packages/admin-ui/
COPY packages/multi-tenant/package.json packages/multi-tenant/
COPY packages/cms/package.json packages/cms/
COPY apps/gateway/package.json apps/gateway/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod=false

FROM node:24-slim AS build
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/apps ./apps
COPY . .
RUN pnpm run build

FROM node:24-slim AS prod-deps
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN corepack enable && corepack prepare pnpm@9.14.4 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_OPTIONS="--enable-source-maps"

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      ca-certificates \
      dumb-init \
      fonts-liberation \
      fonts-noto-color-emoji \
      fonts-noto-cjk \
      libasound2 \
      libatk-bridge2.0-0 \
      libatk1.0-0 \
      libcups2 \
      libdbus-1-3 \
      libgbm1 \
      libgtk-3-0 \
      libnspr4 \
      libnss3 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      tini \
      xdg-utils \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/packages ./packages
COPY --from=prod-deps /app/apps ./apps
COPY --from=build /app/packages/core/dist        ./packages/core/dist
COPY --from=build /app/packages/admin-ui/dist    ./packages/admin-ui/dist
COPY --from=build /app/packages/admin-ui/public  ./packages/admin-ui/public
COPY --from=build /app/apps/gateway/dist         ./apps/gateway/dist
COPY package.json pnpm-workspace.yaml ./

RUN useradd --create-home --shell /bin/bash app \
 && mkdir -p /home/app/.cache \
 && chown -R app:app /app /home/app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1

ENTRYPOINT ["/usr/bin/dumb-init","--"]
CMD ["node","apps/gateway/dist/main.js"]
