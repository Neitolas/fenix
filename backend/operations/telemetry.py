from django.db import IntegrityError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from .common import authenticated, payload, serialize
from .event_data import parse_event
from .event_service import EventConflict, ingest_event
from .models import Event

HISTORY_LIMIT = 200


def event_history() -> dict:
    query = Event.objects.select_related("equipment", "agent")
    records = []
    for event in query[:HISTORY_LIMIT]:
        resource_name = (
            event.equipment.serial if event.equipment_id else event.agent.name
        )
        records.append(serialize(event) | {"resource_name": resource_name})
    return {"count": query.count(), "results": records}


@authenticated
@require_http_methods(["GET", "POST"])
def events(request):
    if request.method == "GET":
        return JsonResponse(event_history())
    try:
        command = parse_event(payload(request))
        event, created = ingest_event(command)
        return JsonResponse(serialize(event), status=201 if created else 200)
    except EventConflict as error:
        return JsonResponse({"error": str(error)}, status=409)
    except (ValueError, TypeError) as error:
        return JsonResponse({"error": str(error) or "Evento inválido."}, status=400)
    except IntegrityError:
        return JsonResponse(
            {"error": "Identificador já utilizado; consulte o histórico."}, status=409
        )
