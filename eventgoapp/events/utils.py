import qrcode
import io
from django.core.files.base import ContentFile

def generate_qr_image(qr_data):
    qr = qrcode.make(qr_data)
    buffer = io.BytesIO()
    qr.save(buffer, format='PNG')
    return ContentFile(buffer.getvalue(), name=f'{qr_data}.png')