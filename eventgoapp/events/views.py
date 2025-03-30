from rest_framework import viewsets, permissions, generics, status, parsers
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.response import Response
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail


from events.models import User
from events.serializers import UserSerializer

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