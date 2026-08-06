# 🚀 Hướng dẫn Deploy Soosky HRM bằng Docker lên VPS Contabo

> **CẬP NHẬT — đọc [RUNBOOK.md](RUNBOOK.md) trước.** Cấu trúc compose đã đổi:
> `docker-compose.yml` là BASE (không publish cổng nào), chọn thêm đúng một overlay
> `docker-compose.https.yml` (có tên miền, Caddy lo TLS) hoặc `docker-compose.expose.yml`
> (chưa có tên miền, mở cổng `WEB_PORT`). Mẫu biến môi trường không còn là
> `.env.docker.example` mà là `.env.production.example` / `.env.staging.example`.
> Package manager duy nhất là **pnpm**. Các bước VPS/Docker bên dưới vẫn đúng về
> tư tưởng; lệnh cụ thể lấy theo RUNBOOK.


> ⚠️ **Chạy nhiều dự án trên 1 VPS?** Đọc [DEPLOY-MULTI-PROJECT.md](DEPLOY-MULTI-PROJECT.md)
> trước. `docker-compose.yml` hiện đã theo chuẩn dùng chung Caddy proxy: frontend
> **không** còn mở cổng 80 trực tiếp mà gắn vào mạng `web` + nhãn domain. Vì vậy
> bạn **bắt buộc** dựng proxy chung ở `~/infra` (Phần A của doc kia) thì web mới
> truy cập được. Tài liệu này vẫn đúng cho phần VPS/Docker/env/seed/backup —
> riêng phần HTTPS (mục 6) đã được thay bằng Caddy proxy chung.

> Tài liệu này dắt tay bạn từ con số 0 (một VPS Contabo mới tinh) đến lúc HRM
> chạy thật trên Internet với HTTPS. Mỗi bước đều giải thích **tại sao**, không
> chỉ **làm gì** — để sau này bạn tự sửa được.

---

## 0. Bức tranh tổng thể (đọc 2 phút này trước)

Hệ thống chạy bằng **3 container** do `docker-compose` điều phối:

```
                 Internet (người dùng)
                        │  HTTPS (443)
                        ▼
                 ┌─────────────┐
                 │   Caddy     │  ← tự động cấp & gia hạn SSL (Let's Encrypt)
                 │ (tuỳ chọn)  │
                 └──────┬──────┘
                        │ HTTP (80)
                        ▼
   /api  ┌──────────────────────────┐
 ───────►│  frontend (Nginx)        │  ← phục vụ React + proxy /api
         └──────────────┬───────────┘
                        │ (mạng nội bộ Docker)
                        ▼
         ┌──────────────────────────┐
         │  backend (Node/Express)  │
         └──────────────┬───────────┘
                        │ mongoose
                        ▼
         ┌──────────────────────────┐
         │  mongodb (replica set)   │  ← bắt buộc replSet vì app dùng transactions
         └──────────────────────────┘
```

**Nguyên tắc vàng:** chỉ có frontend (và Caddy) lộ ra Internet. Backend và
MongoDB **không** mở cổng ra ngoài — chúng chỉ truy cập được trong mạng nội bộ
Docker. Kẻ tấn công không thể gõ thẳng vào API hay DB.

Các file đã tạo sẵn trong repo:

| File | Vai trò |
|------|---------|
| `backend/Dockerfile` | Đóng gói API (multi-stage, image gọn) |
| `frontend/Dockerfile` | Build React rồi nhét vào Nginx |
| `frontend/nginx.conf` | Phục vụ SPA + proxy `/api` sang backend |
| `docker-compose.yml` | Nhạc trưởng điều phối 3 container |
| `.env.docker.example` | Mẫu biến môi trường — copy thành `.env` |
| `*/.dockerignore` | Loại file rác khỏi build |

---

## 1. Chuẩn bị VPS Contabo

### 1.1. Tạo & truy cập VPS

1. Mua VPS Contabo (gói VPS S trở lên — HRM + Mongo nên có ≥ 4GB RAM).
2. Chọn OS: **Ubuntu 24.04 LTS** (hướng dẫn này dựa trên Ubuntu).
3. Contabo gửi IP + mật khẩu root qua email. Đăng nhập (từ máy bạn):

```bash
ssh root@<IP_VPS_CỦA_BẠN>
```

### 1.2. Tạo user thường (đừng làm việc bằng root)

> **Tư tưởng:** chạy mọi thứ bằng root rất nguy hiểm. Tạo user riêng, cấp quyền sudo.

```bash
adduser deploy                 # đặt mật khẩu khi được hỏi
usermod -aG sudo deploy        # cho phép dùng sudo
# (khuyến nghị) copy SSH key để login user deploy không cần mật khẩu
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

Từ giờ đăng nhập bằng: `ssh deploy@<IP_VPS>`

### 1.3. Cập nhật & cài Docker

```bash
sudo apt update && sudo apt upgrade -y

# Cài Docker Engine + Docker Compose plugin (script chính chủ của Docker)
curl -fsSL https://get.docker.com | sudo sh

# Cho user "deploy" chạy docker không cần sudo (đăng xuất/đăng nhập lại sau lệnh này)
sudo usermod -aG docker deploy
```

Đăng xuất rồi đăng nhập lại, kiểm tra:

```bash
docker --version
docker compose version
```

### 1.4. Bật tường lửa (chỉ mở cổng cần thiết)

> **Tư tưởng:** mặc định chặn hết, chỉ mở SSH + web. DB/API không có cổng nào ra ngoài.

```bash
sudo ufw allow OpenSSH        # cổng 22 — đừng quên kẻo tự khoá mình ngoài
sudo ufw allow 80/tcp         # HTTP
sudo ufw allow 443/tcp        # HTTPS
sudo ufw enable
sudo ufw status
```

---

## 2. Đưa mã nguồn lên VPS

```bash
cd ~
git clone <URL_REPO_CỦA_BẠN> hrm
cd hrm
```

> Nếu repo private: cấu hình deploy key / token. Nếu không dùng git, có thể
> `scp` thư mục dự án lên, nhưng git giúp cập nhật về sau dễ hơn nhiều.

---

## 3. Cấu hình biến môi trường (`.env`)

```bash
cp .env.docker.example .env
nano .env
```

**Sinh các secret mạnh** (chạy trên VPS, dán kết quả vào `.env`):

```bash
openssl rand -hex 32     # dùng cho JWT_ACCESS_SECRET
openssl rand -hex 32     # dùng cho JWT_REFRESH_SECRET
openssl rand -hex 24     # dùng cho MONGO_ROOT_PASSWORD
openssl rand -hex 24     # dùng cho MONGO_REPLICA_SET_KEY
```

Những giá trị **bắt buộc** đổi trong `.env`:

- `MONGO_ROOT_PASSWORD`, `MONGO_REPLICA_SET_KEY`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (mỗi cái ≥ 32 ký tự)
- `APP_WEB_URL` → `https://hrm.ten-mien-cua-ban.com`

Tuỳ chọn (điền khi cần gửi mail / upload file): `SMTP_*`, `S3_*`.

> ⚠️ File `.env` chứa secret và **đã được .gitignore** — tuyệt đối không commit.

---

## 4. Khởi chạy

```bash
# Build image + chạy nền (-d = detached). Lần đầu sẽ lâu (build React + cài deps).
docker compose up -d --build

# Xem trạng thái 3 container
docker compose ps

# Xem log realtime (Ctrl+C để thoát, container vẫn chạy)
docker compose logs -f
```

Container chạy đúng khi cột `STATUS` hiện `healthy`/`running`. Lúc này mở trình
duyệt vào `http://<IP_VPS>` đã thấy giao diện HRM.

> **Thứ tự khởi động:** compose chờ Mongo `healthy` → mới chạy backend → rồi
> frontend. Bạn không phải canh tay.

---

## 5. Tạo dữ liệu khởi tạo (seed tài khoản admin)

Image backend ở chế độ production **không kèm** công cụ chạy script (`tsx`).
Cách gọn nhất là chạy seed bằng một container Node tạm, dùng chung mạng Docker
để thấy được MongoDB nội bộ:

```bash
# Tên mạng thường là "<tên-thư-mục>_hrm-net". Kiểm tra bằng:
docker network ls | grep hrm-net

# Chạy seed (thay <NET> bằng tên mạng ở trên, ví dụ hrm_hrm-net):
docker run --rm -it \
  --network <NET> \
  --env-file .env \
  -e MONGO_URI="mongodb://mongodb:27017/${MONGO_DB_NAME}?replicaSet=rs0" \
  -v "$PWD/backend:/app" -w /app \
  node:22-alpine sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm seed"
```

> Sau này nếu seed thường xuyên, có thể thêm 1 service `seed` riêng vào compose.
> Kiểm tra `backend/scripts/` để biết các script seed có sẵn (`seed`, `seed:demo`).

---

## 6. Gắn tên miền + HTTPS (khuyến nghị cho production)

Chạy HTTP trần không an toàn (mật khẩu đi qua mạng dạng thô). Ta đặt **Caddy**
đứng trước — nó **tự xin và tự gia hạn chứng chỉ SSL miễn phí** từ Let's Encrypt.

### 6.1. Trỏ tên miền

Vào nhà cung cấp domain, tạo bản ghi **A**: `hrm.ten-mien.com → <IP_VPS>`.
Chờ DNS lan truyền (vài phút–vài giờ).

### 6.2. Thêm Caddy vào hệ thống

Tạo file `Caddyfile` ở thư mục gốc dự án:

```
hrm.ten-mien-cua-ban.com {
    # Caddy nhận HTTPS từ Internet rồi chuyển tiếp về container frontend (cổng 80).
    reverse_proxy frontend:80
}
```

Tạo file `docker-compose.override.yml` (compose tự động gộp file này):

```yaml
# File override: thêm Caddy và NGỪNG mở cổng 80 trực tiếp của frontend
# (để Caddy là cửa ngõ duy nhất, xử lý 80→443).
services:
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - frontend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data         # lưu chứng chỉ -> không xin lại mỗi lần restart
      - caddy_config:/config
    networks:
      - hrm-net

  frontend:
    ports: []                    # bỏ map "80:80" — chỉ Caddy lộ ra ngoài nữa

volumes:
  caddy_data:
  caddy_config:
```

Áp dụng:

```bash
docker compose up -d
```

Xong! Truy cập `https://hrm.ten-mien-cua-ban.com` — đã có ổ khoá xanh.

---

## 7. Vận hành hằng ngày (cheat sheet)

```bash
# Cập nhật code mới rồi build lại
git pull
docker compose up -d --build

# Khởi động lại 1 service
docker compose restart backend

# Xem log 1 service
docker compose logs -f backend

# Dừng toàn bộ (dữ liệu Mongo VẪN còn vì nằm ở volume)
docker compose down

# Dừng + XOÁ luôn dữ liệu (CẨN THẬN — mất sạch DB!)
docker compose down -v

# Vào shell trong container backend để debug
docker compose exec backend sh
```

---

## 8. Sao lưu MongoDB (đừng bỏ qua!)

> Dữ liệu nhân sự rất quan trọng. Tự động hoá backup ngay từ ngày đầu.

**Backup thủ công:**

```bash
docker compose exec mongodb mongodump --db "$MONGO_DB_NAME" --archive=/tmp/hrm-backup.archive
docker compose cp mongodb:/tmp/hrm-backup.archive ./hrm-$(date +%F).archive
```

**Backup tự động hằng ngày** — thêm vào crontab (`crontab -e`):

```cron
0 2 * * * cd /home/deploy/apps/hrm && docker compose exec -T mongodb mongodump --db soosky_hrm --archive | gzip > /home/deploy/backups/hrm-$(date +\%F).archive.gz
```

**Phục hồi:**

```bash
gunzip < hrm-2026-06-25.archive.gz | docker compose exec -T mongodb mongorestore --archive --drop
```

---

## 9. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|-------------|--------------------------|
| Backend liên tục restart | Sai `MONGO_URI` hoặc Mongo chưa healthy. Xem `docker compose logs backend` và `mongodb`. |
| `MongoServerError: not primary` | Replica set chưa sẵn sàng. Chờ ~30s sau khi Mongo lên; healthcheck đã lo việc chờ. |
| Gọi API trả 502 (Bad Gateway) | Nginx không thấy backend. Kiểm tra service `backend` có `running` không. |
| F5 trang con ra 404 | Thiếu SPA fallback — kiểm tra `frontend/nginx.conf` còn dòng `try_files ... /index.html`. |
| Frontend gọi sai URL API | `VITE_API_BASE_URL` được "nướng" lúc build. Sửa xong phải `docker compose up -d --build frontend`. |
| Caddy không ra HTTPS | DNS chưa trỏ đúng IP, hoặc cổng 80/443 bị tường lửa chặn. |
| Build báo lỗi thiếu RAM | VPS yếu khi build React. Tạm thêm swap: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |

---

## 10. Checklist trước khi coi là "xong"

- [ ] Đã đổi **tất cả** secret trong `.env` (không còn `CHANGE_ME`).
- [ ] `docker compose ps` — cả 3 service `healthy`/`running`.
- [ ] Truy cập được qua HTTPS + ổ khoá xanh.
- [ ] Đăng nhập được bằng tài khoản admin đã seed.
- [ ] Tường lửa chỉ mở 22/80/443; Mongo & backend **không** lộ cổng.
- [ ] Đã hẹn lịch backup tự động và **thử phục hồi một lần**.
- [ ] `.env` không bị commit lên git.

---

Chúc deploy thuận lợi! Khi cần mở rộng (tách Mongo ra cluster riêng, thêm
worker gửi mail, CI/CD tự động build khi push) — kiến trúc này đã sẵn sàng,
chỉ việc bồi thêm service vào `docker-compose.yml`.
