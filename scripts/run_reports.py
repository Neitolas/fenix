import os
import subprocess
from pathlib import Path
from dotenv import load_dotenv

root = Path(__file__).resolve().parent.parent
load_dotenv(root / ".env")
if not os.getenv("REPORT_SERVICE_TOKEN"):
    raise SystemExit("Defina REPORT_SERVICE_TOKEN em .env antes de iniciar relatórios.")
subprocess.run(
    ["php", "-S", "127.0.0.1:9080", str(root / "reports-php/index.php")],
    cwd=root / "reports-php",
    check=True,
)
