from django.contrib import admin
from django.urls import path, include

from .views import health

urlpatterns = [
    path("api/", include("operations.urls")),
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
]
