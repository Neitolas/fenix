import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase


class ProductionSettingsTests(SimpleTestCase):
    def run_check(self, **changes):
        env = (
            os.environ
            | {
                "DJANGO_SETTINGS_MODULE": "config.settings_production",
                "DJANGO_DEBUG": "false",
                "DJANGO_HSTS_INCLUDE_SUBDOMAINS": "true",
                "DJANGO_HSTS_PRELOAD": "true",
                "DJANGO_HSTS_SECONDS": "31536000",
                "DJANGO_SECRET_KEY": "test-only-production-check-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ",
                "DJANGO_ALLOWED_HOSTS": "fenix.example.org",
                "REPORT_SERVICE_TOKEN": "test-only-report-token-0123456789-abcdefghijklmnop",
                "DB_ENGINE": "sqlite",
            }
            | changes
        )
        return subprocess.run(
            [
                sys.executable,
                "manage.py",
                "check",
                "--deploy",
                "--fail-level",
                "WARNING",
            ],
            cwd=Path(__file__).resolve().parent.parent,
            env=env,
            capture_output=True,
            text=True,
            timeout=15,
        )

    def test_production_passes_deployment_checks(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_production_rejects_weak_secret(self):
        result = self.run_check(DJANGO_SECRET_KEY="weak")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stderr)

    def test_production_rejects_wildcard_hosts(self):
        for hosts in ["*", ".example.org", "*.example.org"]:
            with self.subTest(hosts=hosts):
                result = self.run_check(DJANGO_ALLOWED_HOSTS=hosts)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("DJANGO_ALLOWED_HOSTS", result.stderr)

    def test_production_rejects_default_report_token(self):
        result = self.run_check(REPORT_SERVICE_TOKEN="local-reports-development-only")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("REPORT_SERVICE_TOKEN", result.stderr)
