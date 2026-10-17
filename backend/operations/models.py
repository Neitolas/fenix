from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

KINDS = [
    (v, label)
    for v, label in [
        ("camera", "Câmera"),
        ("radar", "Radar"),
        ("scale", "Balança"),
        ("parking_vehicle", "Fiscalização de estacionamento"),
        ("gate", "Cancela"),
        ("transport", "Veículo de transporte"),
        ("terminal", "Totem"),
        ("scooter", "Patinete"),
        ("motorcycle", "Moto de agente"),
        ("patrol", "Viatura"),
        ("other", "Outro"),
    ]
]
STATUSES = [
    ("not_installed", "Não instalado"),
    ("operational", "Operacional"),
    ("fault", "Mau funcionamento"),
    ("maintenance", "Em manutenção"),
    ("disabled", "Desativado"),
    ("stolen", "Furtado"),
]
MAINTENANCE = [
    ("none", "Nenhuma"),
    ("immediate", "Imediata"),
    ("scheduled", "Programada"),
]
AGENT_STATUSES = [
    ("active", "Em atividade"),
    ("available", "Disponível"),
    ("incident", "Em ocorrência"),
    ("off_duty", "Fora de serviço"),
]


class Resource(models.Model):
    agency = models.CharField(max_length=100)
    neighborhood = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    latitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=7,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    last_seen = models.DateTimeField(null=True, blank=True)
    archived = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Equipment(Resource):
    kind = models.CharField(max_length=30, choices=KINDS)
    serial = models.CharField(max_length=80, unique=True)
    brand = models.CharField(max_length=80)
    model = models.CharField(max_length=80)
    postal_code = models.CharField(max_length=9)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=2)
    street = models.CharField(max_length=150)
    reference = models.CharField(max_length=150)
    status = models.CharField(max_length=20, choices=STATUSES, default="not_installed")
    maintenance = models.CharField(max_length=12, choices=MAINTENANCE, default="none")
    next_maintenance = models.DateField(null=True, blank=True)
    characteristics = models.JSONField(default=dict, blank=True)


class Agent(Resource):
    name = models.CharField(max_length=100)
    registration = models.CharField(max_length=50)
    role = models.CharField(max_length=80)
    status = models.CharField(
        max_length=15, choices=AGENT_STATUSES, default="available"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["agency", "registration"], name="agent_agency_registration"
            )
        ]


class Event(models.Model):
    equipment = models.ForeignKey(
        Equipment,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="events",
    )
    agent = models.ForeignKey(
        Agent, null=True, blank=True, on_delete=models.PROTECT, related_name="events"
    )
    kind = models.CharField(
        max_length=25,
        choices=[
            (k, k)
            for k in [
                "heartbeat",
                "failure",
                "recovery",
                "position",
                "maintenance_done",
            ]
        ],
    )
    external_id = models.CharField(max_length=100, unique=True)
    timestamp = models.DateTimeField()
    origin = models.CharField(max_length=80, default="manual")
    description = models.CharField(max_length=250, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, blank=True)

    class Meta:
        ordering = ["-timestamp", "-id"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(equipment__isnull=False, agent__isnull=True)
                    | models.Q(equipment__isnull=True, agent__isnull=False)
                ),
                name="event_one_resource",
            )
        ]
