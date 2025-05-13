from datetime import timedelta

from cloudinary.models import CloudinaryField
from django.db import models
from django.contrib.auth.models import AbstractUser
from ckeditor.fields import RichTextField
from django.utils.timezone import now
from django.core.mail import send_mail

class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        ORGANIZER = 'organizer', 'Organizer'
        ATTENDEE = 'attendee', 'Attendee'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.ATTENDEE)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    avatar = CloudinaryField('avatar', blank=True, null=True)
    google_credentials = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.username}"

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ['username']

class BaseModel(models.Model):
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-created_at']

class EventCategory(BaseModel):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Event Category"
        verbose_name_plural = "Event Categories"
        ordering = ['name']

class Event(BaseModel):
    class EventStatus(models.TextChoices):
        UPCOMING = 'upcoming', 'Upcoming'
        ONGOING = 'ongoing', 'Ongoing'
        COMPLETED = 'completed', 'Completed'
        CANCELED = 'canceled', 'Canceled'

    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='organized_events', null=True, blank=True)
    category = models.ForeignKey(EventCategory, on_delete=models.SET_NULL, null=True, related_name='events')
    name = models.CharField(max_length=100, unique=True, null=True)
    description = RichTextField(blank=True, null=True)
    date = models.DateTimeField(default=now)
    location = models.CharField(max_length=255, blank=True, null=True)
    google_maps_link = models.URLField(blank=True, null=True, max_length=1000)
    ticket_limit = models.PositiveIntegerField(null=True, blank=True, default=0)
    status = models.CharField(max_length=20, choices=EventStatus.choices, default=EventStatus.UPCOMING)
    image = CloudinaryField('image', blank=True, null=True)

    def __str__(self):
        return self.name

    def update_status(self):
        """Cập nhật trạng thái sự kiện dựa trên thời gian hiện tại."""
        current_time = now()
        if self.date < current_time and self.status == self.EventStatus.UPCOMING:
            self.status = self.EventStatus.COMPLETED
        elif self.date > current_time and self.status == self.EventStatus.COMPLETED:
            self.status = self.EventStatus.UPCOMING

    def save(self, *args, **kwargs):
        """Ghi đè save để tự động cập nhật trạng thái trước khi lưu."""
        self.update_status()
        super().save(*args, **kwargs)

    def send_notifications(self):
        
        attendees = OrderDetail.objects.filter(ticket__event=self, order__payment_status=Order.PaymentStatus.PAID).values_list('order__user', flat=True)
        users = User.objects.filter(id__in=attendees)

        for user in users:
            # Send email notification
            if send_mail(
                subject=f"Thông báo: Upcoming Event - {self.name}",
                message=f"Gửi {user.username},\n\nMail này thông báo về sự kiện sắp diễn ra '{self.name}' diễn ra vào {self.date}.",
                from_email="nhanhgon24@gmail.com",
                recipient_list=[user.email],
                fail_silently=False,
                
            ): 
                print(f"Email sent to {user.username} ({user.email})")

            # Create a push notification
            if Notification.objects.create(
                user=user,
                event=self,
                message=f"Reminder: The event '{self.name}' is happening soon!"
            ):
                print(f"Created notifications for {len(users)} users.")
    
            
    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['name', 'date'], name='unique_event_name_date')
        ]
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

# def send_test_email():
#         send_mail(
#             subject='Test Email from SendGrid',
#             message='This is a test email sent using SendGrid.',
#             from_email='noreply@yourdomain.com',  # Replace with your sender email
#             recipient_list=['recipient@example.com'],  # Replace with the recipient's email
#             fail_silently=False,
#         )
class Order(BaseModel):
    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        PAID = 'paid', 'Paid'
        FAILED = 'failed', 'Failed'

    class PaymentMethod(models.TextChoices):
        MOMO = 'MoMo', 'MoMo'
        VNPAY = 'VNPAY', 'VNPAY'
        CREDIT_CARD = 'credit_card', 'Credit Card'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    ticket = models.ForeignKey('Ticket', on_delete=models.CASCADE, related_name='orders', null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_status = models.CharField(max_length=10, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, null=True, blank=True)
    quantity = models.PositiveIntegerField(default=1)  # Tổng số vé đặt trong đơn hàng
    expiration_time = models.DateTimeField(null=True, blank=True)  # Thời gian hết hạn thanh toán

    def __str__(self):
        return f"Order #{self.id} by {self.user.username}"

    def save(self, *args, **kwargs):
        """Tự động đặt expiration_time khi tạo Order mới với trạng thái PENDING."""
        if not self.id and self.payment_status == self.PaymentStatus.PENDING:
            self.expiration_time = now() + timedelta(minutes=15)  # Hết hạn sau 15 phút
        super().save(*args, **kwargs)

    class Meta:
        verbose_name = "Order"
        verbose_name_plural = "Orders"
        ordering = ['-created_at']


class OrderDetail(BaseModel):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='order_details')
    ticket = models.ForeignKey(Ticket, on_delete=models.CASCADE)
    qr_code = models.CharField(max_length=255, unique=True)
    qr_image = models.ImageField(upload_to='tickets/%Y/%m/%d/', blank=True, null=True)
    checked_in = models.BooleanField(default=False)
    checkin_time = models.DateTimeField(null=True)
    google_calendar_event_id = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"Order #{self.order.id} - {self.ticket.type}"

    class Meta:
        verbose_name = "Order Detail"
        verbose_name_plural = "Order Details"
        ordering = ['-created_at']

class Discount(BaseModel):
    class LoyaltyRank(models.TextChoices):
        BRONZE = 'bronze', 'Đồng'
        SILVER = 'silver', 'Bạc'
        GOLD = 'gold', 'Vàng'
        NONE = 'none', 'Không có hạng'  # Áp dụng cho tất cả nếu không chỉ định

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='discounts')
    code = models.CharField(max_length=50, unique=True)
    discount_percent = models.PositiveIntegerField()
    expiration_date = models.DateTimeField()
    target_rank = models.CharField(
        max_length=20,
        choices=LoyaltyRank.choices,
        null=True,
        blank=True,
        default=LoyaltyRank.NONE,
        help_text="Hạng khách hàng áp dụng (nếu để trống, áp dụng cho tất cả)."
    )

    def __str__(self):
        return f"Discount {self.code} - {self.discount_percent}% for {self.target_rank or 'All'}"

    class Meta:
        verbose_name = "Discount"
        verbose_name_plural = "Discounts"
        ordering = ['-expiration_date']

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

    def increment_views(self):
        """Tăng lượt xem khi sự kiện được truy cập."""
        self.views += 1
        self.save(update_fields=['views'])

    def increment_interest(self, points=1):
        """Tăng interest_level dựa trên hành vi người dùng."""
        self.interest_level += points
        self.save(update_fields=['interest_level'])

    def __str__(self):
        return f"Trend for {self.event.name}: {self.views} views"

    class Meta:
        verbose_name = "Event Trend"
        verbose_name_plural = "Event Trends"
        ordering = ['-views']


