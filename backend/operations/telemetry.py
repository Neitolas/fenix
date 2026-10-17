import json, math
from django.db import transaction, IntegrityError
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from datetime import timedelta
from django.views.decorators.http import require_http_methods
from .models import Equipment, Agent, Event
from .common import authenticated, payload, serialize


@authenticated
@require_http_methods(["GET", "POST"])
def events(request):
    if request.method == "GET":
        query = Event.objects.select_related("equipment", "agent")
        records = []
        for e in query[:200]:
            resource = e.equipment if e.equipment_id else e.agent
            records.append(
                serialize(e)
                | {
                    "resource_name": (
                        resource.serial if e.equipment_id else resource.name
                    )
                }
            )
        return JsonResponse({"count": query.count(), "results": records})
    try:
        data = payload(request)
        resource_type = data.get("resource")
        if resource_type not in ["equipment", "agent"]:
            raise ValueError("Tipo de recurso inválido.")
        model = Equipment if resource_type == "equipment" else Agent
        resource_id = int(data.get("resource_id", 0))
        kind = data.get("kind")
        if kind not in [
            "heartbeat",
            "failure",
            "recovery",
            "position",
            "maintenance_done",
        ]:
            raise ValueError("Tipo de evento inválido.")
        if resource_type == "agent" and kind in [
            "failure",
            "recovery",
            "maintenance_done",
        ]:
            raise ValueError("Esse evento é exclusivo de equipamentos.")
        external_id = data.get("external_id")
        if not isinstance(external_id, str) or not 1 <= len(external_id) <= 100:
            raise ValueError(
                "Informe um identificador de evento com até 100 caracteres."
            )
        timestamp = (
            parse_datetime(data["timestamp"])
            if data.get("timestamp")
            else timezone.now()
        )
        if (
            timestamp is None
            or timezone.is_naive(timestamp)
            or timestamp > timezone.now() + timedelta(minutes=5)
        ):
            raise ValueError("Data inválida ou muito adiante do horário atual.")
        position = {}
        for key, maximum in [("latitude", 90), ("longitude", 180)]:
            if key in data:
                value = float(data[key])
                if not math.isfinite(value) or abs(value) > maximum:
                    raise ValueError("Coordenadas inválidas.")
                position[key] = value
        if len(position) == 1 or (kind == "position" and not position):
            raise ValueError("Informe latitude e longitude juntas.")
        with transaction.atomic():
            resource = get_object_or_404(
                model.objects.select_for_update(), pk=resource_id, archived=False
            )
            existing = Event.objects.filter(external_id=external_id).first()
            if existing:
                matches = (
                    existing.kind == kind
                    and getattr(existing, resource_type + "_id") == resource.pk
                )
                if not matches:
                    return JsonResponse(
                        {"error": "Identificador já utilizado por outro evento."},
                        status=409,
                    )
                return JsonResponse(serialize(existing), status=200)
            history = Event.objects.filter(**{resource_type: resource})
            state_kinds = ["failure", "recovery", "maintenance_done"]
            latest_state = history.filter(kind__in=state_kinds).first()
            latest_maintenance = history.filter(kind__in=["failure", "maintenance_done"]).first()
            latest_position = history.filter(latitude__isnull=False, longitude__isnull=False).first()
            status = {"failure": "fault", "recovery": "operational", "maintenance_done": "operational"}.get(kind, "")
            event = Event.objects.create(
                **{resource_type: resource},
                kind=kind,
                external_id=external_id,
                timestamp=timestamp,
                origin=str(data.get("origin", "manual"))[:80],
                description=str(data.get("description", ""))[:250],
                status=status,
                **position,
            )
            if resource.last_seen is None or timestamp >= resource.last_seen:
                resource.last_seen = timestamp
            if latest_position is None or timestamp >= latest_position.timestamp:
                for key, value in position.items():
                    setattr(resource, key, value)
            if latest_state is None or timestamp >= latest_state.timestamp:
                if resource_type == "equipment":
                    if kind == "failure":
                        resource.status = "fault"
                    if kind in ["recovery", "maintenance_done"]:
                        resource.status = "operational"
            if resource_type == "equipment" and (latest_maintenance is None or timestamp >= latest_maintenance.timestamp):
                if kind == "failure":
                    resource.maintenance = "immediate"
                if kind == "maintenance_done":
                    resource.maintenance = "none"
                    resource.next_maintenance = None
            resource.save()
        return JsonResponse(serialize(event), status=201)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        return JsonResponse({"error": str(error) or "Evento inválido."}, status=400)
    except IntegrityError:
        return JsonResponse(
            {"error": "Identificador já utilizado; consulte o histórico."}, status=409
        )
