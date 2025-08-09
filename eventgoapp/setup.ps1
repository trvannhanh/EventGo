# Thiết lập môi trường EventGo Backend (Windows)

Write-Host "🚀 Thiết lập EventGo Backend..." -ForegroundColor Green

# Kiểm tra Python
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python không được tìm thấy. Vui lòng cài đặt Python 3.12+" -ForegroundColor Red
    exit 1
}

# Tạo virtual environment nếu chưa có
if (-not (Test-Path "venv")) {
    Write-Host "📦 Tạo virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

Write-Host "🔧 Kích hoạt virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"

Write-Host "📦 Cài đặt dependencies..." -ForegroundColor Yellow
python -m pip install --upgrade pip
pip install -r requirements.txt

# Kiểm tra .env
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ File .env không tồn tại. Tạo từ .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "📝 Vui lòng chỉnh sửa file .env với thông tin thực tế:" -ForegroundColor Cyan
    Write-Host "   - DJANGO_SECRET_KEY" -ForegroundColor Cyan
    Write-Host "   - DB_* (database)" -ForegroundColor Cyan
    Write-Host "   - EMAIL_* (SMTP)" -ForegroundColor Cyan
    Write-Host "   - CLOUDINARY_* (upload ảnh)" -ForegroundColor Cyan
    Write-Host "   - MOMO_*, VNPAY_* (thanh toán)" -ForegroundColor Cyan
    Write-Host "   - Firebase, Google APIs..." -ForegroundColor Cyan
    exit 1
}

Write-Host "🗄️ Chạy database migrations..." -ForegroundColor Yellow
python manage.py makemigrations
python manage.py migrate

Write-Host "👤 Tạo superuser (admin)..." -ForegroundColor Yellow
python manage.py createsuperuser

Write-Host "✅ Thiết lập hoàn tất!" -ForegroundColor Green
Write-Host "🚀 Chạy server: python manage.py runserver" -ForegroundColor Cyan
Write-Host "🎯 Admin: http://localhost:8000/admin/" -ForegroundColor Cyan
Write-Host "📖 API docs: http://localhost:8000/swagger/" -ForegroundColor Cyan
