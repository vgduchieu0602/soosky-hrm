#!/usr/bin/env bash
# =============================================================================
# deploy.sh — deploy lại trên VPS sau khi push code mới
# -----------------------------------------------------------------------------
# Vòng đời: (máy bạn) git push -> CI xanh -> (VPS) chạy script này.
#
# CÁCH DÙNG (trên VPS, trong thư mục stack — /srv/hrm-prod hoặc /srv/hrm-staging):
#     ./deploy.sh              # deploy toàn bộ
#     ./deploy.sh backend      # chỉ build lại + restart backend
#     ./deploy.sh frontend     # chỉ build lại + restart frontend
#
# Môi trường (production/staging) do file .env trong THƯ MỤC HIỆN TẠI quyết
# định — STACK_NAME, PUBLIC_DOMAIN và COMPOSE_FILE nằm cả trong đó. Không có
# cờ --env: hai môi trường là hai thư mục, hai .env, hai stack Docker riêng.
#
# Lần đầu:  chmod +x deploy.sh
# =============================================================================

set -euo pipefail   # gặp lỗi là dừng ngay, không deploy nửa vời

SERVICE="${1:-}"    # tham số đầu tiên (backend/frontend) — bỏ trống = tất cả

# --- [0] Kiểm tra tiền đề ----------------------------------------------------
# Thiếu .env thì container backend sẽ chết vì thiếu AUTH_JWT_SECRET/SMTP_HOST —
# chặn ngay ở đây để báo lỗi cho rõ ràng thay vì bắt người deploy đọc log.
if [ ! -f .env ]; then
    echo "LOI: khong tim thay .env trong $(pwd)" >&2
    echo "     cp .env.production.example .env   (hoac .env.staging.example)" >&2
    echo "     roi dien gia tri that va: chmod 600 .env" >&2
    exit 1
fi

# .env chứa secret: chỉ user chạy deploy được đọc.
perms="$(stat -c '%a' .env)"
if [ "${perms}" != "600" ]; then
    echo "CANH BAO: .env dang co quyen ${perms}. Dang sua ve 600."
    chmod 600 .env
fi

STACK_NAME="$(grep -E '^STACK_NAME=' .env | cut -d= -f2- | tr -d '"' || true)"
echo "==> Stack: ${STACK_NAME:-hrm}   (thu muc: $(pwd))"

echo "==> [1/5] Keo code moi nhat tu git..."
git pull --ff-only   # chỉ nhận khi không xung đột, tránh merge bậy trên server

echo "==> [2/5] Build lai image..."
docker compose build ${SERVICE}

echo "==> [3/5] Khoi dong lai container..."
# up -d áp dụng image mới. MongoDB không bị đụng tới (volume dữ liệu giữ nguyên);
# chỉ container có image mới mới được tạo lại.
docker compose up -d ${SERVICE}

echo "==> [4/5] Cho backend bao healthy..."
status=""
for _ in $(seq 1 30); do
    status="$(docker compose ps --format '{{.Service}} {{.Health}}' | awk '$1=="backend"{print $2}')"
    [ "${status}" = "healthy" ] && break
    sleep 5
done
if [ "${status}" != "healthy" ]; then
    echo "LOI: backend khong healthy sau 150s. Log 50 dong cuoi:" >&2
    docker compose logs --tail 50 backend >&2
    exit 1
fi

echo "==> [5/5] Don image cu khong con dung..."
docker image prune -f

echo ""
echo "Deploy xong. Trang thai hien tai:"
docker compose ps
