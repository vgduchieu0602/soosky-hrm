# =============================================================================
# Backend Dockerfile — Soosky HRM API
# -----------------------------------------------------------------------------
# TƯ TƯỞNG (vì sao làm như vầy):
#
#   1. "Multi-stage build": ta chia Dockerfile thành nhiều CHẶNG (stage).
#      - Chặng build cần TypeScript, devDependencies, mã nguồn -> nặng.
#      - Chặng chạy (runtime) chỉ cần file đã biên dịch (dist) + prod deps -> nhẹ.
#      Kết quả: image cuối cùng nhỏ, không chứa source code / công cụ build,
#      khởi động nhanh và ít bề mặt tấn công hơn trên VPS.
#
#   2. "Layer caching": Docker cache theo từng dòng. Ta COPY file khai báo
#      dependency (package.json + lockfile) TRƯỚC, cài deps, RỒI mới COPY source.
#      Nhờ vậy khi bạn chỉ sửa code (không đổi deps), Docker dùng lại layer cài
#      đặt đã cache -> build lại cực nhanh.
#
#   3. Dùng pnpm qua "corepack" (đi kèm Node) để khớp với lockfile của dự án.
# =============================================================================


# ---------- Chặng 1: deps (cài TẤT CẢ dependencies, kể cả dev) ----------------
# Cần devDependencies (typescript, @types/*) để biên dịch ở chặng build.
FROM node:22-alpine AS deps

WORKDIR /app

# Bật pnpm (corepack có sẵn trong image Node, không phải cài thêm).
RUN corepack enable

# Chỉ copy file khai báo deps trước -> tận dụng cache (xem tư tưởng #2).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# --frozen-lockfile: cài đúng version trong lockfile, fail nếu lockfile lệch.
# Đây là điều ta MUỐN ở môi trường build để đảm bảo tính tái lập (reproducible).
RUN pnpm install --frozen-lockfile


# ---------- Chặng 2: build (biên dịch TypeScript -> JavaScript) ---------------
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Lấy lại node_modules đã cài ở chặng deps (không cần cài lại).
COPY --from=deps /app/node_modules ./node_modules

# Giờ mới copy toàn bộ source. Nếu chỉ source đổi, chặng deps phía trên vẫn cache.
COPY . .

# "pnpm build" = tsc -p tsconfig.json -> sinh ra thư mục ./dist
RUN pnpm build


# ---------- Chặng 3: deps-prod (chỉ dependencies chạy thật) -------------------
# Tách riêng để node_modules ở runtime KHÔNG kèm devDependencies.
FROM node:22-alpine AS deps-prod

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# --prod: bỏ qua devDependencies -> node_modules gọn hơn nhiều.
RUN pnpm install --frozen-lockfile --prod


# ---------- Chặng 4: runtime (image cuối cùng đem deploy) ---------------------
FROM node:22-alpine AS runtime

# NODE_ENV=production: bật tối ưu của các thư viện (vd Express), tắt log debug.
ENV NODE_ENV=production

WORKDIR /app

# Chạy bằng user "node" (có sẵn trong image), KHÔNG chạy bằng root.
# Tư tưởng bảo mật: nếu app bị khai thác, kẻ tấn công không có quyền root trong container.
USER node

# Chỉ mang vào những gì CẦN để chạy:
#   - node_modules bản production (từ deps-prod)
#   - thư mục dist đã biên dịch (từ build)
#   - package.json (để biết "start" script / metadata)
COPY --chown=node:node --from=deps-prod /app/node_modules ./node_modules
COPY --chown=node:node --from=build     /app/dist          ./dist
COPY --chown=node:node package.json ./

# Tài liệu hoá cổng app lắng nghe (khớp env PORT=3000). EXPOSE chỉ mang tính
# khai báo, việc map cổng ra ngoài do docker-compose quyết định.
EXPOSE 3000

# Lệnh khởi động: chạy file đã biên dịch. Tương đương "pnpm start".
CMD ["node", "dist/server.js"]
