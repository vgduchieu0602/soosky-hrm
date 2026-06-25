# 🏗️ Deploy NHIỀU dự án trên 1 VPS Contabo (chuẩn dùng chung Caddy proxy)

> Tài liệu này hướng dẫn kiến trúc chạy **nhiều dự án** trên cùng một VPS. HRM là
> **Dự án 1**. Bốn dự án sau chỉ việc lặp lại "Phần B".

---

## Kiến trúc tổng thể

```
                         Internet
                            │ 80 / 443
                            ▼
              ┌──────────────────────────────┐
              │  Caddy proxy (DÙNG CHUNG)      │  ~/infra — cài 1 lần
              │  tự cấp SSL + định tuyến domain│  nối mạng "web"
              └──┬─────────┬─────────┬─────────┘
   hrm.domain.com│  app2.  │  app3.  │ ...
                 ▼         ▼         ▼
          ┌───────────┐ ┌───────┐ ┌───────┐
          │ Dự án 1   │ │ DA 2  │ │ DA 3  │   mỗi dự án 1 stack riêng
          │ ~/apps/hrm│ │       │ │       │   KHÔNG mở cổng ra ngoài
          └───────────┘ └───────┘ └───────┘
```

**3 ý tưởng cốt lõi:**

1. **Một proxy cho cả VPS.** Chỉ Caddy giữ cổng 80/443. Cài đúng 1 lần ở `~/infra`.
2. **Mạng `web` dùng chung.** Caddy + "cửa ngõ" của mỗi dự án (frontend) cùng nằm
   trên mạng `web` để nói chuyện được. Backend/DB của mỗi dự án nằm ở mạng nội
   bộ riêng, cô lập hoàn toàn với dự án khác.
3. **Dự án tự khai báo domain bằng label.** Caddy đọc nhãn `caddy: <domain>` của
   container và tự định tuyến + cấp HTTPS. Thêm dự án = không sửa gì ở proxy.

---

## PHẦN A — Cài đặt VPS + proxy chung (CHỈ LÀM 1 LẦN)

### A1. Chuẩn bị VPS, user, Docker, tường lửa

Làm theo **Bước 1 & 2** trong [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md) (tạo user `deploy`,
cài Docker, bật `ufw` mở 22/80/443). Phần đó dùng chung, không lặp lại ở đây.

### A2. Tạo mạng dùng chung + chạy Caddy proxy

```bash
# 1. Tạo mạng "web" dùng chung (1 lần duy nhất cho cả VPS)
docker network create web

# 2. Dựng thư mục hạ tầng riêng, tách khỏi các repo dự án
mkdir -p ~/infra && cd ~/infra
```

Copy file [infra/docker-compose.yml](infra/docker-compose.yml) (có trong repo HRM)
vào `~/infra/docker-compose.yml`. Cách nhanh: clone HRM trước rồi copy:

```bash
cp ~/apps/hrm/infra/docker-compose.yml ~/infra/docker-compose.yml
cd ~/infra
docker compose up -d
docker compose ps      # caddy phải "running"
```

> Từ giờ Caddy luôn chạy. Mọi dự án gắn vào mạng `web` + dán nhãn domain sẽ được
> nó tự nhận diện và phục vụ HTTPS.

---

## PHẦN B — Deploy một dự án (áp dụng cho HRM và 4 dự án sau)

> Mỗi dự án sống trong thư mục riêng `~/apps/<tên-dự-án>`. Dưới đây là HRM.

### B1. Lấy code

```bash
mkdir -p ~/apps && cd ~/apps
git clone <URL_REPO_HRM> hrm
cd hrm
```

### B2. Cấu hình `.env`

```bash
cp .env.docker.example .env
# Sinh secret
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET
openssl rand -hex 24   # MONGO_ROOT_PASSWORD
openssl rand -hex 24   # MONGO_REPLICA_SET_KEY
nano .env
```

Bắt buộc đổi: các secret ở trên, và đặc biệt **`PUBLIC_DOMAIN`** = domain riêng của
dự án này, ví dụ `hrm.ten-mien-cua-ban.com`. (Đây là điểm khác biệt then chốt giữa
các dự án — mỗi dự án 1 domain.)

> Lưu ý mỗi dự án nên dùng `MONGO_ROOT_PASSWORD` / JWT secret **riêng biệt**, không
> dùng lại của dự án khác.

### B3. Trỏ DNS

Tại nhà cung cấp domain, tạo bản ghi **A**: `hrm.ten-mien.com → <IP_VPS>`.
(4 dự án sau: tạo thêm `app2.ten-mien.com → <IP_VPS>`, v.v. — cùng 1 IP.)

### B4. Khởi chạy

```bash
docker compose up -d --build
docker compose ps
```

Caddy tự phát hiện frontend qua nhãn, xin SSL cho `PUBLIC_DOMAIN`. Chờ ~30s rồi
mở `https://hrm.ten-mien.com` — đã có ổ khoá xanh, không cần cấu hình SSL thủ công.

### B5. Seed admin

Giống **Bước 6** trong [DEPLOY-DOCKER.md](DEPLOY-DOCKER.md). Lưu ý tên mạng giờ có
tiền tố `hrm_` (vì đã đặt `name: hrm`):

```bash
docker network ls | grep hrm-net      # ví dụ: hrm_hrm-net
```

---

## PHẦN C — Thêm dự án thứ 2, 3, 4, 5

Với mỗi dự án mới, **lặp lại Phần B** với các thay đổi:

1. Thư mục riêng: `~/apps/<tên-dự-án>`.
2. `PUBLIC_DOMAIN` riêng (subdomain hoặc domain khác).
3. Tên stack riêng: trong `docker-compose.yml` đổi `name: hrm` → `name: <tên-dự-án>`,
   và đổi tên mạng nội bộ `hrm-net` → `<tên>-net` để khỏi trùng.
4. Mỗi dự án phải có khối network `web: external: true` và frontend (cửa ngõ) phải:
   - nối cả mạng nội bộ riêng **và** `web`,
   - có nhãn `caddy: ${PUBLIC_DOMAIN}` + `caddy.reverse_proxy: "{{upstreams <cổng>}}"`.

> Dự án không phải HRM (stack khác, ví dụ chỉ có 1 web server) thì chỉnh cổng
> trong `{{upstreams 80}}` cho khớp cổng container web của nó.

**KHÔNG cần đụng tới `~/infra`** khi thêm dự án — Caddy tự cập nhật.

---

## Vận hành & deploy lại

- Deploy lại 1 dự án: vào thư mục dự án, chạy `./deploy.sh` (xem [deploy.sh](deploy.sh)).
- Xem proxy: `cd ~/infra && docker compose logs -f caddy`.
- Liệt kê tất cả container toàn VPS: `docker ps`.

## Sự cố thường gặp (riêng cho mô hình nhiều dự án)

| Triệu chứng | Xử lý |
|-------------|-------|
| Domain báo "502" hoặc không lên SSL | Frontend chưa nối mạng `web`, hoặc thiếu nhãn `caddy:`. Kiểm tra `docker inspect` container frontend. |
| `network web declared as external, but could not be found` | Chưa chạy `docker network create web`. |
| 2 dự án xung đột tên network/volume | Quên đổi `name:` và tên mạng nội bộ ở dự án mới. |
| SSL không cấp được | DNS chưa trỏ đúng IP, hoặc 2 dự án khai cùng 1 `PUBLIC_DOMAIN`. |
| Sửa `PUBLIC_DOMAIN` xong không đổi | Chạy `docker compose up -d frontend` để Caddy đọc lại nhãn. |
```
