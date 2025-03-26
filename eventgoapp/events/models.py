from django.db import models
from django.contrib.auth.models import AbstractUser
from ckeditor.fields import RichTextField
from django.utils.timezone import now

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('organizer', 'Organizer'),
        ('attendee', 'Attendee'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='attendee')
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    avatar = models.ImageField(upload_to='users/%Y/%m/%d/', blank=True, null=True)

    def __str__(self):
        return f"{self.username}"

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ['username']

class BaseModel(models.Model):
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']

class Event(BaseModel):
    EVENT_TYPES = [
        ('music', 'Music'),
        ('conference', 'Conference'),
        ('sports', 'Sports'),
        ('workshop', 'Workshop'),
    ]
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organized_events', null=True)
    name = models.CharField(max_length=100, unique=True, null=True)
    description = RichTextField(blank=True, null=True)
    date = models.DateTimeField(default=now)
    location = models.CharField(max_length=255, blank=True, null=True)
    google_maps_link = models.URLField(blank=True, null=True)
    ticket_limit = models.PositiveIntegerField(null=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES, default='music') 
    image = models.ImageField(upload_to='events/%Y/%m/%d/', blank=True, null=True)

    def __str__(self):
        return f"{self.name}"

    class Meta:
        unique_together = ('name', 'event_type')
        verbose_name = "Event"
        verbose_name_plural = "Events"
        ordering = ['date']

class Ticket(BaseModel):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    type = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField()

    def __str__(self):
        return f"{self.type} - {self.event.name}"

    class Meta:
        verbose_name = "Ticket"
        verbose_name_plural = "Tickets"
        ordering = ['price']


class Order(BaseModel):
    PAYMENT_STATUS = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
    ]
    PAYMENT_METHOD = [
        ('MoMo', 'MoMo'),
        ('VNPAY', 'VNPAY'),
        ('credit_card', 'Credit Card'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    tickets = models.ManyToManyField(Ticket, through='OrderDetail')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(max_length=10, choices=PAYMENT_STATUS, default='pending')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD)

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"

    class Meta:
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ['-created_at']


class OrderDetail(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='order_details')
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    qr_code = models.CharField(max_length=255, unique=True)

    def __str__(self):
        return f"Order #{self.order.id} - {self.ticket.type}"

    class Meta:
        verbose_name = "Order Detail"
        verbose_name_plural = "Order Details"
        ordering = ['-created_at']


class Review(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reviews')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='reviews')
    rating = models.PositiveIntegerField()
    comment = models.TextField(blank=True)

    def __str__(self):
        return f"Review by {self.user.username} for {self.event.name}"

    class Meta:
        verbose_name = "Review"
        verbose_name_plural = "Reviews"
        ordering = ['-created_at']


class Notification(BaseModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"Notification for {self.user.username}"

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']


class Discount(BaseModel):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='discounts')
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.PositiveIntegerField()
    expiration_date = models.DateTimeField()

    def __str__(self):
        return f"Discount {self.code} - {self.discount_percent}%"

    class Meta:
        verbose_name = "Discount"
        verbose_name_plural = "Discounts"
        ordering = ['-expiration_date']


class ChatMessage(BaseModel):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='chat_messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    message = models.TextField()

    def __str__(self):
        return f"Message from {self.sender.username}"

    class Meta:
        verbose_name = "Chat Message"
        verbose_name_plural = "Chat Messages"
        ordering = ['-created_at']


class EventTrend(BaseModel):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='trends')
    views = models.PositiveIntegerField(default=0)
    interest_level = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Trend for {self.event.name}: {self.views} views"

    class Meta:
        verbose_name = "Event Trend"
        verbose_name_plural = "Event Trends"
        ordering = ['-views']
