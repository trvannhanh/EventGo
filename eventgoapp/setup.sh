#!/bin/bash
# Thiết lập môi trường EventGo Backend

echo "🚀 Thiết lập EventGo Backend..."

# Kiểm tra Python 3.12+
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 không được tìm thấy. Vui lòng cài đặt Python 3.12+"
    exit 1
fi

# Tạo virtual environment nếu chưa có
if [ ! -d "venv" ]; then
    echo "📦 Tạo virtual environment..."
    python3 -m venv venv
fi

echo "🔧 Kích hoạt virtual environment..."
source venv/bin/activate

echo "📦 Cài đặt dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Kiểm tra .env
if [ ! -f ".env" ]; then
    echo "⚠️ File .env không tồn tại. Tạo từ .env.example..."
    cp .env.example .env
    echo "📝 Vui lòng chỉnh sửa file .env với thông tin thực tế:"
    echo "   - DJANGO_SECRET_KEY"
    echo "   - DB_* (database)"
    echo "   - EMAIL_* (SMTP)"
    echo "   - CLOUDINARY_* (upload ảnh)"
    echo "   - MOMO_*, VNPAY_* (thanh toán)"
    echo "   - Firebase, Google APIs..."
    exit 1
fi

echo "🗄️ Chạy database migrations..."
python manage.py makemigrations
python manage.py migrate

echo "👤 Tạo superuser (admin)..."
python manage.py createsuperuser

echo "✅ Thiết lập hoàn tất!"
echo "🚀 Chạy server: python manage.py runserver"
echo "🎯 Admin: http://localhost:8000/admin/"
echo "📖 API docs: http://localhost:8000/swagger/"
