from django.urls import include, path
from rest_framework.routers import DefaultRouter
from events.views import UserViewSet

r = DefaultRouter()
r.register('users', UserViewSet, basename='users')

urlpatterns = [
    path('', include(r.urls)),
]