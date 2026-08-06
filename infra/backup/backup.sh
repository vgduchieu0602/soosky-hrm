#!/usr/bin/env bash
# =============================================================================
# backup.sh — chụp một bản sao lưu MongoDB, dọn bản cũ, đẩy lên S3 (nếu có).
# -----------------------------------------------------------------------------
# Chạy trong container `mongo-backup`. Gọi thủ công bất cứ lúc nào:
#     docker compose exec mongo-backup backup.sh
#
# Kết quả: /backups/<STACK_NAME>-<DB>-<YYYYmmdd-HHMMSS>.archive.gz
# `mongodump --archive --gzip` cho ra MỘT file duy nhất -> dễ đếm, dễ copy, dễ
# upload; khác với dump dạng thư mục phải nén thêm một bước.
# =============================================================================
set -euo pipefail

STACK_NAME="${STACK_NAME:-hrm}"
MONGODB_DB="${MONGODB_DB:-soosky-hrm}"
MONGODB_URI="${MONGODB_URI:-mongodb://mongodb:27017/?replicaSet=rs0}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

timestamp="$(date -u +%Y%m%d-%H%M%S)"
archive="${BACKUP_DIR}/${STACK_NAME}-${MONGODB_DB}-${timestamp}.archive.gz"

mkdir -p "${BACKUP_DIR}"

echo "[backup] ${timestamp} — dump ${MONGODB_DB} -> ${archive}"
mongodump \
    --uri="${MONGODB_URI}" \
    --db="${MONGODB_DB}" \
    --archive="${archive}" \
    --gzip \
    --quiet

# Bản dump 0 byte = hỏng. Xoá ngay để không bao giờ nhầm nó là bản khôi phục được.
if [ ! -s "${archive}" ]; then
    echo "[backup] LOI: file dump rong, xoa va thoat" >&2
    rm -f "${archive}"
    exit 1
fi

size="$(du -h "${archive}" | cut -f1)"
echo "[backup] xong: ${archive} (${size})"

# --- Đẩy lên S3/Backblaze B2 (bỏ qua nếu chưa cấu hình) ----------------------
if [ -n "${S3_BUCKET:-}" ]; then
    endpoint_args=()
    [ -n "${S3_ENDPOINT:-}" ] && endpoint_args+=(--endpoint-url "${S3_ENDPOINT}")
    [ -n "${S3_REGION:-}" ]   && export AWS_DEFAULT_REGION="${S3_REGION}"

    remote="s3://${S3_BUCKET}/mongo-backups/${STACK_NAME}/$(basename "${archive}")"
    echo "[backup] upload -> ${remote}"
    aws "${endpoint_args[@]}" s3 cp "${archive}" "${remote}"
    echo "[backup] upload xong"
else
    echo "[backup] S3_BUCKET trong -> chi giu ban local (mat VPS la mat backup)"
fi

# --- Dọn bản cũ trên đĩa VPS -------------------------------------------------
# Chỉ dọn LOCAL. Bản trên S3 để lifecycle policy của bucket lo (xem RUNBOOK.md).
deleted="$(find "${BACKUP_DIR}" -maxdepth 1 -name "${STACK_NAME}-*.archive.gz" -mtime "+${BACKUP_KEEP_DAYS}" -print -delete | wc -l)"
echo "[backup] don ${deleted} ban cu hon ${BACKUP_KEEP_DAYS} ngay"

echo "[backup] con lai tren dia:"
ls -1sh "${BACKUP_DIR}" | tail -n +2
