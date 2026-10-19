import json
from datetime import timedelta
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from operations.models import Agent, Equipment, Event


class Command(BaseCommand):
    help = (
        "Cria exemplos coerentes e atualiza somente rótulos antigos não personalizados."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        catalog = json.loads(
            (Path(__file__).resolve().parents[2] / "demo_catalog.json").read_text()
        )
        now = timezone.now()
        today = timezone.localdate()
        for i, example in enumerate(catalog["equipment"]):
            item = Equipment.objects.filter(serial=example["serial"]).first()
            if item is None:
                item = Equipment.objects.filter(serial=f"DEMO-{i + 1:03}").first()
                if (
                    item
                    and item.brand == "Demonstração"
                    and item.model == f"Modelo {i + 1}"
                ):
                    replacements = {
                        "serial": f"DEMO-{i + 1:03}",
                        "brand": "Demonstração",
                        "model": f"Modelo {i + 1}",
                        "street": "Via demonstrativa",
                        "reference": "Local fictício",
                    }
                    for field, old in replacements.items():
                        if getattr(item, field) == old:
                            setattr(item, field, example[field])
                    item.save()
            if item is None:
                item = Equipment.objects.create(
                    **example,
                    status=[
                        "operational",
                        "operational",
                        "fault",
                        "maintenance",
                        "not_installed",
                        "disabled",
                    ][i % 6],
                    maintenance="immediate"
                    if i % 6 == 2
                    else "scheduled"
                    if i % 3 == 0
                    else "none",
                    next_maintenance=today + timedelta(days=i - 4)
                    if i % 3 == 0
                    else None,
                    characteristics={"speed_limit": 60}
                    if i % 4 == 1
                    else {"night_vision": True}
                    if i % 4 == 0
                    else {},
                )
            if i % 3 == 0:
                for days in [1, 4, 9]:
                    Event.objects.get_or_create(
                        external_id=f"demo-{i}-{days}",
                        defaults=dict(
                            equipment=item,
                            kind="failure",
                            timestamp=now - timedelta(days=days),
                            origin="demonstração",
                            description=f"Inspeção demonstrativa: falha registrada em {item.model}."[
                                :250
                            ],
                        ),
                    )
        for i, example in enumerate(catalog["agents"]):
            agent = Agent.objects.filter(
                registration=example["registration"], agency=example["agency"]
            ).first()
            if agent is None:
                agent = Agent.objects.filter(
                    registration=f"DEMO-A{i + 1}", agency="Trânsito"
                ).first()
                if agent and agent.name == f"Agente demonstrativo {i + 1}":
                    agent.name = example["name"]
                    agent.registration = example["registration"]
                    agent.save(update_fields=["name", "registration", "updated_at"])
            if agent is None:
                Agent.objects.create(
                    **example,
                    status=["active", "available", "incident", "off_duty"][i % 4],
                )
        self.stdout.write(
            self.style.SUCCESS(
                "Demonstração pronta: exemplos atualizados e personalizações preservadas."
            )
        )
