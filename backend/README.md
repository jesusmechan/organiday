# Mi Planificador Personal — API

FastAPI para ciclos, horarios, cursos, tareas y ejercicio. En local puede usar PostgreSQL o SQLite.

## Arranque

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000/api/health
- Docs: http://localhost:8000/docs

## PostgreSQL local (pgAdmin)

Tu servidor 16 está en el puerto **5432**. Crea un usuario y una base para la app (no uses la contraseña de `postgres` en el proyecto).

**En pgAdmin**

1. **Login/Group Roles** → clic derecho → Create → Login/Group Role  
   - General → Name: `organi`  
   - Definition → Password: `organi_local`  
   - Privileges → Can login: **Yes** → Save
2. **Databases** → clic derecho → Create → Database  
   - Database: `organi_day`  
   - Owner: `organi` → Save
3. Con `organi_day` seleccionada, Query Tool, ejecuta `scripts/init_postgres_schema.sql`.
4. En `backend/` copia `.env.example` a `.env`.
5. Reinicia uvicorn. Las tablas se crean solas; en pgAdmin recarga `organi_day` → Schemas → public → Tables.

Si prefieres SQL en vez de la interfaz: `scripts/init_postgres.sql` (el `CREATE DATABASE` hay que ejecutarlo **solo**, no junto al `DO`).

## Docker / Render

Desde la raíz del repo (no desde `backend/`):

```bash
docker build -t organi-day .
docker run --rm -p 10000:10000 -e SECRET_KEY=cambia-esto organi-day
```

En Render crea un **Web Service** con runtime **Docker** y una **PostgreSQL**:

- Health check: `/api/health`
- `SECRET_KEY`: un valor largo y secreto
- Enlaza la Postgres al servicio (o pega la **Internal Database URL** en `DATABASE_URL`)

Los datos viven en Postgres, fuera del contenedor: un deploy nuevo no los borra. `PORT` lo pone Render.

## Endpoints principales

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/planner` | Estado completo del ciclo seleccionado |
| GET | `/api/planner?termId=` | Estado de un ciclo |
| POST | `/api/planner/generate` | Genera un horario por fechas y derivados |
| GET/POST | `/api/terms` | Listar o crear ciclos |
| PUT | `/api/terms/{id}` | Editar fechas y nombre |
| POST | `/api/terms/{id}/select` | Abrir un ciclo |
| POST | `/api/blocks` `/api/courses` `/api/tasks` | Crear ítems |
| POST | `/api/checks` `/api/exercise-logs` | Marcar hechos |

Los JSON usan camelCase, igual que la PWA (`startDate`, `termId`, `dayOfWeek`).

## Generar horario

`POST /api/planner/generate`

```json
{
  "name": "Ciclo 2027-I",
  "startDate": "2027-03-01",
  "endDate": "2027-07-31",
  "mode": "new",
  "work": [
    { "dayOfWeek": 1, "enabled": true, "start": "08:00", "end": "18:00" }
  ],
  "courses": [
    {
      "name": "Java Script Avanzado",
      "shortName": "JS",
      "modality": "presencial",
      "sessions": [{ "dayOfWeek": 1, "start": "18:30", "end": "20:00", "location": "C0501" }]
    }
  ],
  "exercises": [],
  "deriveMeals": true,
  "deriveCommute": true,
  "deriveSleep": true,
  "createCourseTasks": true
}
```

`modality` puede ser `presencial`, `virtual-live` o `virtual-247`.

## Base de datos

**Local:** PostgreSQL `organi_day` (usuario `organi`) vía `backend/.env`. Sin `.env`, SQLite en `backend/data/planner.db`.

**Render:** PostgreSQL. El servicio lee `DATABASE_URL` (`postgres://…` se convierte sola).
