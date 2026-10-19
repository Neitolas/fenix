import json
import os
from unittest import skipUnless
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .tests import ApiCase


@skipUnless(
    os.getenv("RUN_REPORT_HTTP_TESTS") == "1", "Requer serviço PHP em execução."
)
class ReportHttpTests(ApiCase):
    def test_django_exports_filtered_inventory_through_real_php(self):
        self.create()
        response = self.client.get("/api/reports/equipment.csv?search=CAM-001")
        self.assertEqual(response.status_code, 200, response.content)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn(b"CAM-001", response.content)
        self.assertIn("Trânsito".encode(), response.content)
        empty = self.client.get("/api/reports/equipment.csv?search=absent")
        self.assertEqual(empty.status_code, 200)
        self.assertNotIn(b"CAM-001", empty.content)

    def test_php_rejects_missing_authentication_and_invalid_contract(self):
        url = (
            os.getenv("REPORT_SERVICE_URL", "http://127.0.0.1:9080").rstrip("/")
            + "/export"
        )
        for authorized, payload, status in [
            (False, {}, 401),
            (True, {"rows": []}, 400),
        ]:
            headers = {"Content-Type": "application/json"}
            if authorized:
                headers["Authorization"] = (
                    "Bearer " + os.environ["REPORT_SERVICE_TOKEN"]
                )
            with self.subTest(authorized=authorized):
                with self.assertRaises(HTTPError) as error:
                    urlopen(
                        Request(
                            url, data=json.dumps(payload).encode(), headers=headers
                        ),
                        timeout=5,
                    )
                self.assertEqual(error.exception.code, status)
