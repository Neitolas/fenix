import json
import os
from urllib.error import URLError
from urllib.request import Request, urlopen

from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from .common import authenticated, filtered
from .models import Equipment


@authenticated
@require_GET
def equipment_csv(request):
    token = os.getenv("REPORT_SERVICE_TOKEN", "")
    if not token:
        return JsonResponse(
            {"error": "Serviço de relatórios não configurado."}, status=503
        )
    query = filtered(Equipment.objects.filter(archived=False), request.GET)
    if query.count() > 5000:
        return JsonResponse(
            {"error": "Restrinja os filtros para exportar até 5.000 registros."},
            status=400,
        )
    rows = [
        {
            "serial": x.serial,
            "kind": x.get_kind_display(),
            "status": x.get_status_display(),
            "agency": x.agency,
            "neighborhood": x.neighborhood,
            "region": x.region,
            "maintenance": x.get_maintenance_display(),
        }
        for x in query
    ]
    body = json.dumps({"version": 1, "rows": rows}, ensure_ascii=False).encode()
    url = (
        os.getenv("REPORT_SERVICE_URL", "http://127.0.0.1:9080").rstrip("/") + "/export"
    )
    try:
        with urlopen(
            Request(
                url,
                data=body,
                headers={
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json",
                },
            ),
            timeout=5,
        ) as service:
            if "text/csv" not in service.headers.get("Content-Type", ""):
                raise ValueError("Formato de relatório inesperado.")
            result = HttpResponse(
                service.read(6000000), content_type="text/csv; charset=utf-8"
            )
            result["Content-Disposition"] = (
                'attachment; filename="fenix-equipamentos.csv"'
            )
            result["Cache-Control"] = "no-store"
            return result
    except (URLError, OSError, ValueError):
        return JsonResponse(
            {"error": "Serviço de relatórios indisponível. Tente novamente."},
            status=503,
        )
