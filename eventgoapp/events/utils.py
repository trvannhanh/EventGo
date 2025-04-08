import qrcode
import io
from django.core.files.base import ContentFile

from django.db.models import Sum
from .models import User, Order, OrderDetail

def generate_qr_image(qr_data):
    qr = qrcode.make(qr_data)
    buffer = io.BytesIO()
    qr.save(buffer, format='PNG')
    return ContentFile(buffer.getvalue(), name=f'{qr_data}.png')



def get_customer_rank(user):
    """Tính hạng khách hàng dựa trên tổng chi tiêu hoặc số lần tham gia."""
    # Tổng chi tiêu từ các đơn hàng đã thanh toán
    total_spent = Order.objects.filter(
        user=user,
        payment_status=Order.PaymentStatus.PAID
    ).aggregate(total=Sum('total_amount'))['total'] or 0

    # Số lần tham gia sự kiện
    event_count = OrderDetail.objects.filter(
        order__user=user,
        order__payment_status=Order.PaymentStatus.PAID
    ).count()

    # Xác định hạng dựa trên tiêu chí (có thể tùy chỉnh)
    if total_spent >= 1000000 or event_count >= 10:  # Ví dụ: 1 triệu VNĐ hoặc 10 sự kiện
        return 'gold'
    elif total_spent >= 500000 or event_count >= 5:  # 500k VNĐ hoặc 5 sự kiện
        return 'silver'
    elif total_spent > 0 or event_count > 0:
        return 'bronze'
    return 'none'  # Chưa có giao dịch