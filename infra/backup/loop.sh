#!/usr/bin/env bash
# =============================================================================
# loop.sh — bộ hẹn giờ của container backup.
# -----------------------------------------------------------------------------
# Vì sao không dùng cron? Cron trong container cần daemon riêng, nuốt biến môi
# trường của container và log đi lạc chỗ. Vòng lặp ngủ tới mốc giờ kế tiếp thì
# đơn giản hơn, log ra thẳng `docker compose logs`, và không lệch nhịp vì mỗi
# vòng tính lại từ đồng hồ thật chứ không cộng dồn.
# =============================================================================
set -euo pipefail

BACKUP_ENABLED="${BACKUP_ENABLED:-true}"
BACKUP_AT_HOUR="${BACKUP_AT_HOUR:-2}"   # giờ UTC chạy hằng ngày

if [ "${BACKUP_ENABLED}" != "true" ]; then
    echo "[backup] BACKUP_ENABLED=${BACKUP_ENABLED} -> tat sao luu tu dong, container ngu."
    # Vẫn giữ container sống để còn `docker compose exec` chạy tay khi cần.
    while true; do sleep 86400; done
fi

echo "[backup] lich: moi ngay luc ${BACKUP_AT_HOUR}:00 UTC"

while true; do
    now_epoch="$(date -u +%s)"
    # Mốc chạy hôm nay; đã qua rồi thì lùi sang ngày mai.
    next_epoch="$(date -u -d "today ${BACKUP_AT_HOUR}:00" +%s)"
    if [ "${next_epoch}" -le "${now_epoch}" ]; then
        next_epoch="$(date -u -d "tomorrow ${BACKUP_AT_HOUR}:00" +%s)"
    fi

    sleep_seconds=$(( next_epoch - now_epoch ))
    echo "[backup] lan chay ke tiep: $(date -u -d "@${next_epoch}" '+%F %T') UTC (sau ${sleep_seconds}s)"
    sleep "${sleep_seconds}"

    # Backup lỗi KHÔNG được giết container — lần sau vẫn phải thử lại.
    /usr/local/bin/backup.sh || echo "[backup] LAN CHAY THAT BAI, se thu lai vao lich sau" >&2
done
