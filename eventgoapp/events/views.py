from datetime import timezone, timedelta
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from django.conf import settings
from django.shortcuts import get_object_or_404

from django.db import transaction, models
from django.utils.timezone import now
from google_auth_oauthlib.flow import Flow
from httplib2 import Credentials
from rest_framework import viewsets, permissions, generics, status, parsers
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.generics import get_object_or_404
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

from django.db.models import F

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
    parser_classes = [parsers.MultiPartParser]

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

    @action(methods=['put', 'patch'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
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


    @action(methods=['delete'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def delete_current_user(self, request):
        user = request.user
        user.is_active = False  # Soft delete
        user.save()
        return Response({"message": "Xóa tài khoản thành công."}, status=status.HTTP_204_NO_CONTENT)

class EventViewSet(viewsets.ViewSet, generics.ListAPIView):
    queryset = Event.objects.filter(active=True)
    serializer_class = EventSerializer

    @action(methods=['get'], url_path='detail', detail=True)
    def view_event(self, request, pk=None):
        event = get_object_or_404(Event, id=pk)
        trend, created = EventTrend.objects.get_or_create(event=event)
        trend.increment_views()  # Tăng views
        trend.increment_interest(points=1)  # Tăng interest_level khi xem chi tiết
        serializer = EventSerializer(event)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update_event_statuses(self, queryset):
        """Cập nhật trạng thái cho tất cả sự kiện trong queryset."""
        current_time = now()
        # Cập nhật từ 'upcoming' sang 'completed' nếu đã qua
        queryset.filter(date__lt=current_time, status=Event.EventStatus.UPCOMING).update(
            status=Event.EventStatus.COMPLETED)
        # Cập nhật từ 'completed' sang 'upcoming' nếu còn trong tương lai (trường hợp hiếm)
        queryset.filter(date__gt=current_time, status=Event.EventStatus.COMPLETED).update(
            status=Event.EventStatus.UPCOMING)
        return queryset

    def get_queryset(self):
        """Trả về queryset với trạng thái đã được cập nhật."""
        queryset = Event.objects.filter(active=True)
        return self.update_event_statuses(queryset)

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

        if event.organizer != request.user:
            return Response(
                {"error": "Bạn không có quyền xem phản hồi cho sự kiện này."},
                status=status.HTTP_403_FORBIDDEN
            )

        reviews = Review.objects.filter(event=event)
        serializer = ReviewSerializer(reviews, many=True)

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

    @action(methods=['get'], url_path='my-rank', detail=False, permission_classes=[IsAuthenticated])
    def get_my_rank(self, request):
        rank = get_customer_rank(request.user)
        return Response({"rank": rank}, status=status.HTTP_200_OK)


class BookingViewSet(viewsets.ViewSet):

    @action(methods=['get'], url_path='search-events', detail=False)
    def search_events(self, request):
        category = request.query_params.get('category')
        if not category:
            return Response({"error": "Vui lòng cung cấp category"}, status=status.HTTP_400_BAD_REQUEST)

        events = Event.objects.filter(category__name__icontains=category,
                                      status=Event.EventStatus.UPCOMING)  # Tìm category không phân biệt chữ hoa/ thường, chỉ lấy sự kiện sắp diễn ra
        serializer = EventSerializer(events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='tickets',
            detail=True)  # Nếu detail=False, URL sẽ là /booking/tickets/ (không cần id sự kiện).
    def get_tickets(self, request, pk=None):  # pk là id của sự kiện
        event = get_object_or_404(Event, id=pk)  # Tìm sự kiện theo id, nếu không có thì báo lỗi 404.
        tickets = Ticket.objects.filter(event=event)
        serializer = TicketSerializer(tickets, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['post'], url_path='book-ticket', permission_classes=[permissions.IsAuthenticated], detail=False)
    def book_ticket(self, request):
        user = request.user
        event_id = request.data.get('event_id')
        ticket_id = request.data.get('ticket_id')
        quantity = int(request.data.get('quantity', 1))
        payment_method = request.data.get('payment_method')
        discount_code = request.data.get('discount_code')

        if not all([event_id, ticket_id, quantity, payment_method]):
            return Response({"error": "Thiếu thông tin đặt vé"}, status=status.HTTP_400_BAD_REQUEST)

        event = get_object_or_404(Event, id=event_id)
        if event.status != Event.EventStatus.UPCOMING:
            return Response({"error": "Sự kiện không khả dụng để đặt vé"}, status=status.HTTP_400_BAD_REQUEST)
        ticket = get_object_or_404(Ticket, event=event, id=ticket_id)

        if ticket.quantity < quantity:
            return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

        total_price = ticket.price * quantity

        # Kiểm tra và áp dụng mã giảm giá
        if discount_code:
            discount = Discount.objects.filter(
                code=discount_code,
                event=event,  # Chỉ áp dụng cho sự kiện này
                expiration_date__gt=now()
            ).first()
            if not discount:
                return Response({"error": "Mã giảm giá không hợp lệ hoặc đã hết hạn."},
                                status=status.HTTP_400_BAD_REQUEST)

            user_rank = get_customer_rank(user)
            if discount.target_rank and discount.target_rank != 'none' and discount.target_rank != user_rank:
                return Response({"error": "Mã giảm giá không áp dụng cho hạng của bạn."},
                                status=status.HTTP_403_FORBIDDEN)

            # Áp dụng giảm giá
            total_price = total_price * (1 - discount.discount_percent / 100)

        calendar_event_id = None  # Biến để lưu ID sự kiện trên Google Calendar
        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                total_amount=total_price,
                payment_status=Order.PaymentStatus.PENDING,
                payment_method=payment_method
            )
            qr_code = f"QR_{order.id}_{ticket.id}"
            order_detail = OrderDetail.objects.create(
                order=order,
                ticket=ticket,
                quantity=quantity,
                qr_code=qr_code
            )

            # Tạo hình ảnh QR code và gán vào order_detail
            qr_image = generate_qr_image(qr_code)
            order_detail.qr_image.save(f"{qr_code}.png", qr_image)
            order_detail.save()

            ticket.quantity -= quantity
            ticket.save()

            # Tăng interest_level khi đặt vé
            trend, created = EventTrend.objects.get_or_create(event=event)
            trend.increment_interest(points=3)  # Đặt vé có thể đáng giá hơn xem (+3)


            # Tích hợp Google Calendar: Thêm sự kiện vào lịch nếu người dùng đã xác thực
            credentials_dict = request.session.get('google_credentials')
            if credentials_dict:
                try:
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

                    calendar_event_response = service.events().insert(calendarId='primary',
                                                                      body=calendar_event).execute()
                    calendar_event_id = calendar_event_response['id']
                except Exception as e:
                    # Nếu có lỗi khi thêm vào Google Calendar, không làm gián đoạn đặt vé
                    print(f"Error adding to Google Calendar: {str(e)}")
        momo_response = self.create_momo_qr(order)
        if "error" in momo_response or "qrCodeUrl" not in momo_response:
            return Response({
                "error": "Không thể tạo QR thanh toán MoMo",
                "momo_response": momo_response
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "order": OrderSerializer(order).data,
            "qrCodeUrl": momo_response["qrCodeUrl"],
            "payUrl": momo_response["payUrl"],
            "qr_image_url": request.build_absolute_uri(order_detail.qr_image.url),
            "calendar_added": calendar_event_id is not None,
            "calendar_event_id": calendar_event_id
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='checkin')
    def checkin_by_qr(self, request):
        qr_code = request.data.get('qr_code')
        if not qr_code:
            return Response({"error": "Thiếu mã QR"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            order_detail = OrderDetail.objects.get(qr_code=qr_code)
        except OrderDetail.DoesNotExist:
            return Response({"error": "Không tìm thấy vé với mã QR này"}, status=status.HTTP_404_NOT_FOUND)

        if order_detail.checked_in:
            return Response({"message": "Vé đã được check-in trước đó"}, status=status.HTTP_200_OK)

        order_detail.checked_in = True
        order_detail.save()

        return Response({"message": "Check-in thành công", "order_id": order_detail.order.id},
                        status=status.HTTP_200_OK)

    def create_momo_qr(self, order):
        """ Hàm gọi API tạo QR MoMo """
        order_id = f"ORDER_{order.user.id}_{order.id}"
        request_id = f"REQ_{order_id}"
        amount = int(order.total_amount)
        order_info = f"Thanh toán đơn hàng {order_id}"

        endpoint = "https://test-payment.momo.vn/v2/gateway/api/create"
        partner_code = "MOMO"
        access_key = "F8BBA842ECF85"
        secret_key = "K951B6PE1waDMi640xX08PD3vg6EkVlz"
        redirect_url = "http://localhost:8000/payment-success"
        ipn_url = "http://localhost:8000/payment-notify"

        raw_data = f"accessKey={access_key}&amount={amount}&extraData=&ipnUrl={ipn_url}&orderId={order_id}&orderInfo={order_info}&partnerCode={partner_code}&redirectUrl={redirect_url}&requestId={request_id}&requestType=captureWallet"
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
            "extraData": "",
            "requestType": "captureWallet",
            "signature": signature
        }

        response = requests.post(endpoint, json=data, headers={'Content-Type': 'application/json'})
        return response.json()


    @action(methods=['post'], url_path='check-discount', detail=False, permission_classes=[permissions.IsAuthenticated])
    def check_discount(self, request):
        discount_code = request.data.get('discount_code')
        event_id = request.data.get('event_id')
        if not all([discount_code, event_id]):
            return Response({"error": "Thiếu mã hoặc event_id"}, status=status.HTTP_400_BAD_REQUEST)

        discount = Discount.objects.filter(code=discount_code, event_id=event_id, expiration_date__gt=now()).first()
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


class MoMoPaymentViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'], url_path='payment-notify')
    def payment_notify(self, request):
        """
        API nhận thông báo thanh toán từ MoMo (IPN).
        """
        data = request.data
        order_id = data.get("orderId")  # ID đơn hàng từ MoMo
        request_id = data.get("requestId")
        result_code = data.get("resultCode")  # Mã kết quả giao dịch (0: thành công)
        message = data.get("message")

        if not order_id or not request_id:
            return Response({"error": "Dữ liệu không hợp lệ"}, status=status.HTTP_400_BAD_REQUEST)

        # Tìm đơn hàng theo order_id
        order = Order.objects.filter(id=order_id.replace("ORDER_", "")).first()

        if not order:
            return Response({"error": "Không tìm thấy đơn hàng"}, status=status.HTTP_404_NOT_FOUND)

        # Cập nhật trạng thái đơn hàng dựa vào result_code từ MoMo
        if result_code == 0:
            order.payment_status = Order.PaymentStatus.PAID
            order.save()
            return Response({"message": "Thanh toán thành công", "order_id": order.id}, status=status.HTTP_200_OK)
        else:
            order.payment_status = Order.PaymentStatus.FAILED
            order.save()
            return Response({"message": f"Thanh toán thất bại: {message}"}, status=status.HTTP_400_BAD_REQUEST)

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
        request.session['google_credentials'] = {
            'token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_uri': credentials.token_uri,
            'client_id': credentials.client_id,
            'client_secret': credentials.client_secret,
            'scopes': credentials.scopes
        }

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
