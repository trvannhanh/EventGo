from django.contrib import admin
from django.utils.html import mark_safe
from .models import Category, Event
from django import forms
from ckeditor_uploader.widgets import CKEditorUploadingWidget



class EventForm(forms.ModelForm):
    description = forms.CharField(widget=CKEditorUploadingWidget)

    class Meta:
        model = Event
        fields = '__all__'

#tùy chỉnh phân hệ admin ( bổ sung thêm các tùy chỉnh khác sau này)
class EventAdmin(admin.ModelAdmin):
    list_display = ["id", "event_name", "created_date"] #chỉ định các thuộc tính muốn hiển thị
    search_fields = ["event_name"] # chỉ định các trường dùng để tra cứu
    list_filter = ['id', 'created_date', 'event_name'] #tạo các bộ lọc
    readonly_fields = ['my_image']
    form = EventForm

    def my_image(self, event):
        if event:
            return mark_safe(f"<img src='/static/{event.image.name}' width='120'/>")

    # thêm css và js vào
    class Media:
        css = {
            'all': ('/static/css/style.css', )
        }
        js = ('/static/js/script.js', )

admin.site.register(Category)
admin.site.register(Event, EventAdmin)
