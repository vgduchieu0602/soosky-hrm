#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Script deploy lại trên VPS sau khi bạn push code mới
# -----------------------------------------------------------------------------
# TƯ TƯỞNG:
#   Mỗi lần sửa code, vòng đời là: (máy bạn) git push  ->  (VPS) chạy script này.
#   Script gói gọn 3 việc bạn hay làm bằng tay thành 1 lệnh, và LÀM AN TOÀN:
#     1. Kéo code mới về (git pull).
#     2. Build lại image + khởi động lại container (chỉ service nào đổi).
#     3. Dọn image cũ để VPS khỏi đầy ổ cứng.
#
# CÁCH DÙNG (trên VPS, trong thư mục dự án):
#     ./deploy.sh              # deploy toàn bộ
#     ./deploy.sh backend      # chỉ build lại + restart backend
#     ./deploy.sh frontend     # chỉ build lại + restart frontend
#
# Lần đầu nhớ cấp quyền chạy:  chmod +x deploy.sh
# =============================================================================

set -euo pipefail   # gặp lỗi là dừng ngay, không deploy nửa vời

SERVICE="${1:-}"    # tham số đầu tiên (backend/frontend) — bỏ trống = tất cả

echo "==> [1/4] Kéo code mới nhất từ git..."
git pull --ff-only   # --ff-only: chỉ nhận khi không xung đột, tránh merge bậy trên server

echo "==> [2/4] Build lại image..."
# --build: build lại; nếu chỉ định SERVICE thì chỉ build cái đó cho nhanh.
docker compose build $SERVICE

echo "==> [3/4] Khởi động lại container..."
# up -d: áp dụng image mới. Docker tự thay container, MongoDB không bị đụng tới
# (volume dữ liệu giữ nguyên). Chỉ container có image mới mới được tạo lại.
docker compose up -d $SERVICE

echo "==> [4/4] Dọn image cũ không còn dùng..."
docker image prune -f   # xoá layer mồ côi -> giải phóng ổ cứng VPS

echo ""
echo "✅ Deploy xong. Trạng thái hiện tại:"
docker compose ps
