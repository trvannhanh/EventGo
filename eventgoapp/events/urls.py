from django.urls import include, path
from rest_framework.routers import DefaultRouter
from events.views import EventCategoryViewSet, EventViewSet, UserViewSet

r = DefaultRouter()
r.register('users', UserViewSet, basename='users')
r.register('events', EventViewSet, basename='events')
r.register('categories', EventCategoryViewSet, basename='categories')

urlpatterns = [
    path('', include(r.urls)),
]