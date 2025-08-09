# EventGo

Hệ thống quản lý sự kiện và đặt vé trực tuyến gồm:
- Backend: Django REST Framework, Celery, Redis, MySQL, Cloudinary, OAuth2, Realtime (Channels)
- Mobile App: React Native (Expo), Firebase Realtime DB, Expo Notifications

## Tính năng chính
- Tạo/sửa/hủy sự kiện, quản lý vé và mã giảm giá
- Đặt vé, thanh toán (MoMo, VNPAY – sandbox), tạo QR cho từng vé
- Gợi ý sự kiện, sự kiện thịnh hành, tìm kiếm, xem địa điểm tích hợp google map
- Quản lý đơn hàng, check-in bằng QR
- Đánh giá sự kiện, lọc, chat realtime
- Đăng ký/đăng nhập, cập nhật hồ sơ, xếp hạng khách hàng (bronze/silver/gold)
- Thông báo đẩy và trong app khi có sự kiện mới/cập nhật, gửi mail
- Quản trị: dashboard analytics, thống kê cho từng role

## Kiến trúc & Công nghệ
- Django 5, DRF, Channels, Celery + Redis, MySQL, Cloudinary
- OAuth2 (django-oauth-toolkit), allauth (Google/Facebook)
- Expo RN 0.79, Firebase Realtime Database, expo-notifications, RN Vision Camera

---

## Thiết lập môi trường (ENV)

Tất cả thông tin nhạy cảm được cấu hình bằng biến môi trường.

### Backend (Django)
1) Tạo file `eventgoapp/.env` dựa trên mẫu:
	- Xem `eventgoapp/.env.example`
2) Các biến quan trọng:
	- DJANGO_SECRET_KEY, DJANGO_DEBUG, DJANGO_ALLOWED_HOSTS
	- DB_ENGINE, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
	- EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, DEFAULT_FROM_EMAIL
	- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
	- OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FACEBOOK_ID, FACEBOOK_SECRET
	- GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI
	- REDIS_HOST, REDIS_PORT, REDIS_PASSWORD (hoặc CELERY_BROKER_URL, REDIS_CACHE_URL…)
	- MOMO_PARTNER_CODE, MOMO_ACCESS_KEY, MOMO_SECRET_KEY, MOMO_CREATE_ENDPOINT, MOMO_QUERY_ENDPOINT, MOMO_REDIRECT_URL, MOMO_IPN_URL
	- VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_QUERY_ENDPOINT

### Mobile App (Expo)
1) Tạo file `eventgomobileapp/.env` dựa trên mẫu:
	- Xem `eventgomobileapp/.env.example`
2) Các biến quan trọng:
	- API_BASE (ví dụ: http://<ip_may_chay_backend>:8000/)
	- Firebase: FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID, FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID, FIREBASE_MEASUREMENT_ID, FIREBASE_DATABASE_URL
	- GOOGLE_MAPS_API_KEY

Lưu ý: Mobile đọc env qua `app.config.js` và inject vào `Constants.expoConfig.extra`.

---

## Cài đặt và chạy dự án

### Backend
Yêu cầu: Python 3.12+, MySQL, Redis

```powershell
cd eventgoapp
.\setup.ps1  # Windows
# hoặc ./setup.sh  # Linux/Mac
```

**Hoặc manual:**
```powershell
cd eventgoapp
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Sao chép và chỉnh sửa .env.example thành .env
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### Mobile App
Yêu cầu: Node.js LTS, Expo, Android SDK (cho run:android)

```powershell
cd eventgomobileapp
.\setup.ps1  # Windows
```

**Hoặc manual:**
```powershell
cd eventgomobileapp
npm install
# Sao chép và chỉnh sửa .env.example thành .env
npm start  # Development server
```

---

## Cấu hình đã chỉnh sửa
- Backend: `eventgoapp/eventgoapp/settings.py` đã đọc biến môi trường (dotenv). Bỏ toàn bộ secrets hardcode.
- Backend: `events/views.py` dùng `settings` cho MoMo/VNPAY và email.
- Thêm `eventgoapp/.env.example` và `eventgomobileapp/.env.example`.
- Mobile: `configs/Apis.js` dùng `Constants.expoConfig.extra.API_BASE`.
- Mobile: `configs/firebase.js` đọc cấu hình Firebase từ env.
- Mobile: thêm `app.config.js` để inject env -> `extra`.
- Mobile: `.gitignore` đã thêm ignore `.env`.

---

## Bảo mật & best practices
- Không commit `.env`, `google-services.json` chứa thông tin nhạy cảm khi public repo.
- Dùng secrets cho CI/CD khi build.
- Hạn chế ALLOWED_HOSTS linh hoạt theo môi trường.

---

## Liên hệ
Trao đổi thêm: cập nhật biến môi trường thực tế (MoMo, VNPAY, Firebase, Cloudinary, Google APIs) trước khi chạy production.
