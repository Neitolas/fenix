"""Cria certificado somente para testes locais do conjunto HTTPS."""

import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent.parent / "infra" / "tls"
root.mkdir(parents=True, exist_ok=True)
if (root / "key.pem").exists() or (root / "cert.pem").exists():
    raise SystemExit(
        "Certificado existente preservado. Remova-o explicitamente para renovar."
    )
subprocess.run(
    [
        "openssl",
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "7",
        "-keyout",
        str(root / "key.pem"),
        "-out",
        str(root / "cert.pem"),
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
    ],
    check=True,
)
(root / "key.pem").chmod(0o600)
print("Certificado local criado em infra/tls; não é válido para hospedagem pública.")
