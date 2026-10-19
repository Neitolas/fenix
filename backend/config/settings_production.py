# ruff: noqa: F403, F405
"""Configuração explícita para uma implantação com HTTPS."""

import os

from django.core.exceptions import ImproperlyConfigured

from .settings import *

DEBUG = False
if (
    SECRET_KEY == LOCAL_SECRET
    or SECRET_KEY.startswith("django-insecure-")
    or len(SECRET_KEY) < 50
    or len(set(SECRET_KEY)) < 5
):
    raise ImproperlyConfigured(
        "Configure DJANGO_SECRET_KEY com uma chave aleatória de pelo menos 50 caracteres."
    )
if (
    not os.getenv("DJANGO_ALLOWED_HOSTS")
    or not ALLOWED_HOSTS
    or any("*" in host or host.startswith(".") for host in ALLOWED_HOSTS)
):
    raise ImproperlyConfigured(
        "Configure DJANGO_ALLOWED_HOSTS com os domínios da aplicação, sem curinga."
    )
report_token = os.getenv("REPORT_SERVICE_TOKEN", "")
if len(report_token) < 32 or report_token == "local-reports-development-only":
    raise ImproperlyConfigured(
        "Configure REPORT_SERVICE_TOKEN com um token aleatório de pelo menos 32 caracteres."
    )

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_HSTS_SECONDS", "3600"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.getenv("DJANGO_HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
)
SECURE_HSTS_PRELOAD = os.getenv("DJANGO_HSTS_PRELOAD", "false").lower() == "true"
if SECURE_HSTS_PRELOAD and (
    not SECURE_HSTS_INCLUDE_SUBDOMAINS or SECURE_HSTS_SECONDS < 31536000
):
    raise ImproperlyConfigured(
        "HSTS preload requer subdomínios em HTTPS e DJANGO_HSTS_SECONDS de pelo menos 31536000."
    )
STATIC_ROOT = BASE_DIR / "staticfiles"
# Somente habilite quando o proxy remover o cabeçalho enviado pelo cliente.
if os.getenv("DJANGO_TRUST_PROXY_SSL_HEADER", "false").lower() == "true":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
