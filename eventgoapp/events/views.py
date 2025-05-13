import base64
from datetime import timezone, timedelta
from io import BytesIO


import openpyxl
from django.http import HttpResponse
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from django.conf import settings
from django.shortcuts import get_object_or_404

from django.db import transaction, models
from django.utils.timezone import now
from google_auth_oauthlib.flow import Flow
from httplib2 import Credentials
from openpyxl.styles import Alignment
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
from .utils import generate_qr_image
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from .recommendation_engine import RecommendationEngine
from .utils import get_customer_rank

from events.models import Review, User, Event, Ticket, Order, OrderDetail, EventCategory, Discount, EventTrend
from events.serializers import ReviewSerializer, UserSerializer, EventSerializer, TicketSerializer, OrderSerializer, \
    EventCategorySerializer, DiscountSerializer, ChangePasswordSerializer


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
        queryset.filter(date__lt=current_time, status=Event.EventStatus.UPCOMING).update(
            status=Event.EventStatus.COMPLETED)
        queryset.filter(date__gt=current_time, status=Event.EventStatus.COMPLETED).update(
            status=Event.EventStatus.UPCOMING)
        return queryset

    def get_queryset(self):
        query = self.queryset

        q = self.request.query_params.get('q')
        cate_id = self.request.query_params.get('cateId')
        status = self.request.query_params.get('status')

        filters = Q()

        if q:
            filters |= Q(name__icontains=q)

        # Xử lý tham số tìm kiếm

        if cate_id:
            try:
                filters &= Q(category_id=int(cate_id))
            except ValueError:
                raise ValidationError({"error": "cateId phải là số nguyên hợp lệ."})

        if status:
            valid_statuses = [choice[0] for choice in Event.EventStatus.choices]
            if status not in valid_statuses:
                raise ValidationError({"error": f"Trạng thái không hợp lệ. Sử dụng {', '.join(valid_statuses)}."})
            filters &= Q(status=status.upper())

        # Áp dụng bộ lọc
        if filters:
            query = query.filter(filters)

        # Cập nhật trạng thái
        return self.update_event_statuses(query)


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
        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền cập nhật sự kiện này."}, status=status.HTTP_403_FORBIDDEN)
        serializer = EventSerializer(event, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['delete'], url_path='delete', detail=True, permission_classes=[IsAuthenticated])
    def delete_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        user = request.user
        if not user.is_superuser and event.organizer != user:
            return Response({"error": "Bạn không có quyền xóa sự kiện này."}, status=status.HTTP_403_FORBIDDEN)
        event.delete()
        return Response({"message": "Đã xóa sự kiện thành công."}, status=status.HTTP_204_NO_CONTENT)

    @action(methods=['post'], url_path='create', detail=False)
    def create_event(self, request):

        if not request.user.is_superuser and request.user.role != User.Role.ORGANIZER:
            return Response(
                {"error": "Bạn không có quyền tạo sự kiện"},
                status=status.HTTP_403_FORBIDDEN
            )

        data = request.data.copy()
        data['organizer'] = request.user.id

        serializer = EventSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        event = serializer.save()

        # Cập nhật trạng thái ngay sau khi tạo
        event.update_status()  # Nếu vẫn giữ method trong model, hoặc dùng logic dưới
        current_time = now()
        if event.date < current_time and event.status == Event.EventStatus.UPCOMING:  # 6/4
            event.status = Event.EventStatus.COMPLETED
            event.save(update_fields=['status'])

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(methods=['post'], url_path='review', detail=True)
    def submit_review(self, request, pk=None):
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
        reviews = Review.objects.filter(event=event)
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

                total_price = total_price * (1 - discount.discount_percent / 100)

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
        ).aggregate(total_tickets=Sum('quantity'))['total_tickets'] or 0

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

        return Response({
            "total_revenue": total_revenue,
            "tickets_sold": tickets_sold,
            "average_rating": average_rating,
            "cancellation_rate": cancellation_rate,  # Tỷ lệ hủy đơn hàng (%)
            "avg_purchase_time_minutes": round(avg_purchase_time_seconds, 2),  # Thời gian trung bình (phút)
            "repeat_attendee_rate": repeat_attendee_rate  # Tỷ lệ người tham gia quay lại (%)
        }, status=status.HTTP_200_OK)

    # # Action mới: Xuất báo cáo
    # @action(methods=['get'], url_path='analytics/export', detail=True,
    #         permission_classes=[permissions.IsAuthenticated])
    # def export_analytics(self, request, pk=None):
    #     event = get_object_or_404(Event, id=pk)
    #
    #     # Kiểm tra quyền truy cập
    #     if not request.user.is_superuser and request.user != event.organizer:
    #         return Response(
    #             {"error": "Bạn không có quyền xuất báo cáo cho sự kiện này."},
    #             status=status.HTTP_403_FORBIDDEN
    #         )
    #
    #     # Lấy dữ liệu từ API analytics
    #     analytics_response = self.get_event_analytics(request, pk)
    #     if analytics_response.status_code != 200:
    #         return Response(analytics_response.data, status=analytics_response.status_code)
    #     analytics_data = analytics_response.data
    #
    #     # Định dạng xuất (pdf hoặc excel)
    #     export_format = request.query_params.get('format', 'pdf')
    #
    #     if export_format.lower() == 'pdf':
    #         # Xuất PDF
    #         buffer = BytesIO()
    #         p = canvas.Canvas(buffer, pagesize=letter)
    #         width, height = letter
    #
    #         # Tiêu đề
    #         p.setFont("Helvetica-Bold", 16)
    #         p.drawString(100, height - 50, f"Event Analytics Report - {event.name}")
    #
    #         # Dữ liệu analytics
    #         p.setFont("Helvetica", 12)
    #         y_position = height - 100
    #         p.drawString(100, y_position, f"Total Revenue: {analytics_data['total_revenue']} VND")
    #         p.drawString(100, y_position - 20, f"Tickets Sold: {analytics_data['tickets_sold']}")
    #         p.drawString(100, y_position - 40, f"Average Rating: {analytics_data['average_rating']}")
    #         p.drawString(100, y_position - 60, f"Cancellation Rate: {analytics_data['cancellation_rate']}%")
    #         p.drawString(100, y_position - 80,
    #                      f"Average Purchase Time: {analytics_data['avg_purchase_time_minutes']} minutes")
    #         p.drawString(100, y_position - 100, f"Repeat Attendee Rate: {analytics_data['repeat_attendee_rate']}%")
    #
    #         p.showPage()
    #         p.save()
    #         buffer.seek(0)
    #
    #         response = HttpResponse(buffer, content_type='application/pdf')
    #         response['Content-Disposition'] = f'attachment; filename="event_{event.id}_analytics.pdf"'
    #         return response
    #
    #     elif export_format.lower() == 'excel':
    #         # Xuất Excel
    #         workbook = openpyxl.Workbook()
    #         worksheet = workbook.active
    #         worksheet.title = "Event Analytics"
    #
    #         # Tiêu đề
    #         worksheet['A1'] = f"Event Analytics Report - {event.name}"
    #         worksheet['A1'].font = Font(bold=True, size=16)
    #         worksheet['A1'].alignment = Alignment(horizontal='center')
    #         worksheet.merge_cells('A1:D1')
    #
    #         # Dữ liệu analytics
    #         headers = ['Metric', 'Value', '', '']
    #         worksheet.append(headers)
    #         for cell in worksheet[2]:
    #             cell.font = Font(bold=True)
    #         analytics_rows = [
    #             ['Total Revenue', f"{analytics_data['total_revenue']} VND", '', ''],
    #             ['Tickets Sold', analytics_data['tickets_sold'], '', ''],
    #             ['Average Rating', analytics_data['average_rating'], '', ''],
    #             ['Cancellation Rate', f"{analytics_data['cancellation_rate']}%", '', ''],
    #             ['Average Purchase Time', f"{analytics_data['avg_purchase_time_minutes']} minutes", '', ''],
    #             ['Repeat Attendee Rate', f"{analytics_data['repeat_attendee_rate']}%", '', '']
    #         ]
    #         for row in analytics_rows:
    #             worksheet.append(row)
    #
    #         buffer = BytesIO()
    #         workbook.save(buffer)
    #         buffer.seek(0)
    #
    #         response = HttpResponse(buffer,
    #                                 content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    #         response['Content-Disposition'] = f'attachment; filename="event_{event.id}_analytics.xlsx"'
    #         return response
    #
    #     else:
    #         return Response({"error": "Định dạng không được hỗ trợ. Sử dụng 'pdf' hoặc 'excel'."},
    #                         status=status.HTTP_400_BAD_REQUEST)



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

                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f"{qr_code}.png", qr_image)
                    order_detail.save()

                    qr_image_urls.append(f"/media/tickets/{order_detail.qr_image.name}")

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

                # Lấy extra_data từ vnp_OrderInfo
                order_info = data.get("vnp_OrderInfo", "")
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
                        quantity=1,
                        qr_code=qr_code
                    )

                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f"{qr_code}.png", qr_image)
                    order_detail.save()

                    qr_image_urls.append(f"/media/tickets/{order_detail.qr_image.name}")

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

                    qr_image = generate_qr_image(qr_code)
                    order_detail.qr_image.save(f"{qr_code}.png", qr_image)
                    order_detail.save()

                    qr_image_urls.append(f"/media/tickets/{order_detail.qr_image.name}")

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

                # Giảm số lượng vé đã bán
                ticket.quantity -= quantity
                ticket.save()

                return Response({
                    "message": "Thanh toán thành công! Kiểm tra email của bạn để xem mã QR hoặc gọi GET /orders/{id}/",
                    "order_id": order.id,
                    "redirect_url": f"/payment-success?order_id={order.id}"  # Chuyển hướng đến trang thành công
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
                    order_detail.qr_image.save(f"{qr_code}.png", qr_image)
                    order_detail.save()

                    qr_image_urls.append(f"/media/tickets/{order_detail.qr_image.name}")

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


class OrderViewSet(viewsets.GenericViewSet, generics.ListAPIView, generics.UpdateAPIView, generics.DestroyAPIView):
    queryset = Order.objects.all()
    serializer_class = OrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'

    def get_queryset(self):
        return Order.objects.filter(user=self.request.user)

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
                    "qr_image_urls": qr_image_urls
                }, status=status.HTTP_200_OK)
            else:
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
                return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)

    def list(self, request, *args, **kwargs):
        """GET /orders/: Lấy danh sách đơn hàng của người dùng hiện tại."""
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        """PUT /orders/{id}/: Cập nhật toàn bộ thông tin đơn hàng."""
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể cập nhật đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(order, data=request.data, partial=False)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        """PATCH /orders/{id}/: Cập nhật một phần thông tin đơn hàng."""
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể cập nhật đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(order, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """DELETE /orders/{id}/: Hủy đơn hàng."""
        order = self.get_object()
        if order.payment_status != 'PENDING':
            return Response({"error": "Không thể hủy đơn hàng đã thanh toán hoặc thất bại"},
                           status=status.HTTP_400_BAD_REQUEST)

        order.delete()
        return Response({"message": "Hủy đơn hàng thành công"}, status=status.HTTP_204_NO_CONTENT)

    @action(methods=['post'], url_path='pay', detail=True, permission_classes=[permissions.IsAuthenticated])
    def pay(self, request, id=None):
        order = self.get_object()

        # Kiểm tra thời gian hết hạn
        if order.expiration_time and now() > order.expiration_time:
            with transaction.atomic():
                ticket = order.ticket
                ticket.quantity += order.quantity  # Nhả vé
                ticket.save()
                order.active = False
                order.payment_status = Order.PaymentStatus.FAILED
                order.save()
            return Response({"error": "Thời gian thanh toán đã hết hạn, vé đã được nhả"},
                            status=status.HTTP_400_BAD_REQUEST)

        if order.payment_status != Order.PaymentStatus.PENDING:
            return Response({"error": "Đơn hàng không ở trạng thái PENDING"},
                            status=status.HTTP_400_BAD_REQUEST)

        # Lấy hoặc cập nhật payment_method
        new_payment_method = request.data.get('payment_method')
        if new_payment_method:
            if new_payment_method not in [method[0] for method in Order.PaymentMethod.choices]:
                return Response({"error": "Phương thức thanh toán không hợp lệ"},
                                status=status.HTTP_400_BAD_REQUEST)
            order.payment_method = new_payment_method
            order.save()

        payment_method = order.payment_method


        # Tạo yêu cầu thanh toán
        extra_data = base64.b64encode(json.dumps({
            'ticket_id': order.ticket.id,
            'quantity': order.quantity
        }).encode()).decode()

        if payment_method == "MoMo":
            payment_response = self.create_momo_qr(order, extra_data)
            if "error" in payment_response or "qrCodeUrl" not in payment_response:
                # Nhả vé nếu không tạo được QR
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
        """Hàm gọi API tạo QR MoMo, truyền extraData."""
        order_id = f"ORDER_{order.user.id}_{order.id}"
        request_id = f"REQ_{order_id}"
        amount = int(order.total_amount)
        order_info = f"Thanh toán đơn hàng {order_id}"

        endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
        partner_code = "MOMO"
        access_key = "F8BBA842ECF85"
        secret_key = "K951B6PE1waDMi640xX08PD3vg6EkVlz"
        redirect_url = "http://192.168.79.102:8000/payment/momo-payment-success"
        ipn_url = "http://192.168.79.102:8000/payment/momo-payment-notify"

        raw_data = f"accessKey={access_key}&amount={amount}&extraData={extra_data}&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}&partnerCode={partner_code}&redirectUrl={redirect_url}&requestId={request_id}&requestType=captureWallet"
        signature = hmac.new(secret_key.encode(), raw_data.encode(), hashlib.sha256).hexdigest()

        data = {
            "partnerCode": partner_code,
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

    def create_vnpay_url(self, order, extra_data, request):
        """Tạo URL thanh toán VNPAY."""
        order_id = f"ORDER_{order.user.id}_{order.id}"
        amount = int(order.total_amount * 100)  # VNPAY yêu cầu số tiền tính bằng VND, nhân 100
        order_info = f"Thanh toan don hang {order_id}"
        ip_addr = request.META.get('REMOTE_ADDR', '127.0.0.1')

        # Thông tin VNPAY (cần thay bằng thông tin thật từ tài khoản VNPAY của bạn)
        vnpay_tmn_code = "YOUR_VNPAY_TMN_CODE"  # Mã website do VNPAY cung cấp
        vnpay_hash_secret = "YOUR_VNPAY_HASH_SECRET"  # Secret key do VNPAY cung cấp
        vnpay_url = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html"
        return_url = "http://localhost:8000/payment/vnpay-payment-success"  # URL MoMo chuyển hướng sau thanh toán
        notify_url = "http://localhost:8000/payment/vnpay-payment-notify"  # IPN URL

        # Tạo các tham số cho URL thanh toán
        vnpay_params = {"vnp_Version": "2.1.0", "vnp_Command": "pay", "vnp_TmnCode": vnpay_tmn_code,
                        "vnp_Amount": amount, "vnp_CreateDate": now().strftime("%Y%m%d%H%M%S"), "vnp_CurrCode": "VND",
                        "vnp_IpAddr": ip_addr, "vnp_Locale": "vn",
                        "vnp_OrderInfo": f"{order_info}|extraData:{extra_data}", "vnp_OrderType": "billpayment",
                        "vnp_ReturnUrl": return_url, "vnp_TxnRef": order_id, "vnp_NotifyUrl": notify_url}

        # Thêm extra_data vào OrderInfo (nếu cần)

        # Sắp xếp các tham số theo thứ tự alphabet để tạo chữ ký
        sorted_params = sorted(vnpay_params.items(), key=lambda x: x[0])
        query_string = "&".join([f"{k}={v}" for k, v in sorted_params])
        hash_data = query_string.encode('utf-8')
        vnpay_secure_hash = hmac.new(
            vnpay_hash_secret.encode('utf-8'),
            hash_data,
            hashlib.sha512
        ).hexdigest()
        vnpay_params["vnp_SecureHash"] = vnpay_secure_hash

        # Tạo URL thanh toán
        pay_url = f"{vnpay_url}?{query_string}&vnp_SecureHash={vnpay_secure_hash}"
        return {"payUrl": pay_url}



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
        reviews = self.get_queryset().filter(user=request.user)
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
