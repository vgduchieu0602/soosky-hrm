#!/usr/bin/env bash
# =============================================================================
# restore-drill.sh — DIỄN TẬP khôi phục, chạy trên VPS (ngoài container).
# -----------------------------------------------------------------------------
# Backup chưa từng khôi phục thử thì chưa phải backup. Script này chứng minh
# bản dump mới nhất thực sự dùng được, mà KHÔNG đụng vào dữ liệu thật:
#
#   1. chụp một bản backup mới (để diễn tập trên đúng thứ đang chạy),
#   2. khôi phục nó sang database tạm `<db>-drill`,
#   3. đếm document từng collection và so với database thật,
#   4. xoá database tạm.
#
# CÁCH DÙNG (thư mục dự án, cùng chỗ với docker-compose.yml):
#     ./infra/backup/restore-drill.sh
#
# Nên chạy ÍT NHẤT MỖI THÁNG MỘT LẦN và ghi kết quả vào RUNBOOK.md.
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/../.."   # về thư mục gốc dự án

DB="$(grep -E '^MONGODB_DB=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)"
DB="${DB:-soosky-hrm}"
DRILL_DB="${DB}-drill"

echo "==> [1/5] Chup ban backup moi"
docker compose exec -T mongo-backup backup.sh

echo "==> [2/5] Tim ban dump moi nhat"
latest="$(docker compose exec -T mongo-backup bash -c 'ls -1t /backups/*.archive.gz | head -1' | tr -d '\r')"
echo "    ${latest}"

echo "==> [3/5] Khoi phuc sang database tam '${DRILL_DB}' (du lieu that khong bi dung toi)"
docker compose exec -T mongo-backup restore.sh "${latest}" "${DRILL_DB}"

echo "==> [4/5] So sanh so document giua '${DB}' va '${DRILL_DB}'"
docker compose exec -T mongodb mongosh --quiet --eval "
    const real  = db.getSiblingDB('${DB}');
    const drill = db.getSiblingDB('${DRILL_DB}');
    const names = [...new Set([...real.getCollectionNames(), ...drill.getCollectionNames()])].sort();
    let mismatch = 0;
    print('collection'.padEnd(36) + 'that'.padStart(8) + 'dientap'.padStart(10) + '  ket qua');
    for (const name of names) {
        const a = real.getCollection(name).countDocuments();
        const b = drill.getCollection(name).countDocuments();
        // Backup chụp trước bước đếm nên số liệu chỉ lệch nếu có ghi xen giữa;
        // trên hệ thống đang chạy, lệch nhỏ ở collection log là bình thường.
        const ok = a === b;
        if (!ok) mismatch++;
        print(name.padEnd(36) + String(a).padStart(8) + String(b).padStart(10) + '  ' + (ok ? 'OK' : 'LECH'));
    }
    print('');
    print(mismatch === 0 ? 'DIEN TAP DAT: moi collection khop.' : 'DIEN TAP CO ' + mismatch + ' COLLECTION LECH - kiem tra lai.');
"

echo "==> [5/5] Xoa database tam"
docker compose exec -T mongodb mongosh --quiet --eval "db.getSiblingDB('${DRILL_DB}').dropDatabase()"

echo ""
echo "Dien tap xong. Ghi ngay chay + ket qua vao RUNBOOK.md."
