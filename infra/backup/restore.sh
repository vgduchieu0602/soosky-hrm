#!/usr/bin/env bash
# =============================================================================
# restore.sh — khôi phục một bản dump vào MongoDB.
# -----------------------------------------------------------------------------
# CÁCH DÙNG (trong container mongo-backup):
#     restore.sh <file.archive.gz> [ten_db_dich]
#
# Không truyền tên db đích -> khôi phục ĐÈ lên đúng database gốc ($MONGODB_DB).
# Truyền tên db đích -> khôi phục sang database khác; đây là cách DIỄN TẬP an
# toàn: dữ liệu thật không hề bị đụng tới.
#
# Ví dụ diễn tập:
#     docker compose exec mongo-backup \
#         restore.sh /backups/hrm-soosky-hrm-20260802-020000.archive.gz restore-drill
# =============================================================================
set -euo pipefail

archive="${1:-}"
target_db="${2:-${MONGODB_DB:-soosky-hrm}}"
source_db="${MONGODB_DB:-soosky-hrm}"
MONGODB_URI="${MONGODB_URI:-mongodb://mongodb:27017/?replicaSet=rs0}"

if [ -z "${archive}" ]; then
    echo "Cach dung: restore.sh <file.archive.gz> [ten_db_dich]" >&2
    exit 1
fi
if [ ! -s "${archive}" ]; then
    echo "Khong tim thay (hoac file rong): ${archive}" >&2
    exit 1
fi

echo "[restore] ${archive} -> database '${target_db}'"

if [ "${target_db}" = "${source_db}" ]; then
    echo "[restore] CANH BAO: dang ghi de len DATABASE THAT '${source_db}'."
fi

# --nsFrom/--nsTo đổi tên database khi khôi phục sang chỗ khác.
# --drop xoá collection trùng tên TRONG DATABASE ĐÍCH trước khi nạp, để kết quả
# đúng bằng bản dump chứ không phải trộn lẫn dữ liệu cũ.
mongorestore \
    --uri="${MONGODB_URI}" \
    --archive="${archive}" \
    --gzip \
    --drop \
    --nsFrom="${source_db}.*" \
    --nsTo="${target_db}.*" \
    --quiet

echo "[restore] xong. Thong ke database '${target_db}':"
mongosh "${MONGODB_URI}" --quiet --eval "
    const db = db.getSiblingDB('${target_db}');
    db.getCollectionNames().sort().forEach(c => print(c.padEnd(36) + db.getCollection(c).countDocuments()));
"
