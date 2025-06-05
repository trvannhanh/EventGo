import json
import requests
from .models import User, Notification, Event


def send_push_notification(user_ids, title, body, data=None):
    users = User.objects.filter(id__in=user_ids, push_token__isnull=False)

    tokens = [user.push_token for user in users if user.push_token]
    
    if not tokens:
        return

    message = {
        'to': tokens,
        'title': title,
        'body': body,
        'sound': 'default',
    }

    if data:
        message['data'] = data
    
    try:
        response = requests.post(
            'https://exp.host/--/api/v2/push/send',
            headers={
                'Content-Type': 'application/json',
            },
            data=json.dumps(message)
        )

        if response.status_code == 200:
            print(f"Đã gửi push notification thành công đến {len(tokens)} thiết bị")
        else:
            print(f"Lỗi khi gửi push notification: {response.status_code} - {response.text}")
    
    except Exception as e:
        print(f"Lỗi khi gửi push notification: {str(e)}")



def create_and_send_event_notification(event_id, is_update=False, is_cancel=False):
    """
    Tạo và gửi thông báo khi có sự kiện mới, cập nhật sự kiện hoặc hủy sự kiện.
    
    Args:
        event_id: ID của sự kiện
        is_update: True nếu là cập nhật sự kiện, False nếu là tạo mới
        is_cancel: True nếu là hủy sự kiện, False nếu không phải
    """
    try:
        event = Event.objects.get(id=event_id)

        if is_cancel:
            title = "Sự kiện bị hủy"
            body = f"'{event.name}' đã bị hủy. Vui lòng liên hệ ban tổ chức để được hỗ trợ."
        elif is_update:
            title = "Sự kiện đã được cập nhật"
            body = f"'{event.name}' đã được cập nhật. Xem ngay chi tiết mới nhất!"
        else:
            title = "Sự kiện mới"
            body = f"'{event.name}' đã được tạo. Khám phá ngay!"
        
        if is_cancel:
            data = {
                "type": "EVENT_CANCELED",
                "eventId": event_id
            }
        else:
            data = {
                "type": "EVENT_UPDATED" if is_update else "EVENT_CREATED",
                "eventId": event_id
            }
        
        if is_cancel:
            from .models import OrderDetail, Order
            user_ids = OrderDetail.objects.filter(
                ticket__event=event,
                order__payment_status=Order.PaymentStatus.PAID
            ).values_list('order__user_id', flat=True).distinct()
        else:
            user_ids = User.objects.filter(role='attendee', is_active=True).values_list('id', flat=True)
        

        send_push_notification(user_ids, title, body, data)

        notifications = []
        for user_id in user_ids:
            notifications.append(
                Notification(
                    user_id=user_id,
                    event=event,
                    message=body,
                    is_read=False
                )
            )

        if notifications:
            Notification.objects.bulk_create(notifications)
        
        return True
    except Event.DoesNotExist:
        print(f"Không tìm thấy sự kiện với ID {event_id}")
        return False
    except Exception as e:
        print(f"Lỗi khi tạo và gửi thông báo sự kiện: {str(e)}")
        return False
