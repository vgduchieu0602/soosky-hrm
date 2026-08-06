# =============================================================================
# Image sao lưu MongoDB — mongodump + aws-cli trong một container.
# -----------------------------------------------------------------------------
# Dựa trên image mongo chính chủ vì nó đã có sẵn bộ công cụ database
# (mongodump/mongorestore) khớp đúng phiên bản server. Chỉ thêm aws-cli để đẩy
# bản dump lên S3/Backblaze B2.
# =============================================================================
FROM mongo:7

# awscli từ kho Ubuntu: không cần pip, không cần Python venv, vá lỗi theo distro.
RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli ca-certificates tzdata \
    && rm -rf /var/lib/apt/lists/*

COPY backup.sh  /usr/local/bin/backup.sh
COPY restore.sh /usr/local/bin/restore.sh
COPY loop.sh    /usr/local/bin/loop.sh
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/loop.sh

WORKDIR /backups

CMD ["/usr/local/bin/loop.sh"]
