# EventGo Full Setup Script (Windows)

Write-Host "🎉 EventGo - Hệ thống quản lý sự kiện và đặt vé" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

$choice = Read-Host "Chọn thiết lập (1: Backend, 2: Mobile App, 3: Cả hai): "

if ($choice -eq "1" -or $choice -eq "3") {
    Write-Host "`n🔧 THIẾT LẬP BACKEND..." -ForegroundColor Yellow
    Set-Location "eventgoapp"
    & ".\setup.ps1"
    Set-Location ".."
}

if ($choice -eq "2" -or $choice -eq "3") {
    Write-Host "`n📱 THIẾT LẬP MOBILE APP..." -ForegroundColor Yellow
    Set-Location "eventgomobileapp"
    & ".\setup.ps1"
    Set-Location ".."
}

Write-Host "`n🎯 GHI CHÚ QUAN TRỌNG:" -ForegroundColor Cyan
Write-Host "1. Đảm bảo MySQL và Redis đang chạy cho backend" -ForegroundColor White
Write-Host "2. Cập nhật file .env với thông tin thực tế" -ForegroundColor White
Write-Host "3. API_BASE trong mobile .env phải trỏ đúng IP backend" -ForegroundColor White
Write-Host "4. Cấu hình Firebase, Cloudinary, thanh toán trước production" -ForegroundColor White

Write-Host "`n✨ Hoàn tất thiết lập EventGo!" -ForegroundColor Green
