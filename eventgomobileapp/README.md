# EventGo Mobile App

- Sử dụng Expo RN, đọc biến môi trường qua `app.config.js` -> `Constants.expoConfig.extra`.
- Cấu hình env: xem `.env.example`, tạo `.env` với API_BASE, Firebase keys, GOOGLE_MAPS_API_KEY.
- Chạy:
  - npm install
  - npm run start
  - npm run android

Lưu ý: đảm bảo API_BASE trỏ đến địa chỉ IP backend trong cùng mạng (ví dụ 192.168.x.x:8000).
