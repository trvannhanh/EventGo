from django.contrib import admin
from django.utils.html import mark_safe
from .models import *
from django import forms
from ckeditor_uploader.widgets import CKEditorUploadingWidget



class EventForm(forms.ModelForm):
    description = forms.CharField(widget=CKEditorUploadingWidget)

    class Meta:
        model = Event
        fields = '__all__'

#tùy chỉnh phân hệ admin ( bổ sung thêm các tùy chỉnh khác sau này)
class EventAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "status", "date", "organizer"] # bộ lọc theo trạng thái (status), ngày (date), người tổ chức (organizer).
    search_fields = ["name", "organizer__username"]
    list_filter = ['status', 'date', 'organizer']
    readonly_fields = ['my_image']
    form = EventForm

    def my_image(self, event):
        if event:
            return mark_safe(f"<img src='/static/{event.image.name}' width='120'/>")

    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )


class UserAdmin(admin.ModelAdmin):
    list_display = ["id", "username", "email", "role", "phone"]
    search_fields = ["username", "email"]
    list_filter = ["role"]
    readonly_fields = ["avatar_preview"]    #Hiển thị ảnh đại diện trong Admin.

    def avatar_preview(self, obj):
        if obj.avatar:
            return mark_safe(f"<img src='{obj.avatar.url}' width='60' height='60'/>")

class TicketAdmin(admin.ModelAdmin):
    list_display = ["id", "event", "type", "price", "quantity"]
    search_fields = ["event__name", "type"]
    list_filter = ["event"]

class OrderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "total_amount", "payment_status", "payment_method"]
    search_fields = ["user__username"]
    list_filter = ["payment_status", "payment_method"]

admin.site.register(User, UserAdmin)
admin.site.register(Event, EventAdmin)
admin.site.register(EventCategory)
admin.site.register(Ticket, TicketAdmin)
admin.site.register(Order, OrderAdmin)
admin.site.register(OrderDetail)
admin.site.register(Review)
admin.site.register(Notification)
admin.site.register(Discount)
admin.site.register(ChatMessage)
admin.site.register(EventTrend)
