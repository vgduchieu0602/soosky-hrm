# =============================================================================
# Frontend Dockerfile — Soosky HRM Web (React 19 + Vite -> Nginx)
# -----------------------------------------------------------------------------
# TƯ TƯỞNG:
#
#   Frontend là một SPA (Single Page Application). Sau khi build, nó chỉ còn là
#   các file tĩnh: index.html + JS + CSS. KHÔNG cần Node để "chạy" — chỉ cần một
#   web server tĩnh phục vụ chúng. Vì vậy:
#
#     - Chặng 1 (build): dùng Node + Vite để biên dịch React -> thư mục dist/.
#     - Chặng 2 (serve):  dùng Nginx (siêu nhẹ, siêu nhanh) chỉ để bê dist/ ra.
#
#   Image cuối cùng KHÔNG chứa Node, không chứa source -> chỉ ~vài chục MB.
#
#   LƯU Ý QUAN TRỌNG về biến môi trường của Vite:
#     Vite "nướng" (bake) biến VITE_* vào bundle ngay lúc BUILD, không phải lúc
#     chạy. Nghĩa là giá trị API URL được chốt tại đây. Ta truyền nó qua
#     build-arg VITE_API_BASE_URL với mặc định "/api/v1" (đường dẫn TƯƠNG ĐỐI).
#
#     Vì sao dùng đường dẫn tương đối? -> Trình duyệt sẽ gọi "/api/v1/..." cùng
#     domain với web. Nginx (cấu hình trong nginx.conf) bắt các request "/api"
#     và proxy sang container backend. Lợi ích:
#       * Không cần biết trước domain VPS lúc build.
#       * Cùng origin -> cookie httpOnly (refresh token) + withCredentials chạy
#         mượt, không vướng CORS.
# =============================================================================


# ---------- Chặng 1: build (React/Vite -> static files) ----------------------
FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

# Nhận giá trị API base URL từ ngoài (docker-compose). Mặc định "/api/v1".
ARG VITE_API_BASE_URL=/api/v1
# Đẩy build-arg thành ENV để lệnh "vite build" đọc được.
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Cache deps trước (xem tư tưởng layer-caching ở Dockerfile backend).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source rồi build. Kết quả nằm ở ./dist
COPY . .
RUN pnpm build


# ---------- Chặng 2: serve (Nginx phục vụ file tĩnh) --------------------------
FROM nginx:1.27-alpine AS runtime

# Thay cấu hình mặc định của Nginx bằng cấu hình SPA + proxy /api của ta.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Bê toàn bộ output build vào thư mục gốc web của Nginx.
COPY --from=build /app/dist /usr/share/nginx/html

# Nginx phục vụ ở cổng 80 trong container.
EXPOSE 80

# Chạy Nginx ở foreground (bắt buộc trong container — container sống theo
# tiến trình chính; "daemon off" giữ Nginx ở tiền cảnh).
CMD ["nginx", "-g", "daemon off;"]
