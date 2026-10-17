import json
from functools import wraps

from django.http import JsonResponse


def authenticated(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse(
                {"error": "Entre na central para continuar."}, status=401
            )
        return view(request, *args, **kwargs)

    return wrapped


def payload(request):
    data = json.loads(request.body)
    if not isinstance(data, dict):
        raise ValueError("Envie um objeto JSON.")
    return data


def serialize(obj):
    result = {}
    for field in obj._meta.fields:
        if field.name == "archived":
            continue
        value = getattr(obj, field.attname)
        if field.name in ("latitude", "longitude") and value is not None:
            value = float(value)
        result[field.name] = value
    return result


def filtered(queryset, params):
    for field in ["status", "neighborhood", "region", "agency"]:
        if params.get(field):
            queryset = queryset.filter(**{field: params[field]})
    names = {f.name for f in queryset.model._meta.fields}
    if params.get("kind") and "kind" in names:
        queryset = queryset.filter(kind=params["kind"])
    if params.get("search"):
        fields = [
            field
            for field in [
                "serial",
                "name",
                "registration",
                "neighborhood",
                "agency",
                "brand",
                "model",
            ]
            if field in names
        ]
        needle = params["search"].lower()
        ids = [
            row["id"]
            for row in queryset.values("id", *fields).iterator()
            if any(needle in str(row[field]).lower() for field in fields)
        ]
        queryset = queryset.filter(pk__in=ids)
    return queryset.order_by("id")
