from unittest.mock import patch

from django.db import OperationalError
from django.test import TestCase
from django.urls import reverse


class HealthTests(TestCase):
    def test_reports_ready_when_database_is_available(self):
        response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok", "service": "fenix-api"})

    def test_reports_unavailable_without_exposing_database_details(self):
        with patch(
            "config.views.connection.cursor",
            side_effect=OperationalError("private detail"),
        ):
            response = self.client.get(reverse("health"))
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})

    def test_rejects_write_requests(self):
        self.assertEqual(self.client.post(reverse("health")).status_code, 405)
