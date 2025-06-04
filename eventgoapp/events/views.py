import base64
from datetime import timezone, timedelta
from decimal import Decimal
from io import BytesIO


import openpyxl
import cloudinary.uploader
import logging
from django.http import HttpResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from django.conf import settings
from django.shortcuts import get_object_or_404

from django.db import transaction, models
from django.utils.timezone import now
from google_auth_oauthlib.flow import Flow
from httplib2 import Credentials
from openpyxl.styles import Alignment, Font
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from rest_framework import viewsets, permissions, generics, status, parsers
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from rest_framework.utils.mediatypes import order_by_precedence
from unicodedata import category
import json
import requests
import hashlib
import hmac

from django.db.models import F, Sum, Avg, ExpressionWrapper, DurationField, Q

from . import paginators
from .utils import generate_qr_image, logger
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .recommendation_engine import RecommendationEngine
from .utils import get_customer_rank

from events.models import Review, User, Event, Ticket, Order, OrderDetail, EventCategory, Discount, EventTrend, Notification
from events.serializers import ReviewSerializer, UserSerializer, EventSerializer, TicketSerializer, OrderSerializer, \
    EventCategorySerializer, DiscountSerializer, ChangePasswordSerializer, OrderDetailSerializer


# 29/3
class UserViewSet(viewsets.GenericViewSet, generics.CreateAPIView, generics.UpdateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get_object(self):
        # Dùng cho UpdateAPIView để lấy user hiện tại
        return self.request.user

    @action(methods=['get'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_current_user(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

    @action(methods=['put', 'patch'], url_path='update-current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def update_current_user(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='change-password', detail=False,
            permission_classes=[permissions.IsAuthenticated])
    def change_password(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({"message": "Đổi mật khẩu thành công."}, status=status.HTTP_200_OK)


    @action(methods=['delete'], url_path='delete-current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def delete_current_user(self, request):
        user = request.user
        user.is_active = False  # Soft delete
        user.save()
        return Response({"message": "Xóa tài khoản thành công."}, status=status.HTTP_204_NO_CONTENT)

    @action(methods=['get'], url_path='my-rank', detail=False, permission_classes=[IsAuthenticated])
    def get_my_rank(self, request):
        rank = get_customer_rank(request.user)
        return Response({"rank": rank}, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='my-tickets', detail=False, permission_classes=[IsAuthenticated])
    def my_tickets(self, request):
        user = request.user
        order_details = OrderDetail.objects.filter(order__user=user)
        from events.serializers import OrderDetailSerializer
        serializer = OrderDetailSerializer(order_details, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
        
    @action(methods=['get'], url_path='my-notifications', detail=False, permission_classes=[IsAuthenticated])
    def my_notifications(self, request):
        user = request.user
        notifications = Notification.objects.filter(user=user).order_by('-created_at')
        from events.serializers import NotificationSerializer
        serializer = NotificationSerializer(notifications, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    @action(methods=['patch'], url_path='mark-notification-read/(?P<pk>[0-9]+)', detail=False, permission_classes=[IsAuthenticated])
    def mark_notification_read(self, request, pk=None):
        user = request.user
        try:
            notification = Notification.objects.get(id=pk, user=user)
            notification.is_read = True
            notification.save()
            return Response({"message": "Đánh dấu thông báo đã đọc thành công"}, status=status.HTTP_200_OK)
        except Notification.DoesNotExist:
            return Response({"error": "Không tìm thấy thông báo"}, status=status.HTTP_404_NOT_FOUND)
    @action(methods=['patch'], url_path='mark-all-notifications-read', detail=False, permission_classes=[IsAuthenticated])
    def mark_all_notifications_read(self, request):
        user = request.user
        Notification.objects.filter(user=user, is_read=False).update(is_read=True)
        return Response({"message": "Đánh dấu tất cả thông báo đã đọc thành công"}, status=status.HTTP_200_OK)
        
    @action(methods=['post'], url_path='push-token', detail=False, permission_classes=[IsAuthenticated])
    def update_push_token(self, request):
        """API endpoint để cập nhật Expo Push Token cho người dùng hiện tại."""
        user = request.user
        from events.serializers import PushTokenSerializer
        serializer = PushTokenSerializer(data=request.data)
        
        if serializer.is_valid():
            user.push_token = serializer.validated_data.get('push_token')
            user.save()
            return Response({"message": "Push token đã được cập nhật thành công"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class EventCategoryViewSet(viewsets.ViewSet, generics.ListAPIView):
    """
    API để lấy danh sách tất cả các danh mục sự kiện (EventCategory).
    Endpoint: GET /event-categories/
    """
    queryset = EventCategory.objects.all()
    serializer_class = EventCategorySerializer
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return self.queryset

class EventViewSet(viewsets.ViewSet, generics.ListAPIView):
    queryset = Event.objects.filter(active=True)
    serializer_class = EventSerializer
    pagination_class = paginators.ItemPaginator

    def update_event_statuses(self, queryset):
        """Cập nhật trạng thái cho tất cả sự kiện trong queryset."""
        current_time = now()
        # Logic cập nhật từ UPCOMING/ONGOING sang COMPLETED nếu đã qua ngày
        queryset.filter(
            Q(status=Event.EventStatus.UPCOMING) | Q(status=Event.EventStatus.ONGOING),
            date__lt=current_time 
        ).update(status=Event.EventStatus.COMPLETED)
        
        # Logic cập nhật từ COMPLETED sang UPCOMING nếu ngày sự kiện trong tương lai (có thể do chỉnh sửa)
        queryset.filter(
            status=Event.EventStatus.COMPLETED,
            date__gte=current_time 
        ).update(status=Event.EventStatus.UPCOMING)

        # Logic cập nhật từ UPCOMING sang ONGOING nếu sự kiện đang diễn ra
        # Giả sử một sự kiện diễn ra trong cả ngày, hoặc bạn có start_time và end_time để so sánh chính xác hơn
        # Ví dụ đơn giản: nếu date là ngày hôm nay và status là upcoming -> ongoing
        # Cần định nghĩa rõ hơn "ongoing" nghĩa là gì (ví dụ: trong khoảng start_time và end_time)
        # Tạm thời giữ nguyên logic cũ cho ongoing nếu không có start/end time cụ thể
        # queryset.filter(date__date=current_time.date(), status=Event.EventStatus.UPCOMING).update(status=Event.EventStatus.ONGOING)
        return queryset

    def get_queryset(self):
        # Start with the base queryset defined for the ViewSet
        query = self.queryset # This is Event.objects.filter(active=True)

        # Get query parameters
        q_param = self.request.query_params.get('q')
        cate_id_param = self.request.query_params.get('cateId')
        status_param = self.request.query_params.get('status')
        organizer_param = self.request.query_params.get('organizer')

        # --- Stage 1: Apply general filters (search, category, organizer) ---
        general_filters = Q()
        if q_param:
            general_filters &= Q(name__icontains=q_param)

        if cate_id_param:
            try:
                general_filters &= Q(category_id=int(cate_id_param))
            except ValueError:
                raise ValidationError({"error": "cateId phải là số nguyên hợp lệ."})

        if organizer_param:
            if organizer_param == 'me':
                if hasattr(self.request, 'user') and self.request.user.is_authenticated:
                    if self.request.user.role not in [User.Role.ORGANIZER, User.Role.ADMIN]:
                        return Event.objects.none() 
                    general_filters &= Q(organizer=self.request.user)
                else:
                    return Event.objects.none()
            else: 
                try:
                    general_filters &= Q(organizer_id=int(organizer_param))
                except ValueError:
                    raise ValidationError({"error": "Tham số organizer ID không hợp lệ."})
        
        if general_filters: 
            query = query.filter(general_filters)

        # --- Stage 2: Update statuses for the current generally filtered set ---
        # This ensures statuses are based on current time BEFORE specific status filtering.
        query = self.update_event_statuses(query)

        # --- Stage 3: Apply the specific status filter requested by the client ---
        if status_param:
            valid_statuses = [choice[0] for choice in Event.EventStatus.choices]
            if status_param not in valid_statuses:
                raise ValidationError({"error": f"Trạng thái không hợp lệ. Sử dụng {', '.join(valid_statuses)}."})
            
            # Filter by the specific status AFTER statuses have been updated
            query = query.filter(status=status_param) 
            print(f"Applied specific status filter: {status_param} AFTER status update logic.")
        
        # DEBUG: Log the filter conditions and result count
        print(f"Event Query - Final - Requested Status: {status_param}, Organizer: {organizer_param}, Result count: {query.count()}")
        
        return query


    @action(methods=['get'], url_path='detail', detail=True)
    def view_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        trend, created = EventTrend.objects.get_or_create(event=event)
        trend.increment_views()  # Tăng views
        trend.increment_interest(points=1)  # Tăng interest_level khi xem chi tiết
        serializer = EventSerializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['put', 'patch'], url_path='update', detail=True, permission_classes=[IsAuthenticated])
    def update_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        user = request.user

        # Check 1: Event status must be 'upcoming'
        if event.status != Event.EventStatus.UPCOMING:
            return Response({"error": "Chỉ có thể cập nhật sự kiện sắp diễn ra."}, 
                            status=status.HTTP_403_FORBIDDEN)

        # Check 2: User must be the organizer or a superuser
        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền cập nhật sự kiện này."}, 
                            status=status.HTTP_403_FORBIDDEN)
        
        # Lưu lại các giá trị cũ trực tiếp từ đối tượng event TRƯỚC KHI cập nhật
        old_name = event.name
        old_date = event.date  # Đây là đối tượng date/datetime của Python
        old_location = event.location
        
        serializer = EventSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_event = serializer.save() # Đối tượng 'event' được cập nhật (updated_event và event là cùng một instance)
        
        significant_updates = []
        
        # So sánh các giá trị mới từ updated_event với các giá trị cũ đã lưu
        if updated_event.name != old_name:
            significant_updates.append(f"Tên sự kiện đã được thay đổi thành: {updated_event.name}")
        
        if updated_event.date != old_date:
            # Định dạng ngày tháng cho đẹp trong thông báo
            new_date_str = updated_event.date.strftime('%d/%m/%Y') if hasattr(updated_event.date, 'strftime') else str(updated_event.date)
            significant_updates.append(f"Ngày diễn ra sự kiện đã thay đổi thành: {new_date_str}")
        
        if updated_event.location != old_location:
            significant_updates.append(f"Địa điểm sự kiện đã thay đổi thành: {updated_event.location}")
            
        if significant_updates:
            # Tạo thông điệp cập nhật, sử dụng updated_event.name là tên mới nhất
            update_message = f"Sự kiện {old_name} đã được cập nhật:\\n" + "\\n".join(significant_updates)
            print(update_message)
            print("Thông điệp cập nhật:")
            print(updated_event.id)
            print("Loai")
            print(type(updated_event.id))
            print(type(update_message))              # Send notification asynchronously
            from events.tasks import send_event_update_notifications
            # Use delay instead of apply_async for simpler task execution
            send_event_update_notifications.delay(updated_event.id, update_message)
            
            # Gửi push notification
            from events.notification_utils import create_and_send_event_notification
            create_and_send_event_notification(updated_event.id, is_update=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['delete'], url_path='delete', detail=True, permission_classes=[IsAuthenticated])
    def delete_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        user = request.user
        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền xóa sự kiện này."}, status=status.HTTP_403_FORBIDDEN)
        event.delete()
        return Response({"message": "Đã xóa sự kiện thành công."}, status=status.HTTP_204_NO_CONTENT)    
    
    @action(methods=['patch'], url_path='cancel', detail=True, permission_classes=[IsAuthenticated])
    def cancel_event(self, request, pk=None):
        """Hủy sự kiện - chỉ áp dụng cho sự kiện có trạng thái UPCOMING hoặc ONGOING"""
        event = get_object_or_404(Event, id=pk)
        user = request.user
        
        # Kiểm tra quyền hủy sự kiện (chỉ organizer hoặc admin)
        if not user.is_superuser and event.organizer != user:
            return Response(
                {"error": "Bạn không có quyền hủy sự kiện này."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Kiểm tra trạng thái sự kiện - chỉ có thể hủy sự kiện chưa kết thúc
        if event.status not in [Event.EventStatus.UPCOMING, Event.EventStatus.ONGOING]:
            return Response(
                {"error": f"Không thể hủy sự kiện có trạng thái '{event.get_status_display()}'. Chỉ có thể hủy sự kiện 'Sắp diễn ra' hoặc 'Đang diễn ra'."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Cập nhật trạng thái thành CANCELED
        old_status = event.get_status_display()
        event.status = Event.EventStatus.CANCELED
        event.save()
        
        # Tạo thông điệp thông báo hủy sự kiện
        cancel_message = f"Sự kiện '{event.name}' đã bị hủy. Trạng thái thay đổi từ '{old_status}' thành 'Đã hủy'."
        
        # Gửi thông báo cho tất cả người đã đăng ký vé
        try:
            # Lấy danh sách người dùng đã mua vé cho sự kiện này
            attendees = User.objects.filter(
                orders__order_details__ticket__event=event,
                orders__payment_status=Order.PaymentStatus.PAID
            ).distinct()
            
            # Tạo thông báo cho từng người tham gia
            for attendee in attendees:
                Notification.objects.create(
                    user=attendee,
                    message=f"Sự kiện '{event.name}' mà bạn đã đăng ký tham gia đã bị hủy. Vui lòng liên hệ ban tổ chức để được hỗ trợ về việc hoàn tiền.",
                    event=event
                )
            
            # Gửi thông báo bất đồng bộ
            from events.tasks import send_event_cancellation_notifications
            send_event_cancellation_notifications.delay(event.id, cancel_message)
            
            # Gửi push notification
            from events.notification_utils import create_and_send_event_notification
            create_and_send_event_notification(event.id, is_cancel=True)
            
        except Exception as e:
            # Log lỗi nhưng không làm thất bại việc hủy sự kiện
            logger.error(f"Lỗi khi gửi thông báo hủy sự kiện {event.id}: {str(e)}")
        
        serializer = EventSerializer(event)
        return Response({
            "message": "Sự kiện đã được hủy thành công.",
            "event": serializer.data,
            "notifications_sent": f"Đã gửi thông báo hủy sự kiện đến {attendees.count() if 'attendees' in locals() else 0} người tham gia."
        }, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='create', detail=False, permission_classes=[permissions.IsAuthenticated])
    def create_event(self, request):
        print(request.user.role)
        if not request.user.is_superuser and request.user.role != 'organizer':
            return Response(
                {"error": "Bạn không có quyền tạo sự kiện"},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['organizer_id'] = request.user.id
        
        
        print("Dữ liệu gửi đến serializer:", data)

        serializer = EventSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        event = serializer.save()

        # Cập nhật trạng thái ngay sau khi tạo
        event.update_status()  # Nếu vẫn giữ method trong model, hoặc dùng logic dưới
        current_time = now()
        if event.date < current_time and event.status == Event.EventStatus.UPCOMING:  # 6/4
            event.status = Event.EventStatus.COMPLETED
            event.save(update_fields=['status'])        # Tạo thông báo cho tất cả người dùng về sự kiện mới
        message = f"Sự kiện mới '{event.name}' đã được tạo and sẽ diễn ra vào {event.date.strftime('%d/%m/%Y')}"
        
        # Lấy tất cả người dùng có vai trò là người tham dự (attendee)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        attendees = User.objects.filter(role='attendee', is_active=True)
        
        # Tạo thông báo trong ứng dụng cho mỗi người dùng
        for user in attendees:
            Notification.objects.create(
                user=user,
                message=message,
                event=event
            )
          # Gọi celery task để gửi email thông báo
        from events.tasks import send_new_event_notifications
        send_new_event_notifications.delay(event.id)
        
        # Gửi push notification
        from events.notification_utils import create_and_send_event_notification
        create_and_send_event_notification(event.id, is_update=False)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(methods=['post'], url_path='review', detail=True)
    def submit_review(self, request, pk=None):        # Check if user is authenticated
        if not request.user.is_authenticated:
            return Response(
                {"error": "Bạn cần đăng nhập để đánh giá sự kiện này."},
                status=status.HTTP_401_UNAUTHORIZED
            )
            
        event = get_object_or_404(Event, id=pk)

        if not OrderDetail.objects.filter(order__user=request.user, ticket__event=event,
                                          order__payment_status=Order.PaymentStatus.PAID).exists():
            return Response(
                {"error": "Bạn không thể đánh giá sự kiện mà bạn không tham gia."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        
        if event.status != Event.EventStatus.COMPLETED:
            return Response(
                {"error": "Chỉ có thể đánh giá sự kiện đã kết thúc."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        
        rating = request.data.get('rating')
        comment = request.data.get('comment')

        if not rating or not comment:
            return Response(
                {"error": "Vui lòng cung cấp cả đánh giá và nhận xét."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Ensure rating is an integer
        try:
            rating = int(rating)
            if rating < 1 or rating > 5:
                return Response(
                    {"error": "Đánh giá phải từ 1 đến 5 sao."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {"error": "Đánh giá phải là một số từ 1 đến 5."},
                status=status.HTTP_400_BAD_REQUEST
            )

        review = Review.objects.create(
            user=request.user,
            event=event,
            rating=rating,
            comment=comment
        )

        # Tăng interest_level khi đánh giá
        trend, created = EventTrend.objects.get_or_create(event=event)
        trend.increment_interest(points=2)  # Đánh giá đáng giá +2

        return Response(
            {"message": "Đánh giá của bạn đã được gửi thành công."},
            status=status.HTTP_201_CREATED
        )

    @action(methods=['get'], url_path='feedback', detail=True)
    def view_feedback(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        
        # Không cần kiểm tra quyền, cho phép mọi người dùng xem phản hồi
        reviews = Review.objects.filter(event=event, active=True).order_by('-created_at')
        serializer = ReviewSerializer(reviews, many=True)
        
        # Tính điểm đánh giá trung bình để đồng bộ với frontend
        avg_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0
        
        # Trả về dạng đối tượng có cấu trúc giống với ReviewViewSet.by_event
        response_data = {
            'reviews': serializer.data,
            'average_rating': round(avg_rating, 1),
            'total_reviews': reviews.count(),
        }

        return Response(response_data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='reviews/(?P<review_pk>[0-9]+)/reply', detail=True, permission_classes=[IsAuthenticated])
    def reply_to_review(self, request, pk=None, review_pk=None):
        event = get_object_or_404(Event, id=pk)
        review = get_object_or_404(Review, id=review_pk, event=event)
        user = request.user

        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền phản hồi đánh giá này."}, status=status.HTTP_403_FORBIDDEN)

        reply_content = request.data.get('reply')
        if not reply_content:
            return Response({"error": "Nội dung phản hồi không được để trống."}, status=status.HTTP_400_BAD_REQUEST)

        review.reply = reply_content
        review.replied_by = user
        review.replied_at = now()
        review.save()

        serializer = ReviewSerializer(review)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='recommended', detail=False, permission_classes=[IsAuthenticated])
    def get_recommended_events(self, request):
        user = request.user
        if user.role != 'attendee':
            return Response(
                {"error": "Chỉ người tham gia (attendee) mới có thể xem sự kiện đề xuất."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Cập nhật trạng thái trước khi đề xuất
        self.update_event_statuses(Event.objects.all())
        engine = RecommendationEngine()
        recommended_events = engine.ml_recommendation(user.id)
        serializer = self.get_serializer(recommended_events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='trending', detail=False)
    def get_trending_events(self, request):
        """Lấy danh sách sự kiện hot dựa trên views và interest_level."""
        limit = int(request.query_params.get('limit', 5))

        # Tính điểm tổng hợp: ví dụ 70% views + 30% interest_level
        trending_events = Event.objects.filter(
            active=True,
            status=Event.EventStatus.UPCOMING
        ).annotate(
            trend_score=(0.7 * models.F('trends__views') + 0.3 * models.F('trends__interest_level'))
        ).order_by('-trend_score')[:limit]

        serializer = self.get_serializer(trending_events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='create-discount', detail=True)
    def create_discount(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)

        if not request.user.is_superuser and request.user != event.organizer:
            return Response(
                {"error": "Bạn không có quyền tạo mã giảm giá cho sự kiện này."},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['event'] = event.id
        if 'expiration_date' not in data:
            data['expiration_date'] = now() + timedelta(days=7)

        serializer = DiscountSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


    # @action(methods=['get'], url_path='search-events', detail=False)
    # def search_events(self, request):
    #     category = request.query_params.get('category')
    #     if not category:
    #         return Response({"error": "Vui lòng cung cấp category"}, status=status.HTTP_400_BAD_REQUEST)
    #
    #     events = Event.objects.filter(category__name__icontains=category,
    #                                   status=Event.EventStatus.UPCOMING)  # Tìm category không phân biệt chữ hoa/ thường, chỉ lấy sự kiện sắp diễn ra
    #     serializer = EventSerializer(events, many=True)
    #     return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='tickets', detail=True)
    def get_tickets(self, request, pk=None):
        """Lấy danh sách vé của một sự kiện."""
        event = get_object_or_404(Event, id=pk)
        tickets = Ticket.objects.filter(event=event)
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='tickets/create', detail=True, permission_classes=[permissions.IsAuthenticated])
    def create_ticket(self, request, pk=None):
        """
        Create a ticket for an event.
        POST /events/{event_id}/tickets/create/
        """
        event = get_object_or_404(Event, id=pk)
        
        # Check if the user is the organizer or an admin
        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "You don't have permission to create tickets for this event."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Get ticket data from request
        ticket_type = request.data.get('type')
        price = request.data.get('price')
        quantity = request.data.get('quantity')
        
        # Validate required fields
        if not all([ticket_type, price, quantity]):
            return Response(
                {"error": "Missing required fields: type, price, or quantity"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Convert price and quantity to appropriate types
            price = float(price)
            quantity = int(quantity)
            
            # Validate price and quantity
            if price < 0:
                return Response(
                    {"error": "Price cannot be negative"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if quantity <= 0:
                return Response(
                    {"error": "Quantity must be positive"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Create the ticket
            ticket = Ticket.objects.create(
                event=event,
                type=ticket_type,
                price=price,
                quantity=quantity
            )
            
            # Return the created ticket
            serializer = TicketSerializer(ticket)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid price or quantity values"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(methods=['put'], url_path='tickets/(?P<ticket_id>[^/.]+)/update', detail=True, permission_classes=[permissions.IsAuthenticated])
    def update_ticket(self, request, pk=None, ticket_id=None):
        """
        Update a ticket for an event.
        PUT /events/{event_id}/tickets/{ticket_id}/update/
        """
        event = get_object_or_404(Event, id=pk)
        ticket = get_object_or_404(Ticket, id=ticket_id, event=event)
        
        # Check if the user is the organizer or an admin
        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "You don't have permission to update tickets for this event."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Get ticket data from request
        ticket_type = request.data.get('type')
        price = request.data.get('price')
        quantity = request.data.get('quantity')
        
        # Validate required fields
        if not all([ticket_type, price, quantity]):
            return Response(
                {"error": "Missing required fields: type, price, or quantity"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            # Convert price and quantity to appropriate types
            price = float(price)
            quantity = int(quantity)
            
            # Validate price and quantity
            if price < 0:
                return Response(
                    {"error": "Price cannot be negative"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if quantity <= 0:
                return Response(
                    {"error": "Quantity must be positive"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            # Update the ticket
            ticket.type = ticket_type
            ticket.price = price
            ticket.quantity = quantity
            ticket.save()
            
            # Return the updated ticket
            serializer = TicketSerializer(ticket)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid price or quantity values"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(methods=['delete'], url_path='tickets/(?P<ticket_id>[^/.]+)/delete', detail=True, permission_classes=[permissions.IsAuthenticated])
    def delete_ticket(self, request, pk=None, ticket_id=None):
        """
        Delete a ticket for an event.
        DELETE /events/{event_id}/tickets/{ticket_id}/delete/
        """
        event = get_object_or_404(Event, id=pk)
        ticket = get_object_or_404(Ticket, id=ticket_id, event=event)
        
        # Check if the user is the organizer or an admin
        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "You don't have permission to delete tickets for this event."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        # Check if the ticket has been sold
        if OrderDetail.objects.filter(ticket=ticket).exists():
            return Response(
                {"error": "Cannot delete ticket as it has already been sold."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        # Delete the ticket
        ticket.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(methods=['post'], url_path='create-order', detail=True, permission_classes=[permissions.IsAuthenticated])
    def create_order(self, request, pk=None):
        user = request.user
        event = get_object_or_404(Event, id=pk)
        if event.status != Event.EventStatus.UPCOMING:
            return Response({"error": "Sự kiện không khả dụng để đặt vé"}, status=status.HTTP_400_BAD_REQUEST)

        ticket_id = request.data.get('ticket_id')
        quantity = int(request.data.get('quantity', 1))
        discount_code = request.data.get('discount_code')
        payment_method = request.data.get('payment_method')

        if not all([ticket_id, quantity]):
            return Response({"error": "Thiếu thông tin đặt vé"}, status=status.HTTP_400_BAD_REQUEST)

        ticket = get_object_or_404(Ticket, event=event, id=ticket_id)

        with transaction.atomic():
            # Kiểm tra và tạm giữ vé
            if ticket.quantity < quantity:
                return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

            # Giảm số lượng vé ngay lập tức để tạm giữ
            ticket.quantity -= quantity
            ticket.save()

            total_price = ticket.price * quantity

            # Kiểm tra và áp dụng mã giảm giá
            if discount_code:
                discount = Discount.objects.filter(
                    code=discount_code,
                    event=event,
                    expiration_date__gt=now()
                ).first()
                if not discount:
                    return Response({"error": "Mã giảm giá không hợp lệ hoặc đã hết hạn"},
                                    status=status.HTTP_400_BAD_REQUEST)

                user_rank = get_customer_rank(user)
                if discount.target_rank and discount.target_rank != 'none' and discount.target_rank != user_rank:
                    return Response({"error": "Mã giảm giá không áp dụng cho hạng của bạn"},
                                    status=status.HTTP_403_FORBIDDEN)

                total_price = total_price * Decimal(str(1 - discount.discount_percent / 100))

            # Tạo Order
            order = Order.objects.create(
                user=user,
                ticket=ticket,
                total_amount=total_price,
                payment_status=Order.PaymentStatus.PENDING,
                payment_method=payment_method,
                quantity=quantity
            )

            # Tăng interest_level
            trend, created = EventTrend.objects.get_or_create(event=event)
            trend.increment_interest(points=3)

        return Response({
            "order_id": order.id,
            "total_amount": order.total_amount,
            "payment_method": order.payment_method,
            "expiration_time": order.expiration_time,
            "message": "Order đã được tạo, vui lòng gọi /orders/{id}/pay/ để thanh toán"
        }, status=status.HTTP_201_CREATED)




    @action(methods=['post'], url_path='checkin', detail=True, permission_classes=[permissions.IsAuthenticated])
    def checkin_by_qr(self, request, pk=None):
        """Check-in vé bằng mã QR cho một sự kiện."""
        qr_code = request.data.get('qr_code')
        if not qr_code:
            return Response({"error": "Thiếu mã QR"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_detail = OrderDetail.objects.get(
                qr_code=qr_code,
                ticket__event_id=pk
            )
        except OrderDetail.DoesNotExist:
            return Response({"error": "Không tìm thấy vé với mã QR này cho sự kiện"}, status=status.HTTP_404_NOT_FOUND)

        if order_detail.order.payment_status != Order.PaymentStatus.PAID:
            return Response({"error": "Vé chưa được thanh toán"}, status=status.HTTP_400_BAD_REQUEST)

        if order_detail.checked_in:
            return Response({"message": "Vé đã được check-in trước đó"}, status=status.HTTP_200_OK)

        order_detail.checked_in = True
        order_detail.save()

        return Response({"message": "Check-in thành công", "order_id": order_detail.order.id},
                        status=status.HTTP_200_OK)


    @action(methods=['get'], url_path='discounts', detail=True, permission_classes=[permissions.IsAuthenticated])
    def get_discounts(self, request, pk=None):
        """
        Lấy tất cả mã giảm giá của một sự kiện và đánh dấu mã nào người dùng có thể sử dụng.
        Endpoint: GET /events/{pk}/discounts/
        """
        event = get_object_or_404(Event, id=pk)

        # Lấy rank của người dùng hiện tại
        user_rank = get_customer_rank(request.user)

        # Lấy tất cả mã giảm giá còn hiệu lực của sự kiện
        current_time = now()
        discounts = Discount.objects.filter(
            event=event,
            expiration_date__gt=current_time
        ).order_by('expiration_date')

        # Serialize dữ liệu và thêm trường is_usable
        serializer = DiscountSerializer(discounts, many=True)
        discount_data = serializer.data

        for discount in discount_data:
            discount['is_usable'] = (
                    discount['target_rank'] == 'none' or discount['target_rank'] == user_rank
            )

        return Response({
            'discounts': discount_data,
            'user_rank': user_rank,
        }, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='check-discount', detail=True, permission_classes=[permissions.IsAuthenticated])
    def check_discount(self, request, pk=None):
        """Kiểm tra mã giảm giá cho một sự kiện."""
        discount_code = request.data.get('discount_code')
        if not discount_code:
            return Response({"error": "Thiếu mã giảm giá"}, status=status.HTTP_400_BAD_REQUEST)

        discount = Discount.objects.filter(
            code=discount_code,
            event_id=pk,
            expiration_date__gt=now()
        ).first()
        if not discount:
            return Response({"error": "Mã không hợp lệ hoặc hết hạn"}, status=status.HTTP_400_BAD_REQUEST)

        user_rank = get_customer_rank(request.user)
        if discount.target_rank and discount.target_rank != 'none' and discount.target_rank != user_rank:
            return Response({"error": "Mã không áp dụng cho hạng của bạn"}, status=status.HTTP_403_FORBIDDEN)

        return Response({
            "code": discount.code,
            "discount_percent": discount.discount_percent,
            "target_rank": discount.target_rank
        }, status=status.HTTP_200_OK)
    
    @action(methods=['get'], url_path='analytics', detail=True, permission_classes=[permissions.IsAuthenticated])
    def get_event_analytics(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)

        # Kiểm tra quyền truy cập
        if not request.user.is_superuser and request.user != event.organizer:
            return Response(
                {"error": "Bạn không có quyền xem báo cáo phân tích cho sự kiện này."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Tính toán các chỉ số hiện có
        total_revenue = Order.objects.filter(
            order_details__ticket__event=event,
            payment_status=Order.PaymentStatus.PAID
        ).aggregate(total=Sum('total_amount'))['total'] or 0        
        tickets_sold = OrderDetail.objects.filter(
            ticket__event=event,
            order__payment_status=Order.PaymentStatus.PAID
        ).count() or 0

        average_rating = Review.objects.filter(event=event).aggregate(avg_rating=Avg('rating'))['avg_rating'] or 0
        average_rating = round(average_rating, 1)

        # Tỷ lệ hủy đơn hàng
        total_orders = Order.objects.filter(order_details__ticket__event=event).count()
        canceled_orders = Order.objects.filter(
            order_details__ticket__event=event,
            payment_status=Order.PaymentStatus.FAILED
        ).count()
        cancellation_rate = (canceled_orders / total_orders * 100) if total_orders > 0 else 0
        cancellation_rate = round(cancellation_rate, 2)

        # Thời gian trung bình để mua vé (tính từ created_at đến updated_at khi thanh toán thành công)
        avg_purchase_time = Order.objects.filter(
            order_details__ticket__event=event,
            payment_status=Order.PaymentStatus.PAID
        ).annotate(
            purchase_duration=ExpressionWrapper(
                F('updated_at') - F('created_at'),
                output_field=DurationField()
            )
        ).aggregate(avg_time=Avg('purchase_duration'))['avg_time']
        avg_purchase_time_seconds = avg_purchase_time.total_seconds() / 60 if avg_purchase_time else 0  # Đổi ra phút

        # Tỷ lệ người tham gia quay lại
        attendees = User.objects.filter(
            orders__order_details__ticket__event=event,
            orders__payment_status=Order.PaymentStatus.PAID
        ).distinct()
        total_attendees = attendees.count()
        repeat_attendees = 0
        for attendee in attendees:
            other_events = Event.objects.filter(
                organizer=event.organizer
            ).exclude(id=event.id)
            if Order.objects.filter(
                    user=attendee,
                    order_details__ticket__event__in=other_events,
                    payment_status=Order.PaymentStatus.PAID
            ).exists():
                repeat_attendees += 1
        repeat_attendee_rate = (repeat_attendees / total_attendees * 100) if total_attendees > 0 else 0
        repeat_attendee_rate = round(repeat_attendee_rate, 2)

        # Lấy thông tin từ EventTrend
        event_trend = EventTrend.objects.filter(event=event).first()
        event_views = event_trend.views if event_trend else 0
        event_interest_score = event_trend.interest_level if event_trend else 0
        
        # Tỷ lệ chuyển đổi (views -> tickets)
        conversion_rate = (tickets_sold / event_views * 100) if event_views > 0 else 0
        conversion_rate = round(conversion_rate, 2)
        
        # Thông tin chi tiết về loại vé đã bán
        tickets_breakdown = []
        tickets = Ticket.objects.filter(event=event)
        for ticket in tickets:
            sold_count = OrderDetail.objects.filter(
                ticket=ticket,
                order__payment_status=Order.PaymentStatus.PAID
            ).count()
            
            tickets_breakdown.append({
                'ticket_id': ticket.id,
                'ticket_type': ticket.type,
                'ticket_price': ticket.price,
                'quantity_sold': sold_count,
                'revenue': ticket.price * sold_count
            })
        
        # Thông tin về lượt xem theo ngày (lấy 7 ngày gần nhất)
        # Giả lập dữ liệu cho mẫu, trong thực tế cần lưu lượt xem theo ngày trong cơ sở dữ liệu
        from datetime import datetime, timedelta
        today = datetime.now().date()
        views_by_day = []
        
        # Giả lập dữ liệu xem theo ngày (trong thực tế có bảng lưu lượt xem theo ngày)
        for i in range(7):
            day = today - timedelta(days=i)
            views_by_day.append({
                'date': day.strftime('%Y-%m-%d'),
                'count': int(event_views / 7) + ((-1)**i) * (i*3) # Giả lập tăng giảm để tạo đồ thị
            })
        views_by_day.reverse()  # Sắp xếp từ ngày xa nhất đến gần nhất
        
        # Phân tích đánh giá
        reviews = Review.objects.filter(event=event)
        review_count = reviews.count()
        
        rating_counts = {
            '5': reviews.filter(rating=5).count(),
            '4': reviews.filter(rating=4).count(),
            '3': reviews.filter(rating=3).count(),
            '2': reviews.filter(rating=2).count(),
            '1': reviews.filter(rating=1).count(),
        }
        
        rating_percents = {
            'rating_5_percent': (rating_counts['5'] / review_count * 100) if review_count > 0 else 0,
            'rating_4_percent': (rating_counts['4'] / review_count * 100) if review_count > 0 else 0,
            'rating_3_percent': (rating_counts['3'] / review_count * 100) if review_count > 0 else 0,
            'rating_2_percent': (rating_counts['2'] / review_count * 100) if review_count > 0 else 0,
            'rating_1_percent': (rating_counts['1'] / review_count * 100) if review_count > 0 else 0,
        }

        result = {
            "event_id": event.id,
            "event_name": event.name,
            "event_start_date": event.date,
            "event_end_date": event.date + timedelta(hours=3),  # Giả định sự kiện kéo dài 3 giờ
            "total_revenue": total_revenue,
            "tickets_sold": tickets_sold,
            "average_rating": average_rating,
            "cancellation_rate": cancellation_rate,
            "avg_purchase_time_minutes": round(avg_purchase_time_seconds, 2),
            "repeat_attendee_rate": repeat_attendee_rate,
            "event_views": event_views,
            "event_interest_score": event_interest_score,
            "conversion_rate": conversion_rate,
            "tickets_breakdown": tickets_breakdown,
            "views_by_day": views_by_day,
            "review_count": review_count,
        }
        
        # Thêm các chỉ số phần trăm đánh giá
        result.update(rating_percents)
        
        return Response(result, status=status.HTTP_200_OK)
    @action(methods=['get'], url_path='dashboard-analytics', detail=False, permission_classes=[permissions.IsAuthenticated])
    def dashboard_analytics(self, request):
        user = request.user
        
        if user.role == User.Role.ORGANIZER:
            # Organizer chỉ lọc theo event (tất cả hoặc từng event riêng lẻ)
            event_filter = request.query_params.get('event_filter', 'all')  # 'all' hoặc event_id cụ thể
            
            # Lấy tất cả events của organizer
            organizer_events = Event.objects.filter(organizer=user, active=True)
            
            # Áp dụng bộ lọc sự kiện cụ thể nếu có
            if event_filter != 'all':
                try:
                    event_id = int(event_filter)
                    organizer_events = organizer_events.filter(id=event_id)
                except (ValueError, TypeError):
                    return Response(
                        {"error": "Invalid event_filter parameter"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            analytics_data = []
            for event_instance in organizer_events:
                # Gọi lại logic của get_event_analytics cho từng event
                response = self.get_event_analytics(request, pk=event_instance.pk)
                if response.status_code == status.HTTP_200_OK:
                    analytics_data.append(response.data)
            return Response(analytics_data, status=status.HTTP_200_OK)

        elif user.role == User.Role.ADMIN:
            # Admin chỉ lọc theo organizer (tất cả hoặc từng organizer riêng lẻ)
            organizer_filter = request.query_params.get('organizer_filter', 'all')  # 'all' hoặc organizer_id cụ thể
            
            organizers = User.objects.filter(role=User.Role.ORGANIZER, is_active=True)
            
            # Áp dụng bộ lọc organizer nếu có
            if organizer_filter != 'all':
                try:
                    organizer_id = int(organizer_filter)
                    organizers = organizers.filter(id=organizer_id)
                except (ValueError, TypeError):
                    return Response(
                        {"error": "Invalid organizer_filter parameter"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            admin_analytics_data = []
            for organizer in organizers:
                organizer_events = Event.objects.filter(organizer=organizer, active=True)
                
                org_total_revenue = 0
                org_total_tickets_sold = 0
                org_event_ratings = []
                org_cancellation_rates = []
                org_total_views = 0
                org_total_interest_score = 0
                event_count = 0
                event_details = []  # Thêm chi tiết từng event cho admin

                for event_instance in organizer_events:
                    response = self.get_event_analytics(request, pk=event_instance.pk)
                    if response.status_code == status.HTTP_200_OK:
                        event_data = response.data
                        org_total_revenue += event_data.get("total_revenue", 0)
                        org_total_tickets_sold += event_data.get("tickets_sold", 0)
                        if event_data.get("average_rating", 0) > 0:
                            org_event_ratings.append(event_data.get("average_rating", 0))
                        org_cancellation_rates.append(event_data.get("cancellation_rate", 0))
                        org_total_views += event_data.get("event_views", 0)
                        org_total_interest_score += event_data.get("event_interest_score", 0)
                        event_count += 1
                        
                        # Thêm chi tiết event cho admin
                        event_details.append({
                            "event_id": event_data.get("event_id"),
                            "event_name": event_data.get("event_name"),
                            "event_start_date": event_data.get("event_start_date"),
                            "total_revenue": event_data.get("total_revenue", 0),
                            "tickets_sold": event_data.get("tickets_sold", 0),
                            "average_rating": event_data.get("average_rating", 0),
                            "event_views": event_data.get("event_views", 0)
                        })
                
                if event_count > 0:
                    avg_rating = sum(org_event_ratings) / len(org_event_ratings) if org_event_ratings else 0
                    avg_cancellation_rate = sum(org_cancellation_rates) / event_count if org_cancellation_rates else 0
                    admin_analytics_data.append({
                        "organizer_id": organizer.id,
                        "organizer_username": organizer.username,
                        "organizer_email": organizer.email,
                        "total_events": event_count,
                        "aggregated_total_revenue": org_total_revenue,
                        "aggregated_total_tickets_sold": org_total_tickets_sold,
                        "average_event_rating": round(avg_rating, 2),
                        "average_cancellation_rate": round(avg_cancellation_rate, 2),
                        "total_event_views": org_total_views,
                        "total_event_interest_score": org_total_interest_score,
                        "event_details": event_details  # Chi tiết từng event
                    })
            return Response(admin_analytics_data, status=status.HTTP_200_OK)

        else:
            return Response(
                {"error": "Bạn không có quyền truy cập vào mục này."},
                status=status.HTTP_403_FORBIDDEN
            )

    


class PaymentViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'], url_path='momo-payment-notify')
    def momo_payment_notify(self, request):
        data = request.data
        order_id = data.get("orderId")
        request_id = data.get("requestId")
        result_code = data.get("resultCode")
        message = data.get("message")

        if not order_id or not request_id:
            return Response({"error": "Dữ liệu không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_id_parts = order_id.split('_')
            if len(order_id_parts) != 3 or order_id_parts[0] != 'ORDER':
                raise ValueError("Định dạng order_id không hợp lệ")
            actual_order_id = order_id_parts[2]
        except (ValueError, IndexError):
            return Response({"error": "Định dạng order_id không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=actual_order_id).first()
        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        # Kiểm tra thời gian hết hạn
        if order.expiration_time and now() > order.expiration_time:
            with transaction.atomic():
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
            return Response({"error": "Thời gian thanh toán đã hết hạn"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if result_code == 0:
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                ticket = order.ticket
                quantity = order.quantity

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        qr_code=qr_code
                    )

                    try:
                        qr_image = generate_qr_image(qr_code)  # Trả về BytesIO
                        upload_result = cloudinary.uploader.upload(
                            qr_image,
                            folder='tickets',
                            public_id=qr_code,
                            resource_type='image',
                            format='png'
                        )
                        order_detail.qr_image = upload_result['public_id']
                        order_detail.save()
                        qr_url = upload_result['secure_url']
                        logger.info(f"QR image uploaded: public_id={upload_result['public_id']}, url={qr_url}")
                        qr_image_urls.append(qr_url)
                    except Exception as e:
                        logger.error(f"Lỗi khi tải ảnh QR {qr_code} lên Cloudinary: {str(e)}")
                        order_detail.qr_image = None
                        order_detail.save()
                        qr_image_urls.append(None)


                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công, email chứa mã QR đã được gửi",
                    "order_id": order.id
                }, status=status.HTTP_200_OK)
            else:
                # Thanh toán thất bại, nhả vé
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='vnpay-payment-notify')
    def vnpay_payment_notify(self, request):
        """Xử lý thông báo từ VNPAY."""
        data = request.query_params
        vnp_TxnRef = data.get("vnp_TxnRef")
        vnp_ResponseCode = data.get("vnp_ResponseCode")
        vnp_SecureHash = data.get("vnp_SecureHash")
        vnp_Amount = int(data.get("vnp_Amount")) / 100  # Chia 100 để đổi về VND

        # Xác minh chữ ký
        vnpay_hash_secret = "YOUR_VNPAY_HASH_SECRET"
        input_data = {k: v for k, v in data.items() if k != "vnp_SecureHash"}
        sorted_input = sorted(input_data.items(), key=lambda x: x[0])
        query_string = "&".join([f"{k}={v}" for k, v in sorted_input])
        hash_data = query_string.encode('utf-8')
        calculated_hash = hmac.new(
            vnpay_hash_secret.encode('utf-8'),
            hash_data,
            hashlib.sha512
        ).hexdigest()

        if calculated_hash != vnp_SecureHash:
            return Response({"error": "Chữ ký không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_id_parts = vnp_TxnRef.split('_')
            if len(order_id_parts) != 3 or order_id_parts[0] != 'ORDER':
                raise ValueError("Định dạng order_id không hợp lệ")
            actual_order_id = order_id_parts[2]
        except (ValueError, IndexError):
            return Response({"error": "Định dạng order_id không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=actual_order_id).first()
        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        # Kiểm tra số tiền
        if vnp_Amount != order.total_amount:
            return Response({"error": "Số tiền không khớp"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            if vnp_ResponseCode == "00":  # Thanh toán thành công
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                ticket = order.ticket
                quantity = order.quantity

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        qr_code=qr_code
                    )

                    qr_image = generate_qr_image(qr_code)
                    qr_image.seek(0)
                    upload_result = cloudinary.uploader.upload(
                        qr_image,
                        folder='tickets',
                        public_id=f"QR_{order.id}_{ticket.id}_{i + 1}",
                        resource_type='image',
                        overwrite=True
                    )
                    order_detail.qr_image = upload_result['public_id']
                    order_detail.save()
                    qr_image_urls.append(upload_result['secure_url'])

                ticket.quantity -= quantity
                ticket.save()

                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công, email chứa mã QR đã được gửi",
                    "order_id": order.id
                }, status=status.HTTP_200_OK)
            else:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {vnp_ResponseCode}"},
                                status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='momo-payment-success')
    def momo_payment_success(self, request):
        """Xử lý chuyển hướng từ MoMo sau khi thanh toán thành công."""
        partner_code = request.query_params.get('partnerCode')
        order_id = request.query_params.get('orderId')
        request_id = request.query_params.get('requestId')
        result_code = request.query_params.get('resultCode')
        message = request.query_params.get('message')

        if not all([partner_code, order_id, request_id, result_code]):
            return Response({"error": "Thiếu thông tin từ MoMo"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_id_parts = order_id.split('_')
            if len(order_id_parts) != 3 or order_id_parts[0] != 'ORDER':
                raise ValueError("Định dạng order_id không hợp lệ")
            actual_order_id = order_id_parts[2]
        except (ValueError, IndexError):
            return Response({"error": "Định dạng order_id không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=actual_order_id).first()
        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if result_code == '0':
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                ticket = order.ticket
                quantity = order.quantity

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        qr_code=qr_code
                    )

                    try:
                        qr_image = generate_qr_image(qr_code)  # Trả về BytesIO
                        upload_result = cloudinary.uploader.upload(
                            qr_image,
                            folder='tickets',
                            public_id=qr_code,
                            resource_type='image',
                            format='png'
                        )
                        order_detail.qr_image = upload_result['public_id']
                        order_detail.save()
                        qr_url = upload_result['secure_url']
                        logger.info(f"QR image uploaded: public_id={upload_result['public_id']}, url={qr_url}")
                        qr_image_urls.append(qr_url)
                    except Exception as e:
                        logger.error(f"Lỗi khi tải ảnh QR {qr_code} lên Cloudinary: {str(e)}")
                        order_detail.qr_image = None
                        order_detail.save()
                        qr_image_urls.append(None)

                ticket.quantity -= quantity
                ticket.save()

                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công! Kiểm tra email của bạn để xem mã QR hoặc gọi GET /orders/{id}/",
                    "order_id": order.id,
                    "redirect_url": f"/payment-success?order_id={order.id}"
                }, status=status.HTTP_200_OK)
            else:
                # Nhả vé nếu thanh toán thất bại
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({
                    "message": f"Thanh toán thất bại: {message}",
                    "order_id": order.id,
                    "redirect_url": "/payment-failure"  # Chuyển hướng đến trang thất bại
                }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='vnpay-payment-success')
    def vnpay_payment_success(self, request):
        """Xử lý chuyển hướng từ VNPAY sau khi thanh toán thành công."""
        vnp_TxnRef = request.query_params.get("vnp_TxnRef")
        vnp_ResponseCode = request.query_params.get("vnp_ResponseCode")
        vnp_SecureHash = request.query_params.get("vnp_SecureHash")

        # Xác minh chữ ký
        vnpay_hash_secret = "YOUR_VNPAY_HASH_SECRET"
        input_data = {k: v for k, v in request.query_params.items() if k != "vnp_SecureHash"}
        sorted_input = sorted(input_data.items(), key=lambda x: x[0])
        query_string = "&".join([f"{k}={v}" for k, v in sorted_input])
        hash_data = query_string.encode('utf-8')
        calculated_hash = hmac.new(
            vnpay_hash_secret.encode('utf-8'),
            hash_data,
            hashlib.sha512
        ).hexdigest()

        if calculated_hash != vnp_SecureHash:
            return Response({"error": "Chữ ký không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_id_parts = vnp_TxnRef.split('_')
            if len(order_id_parts) != 3 or order_id_parts[0] != 'ORDER':
                raise ValueError("Định dạng order_id không hợp lệ")
            actual_order_id = order_id_parts[2]
        except (ValueError, IndexError):
            return Response({"error": "Định dạng order_id không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=actual_order_id).first()
        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if vnp_ResponseCode == "00":
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                # Lấy extra_data từ vnp_OrderInfo
                order_info = request.query_params.get("vnp_OrderInfo", "")
                extra_data = ""
                if "|extraData:" in order_info:
                    extra_data = order_info.split("|extraData:")[1]
                if not extra_data:
                    return Response({"error": "Thiếu thông tin vé trong extraData"}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    extra_data_decoded = json.loads(base64.b64decode(extra_data).decode())
                    ticket_id = extra_data_decoded['ticket_id']
                    quantity = extra_data_decoded['quantity']
                except (ValueError, KeyError):
                    return Response({"error": "Dữ liệu extraData không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

                ticket = get_object_or_404(Ticket, id=ticket_id)
                if ticket.quantity < quantity:
                    order.payment_status = Order.PaymentStatus.FAILED
                    order.save()
                    return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        qr_code=qr_code
                    )

                    qr_image = generate_qr_image(qr_code)
                    qr_image.seek(0)
                    upload_result = cloudinary.uploader.upload(
                        qr_image,
                        folder='tickets',
                        public_id=f"QR_{order.id}_{ticket.id}_{i + 1}",
                        resource_type='image',
                        overwrite=True
                    )
                    order_detail.qr_image = upload_result['public_id']
                    order_detail.save()
                    qr_image_urls.append(upload_result['secure_url'])

                ticket.quantity -= quantity
                ticket.save()

                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công! Kiểm tra email của bạn để xem mã QR hoặc gọi GET /orders/{id}/",
                    "order_id": order.id,
                    "redirect_url": f"/payment-success?order_id={order.id}"
                }, status=status.HTTP_200_OK)
            else:
                # Nhả vé nếu thanh toán thất bại
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({
                    "message": f"Thanh toán thất bại: {vnp_ResponseCode}",
                    "order_id": order.id,
                    "redirect_url": "/payment-failure"  # Chuyển hướng đến trang thất bại
                }, status=status.HTTP_400_BAD_REQUEST)


class OrderViewSet(viewsets.GenericViewSet, generics.ListAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    pagination_class = paginators.ItemPaginator

    def get_queryset(self):
        queryset = Order.objects.filter(user=self.request.user)
        payment_status = self.request.query_params.get('payment_status')
        print(f"Payment status: {payment_status}")
        if payment_status:
            valid_statuses = [status[0] for status in Order.PaymentStatus.choices]
            print(f"Valid statuses: {valid_statuses}")
            if payment_status not in valid_statuses:
                print(f"Invalid status: {payment_status}")
                raise ValidationError({
                    "error": f"Trạng thái không hợp lệ. Sử dụng {', '.join(valid_statuses)}."
                })
            queryset = queryset.filter(payment_status=payment_status)
            print(f"Filtered orders count: {queryset.count()}")
       
        return queryset.order_by('-created_at')

    def list(self, request, *args, **kwargs):
        """GET /orders/?payment_status=<status>: Lấy danh sách đơn hàng của người dùng, có thể lọc theo trạng thái."""
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)

        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def get_object(self):
        return get_object_or_404(Order, id=self.kwargs['id'], user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        """GET /orders/{id}/: Lấy chi tiết đơn hàng và mã QR."""
        order = self.get_object()
        serializer = self.get_serializer(order)
        order_details = order.order_details.all()
        qr_image_urls = [request.build_absolute_uri(detail.qr_image.url) for detail in order_details if detail.qr_image]
        return Response({
            "order": serializer.data,
            "qr_image_urls": qr_image_urls
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-payment-status',
            permission_classes=[permissions.IsAuthenticated])
    def check_payment_status(self, request, id=None):
        """Kiểm tra trạng thái thanh toán (MoMo hoặc VNPAY) thủ công."""
        order = self.get_object()
        if order.payment_status != Order.PaymentStatus.PENDING:
            return Response({
                "message": f"Đơn hàng đã được xử lý với trạng thái: {order.payment_status}"
            }, status=status.HTTP_200_OK)

        order_id = f"ORDER_{order.user.id}_{order.id}"
        request_id = f"REQ_{order_id}"

        if order.payment_method == "MoMo":
            endpoint = "https://test-payment.momo.vn/v2/gateway/api/query"
            partner_code = "MOMO"
            access_key = "F8BBA842ECF85"
            secret_key = "K951B6PE1waDMi640xX08PD3vg6EkVlz"

            raw_data = f"accessKey={access_key}&orderId={order_id}&partnerCode={partner_code}&requestId={request_id}"
            signature = hmac.new(secret_key.encode(), raw_data.encode(), hashlib.sha256).hexdigest()

            data = {
                "partnerCode": partner_code,
                "accessKey": access_key,
                "requestId": request_id,
                "orderId": order_id,
                "signature": signature,
                "lang": "vi"
            }

            try:
                response = requests.post(endpoint, json=data, headers={'Content-Type': 'application/json'}, timeout=10)
                response.raise_for_status()
                result = response.json()
                result_code = result.get("resultCode")
                message = result.get("message")
                extra_data = result.get("extraData")
            except requests.RequestException as e:
                return Response({"error": f"Lỗi khi kiểm tra trạng thái MoMo: {str(e)}"},
                                status=status.HTTP_400_BAD_REQUEST)

        elif order.payment_method == "VNPAY":
            endpoint = "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction"
            vnpay_tmn_code = "YOUR_VNPAY_TMN_CODE"
            vnpay_hash_secret = "YOUR_VNPAY_HASH_SECRET"

            vnpay_params = {
                "vnp_Version": "2.1.0",
                "vnp_Command": "querydr",
                "vnp_TmnCode": vnpay_tmn_code,
                "vnp_TxnRef": order_id,
                "vnp_OrderInfo": f"Tra cuu giao dich {order_id}",
                "vnp_TransDate": now().strftime("%Y%m%d%H%M%S"),
                "vnp_CreateDate": now().strftime("%Y%m%d%H%M%S"),
                "vnp_IpAddr": request.META.get('REMOTE_ADDR', '127.0.0.1'),
            }

            sorted_params = sorted(vnpay_params.items(), key=lambda x: x[0])
            query_string = "&".join([f"{k}={v}" for k, v in sorted_params])
            hash_data = query_string.encode('utf-8')
            secure_hash = hmac.new(
                vnpay_hash_secret.encode('utf-8'),
                hash_data,
                hashlib.sha512
            ).hexdigest()
            vnpay_params["vnp_SecureHash"] = secure_hash

            try:
                response = requests.post(endpoint, data=vnpay_params, timeout=10)
                response.raise_for_status()
                result = response.json()
                result_code = result.get("vnp_ResponseCode")
                message = result.get("vnp_Message", "Không có thông tin")
                extra_data = ""
                order_info = result.get("vnp_OrderInfo", "")
                if "|extraData:" in order_info:
                    extra_data = order_info.split("|extraData:")[1]
            except requests.RequestException as e:
                return Response({"error": f"Lỗi khi kiểm tra trạng thái VNPAY: {str(e)}"},
                                status=status.HTTP_400_BAD_REQUEST)

        if not extra_data:
            return Response({"error": "Thiếu thông tin vé trong extraData"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            extra_data_decoded = json.loads(base64.b64decode(extra_data).decode())
            ticket_id = extra_data_decoded['ticket_id']
            quantity = extra_data_decoded['quantity']
        except (ValueError, KeyError):
            return Response({"error": "Dữ liệu extraData không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        ticket = get_object_or_404(Ticket, id=ticket_id)
        with transaction.atomic():
            if ticket.quantity < quantity:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

            if (order.payment_method == "MoMo" and result_code == 0) or (
                    order.payment_method == "VNPAY" and result_code == "00"):
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        quantity=1,
                        qr_code=qr_code
                    )

                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f"{qr_code}.png", qr_image)
                    order_detail.save()

                    qr_image_urls.append(request.build_absolute_uri(order_detail.qr_image.url))



                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công, email chứa mã QR đã được gửi",
                    "order_id": order.id
                }, status=status.HTTP_200_OK)
            else:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'], url_path='vnpay-payment-success')
    def vnpay_payment_success(self, request):
        """Xử lý chuyển hướng từ VNPAY sau khi thanh toán thành công."""
        vnp_TxnRef = request.query_params.get("vnp_TxnRef")
        vnp_ResponseCode = request.query_params.get("vnp_ResponseCode")
        vnp_SecureHash = request.query_params.get("vnp_SecureHash")

        # Xác minh chữ ký
        vnpay_hash_secret = "YOUR_VNPAY_HASH_SECRET"
        input_data = {k: v for k, v in request.query_params.items() if k != "vnp_SecureHash"}
        sorted_input = sorted(input_data.items(), key=lambda x: x[0])
        query_string = "&".join([f"{k}={v}" for k, v in sorted_input])
        hash_data = query_string.encode('utf-8')
        calculated_hash = hmac.new(
            vnpay_hash_secret.encode('utf-8'),
            hash_data,
            hashlib.sha512
        ).hexdigest()

        if calculated_hash != vnp_SecureHash:
            return Response({"error": "Chữ ký không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_id_parts = vnp_TxnRef.split('_')
            if len(order_id_parts) != 3 or order_id_parts[0] != 'ORDER':
                raise ValueError("Định dạng order_id không hợp lệ")
            actual_order_id = order_id_parts[2]
        except (ValueError, IndexError):
            return Response({"error": "Định dạng order_id không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.filter(id=actual_order_id).first()
        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if vnp_ResponseCode == "00":
                order.payment_status = Order.PaymentStatus.PAID
                order.save()

                # Lấy extra_data từ vnp_OrderInfo
                order_info = request.query_params.get("vnp_OrderInfo", "")
                extra_data = ""
                if "|extraData:" in order_info:
                    extra_data = order_info.split("|extraData:")[1]
                if not extra_data:
                    return Response({"error": "Thiếu thông tin vé trong extraData"}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    extra_data_decoded = json.loads(base64.b64decode(extra_data).decode())
                    ticket_id = extra_data_decoded['ticket_id']
                    quantity = extra_data_decoded['quantity']
                except (ValueError, KeyError):
                    return Response({"error": "Dữ liệu extraData không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

                ticket = get_object_or_404(Ticket, id=ticket_id)
                if ticket.quantity < quantity:
                    order.payment_status = Order.PaymentStatus.FAILED
                    order.save()
                    return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

                qr_image_urls = []
                for i in range(quantity):
                    qr_code = f"QR_{order.id}_{ticket.id}_{i + 1}"
                    order_detail = OrderDetail.objects.create(
                        order=order,
                        ticket=ticket,
                        qr_code=qr_code
                    )

                    qr_image = generate_qr_image(qr_code)
                    qr_image.seek(0)
                    upload_result = cloudinary.uploader.upload(
                        qr_image,
                        folder='tickets',
                        public_id=f"QR_{order.id}_{ticket.id}_{i + 1}",
                        resource_type='image',
                        overwrite=True
                    )
                    order_detail.qr_image = upload_result['public_id']
                    order_detail.save()
                    qr_image_urls.append(upload_result['secure_url'])

                ticket.quantity -= quantity
                ticket.save()

                send_mail(
                    subject=f"Xác nhận đặt vé thành công - Đơn hàng #{order.id}",
                    message=f"Chào {order.user.username},\n\nĐơn hàng của bạn đã được thanh toán thành công. Dưới đây là các mã QR cho vé của bạn:\n" +
                            "\n".join([f"Vé {i + 1}: {url}" for i, url in enumerate(qr_image_urls)]) +
                            f"\n\nBạn cũng có thể xem mã QR tại: /orders/{order.id}/",
                    from_email="nhanhgon24@gmail.com",
                    recipient_list=[order.user.email],
                    fail_silently=True
                )

                user = order.user
                credentials_dict = user.google_credentials
                if credentials_dict:
                    try:
                        credentials = Credentials(**credentials_dict)
                        service = build('calendar', 'v3', credentials=credentials)
                        event = ticket.event
                        calendar_event = {
                            'summary': f"Event: {event.name}",
                            'location': event.location,
                            'description': f"Ticket: {ticket.type}",
                            'start': {
                                'dateTime': event.date.isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'end': {
                                'dateTime': (event.date + timedelta(hours=2)).isoformat(),
                                'timeZone': 'Asia/Ho_Chi_Minh',
                            },
                            'reminders': {
                                'useDefault': False,
                                'overrides': [
                                    {'method': 'email', 'minutes': 24 * 60},
                                    {'method': 'popup', 'minutes': 30},
                                ],
                            },
                        }
                        calendar_event_response = service.events().insert(
                            calendarId='primary',
                            body=calendar_event
                        ).execute()
                        order_detail = OrderDetail.objects.filter(order=order).first()
                        order_detail.google_calendar_event_id = calendar_event_response['id']
                        order_detail.save()
                    except Exception as e:
                        print(f"Error adding to Google Calendar for order {order.id}: {str(e)}")

                return Response({
                    "message": "Thanh toán thành công! Kiểm tra email của bạn để xem mã QR hoặc gọi GET /orders/{id}/",
                    "order_id": order.id,
                    "redirect_url": f"/payment-success?order_id={order.id}"
                }, status=status.HTTP_200_OK)
            else:
                # Nhả vé nếu thanh toán thất bại
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({
                    "message": f"Thanh toán thất bại: {vnp_ResponseCode}",
                    "order_id": order.id,
                    "redirect_url": "/payment-failure"
                }, status=status.HTTP_400_BAD_REQUEST)


class GoogleCalendarViewSet(viewsets.ViewSet):
    @action(methods=['get'], url_path='auth-url', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_auth_url(self, request):
        # Tạo flow để lấy URL xác thực
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CALENDAR_API['CLIENT_ID'],
                    "client_secret": settings.GOOGLE_CALENDAR_API['CLIENT_SECRET'],
                    "redirect_uris": [settings.GOOGLE_CALENDAR_API['REDIRECT_URI']],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=settings.GOOGLE_CALENDAR_API['SCOPES']
        )

        flow.redirect_uri = settings.GOOGLE_CALENDAR_API['REDIRECT_URI']
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )

        request.session['google_auth_state'] = state
        return Response({"auth_url": auth_url}, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='callback', detail=False)
    def google_callback(self, request):
        state = request.query_params.get('state')
        code = request.query_params.get('code')

        if state != request.session.get('google_auth_state'):
            return Response({"error": "State không khớp"}, status=status.HTTP_400_BAD_REQUEST)

        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CALENDAR_API['CLIENT_ID'],
                    "client_secret": settings.GOOGLE_CALENDAR_API['CLIENT_SECRET'],
                    "redirect_uris": [settings.GOOGLE_CALENDAR_API['REDIRECT_URI']],
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=settings.GOOGLE_CALENDAR_API['SCOPES'],
            state=state
        )

        flow.redirect_uri = settings.GOOGLE_CALENDAR_API['REDIRECT_URI']
        flow.fetch_token(code=code)

        credentials = flow.credentials
        request.user.google_credentials = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }
        request.user.save()

        return Response({"message": "Xác thực Google thành công"}, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='add-to-calendar/(?P<event_id>[^/.]+)', detail=False, permission_classes=[permissions.IsAuthenticated])
    def add_to_calendar(self, request, event_id=None):
        event = get_object_or_404(Event, id=event_id)
        if not OrderDetail.objects.filter(order__user=request.user, ticket__event=event, order__payment_status='PAID').exists():
            return Response({"error": "Bạn chưa đặt vé cho sự kiện này"}, status=status.HTTP_403_FORBIDDEN)

        credentials_dict = request.session.get('google_credentials')
        if not credentials_dict:
            return Response({"error": "Chưa xác thực với Google"}, status=status.HTTP_400_BAD_REQUEST)

        credentials = Credentials(**credentials_dict)
        service = build('calendar', 'v3', credentials=credentials)

        calendar_event = {
            'summary': event.title,
            'location': event.location,
            'description': event.description,
            'start': {
                'dateTime': event.start_time.isoformat(),
                'timeZone': 'Asia/Ho_Chi_Minh',
            },
            'end': {
                'dateTime': event.end_time.isoformat(),
                'timeZone': 'Asia/Ho_Chi_Minh',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }

        calendar_event = service.events().insert(calendarId='primary', body=calendar_event).execute()
        return Response({
            "message": "Sự kiện đã được thêm vào Google Calendar",
            "calendar_event_id": calendar_event['id']
        }, status=status.HTTP_200_OK)


class ReviewViewSet(viewsets.ModelViewSet):
    
    serializer_class = ReviewSerializer
    
    def get_permissions(self):
        if self.action in ['retrieve', 'list', 'by_event']:
            # Cho phép tất cả người dùng xem đánh giá
            return [permissions.AllowAny()]
        else:
            # Chỉ người dùng đã xác thực mới có thể tạo, sửa, xóa đánh giá
            return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        # Mặc định chỉ lấy các đánh giá active
        return Review.objects.filter(active=True)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'], url_path='by-event/(?P<event_id>[^/.]+)')
    def by_event(self, request, event_id=None):
        """Lấy tất cả đánh giá cho một sự kiện cụ thể"""
        event = get_object_or_404(Event, id=event_id)
        reviews = self.get_queryset().filter(event=event)
        
        # Tính điểm đánh giá trung bình
        avg_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0
        
        # Phân trang
        page = self.paginate_queryset(reviews)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response_data = {
                'reviews': serializer.data,
                'average_rating': round(avg_rating, 1),
                'total_reviews': reviews.count(),
            }
            return self.get_paginated_response(response_data)
        
        serializer = self.get_serializer(reviews, many=True)
        response_data = {
            'reviews': serializer.data,
            'average_rating': round(avg_rating, 1),
            'total_reviews': reviews.count(),
        }
        return Response(response_data)
    
    @action(detail=False, methods=['get'], url_path='my-reviews', permission_classes=[permissions.IsAuthenticated])
    def my_reviews(self, request):
        """Lấy tất cả đánh giá của người dùng hiện tại"""
        print("User id:", request.user.id)
        reviews = self.get_queryset().filter(user=request.user)
        print("Số lượng review tìm được:", reviews.count())
        serializer = self.get_serializer(reviews, many=True)
        return Response(serializer.data)
    
    def update(self, request, *args, **kwargs):
        """Cập nhật đánh giá"""
        review = self.get_object()
        # Chỉ user tạo review mới có quyền cập nhật
        if review.user != request.user:
            return Response(
                {"error": "Bạn không có quyền cập nhật đánh giá này."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Chỉ cho phép sửa rating và comment
        data = request.data.copy()
        allowed_fields = ['rating', 'comment']
        for field in list(data.keys()):
            if field not in allowed_fields:
                data.pop(field)
                
        serializer = self.get_serializer(review, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response(serializer.data)
    
    def destroy(self, request, *args, **kwargs):
        """Xóa đánh giá (soft delete)"""
        review = self.get_object()
        # Chỉ user tạo review hoặc admin mới có quyền xóa
        if review.user != request.user and not request.user.is_superuser:
            return Response(
                {"error": "Bạn không có quyền xóa đánh giá này."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Soft delete bằng cách đặt active=False
        review.active = False
        review.save()
        
        return Response(
            {"message": "Đánh giá đã được xóa thành công."}, 
            status=status.HTTP_204_NO_CONTENT
        )

    # Action mới: Lấy tùy chọn lọc cho analytics    
    @action(methods=['get'], url_path='analytics-filter-options', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_analytics_filter_options(self, request):
        """
        Lấy danh sách tùy chọn lọc cho dashboard analytics
        - Organizer: chỉ lọc theo events của mình
        - Admin: chỉ lọc theo organizers
        """
        user = request.user
        
        if user.role == User.Role.ORGANIZER:
            # Organizer chỉ thấy events của mình để lọc
            events = Event.objects.filter(organizer=user, active=True).values('id', 'name').order_by('-date')
            return Response({
                'events': list(events),
                'user_role': 'organizer'
            }, status=status.HTTP_200_OK)
            
        elif user.role == User.Role.ADMIN:
            # Admin chỉ thấy danh sách organizers để lọc
            organizers = User.objects.filter(role=User.Role.ORGANIZER, is_active=True).values('id', 'username', 'email').order_by('username')
            return Response({
                'organizers': list(organizers),
                'user_role': 'admin'
            }, status=status.HTTP_200_OK)
            
        else:
            return Response(
                {"error": "Bạn không có quyền truy cập vào mục này."},
                status=status.HTTP_403_FORBIDDEN
            )
