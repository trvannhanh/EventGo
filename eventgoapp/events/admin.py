from django.contrib import admin
from django.db.models import Sum, Count
from django.template.response import TemplateResponse
from django.urls import path
from django.db.models.functions import TruncMonth
from django.utils.html import mark_safe
from .models import *
from django import forms
from ckeditor_uploader.widgets import CKEditorUploadingWidget



class EventForm(forms.ModelForm):
    description = forms.CharField(widget=CKEditorUploadingWidget)

    class Meta:
        model = Event
        fields = '__all__'

class TicketInline(admin.StackedInline):
    model = TicketType
    extra = 1
    fields = ['type', 'price', 'quantity']

class OrderDetailInline(admin.StackedInline):
    model = OrderDetail
    extra = 1
    fields = ['qr_code', 'qr_image', 'checked_in', 'qr_image_preview']
    readonly_fields = ['qr_image_preview']

    def qr_image_preview(self, obj):
        """Hiển thị hình ảnh QR code dưới dạng thumbnail."""
        if obj.qr_image:
            return mark_safe(f'<img src="{obj.qr_image.url}" width="60" height="60" />')
        return "No Image"
    qr_image_preview.short_description = "QR Image Preview"

#tùy chỉnh phân hệ admin ( bổ sung thêm các tùy chỉnh khác sau này)
class EventAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "colored_status", "date", "organizer_name", "remaining_tickets"]
    search_fields = ["name", "organizer__username"]
    list_filter = ['status', 'date', 'organizer']
    readonly_fields = ['my_image']
    form = EventForm
    inlines = [TicketInline]



    def colored_status(self, obj):
        """Hiển thị trạng thái sự kiện với màu sắc."""
        colors = {
            Event.EventStatus.UPCOMING: 'green',
            Event.EventStatus.ONGOING: 'blue',
            Event.EventStatus.COMPLETED: 'gray',
            Event.EventStatus.CANCELED: 'red'
        }
        color = colors.get(obj.status, 'black')
        return mark_safe(f'<span style="color: {color};">{obj.get_status_display()}</span>')

    colored_status.short_description = "Status"

    def organizer_name(self, obj):
        """Hiển thị tên người tổ chức thay vì đối tượng User."""
        return obj.organizer.username if obj.organizer else "No Organizer"

    organizer_name.short_description = "Organizer"

    def remaining_tickets(self, obj):
        """Hiển thị số lượng vé còn lại của sự kiện."""
        total_tickets = sum(ticket.quantity for ticket in obj.tickets.all())
        sold_tickets = OrderDetail.objects.filter(
            ticket__event=obj,
            order__payment_status=Order.PaymentStatus.PAID
        ).prefetch_related('order').count()
        remaining = total_tickets - sold_tickets if total_tickets else 0
        return remaining if remaining >= 0 else 0

    remaining_tickets.short_description = "Remaining Tickets"

    def my_image(self, event):
        if event.image:
            return mark_safe(f"<img src='/static/{event.image.name}' width='120'/>")
        return "No Image"

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )


class UserAdmin(admin.ModelAdmin):
    list_display = ["id", "username", "email", "role", "phone", "organized_events_count", "orders_count"]
    search_fields = ["username", "email"]
    list_filter = ["role"]
    readonly_fields = ["avatar_preview", "google_credentials", "push_token"]

    def avatar_preview(self, obj):
        if obj.avatar:
            return mark_safe(f"<img src='{obj.avatar.url}' width='60' height='60'/>")
        return "No Avatar"

    def organized_events_count(self, obj):
        return obj.organized_events.count()
    organized_events_count.short_description = "Organized Events"

    def orders_count(self, obj):
        return obj.orders.count()
    orders_count.short_description = "Orders"

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )


class TicketAdmin(admin.ModelAdmin):
    list_display = ["id", "event", "type", "price", "quantity"]
    search_fields = ["event__name", "type"]
    list_filter = ["event"]

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )

class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "total_amount", "payment_status", "payment_method", "expiration_time", "quantity"]
    search_fields = ["user__username"]
    list_filter = ["payment_status", "payment_method"]
    inlines = [OrderDetailInline]

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )

class OrderDetailAdmin(admin.ModelAdmin):
    list_display = ["order", "qr_code", "qr_image_preview", "checked_in"]
    search_fields = ["order__id", "ticket__type"]
    list_filter = ["checked_in"]

    def qr_image_preview(self, obj):
        if obj.qr_image:
            return mark_safe(f'<img src="{obj.qr_image.url}" width="60" height="60" />')
        return "No Image"
    qr_image_preview.short_description = "QR Image"

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )

# Tạo AdminSite tùy chỉnh
class MyAdminSite(admin.AdminSite):
    site_header = 'Event Management System'

    def has_permission(self, request):
        # Đảm bảo superuser và is_staff luôn có quyền
        return request.user.is_active and (request.user.is_staff or request.user.is_superuser)

    def get_urls(self):
        return [
            path('stats/', self.stats_view, name='stats'),
        ] + super().get_urls()

    def stats_view(self, request):
        # Số lượng vé bán ra theo sự kiện
        tickets_sold = OrderDetail.objects.filter(
            order__payment_status=Order.PaymentStatus.PAID
        ).values('ticket__event__name').annotate(total=Count('id')).order_by('ticket__event__name')

        tickets_sold_labels = [item['ticket__event__name'] for item in tickets_sold]
        tickets_sold_data = [item['total'] for item in tickets_sold]

        # Doanh thu theo tháng
        monthly_revenue = Order.objects.filter(
            payment_status=Order.PaymentStatus.PAID
        ).annotate(month=TruncMonth('created_at')).values('month').annotate(total=Sum('total_amount')).order_by('month')

        revenue_labels = [item['month'].strftime('%Y-%m') for item in monthly_revenue]
        revenue_data = [float(item['total']) for item in monthly_revenue]

        # Mức độ quan tâm (dựa trên views từ EventTrend)
        engagement = EventTrend.objects.values('event__name').annotate(total=Sum('views')).order_by('event__name')

        engagement_labels = [item['event__name'] for item in engagement]
        engagement_data = [item['total'] for item in engagement]

        return TemplateResponse(request, 'admin/stats.html', {
            'tickets_sold_labels': tickets_sold_labels,
            'tickets_sold_data': tickets_sold_data,
            'revenue_labels': revenue_labels,
            'revenue_data': revenue_data,
            'engagement_labels': engagement_labels,
            'engagement_data': engagement_data,
        })

# Khởi tạo AdminSite tùy chỉnh
admin_site = MyAdminSite(name='event_admin')

admin_site.register(User, UserAdmin)
admin_site.register(Event, EventAdmin)
admin_site.register(EventCategory)
admin_site.register(TicketType, TicketAdmin)
admin_site.register(Order, OrderAdmin)
admin_site.register(OrderDetail, OrderDetailAdmin)
admin_site.register(Review)
admin_site.register(Notification)
admin_site.register(Discount)
admin_site.register(EventTrend)
