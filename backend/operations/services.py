from datetime import timedelta

from django.db.models import Count, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .common import authenticated, filtered, serialize
from .models import Agent, Equipment


def attention(item, now=None):
    now = now or timezone.now()
    today = timezone.localtime(now).date()
    factors = []
    if item.maintenance == "immediate":
        factors.append({"label": "Manutenção imediata", "points": 40})
    if item.maintenance == "scheduled" and item.next_maintenance:
        days = (item.next_maintenance - today).days
        if days < 0:
            factors.append({"label": "Manutenção vencida", "points": 25})
        elif days <= 7:
            factors.append({"label": "Manutenção nos próximos sete dias", "points": 10})
    failures = getattr(item, "recent_failures", None)
    if failures is None:
        failures = item.events.filter(
            kind="failure", timestamp__gte=now - timedelta(days=7), timestamp__lte=now
        ).count()
    if failures:
        factors.append(
            {
                "label": f"{failures} falha(s) nos últimos sete dias",
                "points": min(30, failures * 10),
            }
        )
    if item.last_seen and now - item.last_seen > timedelta(minutes=30):
        factors.append({"label": "Último sinal há mais de 30 minutos", "points": 15})
    score = min(100, sum(f["points"] for f in factors))
    level = (
        "critical"
        if score >= 75
        else "high"
        if score >= 50
        else "moderate"
        if score >= 25
        else "low"
    )
    return {
        "id": item.id,
        "serial": item.serial,
        "kind": item.kind,
        "status": item.status,
        "region": item.region,
        "score": score,
        "level": level,
        "factors": factors,
        "calculated_at": now,
        "recommendation": (
            "Verificar o equipamento e priorizar a manutenção."
            if score >= 25
            else "Manter acompanhamento e rotina de manutenção."
        ),
        "has_telemetry": item.last_seen is not None,
    }


@authenticated
@require_GET
def prevention(request):
    now = timezone.now()
    query = filtered(Equipment.objects.filter(archived=False), request.GET).annotate(
        recent_failures=Count(
            "events",
            filter=Q(
                events__kind="failure",
                events__timestamp__gte=now - timedelta(days=7),
                events__timestamp__lte=now,
            ),
        ),
        previous_failures=Count(
            "events",
            filter=Q(
                events__kind="failure",
                events__timestamp__gte=now - timedelta(days=14),
                events__timestamp__lt=now - timedelta(days=7),
            ),
        ),
    )
    records = sorted(
        (attention(item, now) for item in query), key=lambda row: -row["score"]
    )
    recent = sum(item.recent_failures for item in query)
    previous = sum(item.previous_failures for item in query)
    return JsonResponse(
        {
            "results": records,
            "recent_failures": recent,
            "previous_failures": previous,
            "notice": "Índice heurístico de atenção. Não representa probabilidade validada de falha.",
        }
    )


@authenticated
@require_GET
def dashboard(request):
    equipment = filtered(Equipment.objects.filter(archived=False), request.GET)
    agents = filtered(
        Agent.objects.filter(archived=False),
        {k: v for k, v in request.GET.items() if k not in ["kind", "status"]},
    )
    total = equipment.count()
    operational = equipment.filter(status="operational").count()
    unavailable = equipment.filter(
        status__in=["fault", "maintenance", "disabled", "stolen"]
    ).count()
    not_installed = equipment.filter(status="not_installed").count()
    denominator = operational + unavailable
    regions = []
    for row in (
        equipment.values("region").annotate(total=Count("id")).order_by("region")
    ):
        subset = equipment.filter(region=row["region"])
        row["unavailable"] = subset.filter(
            status__in=["fault", "maintenance", "disabled", "stolen"]
        ).count()
        regions.append(row)
    today = timezone.localdate()
    alerts = []
    for item in equipment:
        if item.status in ["fault", "stolen"] or item.maintenance == "immediate":
            alerts.append(
                {
                    "id": item.id,
                    "serial": item.serial,
                    "level": "critical",
                    "message": "Recurso exige intervenção operacional.",
                }
            )
        elif (
            item.maintenance == "scheduled"
            and item.next_maintenance
            and item.next_maintenance <= today + timedelta(days=7)
        ):
            alerts.append(
                {
                    "id": item.id,
                    "serial": item.serial,
                    "level": "warning",
                    "message": (
                        "Manutenção vencida."
                        if item.next_maintenance < today
                        else "Manutenção prevista nos próximos sete dias."
                    ),
                }
            )
    return JsonResponse(
        {
            "total": total,
            "operational": operational,
            "unavailable": unavailable,
            "not_installed": not_installed,
            "availability": (
                round(100 * operational / denominator, 1) if denominator else None
            ),
            "active_agents": agents.filter(status__in=["active", "incident"]).count(),
            "regions": regions,
            "alerts": alerts,
            "equipment": [serialize(x) for x in equipment[:5000]],
            "agents": [serialize(x) for x in agents[:5000]],
            "truncated": total > 5000 or agents.count() > 5000,
            "updated_at": timezone.now(),
        }
    )
