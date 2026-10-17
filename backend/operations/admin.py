from django.contrib import admin
from .models import Equipment, Agent, Event


@admin.register(Equipment)
class EquipmentAdmin(admin.ModelAdmin):
    list_display = ("serial", "kind", "status", "neighborhood", "archived")
    list_filter = ("kind", "status", "archived")
    search_fields = ("serial", "brand", "neighborhood")


@admin.register(Agent)
class AgentAdmin(admin.ModelAdmin):
    list_display = ("name", "registration", "agency", "status", "archived")
    search_fields = ("name", "registration")


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("external_id", "kind", "timestamp", "origin")
    readonly_fields = (
        "external_id",
        "equipment",
        "agent",
        "kind",
        "timestamp",
        "origin",
        "description",
        "latitude",
        "longitude",
        "status",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
