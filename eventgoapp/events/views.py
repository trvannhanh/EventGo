from rest_framework import viewsets, permissions, generics, status, parsers
from rest_framework.decorators import action
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from rest_framework.response import Response
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail


from events.models import Event, EventCategory, User
from events.serializers import EventCategorySerializer, EventSerializer, UserSerializer, ForgotPasswordSerializer, ResetPasswordSerializer

#29/3
class UserViewSet(viewsets.ViewSet, generics.CreateAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserSerializer
    parser_classes = [parsers.MultiPartParser]

    @action(methods=['get'], url_path='current-user', detail=False, permission_classes=[permissions.IsAuthenticated])
    def get_current_user(self, request):
        return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)




class EventViewSet(viewsets.ModelViewSet):
    queryset = Event.objects.filter(active=True)
    serializer_class = EventSerializer
    

    def get_queryset(self):
        queryset = self.queryset
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset
    
    

        
    
class EventCategoryViewSet(viewsets.ModelViewSet):
    queryset = EventCategory.objects.filter(active=True)
    serializer_class = EventCategorySerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = self.queryset
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(name__icontains=search)
        return queryset

    # API để lấy danh sách sự kiện thuộc danh mục
    @action(methods=['get'], detail=True, url_path='events')
    def get_events(self, request, pk=None):
        category = self.get_object()
        events = category.events.filter(active=True)  # Lọc các event còn hoạt động
        serializer = EventSerializer(events, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    
    