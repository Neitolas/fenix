import json
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone


class ApiCase(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            "operador", password="testing-strong-password"
        )
        self.client.force_login(self.user)
        self.equipment = dict(
            kind="camera",
            serial="CAM-001",
            brand="Marca",
            model="Modelo",
            agency="Trânsito",
            postal_code="17500000",
            neighborhood="Centro",
            region="Central",
            city="Marília",
            state="SP",
            street="Rua Teste",
            reference="S/N",
            latitude=-22.21,
            longitude=-49.94,
            status="operational",
            maintenance="none",
            characteristics={"night_vision": True},
        )

    def post(self, path, data):
        return self.client.post(
            path, data=json.dumps(data), content_type="application/json"
        )

    def create(self):
        response = self.post("/api/equipment/", self.equipment)
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()


class InventoryTests(ApiCase):
    def test_equipment_crud_and_soft_delete(self):
        item = self.create()
        listing = self.client.get("/api/equipment/?search=CAM-001").json()
        self.assertEqual(listing["count"], 1)
        changed = self.equipment | {"brand": "Outra"}
        response = self.client.put(
            f"/api/equipment/{item['id']}/",
            json.dumps(changed),
            content_type="application/json",
        )
        self.assertEqual(response.json()["brand"], "Outra")
        self.assertEqual(
            self.client.delete(f"/api/equipment/{item['id']}/").status_code, 204
        )
        self.assertEqual(self.client.get("/api/equipment/").json()["count"], 0)

    def test_rejects_duplicate_and_invalid_coordinates(self):
        self.create()
        self.assertEqual(self.post("/api/equipment/", self.equipment).status_code, 400)
        for value in [91, "NaN", "", "Infinity"]:
            response = self.post(
                "/api/equipment/",
                self.equipment | {"serial": str(value), "latitude": value},
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn("latitude", response.json()["errors"])

    def test_scheduled_maintenance_requires_date(self):
        response = self.post(
            "/api/equipment/", self.equipment | {"maintenance": "scheduled"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("next_maintenance", response.json()["errors"])

    def test_authentication_and_csrf(self):
        self.assertEqual(Client().get("/api/equipment/").status_code, 401)
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(
            client.post(
                "/api/equipment/", "{}", content_type="application/json"
            ).status_code,
            403,
        )

    def test_agent_validation_and_uniqueness(self):
        agent = dict(
            name="Agente de demonstração",
            registration="A-01",
            agency="Trânsito",
            role="Agente",
            status="active",
            neighborhood="Centro",
            region="Central",
            latitude=-22.2,
            longitude=-49.9,
        )
        response = self.post("/api/agents/", agent)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.post("/api/agents/", agent).status_code, 400)
        self.assertEqual(self.client.get("/api/agents/").json()["count"], 1)

    def test_invalid_page_and_json_return_client_error(self):
        self.assertEqual(self.client.get("/api/equipment/?page=abc").status_code, 400)
        self.assertEqual(
            self.client.post(
                "/api/equipment/", "{bad", content_type="application/json"
            ).status_code,
            400,
        )

    def test_session_login_and_logout(self):
        client = Client()
        self.assertFalse(client.get("/api/session/").json()["authenticated"])
        response = client.post(
            "/api/session/",
            json.dumps({"username": "operador", "password": "testing-strong-password"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["authenticated"])
        self.assertEqual(client.delete("/api/session/").status_code, 200)


class OperationsTests(ApiCase):
    def test_delayed_state_and_positions_have_independent_ordering_and_history(self):
        item = self.create()
        now = timezone.now()
        base = {"resource": "equipment", "resource_id": item["id"]}
        def send(name, kind, minutes, **values):
            response = self.post("/api/events/", base | {
                "external_id": name, "kind": kind,
                "timestamp": (now - timedelta(minutes=minutes)).isoformat(),
            } | values)
            self.assertEqual(response.status_code, 201)
            return response.json()
        send("beat", "heartbeat", 0)
        send("failure", "failure", 1)
        send("older-recovery", "recovery", 2)
        self.assertEqual(self.client.get(f"/api/equipment/{item['id']}/").json()["status"], "fault")
        first = send("position1", "position", 1, latitude=-22, longitude=-49)
        send("position2", "position", 0, latitude=-23, longitude=-50)
        send("old-position", "position", 2, latitude=-24, longitude=-51)
        self.assertEqual(first["latitude"], -22)
        current = self.client.get(f"/api/equipment/{item['id']}/").json()
        self.assertEqual(current["latitude"], -23)
        history = self.client.get("/api/events/").json()["results"]
        self.assertEqual(next(e for e in history if e["external_id"] == "failure")["status"], "fault")
        send("recovery", "recovery", 0)
        send("completion", "maintenance_done", 0.5)
        current = self.client.get(f"/api/equipment/{item['id']}/").json()
        self.assertEqual(current["status"], "operational")
        self.assertEqual(current["maintenance"], "none")

    def test_event_updates_state_and_is_idempotent(self):
        item = self.create()
        event = {
            "resource": "equipment",
            "resource_id": item["id"],
            "kind": "failure",
            "external_id": "ev-1",
        }
        first = self.post("/api/events/", event)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(self.post("/api/events/", event).status_code, 200)
        self.assertEqual(self.client.get("/api/events/").json()["count"], 1)
        self.assertEqual(
            self.client.get(f"/api/equipment/{item['id']}/").json()["status"], "fault"
        )
        self.client.delete(f"/api/equipment/{item['id']}/")
        self.assertEqual(
            self.post("/api/events/", event | {"external_id": "ev-2"}).status_code, 404
        )
        self.assertEqual(self.client.get("/api/events/").json()["count"], 1)

    def test_prevention_explains_score_without_fabricating_probability(self):
        item = self.create()
        yesterday = (timezone.localdate() - timedelta(days=1)).isoformat()
        self.client.put(
            f"/api/equipment/{item['id']}/",
            json.dumps(
                self.equipment
                | {"maintenance": "scheduled", "next_maintenance": yesterday}
            ),
            content_type="application/json",
        )
        self.post(
            "/api/events/",
            {
                "resource": "equipment",
                "resource_id": item["id"],
                "kind": "failure",
                "external_id": "ev-risk",
            },
        )
        data = self.client.get("/api/prevention/").json()["results"][0]
        self.assertEqual(data["score"], 50)
        self.assertEqual(data["level"], "high")
        self.assertEqual(len(data["factors"]), 2)
        self.assertNotIn("probability", data)

    def test_dashboard_filters_and_empty_denominator(self):
        self.assertIsNone(self.client.get("/api/dashboard/").json()["availability"])
        self.create()
        data = self.client.get("/api/dashboard/").json()
        self.assertEqual(data["availability"], 100)
        self.assertEqual(data["operational"], 1)
        self.assertEqual(
            self.client.get("/api/dashboard/?neighborhood=Outro").json()["total"], 0
        )

    def test_future_and_mismatched_duplicate_event_rejected(self):
        item = self.create()
        event = {
            "resource": "equipment",
            "resource_id": item["id"],
            "kind": "heartbeat",
            "external_id": "same",
        }
        self.assertEqual(
            self.post(
                "/api/events/",
                event | {"timestamp": (timezone.now() + timedelta(days=2)).isoformat()},
            ).status_code,
            400,
        )
        self.assertEqual(self.post("/api/events/", event).status_code, 201)
        self.assertEqual(
            self.post("/api/events/", event | {"kind": "failure"}).status_code, 409
        )

    def test_score_boundaries_and_missing_history(self):
        from operations.models import Equipment
        from operations.services import attention

        item = self.create()
        obj = Equipment.objects.get(pk=item["id"])
        self.assertEqual(attention(obj)["score"], 0)
        obj.maintenance = "immediate"
        obj.last_seen = timezone.now() - timedelta(minutes=31)
        self.assertEqual(attention(obj)["score"], 55)


class ReportTests(ApiCase):
    def test_accented_search_matches_inventory_and_report_payload(self):
        import os
        from unittest.mock import patch, MagicMock
        self.create()
        self.assertEqual(self.client.get("/api/equipment/?search=TRÂNSITO").json()["count"], 1)
        service = MagicMock()
        service.__enter__.return_value.headers = {"Content-Type": "text/csv"}
        service.__enter__.return_value.read.return_value = b"csv"
        with patch.dict(os.environ, {"REPORT_SERVICE_TOKEN": "test-only"}), patch("operations.reports.urlopen", return_value=service) as send:
            response = self.client.get("/api/reports/equipment.csv?search=TRÂNSITO")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(json.loads(send.call_args.args[0].data)["rows"]), 1)

    def test_report_service_unavailable_is_explicit(self):
        response = self.client.get("/api/reports/equipment.csv")
        self.assertEqual(response.status_code, 503)
        self.assertIn("relatórios", response.json()["error"])


class PerformanceTests(ApiCase):
    def test_prevention_does_not_query_each_resource(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        from operations.models import Equipment

        for i in range(20):
            Equipment.objects.create(**self.equipment | {"serial": f"PERF-{i}"})
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get("/api/prevention/")
        self.assertEqual(response.status_code, 200)
        self.assertLess(len(queries), 12)
