from datetime import timedelta
from celery import shared_task
from django.utils.timezone import now
from events.models import Event, User, Notification, OrderDetail, Order
from django.db import transaction
from django.core.mail import send_mail

@shared_task(bind=True, name='events.tasks.send_event_reminders')
def send_event_reminders(self):
    with transaction.atomic():
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        print(f"Found {upcoming_events.count()} upcoming events.")

        for event in upcoming_events:
            event.send_notifications()
        print("Gửi thông báo sự kiện sắp diễn ra thành công!")


@shared_task(bind=True, name='events.tasks.send_event_update_notifications')
def send_event_update_notifications(self, event_id, update_message):
    print(f"--- TASK send_event_update_notifications ENTERED ---")
    print(f"--- SELF: {self}, EVENT_ID: {event_id}, MESSAGE (first 100 chars): '{str(update_message)[:100]}...' ---")
    try:
        with transaction.atomic():
            event = Event.objects.get(id=event_id)

            attendees = OrderDetail.objects.filter(
                ticket__event=event, 
                order__payment_status=Order.PaymentStatus.PAID
            ).values_list('order__user', flat=True).distinct()
            
            users = User.objects.filter(id__in=attendees)
            
            notification_count = 0
            for user in users:
                try:
                    send_mail(
                        subject=f"Cập nhật cho sự kiện: {event.name}",
                        message=f"Xin chào {user.username},\n\n{update_message}\n\nTrân trọng,\nĐội ngũ EventGo",
                        from_email="nhanhgon24@gmail.com",
                        recipient_list=[user.email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Lỗi gửi mail {user.email}: {str(e)}")

                Notification.objects.create(
                    user=user,
                    event=event,
                    message=update_message
                )
                notification_count += 1
            
            print(f"Đã tạo {notification_count} thông báo cho event '{event.name}' (ID: {event_id})")
            return notification_count
    except Event.DoesNotExist:
        print(f"Event {event_id} không tìm thấy.")
        return 0
    except Exception as e:
        print(f"Lỗi khi send_event_update_notifications: {str(e)}")
        return 0


@shared_task(bind= True, name='events.tasks.send_new_event_notifications')
def send_new_event_notifications(self, event_id):
    try:
        with transaction.atomic():
            event = Event.objects.get(id=event_id)

            attendees = User.objects.filter(role='attendee', is_active=True)
            
            notification_count = 0
            for user in attendees:
                try:
                    send_mail(
                        subject=f"Sự kiện mới: {event.name}",
                        message=f"Xin chào {user.username},\n\nSự kiện mới '{event.name}' đã được tạo và sẽ diễn ra vào {event.date.strftime('%d/%m/%Y')}.\n\nĐịa điểm: {event.location}\n\nHãy đặt vé ngay hôm nay!\n\nTrân trọng,\nĐội ngũ EventGo",
                        from_email="nhanhgon24@gmail.com",
                        recipient_list=[user.email],
                        fail_silently=True,
                    )
                    print(f"Đã gửi email thông báo sự kiện mới tới {user.email}")
                except Exception as e:
                    print(f"Lỗi gửi email đến {user.email}: {str(e)}")
                
                notification_count += 1
            
            print(f"Đã tạo {notification_count} thông báo email cho sự kiện '{event.name}' (ID: {event_id})")
            return notification_count
    except Event.DoesNotExist:
        print(f"Không tìm thấy sự kiện với ID {event_id}")
        return 0
    except Exception as e:
        print(f"Lỗi trong send_new_event_notifications: {str(e)}")
        return 0

@shared_task(bind=True, name='events.tasks.test_taskk')
def test_taskk(self):
    return "Task executed successfully!"

print("Available tasks:", send_event_reminders.name, send_event_update_notifications.name, send_new_event_notifications.name)