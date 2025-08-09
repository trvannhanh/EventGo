from cloudinary.utils import cloudinary_url
from django.db.models import Avg
from rest_framework import serializers
import re
from events.models import User, Event, TicketType, Order, OrderDetail, EventCategory, Review, Notification, Discount


class BaseSerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        d = super().to_representation(instance)
        d['image'] = instance.image.url if instance.image else None # Check if image is null
        return d

class UserSerializer(serializers.ModelSerializer):
    event_count = serializers.SerializerMethodField(read_only=True)
    
    def validate_email(self, value):
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', value):
            raise serializers.ValidationError("Email không hợp lệ.")
        return value

    def to_representation(self, instance):
        d = super().to_representation(instance)
        d['avatar'] = instance.avatar.url if instance.avatar else None # Check if image is null
        d['event_count'] = self.get_event_count(instance)
        return d
        
    def get_event_count(self, obj):
        return Event.objects.filter(organizer=obj, active=True).count()

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
        fields = ["id", "username", "email", "password", "role", "phone", "address", "avatar", "event_count"]
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
        fields = ['id', 'name']

class EventSerializer(BaseSerializer):
    organizer = UserSerializer(read_only=True, )
    category = EventCategorySerializer(read_only=True)
    average_rating = serializers.SerializerMethodField(read_only=True)
    review_count = serializers.SerializerMethodField(read_only=True)
    tickets = serializers.SerializerMethodField(read_only=True)
    
    # Thêm các trường để map đúng cho frontend
    event_date = serializers.SerializerMethodField(read_only=True)
    event_time = serializers.SerializerMethodField(read_only=True)
    venue = serializers.SerializerMethodField(read_only=True)
    
    # Thêm các trường để có thể nhận dữ liệu từ client
    organizer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        source='organizer',
        required=False, 
        write_only=True
    )
    
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=EventCategory.objects.all(),
        source='category',
        required=True,
        write_only=True
    )

    def get_average_rating(self, obj):
        avg = obj.reviews.aggregate(Avg('rating'))['rating__avg']
        return avg if avg else 0
    
    def get_review_count(self, obj):
        return obj.reviews.count()
    
    def get_tickets(self, obj):
        tickets = TicketType.objects.filter(event=obj)
        return TicketSerializer(tickets, many=True).data
    
    def get_event_date(self, obj):
        if obj.date:
            return obj.date.strftime('%Y-%m-%d')
        return None
        
    def get_event_time(self, obj):
        if obj.date:
            return obj.date.strftime('%H:%M')
        return None
    
    def get_venue(self, obj):
        return obj.location

    def validate(self, data):
        print("Dữ liệu nhận được trong serializer:", data)
        return data

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['venue'] = instance.location
        if instance.organizer:
            data['organizer'] = UserSerializer(instance.organizer, context=self.context).data
        return data

    def create(self, validated_data):
        print("Dữ liệu đã xác thực trước khi tạo:", validated_data)
        validated_data['organizer'] = self.context.get('request').user
        return super().create(validated_data)

    class Meta:
        model = Event
        fields = ['id', 'name', 'description', 'date', 'location', 'status', 'image', 'organizer', 'category',
                  'average_rating', 'review_count', 'tickets', 'event_date', 'event_time', 'venue', 'organizer_id',
                  'category_id']

class TicketSerializer(serializers.ModelSerializer):
    event_id = serializers.PrimaryKeyRelatedField(
        source='event',
        queryset=Event.objects.all(),
        required=False,
        write_only=True
    )
    event = serializers.SerializerMethodField(read_only=True)
    
    def get_event(self, obj):
        if obj.event:
            return {
                'id': obj.event.id,
                'name': obj.event.name
            }
        return None

    class Meta:
        model = TicketType
        fields = ['id', 'event', 'event_id', 'type', 'price', 'quantity']

class OrderDetailSerializer(serializers.ModelSerializer):
    order = serializers.SerializerMethodField()

    def get_order(self, obj):
        if obj.order and obj.order.ticket:
            return {
                'id': obj.order.id,
                'ticket': {
                    'id': obj.order.ticket.id,
                    'type': obj.order.ticket.type,
                    'price': obj.order.ticket.price,
                    'event': {
                        'id': obj.order.ticket.event.id,
                        'name': obj.order.ticket.event.name,
                        'image': obj.order.ticket.event.image.url if obj.order.ticket.event.image else None
                    }
                }
            }
        return None

    class Meta:
        model = OrderDetail
        fields = ['id', 'order', 'qr_code', 'qr_image', 'checked_in', 'checkin_time']

class OrderSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)
    details = OrderDetailSerializer(source='order_details', many=True, read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'user', 'total_amount','quantity', 'payment_method', 'payment_status', 'created_at', 'details']

class ReviewSerializer(serializers.ModelSerializer):
    user = serializers.StringRelatedField(read_only=True)  # Display username instead of ID
    user_id = serializers.IntegerField(write_only=True, required=False)
    event_id = serializers.IntegerField(write_only=True)
    user_avatar = serializers.SerializerMethodField()
    event_name = serializers.SerializerMethodField()
    replied_by_username = serializers.SerializerMethodField()

    def get_user_avatar(self, obj):
        if obj.user.avatar:
            return obj.user.avatar.url
        return None
    
    def get_event_name(self, obj):
        return obj.event.name if obj.event else None

    def get_replied_by_username(self, obj):
        if obj.replied_by:
            return obj.replied_by.username
        return None
    
    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Đánh giá phải từ 1 đến 5 sao.")
        return value

    def validate(self, data):
        request = self.context.get('request')
        if not self.instance:
            user_id = data.get('user_id', request.user.id if request else None)
            event_id = data.get('event_id')
            review_exists = Review.objects.select_related('user', 'event').filter(user_id=user_id,
                                                                                event_id=event_id).exists()
            if review_exists:
                raise serializers.ValidationError("Bạn đã đánh giá sự kiện này rồi.")
            order_details = OrderDetail.objects.select_related('order__ticket__event').filter(
                order__user_id=user_id,
                order__ticket__event_id=event_id,
                order__payment_status=Order.PaymentStatus.PAID,
            ).exists()
            if not order_details:
                raise serializers.ValidationError("Bạn cần tham gia sự kiện trước khi đánh giá.")
            event = Event.objects.get(id=event_id)
            if event.status != Event.EventStatus.COMPLETED:
                raise serializers.ValidationError("Chỉ có thể đánh giá sự kiện đã kết thúc.")
        return data
    
    def create(self, validated_data):
        request = self.context.get('request')
        user_id = validated_data.pop('user_id', request.user.id if request else None)
        validated_data['user_id'] = user_id
        return super().create(validated_data)

    class Meta:
        model = Review
        fields = ['id', 'user', 'user_id', 'event_id', 'rating', 'comment', 'created_at', 'user_avatar', 'event_name', 'reply', 'replied_by', 'replied_at', 'replied_by_username']
        read_only_fields = ('replied_by', 'replied_at', 'replied_by_username')

class DiscountSerializer(serializers.ModelSerializer):
    event = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())

    def validate_discount_percent(self, value):
        if not 0 <= value <= 100:
            raise serializers.ValidationError("Phần trăm giảm giá phải từ 0 đến 100.")
        return value

    class Meta:
        model = Discount
        fields = ['id', 'event', 'code', 'discount_percent', 'expiration_date', 'target_rank']

class NotificationSerializer(serializers.ModelSerializer):
    event_name = serializers.SerializerMethodField()
    event_image = serializers.SerializerMethodField()
    
    def get_event_name(self, obj):
        return obj.event.name if obj.event else None
        
    def get_event_image(self, obj):
        if obj.event and obj.event.image:
            return obj.event.image.url
        return None
    
    class Meta:
        model = Notification
        fields = ['id', 'user', 'event', 'message', 'is_read', 'created_at', 'event_name', 'event_image']


class PushTokenSerializer(serializers.Serializer):
    push_token = serializers.CharField(required=True)
    
    def update(self, instance, validated_data):
        instance.push_token = validated_data.get('push_token', instance.push_token)
        instance.save()
        return instance

class DeleteEventSerializer(serializers.Serializer):
    password = serializers.CharField(required=True, write_only=True)

    def validate_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Mật khẩu không đúng.")
        return value