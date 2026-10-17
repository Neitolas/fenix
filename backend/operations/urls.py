from django.urls import path

from . import reports, services, telemetry, views

urlpatterns = [
    path("reports/equipment.csv", reports.equipment_csv),
    path("events/", telemetry.events),
    path("dashboard/", services.dashboard),
    path("prevention/", services.prevention),
    path("session/", views.session),
    path("equipment/", views.equipment),
    path("equipment/<int:pk>/", views.equipment),
    path("agents/", views.agents),
    path("agents/<int:pk>/", views.agents),
]
