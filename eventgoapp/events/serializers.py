from rest_framework import serializers
from django.contrib.auth import get_user_model #30/3
from .models import (
    EventCategory, Event, Ticket, Order, OrderDetail, Review, 
    Notification, Discount, ChatMessage, EventTrend
)

#29/3
User = get_user_model() #30/3
class UserSerializer(serializers.ModelSerializer):
    # băm mật khẩu ra trước khi lên api xử lý
    def create(self, validated_data):
        u = User(**validated_data)
        u.set_password(validated_data['password'])
        u.save()

        return u

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'username', 'email', 'password', 'avatar']
        extra_kwargs = {
            'password': {
                'write_only': True,
                'min_length': 5,
                'max_length': 20
            },
        }


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Email không tồn tại trong hệ thống.")
        return value


class ResetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError("Mật khẩu không khớp.")
        return data
    

class EventCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = EventCategory
        fields = '__all__'


class EventSerializer(serializers.ModelSerializer):
    organizer = UserSerializer(read_only=True)
    category = EventCategorySerializer(read_only=True)

    class Meta:
        model = Event
        fields = '__all__'

