# EventGo Mobile App Setup (Windows)

Write-Host "📱 Thiết lập EventGo Mobile App..." -ForegroundColor Green

# Kiểm tra Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js không được tìm thấy. Vui lòng cài đặt Node.js LTS" -ForegroundColor Red
    exit 1
}

# Kiểm tra npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm không được tìm thấy." -ForegroundColor Red
    exit 1
}

Write-Host "📦 Cài đặt dependencies..." -ForegroundColor Yellow
npm install

# Kiểm tra .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ File .env không tồn tại. Tạo từ .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "📝 Vui lòng chỉnh sửa file .env với thông tin thực tế:" -ForegroundColor Cyan
    Write-Host "   - API_BASE (địa chỉ backend)" -ForegroundColor Cyan
    Write-Host "   - FIREBASE_* (Firebase config)" -ForegroundColor Cyan
    Write-Host "   - GOOGLE_MAPS_API_KEY" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor White
    Write-Host "Ví dụ API_BASE: http://192.168.1.100:8000/" -ForegroundColor Gray
    exit 1
}

# Kiểm tra Expo CLI
if (-not (Get-Command expo -ErrorAction SilentlyContinue)) {
    Write-Host "🔧 Cài đặt Expo CLI..." -ForegroundColor Yellow
    npm install -g @expo/cli
}

Write-Host "✅ Thiết lập hoàn tất!" -ForegroundColor Green
Write-Host "🚀 Chạy app:" -ForegroundColor Cyan
Write-Host "   - Development: npm start" -ForegroundColor Cyan
Write-Host "   - Android: npm run android" -ForegroundColor Cyan
Write-Host "   - iOS: npm run ios" -ForegroundColor Cyan
Write-Host "   - Web: npm run web" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "📱 Quét QR code với Expo Go app hoặc chạy trên simulator" -ForegroundColor Gray
