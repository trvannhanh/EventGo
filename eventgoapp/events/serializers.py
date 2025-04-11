from rest_framework import serializers
import re
from events.models import User, Event, Ticket, Order, OrderDetail, EventCategory, Review, Notification, Discount


class UserSerializer(serializers.ModelSerializer):
    def validate_email(self, value):
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', value):
            raise serializers.ValidationError("Email không hợp lệ.")
        return value

    def validate_phone(self, value):
        if value and not re.match(r'^\d{10}$', value):
            raise serializers.ValidationError("Số điện thoại phải có 10 chữ số.")
        return value

    def validate_avatar(self, value):
        if value:
            if not value.name.endswith(('.jpg', '.jpeg', '.png')):
                raise serializers.ValidationError("Avatar phải là file .jpg, .jpeg hoặc .png.")
            if value.size > 2 * 1024 * 1024:
                raise serializers.ValidationError("Avatar không được lớn hơn 2MB.")
        return value

    def validate(self, data):
        # Không cho phép thay đổi role khi cập nhật
        if self.instance and 'role' in data:
            raise serializers.ValidationError("Không được phép thay đổi vai trò.")
        # Không cho phép thay đổi username khi cập nhật
        if self.instance and 'username' in data:
            raise serializers.ValidationError("Không được phép thay đổi username.")
        return data

    def create(self, validated_data):
        request = self.context.get('request', None)
        role = validated_data.get('role', User.Role.ATTENDEE)

        if role == User.Role.ADMIN:
            if not request or not request.user.is_superuser:
                raise serializers.ValidationError("Bạn không thể tự đăng ký với vai trò Admin.")

        u = User(**validated_data)
        u.set_password(validated_data['password'])
        u.save()
        return u



    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "role", "phone", "address", "avatar"]
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},  # Không bắt buộc khi cập nhật
            'username': {'required': False},  # Không bắt buộc khi cập nhật
        }

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu cũ không đúng.")
        return value

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Mật khẩu mới phải có ít nhất 8 ký tự.")
        return value

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

class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)  # Display username instead of ID

    class Meta:
        model = Review
        fields = ['id', 'user', 'rating', 'comment', 'created_at']

class DiscountSerializer(serializers.ModelSerializer):
    event = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())
    class Meta:
        model = Discount
        fields = ['id', 'event', 'code', 'discount_percent', 'expiration_date', 'target_rank']