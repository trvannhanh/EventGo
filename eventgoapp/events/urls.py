from django.urls import include, path
from rest_framework.routers import DefaultRouter

from events.views import UserViewSet, EventViewSet, BookingViewSet, MoMoPaymentViewSet

r = DefaultRouter()
r.register('users', UserViewSet, basename='users')
r.register('events', EventViewSet, basename='events')
# r.register('categories', EventCategoryViewSet, basename='categories')

r.register('booking', BookingViewSet, basename='booking')
r.register('momopayment', MoMoPaymentViewSet, basename='momopayment')
urlpatterns = [
    path('', include(r.urls)),
]