# Organi Day — imagen para Render (PWA + API en un solo servicio).
#
# En Render:
#   1. New → PostgreSQL (anótala; Render inyecta DATABASE_URL al enlazarla)
#   2. New → Web Service → Docker
#        Dockerfile path: Dockerfile
#        Docker context: .
#        Health check: /api/health
#   3. En el Web Service → Environment:
#        SECRET_KEY = un valor largo y secreto
#        DATABASE_URL = Internal Database URL de la Postgres
#        (o enlaza la base al servicio y Render la pone sola)
#
# Variables:
#   SECRET_KEY     obligatorio en producción
#   DATABASE_URL   Postgres de Render (postgres://… se adapta sola)
#   CORS_ORIGINS   opcional; el front y la API son el mismo origen
#   PORT           lo asigna Render
#
# En local, sin DATABASE_URL, sigue usando SQLite.

# --- build de la PWA ---
FROM node:22-bookworm-slim AS frontend
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build -- --configuration production

# --- runtime ---
FROM python:3.11-slim-bookworm
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000 \
    STATIC_DIR=/app/static

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY --from=frontend /web/dist/organi-day/browser ./static

EXPOSE 10000

CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}"]
