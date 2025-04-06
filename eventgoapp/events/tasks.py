from datetime import timedelta
from celery import shared_task
from django.utils.timezone import now
from events.models import Event
from django.db import transaction

@shared_task
def send_event_reminders():
    """
    Task to send reminders for upcoming events.
    """
    with transaction.atomic():
        upcoming_events = Event.objects.filter(status=Event.EventStatus.UPCOMING)
        print(f"Found {upcoming_events.count()} upcoming events.")

        for event in upcoming_events:
            event.send_notifications()
        print("Successfully sent notifications for upcoming events!")
        
@shared_task
def test_taskk():
    return "Task executed successfully!"