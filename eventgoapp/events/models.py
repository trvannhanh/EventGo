from django.db import models
from django.contrib.auth.models import AbstractUser
from ckeditor.fields import RichTextField # đã cài ckeditor biến thuộc trở thành trình soạn tạo, vd: description bên dưới

#nhớ bổ sung các meta options mới lạ

class User(AbstractUser):
    pass

class BaseModel(models.Model):
    active = models.BooleanField(default=True)
    created_date = models.DateTimeField(auto_now_add=True, null=True)
    updated_date = models.DateTimeField(auto_now=True, null=True)

    class Meta:
        abstract = True #không tạo table nha
        ordering = ['id'] # Truy vấn giảm theo id

class Category(BaseModel):
    name = models.CharField(max_length=50)

    def __str__(self):
        return self.name

class Event(BaseModel):
    event_name = models.CharField(max_length=50, unique=True)
    description = RichTextField()
    image = models.ImageField(upload_to='events/%Y/%m/%d/', null=True)

    category = models.ForeignKey(Category, on_delete=models.CASCADE)

    def __str__(self):
        return self.event_name

    class Meta:
        unique_together = ('event_name', 'category') #trong cùng một category không được trùng event_name
#Viet model vo di