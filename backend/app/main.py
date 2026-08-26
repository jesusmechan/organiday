from contextlib import asynccontextmanager
from mimetypes import guess_type
from os import getenv
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from . import models  # noqa: F401
from .config import settings
from .database import migrate_schema
from .routers.api import router
from .routers.auth import router as auth_router

STATIC_DIR = Path(getenv("STATIC_DIR", str(Path(__file__).resolve().parent.parent / "static")))
RESERVED_SPA = {"api", "docs", "redoc", "openapi.json"}
STATIC_TYPES = {
    ".js": "application/javascript",
    ".mjs": "application/javascript",
    ".css": "text/css",
    ".html": "text/html",
    ".json": "application/json",
    ".webmanifest": "application/manifest+json",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
}

OPENAPI_TAGS = [
    {"name": "Cuenta", "description": "Registro, inicio de sesión y perfil."},
    {"name": "Sistema", "description": "Salud del servicio y estado general."},
    {"name": "Planificador", "description": "Estado completo, generación de horario y reinicio."},
    {"name": "Ciclos", "description": "Periodos académicos con fechas de vigencia."},
    {"name": "Horario", "description": "Bloques de tiempo del calendario semanal."},
    {"name": "Cursos", "description": "Materias de la matrícula."},
    {"name": "Tareas", "description": "Pendientes de estudio y registros de horas."},
    {"name": "Ejercicio", "description": "Sesiones planificadas y bitácora de cumplimiento."},
    {"name": "Rutinas", "description": "Despertar, sueño y carga de cada día."},
    {"name": "Checklist", "description": "Marcas de bloques hechos en una fecha."},
    {"name": "Excepciones", "description": "Feriados, días sin trabajo, juntas y exámenes de una fecha."},
    {"name": "Temas", "description": "Exámenes, prácticas y temas por curso."},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate_schema()
    yield


app = FastAPI(
    title="Mi Planificador Personal",
    summary="API del planificador de trabajo, universidad y ejercicio.",
    description=(
        "Administra ciclos, horarios, cursos, tareas y ejercicio.\n\n"
        "- **Swagger UI:** [/docs](/docs)\n"
        "- **ReDoc:** [/redoc](/redoc)\n"
        "- **OpenAPI JSON:** [/openapi.json](/openapi.json)"
    ),
    version="1.0.0",
    contact={"name": "Mi Planificador Personal"},
    license_info={"name": "Uso personal"},
    openapi_tags=OPENAPI_TAGS,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth")
app.include_router(router, prefix="/api")


def _spa_index() -> FileResponse | RedirectResponse:
    index = STATIC_DIR / "index.html"
    if index.is_file():
        return FileResponse(index, media_type="text/html")
    return RedirectResponse("/docs")


def _static_response(path: Path) -> FileResponse:
    media = STATIC_TYPES.get(path.suffix.lower()) or guess_type(path.name)[0]
    return FileResponse(path, media_type=media)


@app.get("/", include_in_schema=False)
def root():
    return _spa_index()


@app.get("/{full_path:path}", include_in_schema=False)
def spa(full_path: str):
    first = full_path.split("/", 1)[0]
    if first in RESERVED_SPA:
        raise HTTPException(status_code=404, detail="Not Found")
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        raise HTTPException(status_code=404, detail="Not Found")
    candidate = (STATIC_DIR / full_path).resolve()
    try:
        candidate.relative_to(STATIC_DIR.resolve())
    except ValueError as error:
        raise HTTPException(status_code=404, detail="Not Found") from error
    if candidate.is_file():
        return _static_response(candidate)
    if Path(full_path).suffix:
        raise HTTPException(status_code=404, detail="Not Found")
    return FileResponse(index, media_type="text/html")
