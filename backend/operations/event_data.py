import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime

EVENT_STATUSES = {
    "failure": "fault",
    "recovery": "operational",
    "maintenance_done": "operational",
}
EVENT_KINDS = frozenset({"heartbeat", "position", *EVENT_STATUSES})
MAINTENANCE_KINDS = ("failure", "maintenance_done")
MAX_FUTURE_SKEW = timedelta(minutes=5)


@dataclass(frozen=True)
class EventCommand:
    resource_type: str
    resource_id: int
    kind: str
    external_id: str
    timestamp: datetime
    origin: str
    description: str
    position: dict[str, float] = field(default_factory=dict)


def parse_event(data: dict, *, now: datetime | None = None) -> EventCommand:
    now = now or timezone.now()
    resource_type = data.get("resource")
    if resource_type not in ("equipment", "agent"):
        raise ValueError("Tipo de recurso inválido.")
    raw_id = data.get("resource_id")
    if isinstance(raw_id, bool) or not isinstance(raw_id, (int, str)):
        raise ValueError("Identificador de recurso inválido.")
    resource_id = int(raw_id)
    if resource_id < 1:
        raise ValueError("Identificador de recurso inválido.")
    kind = data.get("kind")
    if not isinstance(kind, str) or kind not in EVENT_KINDS:
        raise ValueError("Tipo de evento inválido.")
    if resource_type == "agent" and kind in EVENT_STATUSES:
        raise ValueError("Esse evento é exclusivo de equipamentos.")
    external_id = data.get("external_id")
    if not isinstance(external_id, str) or not 1 <= len(external_id) <= 100:
        raise ValueError("Informe um identificador de evento com até 100 caracteres.")
    raw_timestamp = data.get("timestamp")
    if raw_timestamp and not isinstance(raw_timestamp, str):
        raise ValueError("Data inválida.")
    timestamp = parse_datetime(raw_timestamp) if raw_timestamp else now
    if (
        timestamp is None
        or timezone.is_naive(timestamp)
        or timestamp > now + MAX_FUTURE_SKEW
    ):
        raise ValueError("Data inválida ou muito adiante do horário atual.")
    position = parse_position(data, required=kind == "position")
    return EventCommand(
        resource_type=resource_type,
        resource_id=resource_id,
        kind=kind,
        external_id=external_id,
        timestamp=timestamp,
        origin=str(data.get("origin", "manual"))[:80],
        description=str(data.get("description", ""))[:250],
        position=position,
    )


def parse_position(data: dict, *, required: bool) -> dict[str, float]:
    position = {}
    for field_name, maximum in (("latitude", 90), ("longitude", 180)):
        if field_name not in data:
            continue
        value = float(data[field_name])
        if not math.isfinite(value) or abs(value) > maximum:
            raise ValueError("Coordenadas inválidas.")
        position[field_name] = value
    if len(position) == 1 or (required and not position):
        raise ValueError("Informe latitude e longitude juntas.")
    return position
