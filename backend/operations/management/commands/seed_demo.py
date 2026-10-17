from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from operations.models import Agent, Equipment, Event


class Command(BaseCommand):
    help = "Cria dados fictícios e idempotentes para demonstração."

    def handle(self, *args, **options):
        now = timezone.now()
        today = timezone.localdate()
        for i in range(12):
            neighborhood = ["Centro", "Fragata", "Palmital"][i % 3]
            item, _ = Equipment.objects.get_or_create(
                serial=f"DEMO-{i + 1:03}",
                defaults=dict(
                    kind=["camera", "radar", "patrol", "terminal"][i % 4],
                    brand="Demonstração",
                    model=f"Modelo {i + 1}",
                    agency=["Trânsito", "Guarda Municipal"][i % 2],
                    postal_code="17500000",
                    neighborhood=neighborhood,
                    region=["Central", "Sul", "Norte"][i % 3],
                    city="Marília",
                    state="SP",
                    street="Via demonstrativa",
                    reference="Local fictício",
                    latitude=-22.21 + (i % 4) * 0.007,
                    longitude=-49.95 + (i // 4) * 0.009,
                    status=[
                        "operational",
                        "operational",
                        "fault",
                        "maintenance",
                        "not_installed",
                        "disabled",
                    ][i % 6],
                    maintenance=(
                        "immediate"
                        if i % 6 == 2
                        else "scheduled"
                        if i % 3 == 0
                        else "none"
                    ),
                    next_maintenance=(
                        today + timedelta(days=i - 4) if i % 3 == 0 else None
                    ),
                    characteristics=(
                        {"speed_limit": 60}
                        if i % 4 == 1
                        else {"night_vision": True}
                        if i % 4 == 0
                        else {}
                    ),
                ),
            )
            for days in [1, 4, 9]:
                if i % 3 == 0:
                    Event.objects.get_or_create(
                        external_id=f"demo-{i}-{days}",
                        defaults=dict(
                            equipment=item,
                            kind="failure",
                            timestamp=now - timedelta(days=days),
                            origin="demonstração",
                            description="Evento fictício para validar análises.",
                        ),
                    )
        for i in range(6):
            Agent.objects.get_or_create(
                registration=f"DEMO-A{i + 1}",
                agency="Trânsito",
                defaults=dict(
                    name=f"Agente demonstrativo {i + 1}",
                    role="Agente de trânsito",
                    status=["active", "available", "incident", "off_duty"][i % 4],
                    neighborhood=["Centro", "Fragata", "Palmital"][i % 3],
                    region=["Central", "Sul", "Norte"][i % 3],
                    latitude=-22.205 + i * 0.005,
                    longitude=-49.935 + i * 0.003,
                ),
            )
        self.stdout.write(
            self.style.SUCCESS(
                "Demonstração pronta: registros existentes foram preservados."
            )
        )
