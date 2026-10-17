import json

from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.http import HttpResponse, JsonResponse
from django.middleware.csrf import get_token
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from .common import authenticated, filtered, payload, serialize
from .forms import AgentForm, EquipmentForm
from .models import Agent, Equipment


@require_http_methods(["GET", "POST", "DELETE"])
def session(request):
    if request.method == "POST":
        try:
            data = payload(request)
        except (ValueError, json.JSONDecodeError):
            return JsonResponse({"error": "JSON inválido."}, status=400)
        if not isinstance(data.get("username"), str) or not isinstance(
            data.get("password"), str
        ):
            return JsonResponse({"error": "Informe usuário e senha."}, status=400)
        user = authenticate(
            request, username=data["username"], password=data["password"]
        )
        if user is None:
            return JsonResponse({"error": "Usuário ou senha inválidos."}, status=401)
        login(request, user)
    elif request.method == "DELETE":
        logout(request)
    return JsonResponse(
        {
            "authenticated": request.user.is_authenticated,
            "username": (
                request.user.get_username() if request.user.is_authenticated else ""
            ),
            "csrf": get_token(request),
        }
    )


def resource_view(model, form_type):
    @authenticated
    @require_http_methods(["GET", "POST", "PUT", "DELETE"])
    def view(request, pk=None):
        item = (
            get_object_or_404(model, pk=pk, archived=False) if pk is not None else None
        )
        if request.method == "GET":
            if item:
                return JsonResponse(serialize(item))
            try:
                page = int(request.GET.get("page", 1))
                limit = int(request.GET.get("limit", 100))
                if page < 1 or not 1 <= limit <= 200:
                    raise ValueError()
            except ValueError:
                return JsonResponse({"error": "Página ou limite inválido."}, status=400)
            query = filtered(model.objects.filter(archived=False), request.GET)
            return JsonResponse(
                {
                    "count": query.count(),
                    "results": [
                        serialize(o) for o in query[(page - 1) * limit : page * limit]
                    ],
                }
            )
        if request.method == "DELETE":
            if item is None:
                return JsonResponse({"error": "Informe o registro."}, status=405)
            item.archived = True
            item.save(update_fields=["archived", "updated_at"])
            return HttpResponse(status=204)
        if (request.method == "PUT" and item is None) or (
            request.method == "POST" and item is not None
        ):
            return JsonResponse({"error": "Operação inválida."}, status=405)
        try:
            data = payload(request)
            if isinstance(data.get("characteristics"), dict):
                data["characteristics"] = json.dumps(data["characteristics"])
            form = form_type(data, instance=item)
            if not form.is_valid():
                return JsonResponse({"errors": dict(form.errors)}, status=400)
            with transaction.atomic():
                result = form.save()
            return JsonResponse(serialize(result), status=200 if item else 201)
        except (ValueError, json.JSONDecodeError):
            return JsonResponse({"error": "JSON inválido."}, status=400)
        except IntegrityError:
            return JsonResponse(
                {"error": "Já existe um registro com essa identificação."}, status=400
            )

    return view


equipment = resource_view(Equipment, EquipmentForm)
agents = resource_view(Agent, AgentForm)
