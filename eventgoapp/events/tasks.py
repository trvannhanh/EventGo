from datetime import timedelta
from celery import shared_task
from django.utils.timezone import now
from events.models import Event, User, Notification, OrderDetail, Order
from django.db import transaction
from django.core.mail import send_mail

@shared_task(bind=True, name='events.tasks.send_event_reminders')
def send_event_reminders(self):
    """
    Task to send reminders for upcoming events.
    """
    with transaction.atomic():
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        print(f"Found {upcoming_events.count()} upcoming events.")

        for event in upcoming_events:
            event.send_notifications()
        print("Successfully sent notifications for upcoming events!")


@shared_task(bind=True, name='events.tasks.send_event_update_notifications')
def send_event_update_notifications(self, event_id, update_message):
    print(f"--- TASK send_event_update_notifications ENTERED ---")
    print(f"--- SELF: {self}, EVENT_ID: {event_id}, MESSAGE (first 100 chars): '{str(update_message)[:100]}...' ---")
    """
    Task to send notifications when an event is updated.
    
    Args:
        event_id: The ID of the updated event
        update_message: Description of the update
    """
    try:
        with transaction.atomic():
            event = Event.objects.get(id=event_id)
            
            # Get all users who purchased tickets for this event
            attendees = OrderDetail.objects.filter(
                ticket__event=event, 
                order__payment_status=Order.PaymentStatus.PAID
            ).values_list('order__user', flat=True).distinct()
            
            users = User.objects.filter(id__in=attendees)
            
            notification_count = 0
            for user in users:
                # Send email notification
                try:
                    send_mail(
                        subject=f"Cập nhật cho sự kiện: {event.name}",
                        message=f"Xin chào {user.username},\n\n{update_message}\n\nTrân trọng,\nĐội ngũ EventGo",
                        from_email="nhanhgon24@gmail.com",
                        recipient_list=[user.email],
                        fail_silently=True,
                    )
                except Exception as e:
                    print(f"Error sending email to {user.email}: {str(e)}")
                
                # Create in-app notification
                Notification.objects.create(
                    user=user,
                    event=event,
                    message=update_message
                )
                notification_count += 1
            
            print(f"Created {notification_count} notifications for event '{event.name}' (ID: {event_id})")
            return notification_count
    except Event.DoesNotExist:
        print(f"Event with ID {event_id} not found.")
        return 0
    except Exception as e:
        print(f"Error in send_event_update_notifications: {str(e)}")
        return 0


@shared_task(bind= True, name='events.tasks.send_new_event_notifications')
def send_new_event_notifications(self, event_id):
    """
    Task để gửi thông báo khi một sự kiện mới được tạo.
    
    Args:
        event_id: ID của sự kiện mới
    """
    try:
        with transaction.atomic():
            event = Event.objects.get(id=event_id)
            
            # Lấy tất cả người dùng có vai trò là người tham dự (attendee)
            attendees = User.objects.filter(role='attendee', is_active=True)
            
            notification_count = 0
            for user in attendees:
                # Gửi email thông báo
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

# Print registered tasks for debugging
print("Available tasks:", send_event_reminders.name, send_event_update_notifications.name, send_new_event_notifications.name)