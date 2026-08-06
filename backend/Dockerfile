# =============================================================================
# Backend Dockerfile — Soosky HRM API (Express 5 + TypeScript -> Node)
# -----------------------------------------------------------------------------
# Package manager DUY NHẤT của dự án là pnpm (xem "packageManager" trong
# package.json). Corepack đọc trường đó và cài đúng phiên bản pnpm -> image
# build ra giống hệt máy dev và giống hệt CI.
#
# 2 chặng:
#   - build:   cài đủ dependency (kể cả dev) để chạy tsc + tsc-alias -> dist/
#   - runtime: chỉ cài dependency production, copy dist/ sang -> image nhẹ.
# =============================================================================

FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Cache layer: chỉ manifest + lockfile trước, đổi source không phải cài lại deps.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build


FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
