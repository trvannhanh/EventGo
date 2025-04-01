from rest_framework import serializers

from events.models import User, Event, Ticket, Order, OrderDetail


#29/3
class UserSerializer(serializers.ModelSerializer):

    def create(self, validated_data):
        request = self.context.get('request', None)
        role = validated_data.get('role', User.Role.ATTENDEE)  # Mặc định là attendee

        if role == User.Role.ADMIN:
            if not request or not request.user.is_superuser:
                raise serializers.ValidationError("Bạn không thể tự đăng ký với vai trò Admin.")

        # băm mật khẩu ra trước khi lên api xử lý
        u = User(**validated_data)
        u.set_password(u.password)
        u.save()

        return u

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "phone", "address", "avatar"]
        extra_kwargs = {'password': {'write_only': True}}

# class ForgotPasswordSerializer(serializers.Serializer):
#     email = serializers.EmailField()
#
#     def validate_email(self, value):
#         if not User.objects.filter(email=value).exists():
#             raise serializers.ValidationError("Email không tồn tại trong hệ thống.")
#         return value
#
# class ResetPasswordSerializer(serializers.Serializer):
#     new_password = serializers.CharField(write_only=True, min_length=6)
#     confirm_password = serializers.CharField(write_only=True, min_length=6)
#
#     def validate(self, data):
#         if data['new_password'] != data['confirm_password']:
#             raise serializers.ValidationError("Mật khẩu không khớp.")
#         return data


class EventSerializer(serializers.ModelSerializer):
    """Serializer cho sự kiện"""
    class Meta:
        model = Event
        fields = ['id', 'name', 'category', 'date', 'location', 'status']

class TicketSerializer(serializers.ModelSerializer):
    """Serializer cho vé sự kiện"""
    event = EventSerializer(read_only=True)

    class Meta:
        model = Ticket
        fields = ['id', 'event', 'type', 'price', 'quantity']

class OrderDetailSerializer(serializers.ModelSerializer):
    """Serializer chi tiết đơn hàng"""
    ticket = TicketSerializer(read_only=True)

    class Meta:
        model = OrderDetail
        fields = ['id', 'ticket', 'quantity', 'qr_code']

class OrderSerializer(serializers.ModelSerializer):
    """Serializer đơn hàng"""

    user = serializers.StringRelatedField(read_only=True)  # Hiển thị username thay vì ID
    details = OrderDetailSerializer(source='order_details', many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'user', 'total_amount', 'payment_method', 'payment_status', 'created_at', 'details']