from django.db import transaction
from rest_framework import viewsets, permissions, generics, status, parsers
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from unicodedata import category

from events.models import User, Event, Ticket, Order, OrderDetail, EventCategory
from events.serializers import UserSerializer, EventSerializer, TicketSerializer, OrderSerializer, EventCategorySerializer

#29/3
class UserViewSet(viewsets.ViewSet, generics.CreateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    parser_classes = [parsers.MultiPartParser]

    def get_permissions(self):
        if self.action == 'list':
            return [permissions.IsAdminUser()]  # Chỉ Admin có thể xem danh sách Users
        return [permissions.AllowAny()]  # Ai cũng có thể đăng ký

    @action(methods=['get'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_current_user(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)
    
    
#     @action(methods=['post'], url_path='forgot-password', detail=False)
#     def forgot_password(self, request):
#         """ Xử lý quên mật khẩu: Gửi email chứa link reset """
#         serializer = ForgotPasswordSerializer(data=request.data)
#         if serializer.is_valid():
#             email = serializer.validated_data['email']
#             user = User.objects.get(email=email)
#
#             # Tạo token đặt lại mật khẩu
#             token = default_token_generator.make_token(user)
#             uid = urlsafe_base64_encode(force_bytes(user.pk))
#             reset_link = f"http://localhost:8000/api/users/reset-password/{uid}/{token}/"
#
#             # Gửi email chứa link đặt lại mật khẩu
#             send_mail(
#                 "Đặt lại mật khẩu",
#                 f"Nhấp vào link sau để đặt lại mật khẩu: {reset_link}",
#                 "your_email@gmail.com",
#                 [email],
#                 fail_silently=False,
#             )
#
#             return Response({"message": "Một email đặt lại mật khẩu đã được gửi."}, status=status.HTTP_200_OK)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#
#     @action(methods=['post'], url_path='reset-password/(?P<uidb64>[^/.]+)/(?P<token>[^/.]+)', detail=False)
#     def reset_password(self, request, uidb64, token):
#         """ Xử lý đặt lại mật khẩu """
#         try:
#             uid = force_str(urlsafe_base64_decode(uidb64))
#             user = User.objects.get(pk=uid)
#
#             if not default_token_generator.check_token(user, token):
#                 return Response({"error": "Link đặt lại mật khẩu không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
#
#             serializer = ResetPasswordSerializer(data=request.data)
#             if serializer.is_valid():
#                 user.set_password(serializer.validated_data['new_password'])
#                 user.save()
#                 return Response({"message": "Mật khẩu đã được đặt lại thành công."}, status=status.HTTP_200_OK)
#             return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#         except (TypeError, ValueError, OverflowError, User.DoesNotExist):
#             return Response({"error": "Link không hợp lệ."}, status=status.HTTP_400_BAD_REQUEST)
#
#
# def send_test_email():
#     send_mail(
#         'Test Mailgun SMTP',
#         'Nội dung email từ Django sử dụng Mailgun.',
#         'danhtrantunham2016@gmail.com',  # Địa chỉ email gửi
#         ['trvannhanh@gmail.com'],  # Địa chỉ email nhận
#         fail_silently=False,
#     )

class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.filter(active=True)
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]
    
#     def get_queryset(self): 
#         queryset = self.queryset
#         search = self.request.query_params.get('search', None)
#         if search:
#             queryset = queryset.filter(name__icontains=search)
#         return queryset

class BookingViewSet(viewsets.ViewSet):

    @action(methods=['get'], url_path='search-events', detail=False)
    def search_events(self, request):
        category = request.query_params.get('category')
        if not category:
            return Response({"error": "Vui lòng cung cấp category"}, status=status.HTTP_400_BAD_REQUEST)

        events = Event.objects.filter(category__name__icontains=category, status=Event.EventStatus.UPCOMING) #Tìm category không phân biệt chữ hoa/ thường, chỉ lấy sự kiện sắp diễn ra
        serializer = EventSerializer(events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(methods=['get'], url_path='tickets', detail=True) #Nếu detail=False, URL sẽ là /booking/tickets/ (không cần id sự kiện).
    def get_tickets(self, request, pk=None): #pk là id của sự kiện
        event = get_object_or_404(Event, id=pk) # Tìm sự kiện theo id, nếu không có thì báo lỗi 404.
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

        if not all([event_id, ticket_id, quantity, payment_method]):
            return Response({"error": "Thiếu thông tin đặt vé"}, status=status.HTTP_400_BAD_REQUEST)

        event = get_object_or_404(Event, id=event_id)
        ticket = get_object_or_404(Ticket, event=event, id=ticket_id)

        if ticket.quantity < quantity:
            return Response({"error": "Số lượng vé không đủ"}, status=status.HTTP_400_BAD_REQUEST)

        total_price = ticket.price * quantity

        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                total_amount=total_price,
                payment_status=Order.PaymentStatus.PENDING,
                payment_method=payment_method
            )
            OrderDetail.objects.create(
                order=order,
                ticket=ticket,
                quantity=quantity,
                qr_code=f"QR_{order.id}_{ticket.id}"
            )

            ticket.quantity -= quantity
            ticket.save()

        return Response(OrderSerializer(order).data ,status=status.HTTP_201_CREATED)
      
      
# class EventCategoryViewSet(viewsets.ModelViewSet):
#     queryset = EventCategory.objects.filter(active=True)
#     serializer_class = EventCategorySerializer
#     permission_classes = [permissions.IsAuthenticatedOrReadOnly]

#     def get_queryset(self):
#         queryset = self.queryset
#         search = self.request.query_params.get('search', None)
#         if search:
#             queryset = queryset.filter(name__icontains=search)
#         return queryset

#     # API để lấy danh sách sự kiện thuộc danh mục
#     @action(methods=['get'], detail=True, url_path='events')
#     def get_events(self, request, pk=None):
#         category = self.get_object()
#         events = category.events.filter(active=True)  # Lọc các event còn hoạt động
#         serializer = EventSerializer(events, many=True)
#         return Response(serializer.data, status=status.HTTP_200_OK)
