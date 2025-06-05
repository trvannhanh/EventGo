import base64
from datetime import timedelta
from decimal import Decimal
import cloudinary.uploader
from django.contrib.auth import logout
from django.shortcuts import get_object_or_404
from django.db import transaction, models
from django.utils.timezone import now
from rest_framework import viewsets, permissions, status, parsers
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from django.core.mail import send_mail
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
from events.models import Review, User, Event, TicketType, Order, OrderDetail, EventCategory, Discount, EventTrend, Notification
from events.serializers import ReviewSerializer, UserSerializer, EventSerializer, TicketSerializer, OrderSerializer, \
    EventCategorySerializer, DiscountSerializer, ChangePasswordSerializer, OrderDetailSerializer, \
    NotificationSerializer, DeleteEventSerializer


class UserViewSet(viewsets.GenericViewSet, generics.CreateAPIView, generics.UpdateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAdminUser()]
        return [permissions.AllowAny()]

    def get_object(self):
        return self.request.user

    @action(methods=['get'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_current_user(self, request):
        user = request.user
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

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
        logger.info(f"User {user.username} changed password successfully.")
        logout(request)
        return Response({"message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."}, status=status.HTTP_200_OK)


    @action(methods=['delete'], url_path='delete-current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def delete_current_user(self, request):
        user = request.user
        user.is_active = False
        user.save()
        return Response({"message": "Xóa tài khoản thành công."}, status=status.HTTP_204_NO_CONTENT)

    @action(methods=['get'], url_path='my-rank', detail=False, permission_classes=[IsAuthenticated])
    def get_my_rank(self, request):
        rank = get_customer_rank(request.user)
        return Response({"rank": rank}, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='my-tickets', detail=False, permission_classes=[IsAuthenticated])
    def my_tickets(self, request):
        user = request.user
        order_details = OrderDetail.objects.filter(order__user=user).select_related('ticket__event', 'order')
        page = self.paginate_queryset(order_details)
        serializer = OrderDetailSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    @action(methods=['get'], url_path='my-notifications', detail=False, permission_classes=[IsAuthenticated])
    def my_notifications(self, request):
        user = request.user
        notifications = Notification.objects.filter(user=user).select_related('event').order_by('-created_at')
        page = self.paginate_queryset(notifications)
        serializer = NotificationSerializer(page, many=True)
        return self.get_paginated_response(serializer.data)
    
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
        user = request.user
        from events.serializers import PushTokenSerializer
        serializer = PushTokenSerializer(data=request.data)
        
        if serializer.is_valid():
            user.push_token = serializer.validated_data.get('push_token')
            user.save()
            return Response({"message": "Push token đã được cập nhật thành công"}, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



class EventCategoryViewSet(viewsets.ViewSet, generics.ListAPIView):
    queryset = EventCategory.objects.all()
    serializer_class = EventCategorySerializer
    pagination_class = PageNumberPagination

    def get_queryset(self):
        return self.queryset

class EventViewSet(viewsets.ViewSet, generics.ListAPIView):
    queryset = Event.objects.filter(active=True)
    serializer_class = EventSerializer
    pagination_class = paginators.ItemPaginator

    def get_queryset(self):
        query = self.queryset.select_related('organizer', 'category').prefetch_related('tickets')
        q_param = self.request.query_params.get('q')
        cate_id_param = self.request.query_params.get('cateId')
        status_param = self.request.query_params.get('status')
        organizer_param = self.request.query_params.get('organizer')

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
        for event in query:
            event.update_status()
        if status_param:
            valid_statuses = [choice[0] for choice in Event.EventStatus.choices]
            if status_param not in valid_statuses:
                raise ValidationError({"error": f"Trạng thái không hợp lệ. Sử dụng {', '.join(valid_statuses)}."})
            query = query.filter(status=status_param)
        return query


    @action(methods=['get'], url_path='detail', detail=True)
    def view_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        trend, created = EventTrend.objects.get_or_create(event=event)
        trend.increment_views()
        trend.increment_interest(points=1)
        serializer = EventSerializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['put', 'patch'], url_path='update', detail=True, permission_classes=[IsAuthenticated])
    def update_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        user = request.user

        if event.status != Event.EventStatus.UPCOMING:
            return Response({"error": "Chỉ có thể cập nhật sự kiện sắp diễn ra."}, 
                            status=status.HTTP_403_FORBIDDEN)

        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền cập nhật sự kiện này."}, 
                            status=status.HTTP_403_FORBIDDEN)

        old_name = event.name
        old_date = event.date
        old_location = event.location
        
        serializer = EventSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_event = serializer.save()
        
        significant_updates = []

        if updated_event.name != old_name:
            significant_updates.append(f"Tên sự kiện đã được thay đổi thành: {updated_event.name}")
        
        if updated_event.date != old_date:
            new_date_str = updated_event.date.strftime('%d/%m/%Y') if hasattr(updated_event.date, 'strftime') else str(updated_event.date)
            significant_updates.append(f"Ngày diễn ra sự kiện đã thay đổi thành: {new_date_str}")
        
        if updated_event.location != old_location:
            significant_updates.append(f"Địa điểm sự kiện đã thay đổi thành: {updated_event.location}")
            
        if significant_updates:
            update_message = f"Sự kiện {old_name} đã được cập nhật:\\n" + "\\n".join(significant_updates)
            print(update_message)
            print("Thông điệp cập nhật:")
            print(updated_event.id)
            print("Loai")
            print(type(updated_event.id))
            print(type(update_message))
            from events.tasks import send_event_update_notifications
            send_event_update_notifications.delay(updated_event.id, update_message)

            from events.notification_utils import create_and_send_event_notification
            create_and_send_event_notification(updated_event.id, is_update=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['delete'], url_path='delete', detail=True, permission_classes=[IsAuthenticated])
    def delete_event(self, request, pk=None):
        serializer = DeleteEventSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        event = get_object_or_404(Event, id=pk)
        user = request.user
        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền xóa sự kiện này."}, status=status.HTTP_403_FORBIDDEN)
        event.delete()
        return Response({"message": "Đã xóa sự kiện thành công."}, status=status.HTTP_204_NO_CONTENT)

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
        serializer = EventSerializer(data=data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        event = serializer.save()
        current_time = now()
        if event.date < current_time and event.status == Event.EventStatus.UPCOMING:
            event.status = Event.EventStatus.COMPLETED
            event.save(update_fields=['status'])
        message = f"Sự kiện mới '{event.name}' đã được tạo and sẽ diễn ra vào {event.date.strftime('%d/%m/%Y')}"
        from django.contrib.auth import get_user_model
        User = get_user_model()
        attendees = User.objects.filter(role='attendee', is_active=True)

        for user in attendees:
            Notification.objects.create(
                user=user,
                message=message,
                event=event
            )
        from events.tasks import send_new_event_notifications
        send_new_event_notifications.delay(event.id)

        from events.notification_utils import create_and_send_event_notification
        create_and_send_event_notification(event.id, is_update=False)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(methods=['post'], url_path='review', detail=True)
    def submit_review(self, request, pk=None):
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
        rating = request.data.get('rating')
        comment = request.data.get('comment')

        if not rating or not comment:
            return Response(
                {"error": "Vui lòng cung cấp cả đánh giá và nhận xét."},
                status=status.HTTP_400_BAD_REQUEST
            )

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

        trend, created = EventTrend.objects.get_or_create(event=event)
        trend.increment_interest(points=2)

        return Response(
            {"message": "Đánh giá của bạn đã được gửi thành công."},
            status=status.HTTP_201_CREATED
        )

    @action(methods=['get'], url_path='feedback', detail=True)
    def view_feedback(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        reviews = Review.objects.filter(event=event)
        serializer = ReviewSerializer(reviews, many=True)
        avg_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0

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

        self.update_event_statuses(Event.objects.all())
        engine = RecommendationEngine()
        recommended_events = engine.ml_recommendation(user.id)
        serializer = self.get_serializer(recommended_events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='trending', detail=False)
    def get_trending_events(self, request):
        limit = int(request.query_params.get('limit', 5))
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

    @action(methods=['get'], url_path='tickets', detail=True)
    def get_tickets(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        tickets = TicketType.objects.filter(event=event)
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='tickets/create', detail=True, permission_classes=[permissions.IsAuthenticated])
    def create_ticket(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)

        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "Không có quyền tạo loại vé cho sự kiện này"},
                status=status.HTTP_403_FORBIDDEN
            )

        ticket_type = request.data.get('type')
        price = request.data.get('price')
        quantity = request.data.get('quantity')

        if not all([ticket_type, price, quantity]):
            return Response(
                {"error": "Thiếu thông tin cần thiết: type, price, or quantity"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            price = float(price)
            quantity = int(quantity)
            if price < 0:
                return Response(
                    {"error": "Price không được âm"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if quantity <= 0:
                return Response(
                    {"error": "Số lượng không âm"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            ticket = TicketType.objects.create(
                event=event,
                type=ticket_type,
                price=price,
                quantity=quantity
            )

            serializer = TicketSerializer(ticket)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except (ValueError, TypeError):
            return Response(
                {"error": "Price hoặc quantity không hợp lệ"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(methods=['put'], url_path='tickets/(?P<ticket_id>[^/.]+)/update', detail=True, permission_classes=[permissions.IsAuthenticated])
    def update_ticket(self, request, pk=None, ticket_id=None):
        event = get_object_or_404(Event, id=pk)
        ticket = get_object_or_404(TicketType, id=ticket_id, event=event)

        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "Không có quyền cập nhật loại vé cho sự kiện này"},
                status=status.HTTP_403_FORBIDDEN
            )

        ticket_type = request.data.get('type')
        price = request.data.get('price')
        quantity = request.data.get('quantity')

        if not all([ticket_type, price, quantity]):
            return Response(
                {"error": "Thiếu thông tin cần thiết: type, price, or quantity"},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        try:
            price = float(price)
            quantity = int(quantity)

            if price < 0:
                return Response(
                    {"error": "Price không âm"},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
            if quantity <= 0:
                return Response(
                    {"error": "Quantity không âm"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            ticket.type = ticket_type
            ticket.price = price
            ticket.quantity = quantity
            ticket.save()

            serializer = TicketSerializer(ticket)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except (ValueError, TypeError):
            return Response(
                {"error": "price hoặc quantity không hợp lệ"},
                status=status.HTTP_400_BAD_REQUEST
            )

    @action(methods=['delete'], url_path='tickets/(?P<ticket_id>[^/.]+)/delete', detail=True, permission_classes=[permissions.IsAuthenticated])
    def delete_ticket(self, request, pk=None, ticket_id=None):
        event = get_object_or_404(Event, id=pk)
        ticket = get_object_or_404(TicketType, id=ticket_id, event=event)

        if not request.user.is_superuser and event.organizer != request.user:
            return Response(
                {"error": "Không có quyền xóa loại vé cho sự kiện này"},
                status=status.HTTP_403_FORBIDDEN
            )

        if OrderDetail.objects.filter(ticket=ticket).exists():
            return Response(
                {"error": "Không thể xóa loại vé vì nó đã được bán"},
                status=status.HTTP_400_BAD_REQUEST
            )

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

        ticket = get_object_or_404(TicketType, event=event, id=ticket_id)

        with transaction.atomic():
            if ticket.quantity < quantity:
                return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

            ticket.quantity -= quantity
            ticket.save()

            total_price = ticket.price * quantity

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
            order = Order.objects.create(
                user=user,
                ticket=ticket,
                total_amount=total_price,
                payment_status=Order.PaymentStatus.PENDING,
                payment_method=payment_method,
                quantity=quantity
            )

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
        """Lấy tất cả mã giảm giá của một sự kiện và đánh dấu mã nào người dùng có thể sử dụng."""
        event = get_object_or_404(Event, id=pk)

        user_rank = get_customer_rank(request.user)

        current_time = now()
        discounts = Discount.objects.filter(
            event=event,
            expiration_date__gt=current_time
        ).order_by('expiration_date')

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

        if not request.user.is_superuser and request.user != event.organizer:
            return Response(
                {"error": "Bạn không có quyền xem báo cáo phân tích cho sự kiện này."},
                status=status.HTTP_403_FORBIDDEN
            )

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

        total_orders = Order.objects.filter(order_details__ticket__event=event).count()
        canceled_orders = Order.objects.filter(
            order_details__ticket__event=event,
            payment_status=Order.PaymentStatus.FAILED
        ).count()
        cancellation_rate = (canceled_orders / total_orders * 100) if total_orders > 0 else 0
        cancellation_rate = round(cancellation_rate, 2)

        avg_purchase_time = Order.objects.filter(
            order_details__ticket__event=event,
            payment_status=Order.PaymentStatus.PAID
        ).annotate(
            purchase_duration=ExpressionWrapper(
                F('updated_at') - F('created_at'),
                output_field=DurationField()
            )
        ).aggregate(avg_time=Avg('purchase_duration'))['avg_time']
        avg_purchase_time_seconds = avg_purchase_time.total_seconds() / 60 if avg_purchase_time else 0

        attendees = User.objects.filter(
            orders__order_details__ticket__event=event,
            orders__payment_status=Order.PaymentStatus.PAID
        ).distinct()
        total_attendees = attendees.count()
        other_events = Event.objects.filter(organizer=event.organizer).exclude(id=event.id)
        repeat_attendees = Order.objects.filter(
            user__in=attendees,
            order_details__ticket__event__in=other_events,
            payment_status=Order.PaymentStatus.PAID
        ).values('user').distinct().count()
        repeat_attendee_rate = (repeat_attendees / total_attendees * 100) if total_attendees > 0 else 0
        repeat_attendee_rate = round(repeat_attendee_rate, 2)

        event_trend = EventTrend.objects.filter(event=event).first()
        event_views = event_trend.views if event_trend else 0
        event_interest_score = event_trend.interest_level if event_trend else 0

        conversion_rate = (tickets_sold / event_views * 100) if event_views > 0 else 0
        conversion_rate = round(conversion_rate, 2)

        tickets_breakdown = []
        tickets = TicketType.objects.filter(event=event)
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

        from datetime import datetime, timedelta
        today = datetime.now().date()
        views_by_day = []

        for i in range(7):
            day = today - timedelta(days=i)
            views_by_day.append({
                'date': day.strftime('%Y-%m-%d'),
                'count': int(event_views / 7) + ((-1)**i) * (i*3)
            })
        views_by_day.reverse()

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
            "event_end_date": event.date + timedelta(hours=3),
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
        result.update(rating_percents)
        return Response(result, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='dashboard-analytics', detail=False, permission_classes=[permissions.IsAuthenticated])
    def dashboard_analytics(self, request):
        user = request.user

        if user.role == User.Role.ORGANIZER:
            organizer_events = Event.objects.filter(organizer=user, active=True)
            analytics_data = []
            for event_instance in organizer_events:
                response = self.get_event_analytics(request, pk=event_instance.pk)
                if response.status_code == status.HTTP_200_OK:
                    analytics_data.append(response.data)
            return Response(analytics_data, status=status.HTTP_200_OK)

        elif user.role == User.Role.ADMIN:
            organizers = User.objects.filter(role=User.Role.ORGANIZER, is_active=True)
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

                for event_instance in organizer_events:
                    response = self.get_event_analytics(request, pk=event_instance.pk)
                    if response.status_code == status.HTTP_200_OK:
                        event_data = response.data
                        org_total_revenue += event_data.get("total_revenue", 0)
                        org_total_tickets_sold += event_data.get("tickets_sold", 0)
                        if event_data.get("average_rating", 0) > 0: # Chỉ tính rating nếu có
                            org_event_ratings.append(event_data.get("average_rating", 0))
                        org_cancellation_rates.append(event_data.get("cancellation_rate", 0))
                        org_total_views += event_data.get("event_views", 0)
                        org_total_interest_score += event_data.get("event_interest_score", 0)
                        event_count += 1
                
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
                        "total_event_interest_score": org_total_interest_score
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
                        qr_image = generate_qr_image(qr_code)
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

                return Response({
                    "message": "Thanh toán thành công, email chứa mã QR đã được gửi",
                    "order_id": order.id
                }, status=status.HTTP_200_OK)
            else:
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=['get'], url_path='momo-payment-success')
    def momo_payment_success(self, request):
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

                return Response({
                    "message": "Thanh toán thành công! Kiểm tra email của bạn để xem mã QR hoặc gọi GET /orders/{id}/",
                    "order_id": order.id,
                    "redirect_url": f"/payment-success?order_id={order.id}"
                }, status=status.HTTP_200_OK)
            else:
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({
                    "message": f"Thanh toán thất bại: {message}",
                    "order_id": order.id,
                    "redirect_url": "/payment-failure"
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
        order = self.get_object()
        serializer = self.get_serializer(order)
        order_details = order.order_details.select_related('ticket__event').all()
        qr_image_urls = [request.build_absolute_uri(detail.qr_image.url) for detail in order_details if detail.qr_image]
        return Response({
            "order": serializer.data,
            "qr_image_urls": qr_image_urls
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='check-payment-status',
            permission_classes=[permissions.IsAuthenticated])
    def check_payment_status(self, request, id=None):
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

        ticket = get_object_or_404(TicketType, id=ticket_id)
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

                return Response({
                    "message": "Thanh toán thành công, email chứa mã QR đã được gửi",
                    "qr_image_urls": qr_image_urls
                }, status=status.HTTP_200_OK)
            else:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể cập nhật đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(order, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể cập nhật đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể hủy đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)
        order.delete()
        return Response({"message": "Hủy đơn hàng thành công"}, status=status.HTTP_204_NO_CONTENT)

    @action(methods=['get'], url_path='details', detail=True, permission_classes=[permissions.IsAuthenticated])
    def get_order_details(self, request, id=None):
        order = self.get_object()
        order_details = order.order_details.select_related('ticket__event').all()
        page = self.paginate_queryset(order_details)
        if page is not None:
            serializer = OrderDetailSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        serializer = OrderDetailSerializer(order_details, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='pay', detail=True, permission_classes=[permissions.IsAuthenticated])
    def pay(self, request, id=None):
        order = self.get_object()

        if order.expiration_time and now() > order.expiration_time:
            with transaction.atomic():
                ticket = order.ticket
                ticket.quantity += order.quantity
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
            return Response({"error": "Thời gian thanh toán đã hết hạn, vé đã được nhả"},
                            status=status.HTTP_400_BAD_REQUEST)

        if order.payment_status != Order.PaymentStatus.PENDING:
            return Response({"error": "Đơn hàng không ở trạng thái PENDING"},
                            status=status.HTTP_400_BAD_REQUEST)

        new_payment_method = request.data.get('payment_method')
        if new_payment_method:
            if new_payment_method not in [method[0] for method in Order.PaymentMethod.choices]:
                return Response({"error": "Phương thức thanh toán không hợp lệ"},
                                status=status.HTTP_400_BAD_REQUEST)
            order.payment_method = new_payment_method
            order.save()

        payment_method = order.payment_method

        extra_data = base64.b64encode(json.dumps({
            'ticket_id': order.ticket.id,
            'quantity': order.quantity
        }).encode()).decode()

        if payment_method == "MoMo":
            payment_response = self.create_momo_qr(order, extra_data)
            if "error" in payment_response or "qrCodeUrl" not in payment_response:
                with transaction.atomic():
                    ticket = order.ticket
                    ticket.quantity += order.quantity
                    ticket.save()
                    order.active = False
                    order.payment_status = Order.PaymentStatus.FAILED
                    order.save()
                return Response({
                    "error": "Không thể tạo QR thanh toán MoMo",
                    "momo_response": payment_response
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "order_id": order.id,
                "qrCodeUrl": payment_response["qrCodeUrl"],
                "payUrl": payment_response["payUrl"],
                "message": "Vui lòng hoàn tất thanh toán trước khi hết hạn"
            }, status=status.HTTP_200_OK)

        elif payment_method == "VNPAY":
            payment_response = self.create_vnpay_url(order, extra_data, request)
            if "error" in payment_response or "payUrl" not in payment_response:
                with transaction.atomic():
                    ticket = order.ticket
                    ticket.quantity += order.quantity
                    ticket.save()
                    order.active = False
                    order.payment_status = Order.PaymentStatus.FAILED
                    order.save()
                return Response({
                    "error": "Không thể tạo URL thanh toán VNPAY",
                    "vnpay_response": payment_response
                }, status=status.HTTP_400_BAD_REQUEST)

            return Response({
                "order_id": order.id,
                "payUrl": payment_response["payUrl"],
                "message": "Vui lòng hoàn tất thanh toán trước khi hết hạn"
            }, status=status.HTTP_200_OK)

        return None

    def create_momo_qr(self, order, extra_data):

        order_id = f"ORDER_{order.user.id}_{order.id}"
        request_id = f"REQ_{order_id}"
        amount = int(order.total_amount)
        order_info = f"Thanh toán đơn hàng {order_id}"

        endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
        partner_code = "MOMO"
        access_key = "F8BBA842ECF85"
        secret_key = "K951B6PE1waDMi640xX08PD3vg6EkVlz"
        redirect_url = "http://192.168.79.100:8000/payment/momo-payment-success"
        ipn_url = "http://192.168.79.100:8000/payment/momo-payment-notify"

        raw_data = f"accessKey={access_key}&amount={amount}&extraData={extra_data}&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}&partnerCode={partner_code}&redirectUrl={redirect_url}&requestId={request_id}&requestType=captureWallet"
        signature = hmac.new(secret_key.encode(), raw_data.encode(), hashlib.sha256).hexdigest()

        data = {
            "partnerCode": partner_code,
            "accessKey": access_key,
            "accessKey": access_key,
            "requestId": request_id,
            "amount": amount,
            "orderId": order_id,
            "orderInfo": order_info,
            "redirectUrl": redirect_url,
            "ipnUrl": ipn_url,
            "lang": "vi",
            "extraData": extra_data,
            "requestType": "captureWallet",
            "signature": signature
        }

        try:
            response = requests.post(endpoint, json=data, headers={'Content-Type': 'application/json'}, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            return {"error": f"Lỗi khi gọi API MoMo: {str(e)}"}



class ReviewViewSet(viewsets.ModelViewSet):
    serializer_class = ReviewSerializer
    def get_permissions(self):
        if self.action in ['retrieve', 'list', 'by_event']:
            return [permissions.AllowAny()]
        else:
            return [permissions.IsAuthenticated()]
    
    def get_queryset(self):
        return Review.objects.filter(active=True)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'], url_path='by-event/(?P<event_id>[^/.]+)')
    def by_event(self, request, event_id=None):
        """Lấy tất cả đánh giá cho một sự kiện cụ thể"""
        event = get_object_or_404(Event, id=event_id)
        reviews = self.get_queryset().filter(event=event)
        avg_rating = reviews.aggregate(Avg('rating'))['rating__avg'] or 0

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
        if review.user != request.user:
            return Response(
                {"error": "Bạn không có quyền cập nhật đánh giá này."}, 
                status=status.HTTP_403_FORBIDDEN
            )

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
        review = self.get_object()
        if review.user != request.user and not request.user.is_superuser:
            return Response(
                {"error": "Bạn không có quyền xóa đánh giá này."}, 
                status=status.HTTP_403_FORBIDDEN
            )
        review.active = False
        review.save()
        
        return Response(
            {"message": "Đánh giá đã được xóa thành công."}, 
            status=status.HTTP_204_NO_CONTENT
        )
