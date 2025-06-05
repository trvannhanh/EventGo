import logging

import qrcode
import io
from django.core.files.base import ContentFile

from django.db.models import Sum
from .models import User, Order, OrderDetail

logger = logging.getLogger(__name__)

def generate_qr_image(qr_data):
    try:
        qr = qrcode.make(qr_data)
        buffer = io.BytesIO()
        qr.save(buffer, format='PNG')
        buffer.seek(0)
        logger.info(f"Generated QR image for {qr_data}, size: {buffer.getbuffer().nbytes}")
        return buffer
    except Exception as e:
        logger.error(f"Error generating QR image for {qr_data}: {str(e)}")
        raise



def get_customer_rank(user):
    total_spent = Order.objects.filter(
        user=user,
        payment_status=Order.PaymentStatus.PAID
    ).aggregate(total=Sum('total_amount'))['total'] or 0

    event_count = OrderDetail.objects.filter(
        order__user=user,
        order__payment_status=Order.PaymentStatus.PAID
    ).count()

    if total_spent >= 1000000 or event_count >= 10:
        return 'gold'
    elif total_spent >= 500000 or event_count >= 5:
        return 'silver'
    elif total_spent > 0 or event_count > 0:
        return 'bronze'
    return 'none'