FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential pkg-config default-libmysqlclient-dev && rm -rf /var/lib/apt/lists/*
COPY requirements*.txt ./
RUN pip install --no-cache-dir -r requirements-production.txt
COPY . .
RUN mkdir -p /app/staticfiles && useradd --system --uid 10001 --create-home fenix && chown -R fenix:fenix /app
USER fenix
ENV DJANGO_SETTINGS_MODULE=config.settings_production
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "2", "--no-control-socket"]
