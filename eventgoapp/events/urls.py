from django.urls import include, path
from rest_framework.routers import DefaultRouter

from events.views import UserViewSet, EventViewSet, OrderViewSet, PaymentViewSet, GoogleCalendarViewSet, ReviewViewSet

r = DefaultRouter()
r.register('users', UserViewSet, basename='users')
r.register('events', EventViewSet, basename='events')
r.register('reviews', ReviewViewSet, basename='reviews')
r.register(r'google-calendar', GoogleCalendarViewSet, basename='google-calendar')
r.register(r'orders', OrderViewSet, basename='orders')
r.register('payment', PaymentViewSet, basename='payment')
urlpatterns = [
    path('', include(r.urls)),
]
