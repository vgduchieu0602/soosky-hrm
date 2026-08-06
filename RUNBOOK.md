# Soosky HRM — Runbook vận hành

Sổ tay thao tác cho người deploy và trực hệ thống. Kiến trúc và quyết định kỹ
thuật xem `DEPLOY-DOCKER.md`; đây chỉ là **các bước phải gõ**.

---

## 0. Bản đồ nhanh

| Thứ | Ở đâu |
|---|---|
| Caddy dùng chung cả VPS (TLS) | `~/infra/docker-compose.yml` |
| Stack production | `/srv/hrm-prod` (nhánh `master`) |
| Stack staging | `/srv/hrm-staging` (nhánh `develop`) |
| Secret | `<thư mục stack>/.env`, `chmod 600`, **không bao giờ trong Git** |
| Secret của CI | GitHub → Settings → Secrets and variables → Actions |
| Backup | volume `<STACK_NAME>_mongo_backups` + bucket S3/B2 |

Prefix API là `/api/v1` ở **cả ba nơi** và phải luôn khớp nhau:

- backend: hằng `API_PREFIX` trong `backend/src/infra/server/createExpressServer.ts`
- nginx: block `location /api/v1/` trong `frontend/nginx.conf`
- frontend: build-arg `VITE_API_BASE_URL=/api/v1` trong `docker-compose.yml`

---

## 1. Dựng VPS lần đầu

```bash
# 1. Caddy dùng chung (chỉ làm MỘT LẦN cho cả VPS)
docker network create web
mkdir -p ~/infra && cd ~/infra
# copy infra/docker-compose.yml của repo vào đây
docker compose up -d

# 2. Stack production
sudo mkdir -p /srv/hrm-prod && cd /srv/hrm-prod
git clone https://github.com/vgduchieu0602/Soosky-HRM.git .
cp .env.production.example .env
nano .env            # điền secret thật
chmod 600 .env
./deploy.sh

# 3. Tài khoản super admin đầu tiên (một lần duy nhất)
docker compose exec backend node dist/cli.js register-super-admin \
    --email admin@soosky.co --password '<mat-khau-manh>' --full-name 'Quan tri he thong'
```

Sinh secret: `openssl rand -hex 32`.

Staging làm y hệt trong `/srv/hrm-staging`, dùng `.env.staging.example`, và
`git checkout develop` trước khi `./deploy.sh`.

**Trước khi bật HTTPS:** bản ghi DNS A của `PUBLIC_DOMAIN` phải trỏ về IP VPS.
Let's Encrypt xác minh qua HTTP; DNS sai thì việc xin chứng chỉ hỏng và Caddy
sẽ thử lại liên tục.

---

## 2. Deploy hằng ngày

```bash
cd /srv/hrm-prod        # hoặc /srv/hrm-staging
./deploy.sh             # toàn bộ
./deploy.sh backend     # chỉ backend
```

`deploy.sh` tự dừng nếu backend không `healthy` sau 150 giây và in 50 dòng log
cuối. Quy trình đúng: merge vào `master` (CI phải xanh) → SSH vào VPS → `./deploy.sh`.

---

## 3. Chặn merge khi CI đỏ (làm một lần)

CI (`.github/workflows/ci.yml`) chỉ **báo** đỏ; muốn nó **cản** merge phải bật
branch protection:

GitHub → Settings → Branches → Add branch ruleset cho `master`:

1. **Require a pull request before merging** — bật.
2. **Require status checks to pass** — bật, chọn check **`CI passed`**
   (job tổng hợp; nó đỏ nếu bất kỳ job con nào đỏ).
3. **Require branches to be up to date before merging** — bật.
4. **Do not allow bypassing the above settings** — bật, kể cả với admin.

Các job trong CI: `backend-check` (typecheck + unit + build) ·
`backend-integration` (smoke test vòng đời HR trên MongoDB replica set thật) ·
`frontend-check` (lint + typecheck + unit + build) · `docker-build` (build 2
image) · `secret-scan` (gitleaks + chặn `package-lock.json` và file `.env`).

---

## 4. Quản lý secret

**Nguyên tắc: secret không bao giờ đi vào Git.**

| Loại | Nơi cất | Ghi chú |
|---|---|---|
| Secret runtime (JWT, SMTP, S3) | `.env` trên VPS, `chmod 600` | `.gitignore` chặn + `secret-scan` chặn |
| Secret của CI | GitHub Actions Secrets | Không in ra log |
| Mẫu tham khảo | `.env.production.example`, `.env.staging.example` | Chỉ chứa giá trị `CHANGE_ME` |

Staging và production **không dùng chung secret**: lộ staging không được kéo
theo production.

Xoay `AUTH_JWT_SECRET` (khi nghi lộ):

```bash
cd /srv/hrm-prod
openssl rand -hex 32          # dán vào AUTH_JWT_SECRET trong .env
docker compose up -d backend  # mọi access token cũ lập tức vô hiệu -> user đăng nhập lại
```

---

## 5. Email (SMTP)

Backend chạy `NODE_ENV=production` nên **từ chối khởi động khi thiếu `SMTP_HOST`** —
cố ý, để không bao giờ có chuyện production im lặng ghi log thay vì gửi thư.

Gmail / Google Workspace:

- `SMTP_PASS` là **App Password 16 ký tự** (bật 2FA rồi tạo tại
  <https://myaccount.google.com/apppasswords>), không phải mật khẩu thường.
- `MAIL_FROM` phải trùng `SMTP_USER` (hoặc alias đã khai báo) — Gmail ghi đè
  người gửi bằng tài khoản đã xác thực.
- Cổng 465 → `SMTP_SECURE=true`; cổng 587 → `SMTP_SECURE=false` (STARTTLS).

Kiểm tra nhanh đường gửi mail:

```bash
docker compose exec backend node -e "
  const t = require('nodemailer').createTransport({
    host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  t.verify().then(() => console.log('SMTP OK')).catch(e => { console.error('SMTP LOI:', e.message); process.exit(1); });
"
```

Staging đặt `MAIL_FROM=[STAGING] ...` để người nhận không nhầm với thư thật.

---

## 6. MongoDB — replica set

App dùng transaction nên **bắt buộc** replica set; `mongod` đơn lẻ sẽ lỗi ở
lệnh ghi đầu tiên. Replica set `rs0` do service `mongo-init` khởi tạo một lần
rồi thoát (idempotent, chạy lại vô hại).

```bash
docker compose exec mongodb mongosh --quiet --eval 'rs.status().ok'   # 1 = ổn
docker compose logs mongo-init                                        # xem lần khởi tạo
```

Replica set không lên → backend không khởi động (nó `depends_on` mongo-init
`service_completed_successfully`). Xử lý:

```bash
docker compose up -d --force-recreate mongo-init
docker compose logs -f mongo-init
```

---

## 7. Sao lưu

Container `mongo-backup` chạy `mongodump` mỗi ngày lúc `BACKUP_AT_HOUR` (UTC),
giữ `BACKUP_KEEP_DAYS` bản trên đĩa VPS, đẩy lên S3/B2 nếu `S3_BUCKET` có giá trị.

```bash
docker compose exec mongo-backup backup.sh          # chạy tay ngay
docker compose exec mongo-backup ls -1sh /backups   # xem các bản đang có
docker compose logs --tail 50 mongo-backup          # xem lịch + kết quả
```

**Dọn bản cũ trên S3**: script chỉ dọn bản local. Đặt lifecycle rule trên
bucket (Backblaze B2 → Lifecycle Settings) giữ 30 ngày cho prefix
`mongo-backups/<STACK_NAME>/`.

### Khôi phục thật (sự cố mất dữ liệu)

```bash
cd /srv/hrm-prod
docker compose stop backend                          # chặn ghi mới trước đã
docker compose exec mongo-backup ls -1t /backups
docker compose exec mongo-backup restore.sh /backups/<file>.archive.gz
docker compose start backend
```

Bản chỉ còn trên S3 → tải về trước:

```bash
docker compose exec mongo-backup aws --endpoint-url "$S3_ENDPOINT" \
    s3 cp s3://<bucket>/mongo-backups/<stack>/<file>.archive.gz /backups/
```

### Diễn tập khôi phục (bắt buộc hằng tháng)

Backup chưa từng khôi phục thử thì chưa phải backup.

```bash
cd /srv/hrm-prod
./infra/backup/restore-drill.sh
```

Script chụp bản mới, khôi phục sang database tạm `<db>-drill`, so số document
từng collection với database thật, rồi xoá database tạm — **không đụng dữ liệu
thật**. Ghi kết quả vào bảng dưới.

| Ngày diễn tập | Stack | Kết quả | Người chạy |
|---|---|---|---|
| _(điền sau mỗi lần chạy)_ | | | |

---

## 8. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Web mở được, mọi API 404 | Lệch prefix `/api/v1` giữa backend / nginx / build-arg | So ba nơi ở mục 0 |
| Web mở được, API 502 | Backend chết hoặc đang restart | `docker compose logs --tail 50 backend` |
| Backend crash-loop `Cannot find module '@infra/...'` | `baseUrl` biến mất khỏi `backend/tsconfig.json` → `tsc-alias` không rewrite được alias | Trả `"baseUrl": "."` vào tsconfig, build lại |
| Backend không khởi động, log `SMTP_HOST: is required in production` | `.env` thiếu SMTP | Điền SMTP thật (mục 5) |
| `docker compose up` báo `AUTH_JWT_SECRET la bat buoc` | `.env` thiếu hoặc chạy sai thư mục | Kiểm tra `pwd` và `.env` |
| Ghi DB lỗi `Transaction numbers are only allowed on a replica set` | Replica set chưa khởi tạo | Mục 6 |
| Chứng chỉ HTTPS không cấp được | DNS chưa trỏ, hoặc cổng 80/443 bị chặn | Kiểm tra DNS A record; `docker logs infra-caddy-1` |
| Deploy xong vẫn thấy giao diện cũ | Trình duyệt cache `index.html` | Ctrl+F5; asset có hash nên chỉ `index.html` bị cache |

Log:

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose ps            # cột Health
```

---

## 9. Chạy test ở máy dev

```bash
# Unit test — không cần hạ tầng
cd backend  && pnpm test
cd frontend && pnpm test

# Integration / smoke test vòng đời HR — cần MongoDB replica set
docker compose -f docker-compose.test.yml up -d
cd backend && pnpm run test:integration
docker compose -f docker-compose.test.yml down -v
```

Package manager là **pnpm**, không phải npm: `package.json` có `packageManager`
và script `preinstall` chặn npm/yarn; CI dùng `--frozen-lockfile`.
