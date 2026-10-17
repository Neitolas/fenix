from django.db import transaction
from django.shortcuts import get_object_or_404

from .event_data import EVENT_STATUSES, MAINTENANCE_KINDS, EventCommand
from .models import Agent, Equipment, Event

RESOURCE_MODELS = {"equipment": Equipment, "agent": Agent}


class EventConflict(ValueError):
    pass


def is_current(command: EventCommand, previous: Event | None) -> bool:
    return previous is None or command.timestamp >= previous.timestamp


@transaction.atomic
def ingest_event(command: EventCommand) -> tuple[Event, bool]:
    model = RESOURCE_MODELS[command.resource_type]
    resource = get_object_or_404(
        model.objects.select_for_update(), pk=command.resource_id, archived=False
    )
    existing = Event.objects.filter(external_id=command.external_id).first()
    if existing:
        if (
            existing.kind != command.kind
            or getattr(existing, command.resource_type + "_id") != resource.pk
        ):
            raise EventConflict("Identificador já utilizado por outro evento.")
        return existing, False

    history = Event.objects.filter(**{command.resource_type: resource})
    latest_state = history.filter(kind__in=EVENT_STATUSES).first()
    latest_maintenance = history.filter(kind__in=MAINTENANCE_KINDS).first()
    latest_position = history.filter(
        latitude__isnull=False, longitude__isnull=False
    ).first()
    event = Event.objects.create(
        **{command.resource_type: resource},
        kind=command.kind,
        external_id=command.external_id,
        timestamp=command.timestamp,
        origin=command.origin,
        description=command.description,
        status=EVENT_STATUSES.get(command.kind, ""),
        **command.position,
    )
    if resource.last_seen is None or command.timestamp >= resource.last_seen:
        resource.last_seen = command.timestamp
    if is_current(command, latest_position):
        for field_name, value in command.position.items():
            setattr(resource, field_name, value)
    if command.resource_type == "equipment":
        apply_equipment_state(resource, command, latest_state, latest_maintenance)
    resource.save()
    return event, True


def apply_equipment_state(
    resource: Equipment,
    command: EventCommand,
    latest_state: Event | None,
    latest_maintenance: Event | None,
) -> None:
    status = EVENT_STATUSES.get(command.kind)
    if status and is_current(command, latest_state):
        resource.status = status
    if not is_current(command, latest_maintenance):
        return
    if command.kind == "failure":
        resource.maintenance = "immediate"
    elif command.kind == "maintenance_done":
        resource.maintenance = "none"
        resource.next_maintenance = None
