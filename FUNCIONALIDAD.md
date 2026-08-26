# Organi Day — guía de funcionalidad

Planificador personal para **trabajo, universidad, estudio y ejercicio**. La interfaz está en español. Arranca vacío: tú cargas los datos.

Es una **PWA** (Angular 19) con **API FastAPI** y **PostgreSQL**. En local el frontend habla con `http://127.0.0.1:8000/api`. En producción (Docker / Render) la PWA y la API van en el mismo origen (`/api`). Si el servidor no responde, la barra superior avisa y puedes reintentar.

---

## Cómo correrlo

**Backend** (desde `backend/`, con el entorno virtual activo):

```bash
python -m uvicorn app.main:app --reload --port 8000
```

- API: http://127.0.0.1:8000/api/health
- Swagger: http://127.0.0.1:8000/docs
- Base de datos: PostgreSQL. En local `organi_day` (`backend/.env`); en Render `organiday-db` (`DATABASE_URL`).

**Frontend** (desde `frontend/`):

```bash
npm start
```

Abre http://localhost:4200/. Entras con correo y contraseña. En un build de producción se puede instalar en el celular (banner “Instálala en tu celular”).

**Docker / Render** (desde la raíz del repo):

```bash
docker build -t organi-day .
docker run --rm -p 10000:10000 -e SECRET_KEY=cambia-esto organi-day
```

En Render: Web Service con runtime Docker, health check `/api/health`, `SECRET_KEY` y una **PostgreSQL** enlazada (`DATABASE_URL`). Los datos no se pierden al redesplegar.

---

## Cuenta

Cada persona tiene su propio horario. Sin iniciar sesión no se ve ni se guarda nada.

- **Crear cuenta** en `/entrar`: nombre, correo y contraseña (mínimo 6 caracteres).
- **Entrar** con el mismo correo. El access token dura 15 minutos; el refresh token mantiene la sesión 30 días y se rota en cada renovación.
- **Salir** en la barra superior cierra la sesión y anula el refresh token.
- Restaurar un JSON y vaciar el planificador solo afectan **tu** cuenta.
- La primera cuenta que se registre en una base que ya tenía ciclos (sin usuario) hereda esos datos. Las siguientes empiezan vacías.

La API exige `Authorization: Bearer …` (access token) en todo, salvo `/api/health`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh` y `/api/auth/logout`.

---

## Idea general

Un **ciclo** es un periodo con fechas (por ejemplo “2027-I”). Dentro van:

- un **horario semanal** de bloques (trabajo, clases, ejercicio, comidas, traslados, sueño, estudio, personal);
- **cursos** de la matrícula;
- **tareas** y **temas / exámenes**;
- **sesiones de ejercicio** y su bitácora;
- **excepciones** de un día concreto (feriado, sin trabajo, junta, examen, otro).

El **constructor de horario** arma el ciclo a partir de trabajo, clases y ejercicio. El resto de pantallas sirve para **vivir el día**: marcar lo hecho, ajustar un bloque, ver huecos y entregas.

La navegación inferior: **Hoy**, **Semana**, **Tareas**, **Ejercicio**, **Análisis**. **Ciclos** y **Nuevo horario** se abren desde el chip del ciclo (arriba) o desde esas pantallas.

---

## Conceptos

### Ciclo (term)

Tiene nombre, fecha de inicio, fecha de fin y **días protegidos** (por defecto jueves). En esos días el motor **no sugiere estudio extra**.

Estado según la fecha de hoy:

| Estado   | Significado                         |
|----------|-------------------------------------|
| Vigente  | Hoy está entre inicio y fin         |
| Próximo  | Aún no empieza                      |
| Cerrado  | Ya terminó                          |

Solo hay un ciclo **seleccionado**. El resto de la app muestra ese ciclo.

### Bloque de tiempo

Un tramo con título, categoría, día de la semana, inicio y fin. Puede ser:

- **recurrente** (todas las semanas del ciclo);
- **suelto** (`date`): solo esa fecha.

Categorías: trabajo, universidad, virtual, ejercicio, estudio, comida, traslado, personal, sueño.

### Checklist

Cada bloque se marca **hecho o no** por fecha. El **sueño no entra** en el porcentaje del día.

No se puede marcar un bloque (ni el ejercicio) **antes de su hora de inicio**. Un día futuro tampoco. Desmarcar sí está permitido.

### Excepción de fecha

Anota algo especial en un día. Tipos:

| Tipo        | Uso típico              | Efecto extra                          |
|-------------|-------------------------|---------------------------------------|
| Feriado     | Día no laboral          | Oculta trabajo y traslados ese día    |
| Sin trabajo | Ausencia / día libre    | Igual: oculta trabajo y traslados     |
| Junta       | Reunión puntual         | Solo se muestra el aviso              |
| Examen      | Evaluación              | Solo se muestra el aviso              |
| Otro        | Cualquier nota          | Solo se muestra el aviso              |

### Omisión (skip)

Oculta un bloque **solo en una fecha**, sin borrar el horario semanal. Así funciona “ocultar hoy” y “editar solo este día”.

### Curso

Nombre, abreviación, color y modalidad:

- **Presencial** — genera bloques de universidad.
- **Virtual en vivo** — genera bloques de categoría virtual.
- **Virtual 24/7** — no genera sesiones fijas; el estudio queda flexible.

### Tarea vs. tema

- **Tarea**: pendiente de estudio (prioridad, fecha, minutos estimados y registrados).
- **Tema**: examen, práctica/entrega o tema de un curso, con fecha. Se ve en Hoy y Semana el día que vence.

---

## Pantallas

### Hoy (`/hoy`)

El día de hoy, en tiempo real.

- Fecha, ciclo, carga (ligero / equilibrado / sobrecargado) y **porcentaje** de bloques hechos.
- Bloque **actual** y **siguiente**.
- **Hueco siguiente** de 45 minutos o más (si queda alguno después de ahora).
- Timeline del día: marcar, editar, ver tipo (trabajo, clase, etc.).
- Excepción del día y **entregas / exámenes** que vencen hoy.
- Ejercicio de hoy: hecho o “no pude” (con motivo).
- Sugerencias de estudio para hoy, si hay huecos y tareas pendientes.

Sin ciclo, invita a crear un horario.

### Semana (`/semana`)

El horario de **cualquier fecha**, no solo la semana actual.

- **Tira de la semana** (Lun–Dom con número de día). Hoy está marcado. Puntos si hay entregas o excepciones.
- **Timeline** del día elegido: mismos checks y editor que en Hoy.
- **Calendario mensual** al lado (en celular, debajo): cambiar de mes, tocar un día, volver a hoy. Los días del ciclo se distinguen de los que quedan fuera.
- **Huecos** de ese día (45 min o más).
- **Agregar un bloque suelto** a esa fecha (categoría personal).
- **Excepción** de esa fecha: crear o quitar.
- **Exportar `.ics`** de la semana **abierta** (la que estás viendo, no solo la actual).

### Tareas (`/tareas`)

- Lista de tareas del ciclo: completar, borrar, registrar minutos.
- Alta con curso, prioridad (alta / media / baja), fecha y horas estimadas.
- **Temas, prácticas y exámenes** por curso, con fecha. Se pueden marcar hechos.
- **Sugerencias de estudio**: el motor busca huecos ≥ 45 min (máximo 90 min por tramo), evita días protegidos y prioriza tareas de alta prioridad. “Aceptar” convierte la sugerencia en un bloque de estudio.

### Ejercicio (`/ejercicio`)

- Sesiones del ciclo (día, hora, tipo, intensidad, nombre).
- Marcar hecha o saltarla con motivo: cansancio, trabajo, universidad, personal, sin ganas.
- Estadísticas de la semana: horas planificadas vs. hechas, cumplimiento, mejor y peor día.
- Histórico de cumplimiento (semanas con registro).

Tipos: gym, caminata, trote, recuperación. Intensidad: recuperación, entrenamiento, sesión completa.

### Análisis (`/semana-analisis`)

Resumen de la **semana en curso**:

- Horas por tipo (trabajo, universidad, estudio, ejercicio, sueño, traslado, comida, personal, libre).
- Días sobrecargados (el generador marca un día si termina a las 22:00 o más tarde).
- Recomendaciones (no meter más en un día al límite, usar huecos para estudio, días protegidos, etc.).
- Plan de ejercicio de la semana.
- Checklist semanal (bloques hechos vs. totales, sin sueño).
- Las mismas sugerencias de estudio que en Tareas.

### Ciclos (`/ciclo`)

Tablero del ciclo abierto:

- **Resumen**: estado (Vigente / Próximo / Cerrado), fechas, avance del periodo, días que quedan, conteo de bloques / cursos / tareas abiertas.
- **Datos**: cambiar nombre y fechas.
- Si hay varios ciclos, se elige cuál está abierto.
- **Actualizar horario** → constructor en modo reemplazar (`/nuevo-horario?modo=reemplazar`). El ciclo se mantiene; se regeneran bloques, cursos, tareas de estudio, sesiones y rutinas.
- **Copiar a un ciclo nuevo** → constructor con trabajo, cursos y ejercicio; fechas a partir del día siguiente al fin del ciclo actual (`?copiar=1`).
- **Respaldo JSON**: descargar o restaurar. Restaurar **borra lo que hay** y carga el archivo.
- **Avisos del navegador**: 10 minutos antes del siguiente bloque, si la pestaña está abierta y diste permiso.
- **Zona peligrosa**: eliminar este ciclo, o vaciar todo el planificador. El modal lista el impacto.

### Nuevo horario (`/nuevo-horario`)

Asistente en cuatro pasos. Crear y actualizar son la misma pantalla.

1. **Fechas** — nombre, rango, ciclo nuevo vs. actualizar el abierto, días protegidos, copiar el ciclo visto.
2. **Trabajo** — chips Lun–Dom (atajo Lun–Vie). Horas solo en los días marcados. Si los horarios no coinciden, un botón copia las horas del primer día al resto.
3. **Cursos** — acordeón por materia: modalidad, sesiones (día, inicio, fin, aula). Virtual 24/7 no pide sesiones fijas.
4. **Ejercicio** — mismos chips; solo se editan las sesiones marcadas (hora, tipo, intensidad, nombre).

Opciones al generar:

- derivar **comidas**, **traslados** y **sueño**;
- crear **tareas de estudio** por curso (“Estudiar [abreviación]”).

No deja guardar si faltan nombre o fechas, si el fin es anterior al inicio, o si hay **cruces**: trabajo, clase y ejercicio entre sí, o con comidas y traslados derivados. El sueño no entra en ese chequeo. El API también responde **409** con la lista.

Tras generar, abre **Semana**.

---

## Cómo se arma el horario

El generador (backend y un espejo en el frontend) recorre Lun–Dom y, a partir del borrador:

1. Crea los **cursos** y los bloques de clase (salvo virtual 24/7).
2. Añade **trabajo** y **ejercicio** en los días marcados.
3. Si está activo, deriva, **en este orden por la noche**:
   - **Comidas**: desayuno/preparación antes del trabajo o en el hueco tras el ejercicio; cena **después** de llegar a casa.
   - **Traslados**: a la universidad si hay clase después del trabajo; regreso a casa al terminar la última clase.
   - **Receso** de hasta 20 min entre dos clases seguidas.
   - **Sueño** a las 23:00 o justo al terminar la cena, lo que ocurra más tarde (no cuenta en el checklist).
4. Calcula **rutina** del día: hora de despertar (aprox. 30–60 min antes de la primera actividad), hora de dormir, y si el día está sobrecargado.
5. Si pediste tareas de curso, crea una por materia.

Actualizar un ciclo **limpia** bloques, cursos, tareas, ejercicio, rutinas, excepciones y temas de ese ciclo, y vuelve a generar. Los checks y logs de ejercicio ligados a esos bloques/sesiones se pierden con el reemplazo.

---

## Editor de bloques (Hoy y Semana)

Al tocar un bloque:

- Cambiar título, horas, lugar y nota.
- **Todas las semanas**: modifica el bloque recurrente.
- **Solo este día**: oculta el original esa fecha y crea un bloque suelto.
- **Ocultar hoy**: skip, sin crear otro.
- **Quitar**: borra el bloque (en recurrentes, todas las semanas).

En Semana también se puede **agregar** un bloque suelto al día abierto.

---

## Motor de análisis (en el cliente)

No es un modelo de IA. Calcula a partir del estado:

| Salida            | Regla breve |
|-------------------|-------------|
| Hueco libre       | Entre despertar y dormir, tramos ≥ 45 min, sin sueño |
| Carga del día     | Pesado si trabajo + universidad + traslado ≥ 12 h; equilibrado ≥ 9 h |
| Sugerencia estudio| Tareas incompletas, huecos ≥ 45 min, máximo 90 min, sin días protegidos |
| Resumen semanal   | Suma de bloques + minutos de estudio registrados esta semana |
| Ejercicio         | Horas planificadas vs. logs completados de la semana |

---

## Avisos, respaldo y PWA

- **Avisos**: `Notification` del navegador, 10 min antes de cada bloque de hoy (excepto sueño). Se apagan al cerrar la pestaña: no hay push en segundo plano.
- **Respaldo**: JSON del estado completo (versión 4). Restaurar reemplaza **tu** horario, no el de otros.
- **Exportar semana**: archivo `.ics` para Calendar / Outlook.
- **PWA**: service worker; banner de instalación si el navegador lo ofrece.
- **Autocompletado** desactivado en formularios (el navegador no debe rellenar fechas ni títulos con el perfil).

---

## Modelo de datos (resumen)

| Entidad            | Qué guarda |
|--------------------|------------|
| `users`            | Cuenta: nombre, correo, contraseña cifrada |
| `refresh_tokens`   | Refresh token (hash), caducidad y revocación |
| `terms`            | Ciclo, fechas, días protegidos, dueño (`user_id`) |
| `time_blocks`      | Horario (recurrente o con `date`) |
| `courses`          | Materias |
| `tasks`            | Pendientes de estudio |
| `study_logs`       | Minutos registrados |
| `exercise_sessions`| Plan semanal de ejercicio |
| `exercise_logs`    | Hecho / saltado por fecha |
| `day_routines`     | Despertar, dormir, sobrecarga |
| `block_checks`     | Checklist por bloque y fecha |
| `day_exceptions`   | Notas de un día |
| `course_topics`    | Exámenes, prácticas, temas |
| `block_skips`      | Bloque oculto en una fecha |

JSON en camelCase (`startDate`, `termId`, `dayOfWeek`). Días: `0` = domingo … `6` = sábado (igual que `Date.getDay()`).

---

## API (`/api`)

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/health` | ¿El servidor está vivo? (público) |
| POST | `/auth/register` | Crear cuenta (`accessToken`, `refreshToken`, `user`) |
| POST | `/auth/login` | Entrar (`accessToken`, `refreshToken`, `user`) |
| POST | `/auth/refresh` | Rotar tokens con el refresh (público) |
| POST | `/auth/logout` | Anular el refresh token (público) |
| GET | `/auth/me` | Cuenta actual |
| GET | `/planner` | Estado completo (`?termId=` opcional) |
| POST | `/planner/generate` | Generar o reemplazar horario |
| POST | `/planner/import` | Restaurar JSON |
| DELETE | `/planner` | Vaciar todo |
| GET/POST | `/terms` | Listar / crear ciclo |
| PUT | `/terms/{id}` | Nombre, fechas, días protegidos |
| POST | `/terms/{id}/select` | Abrir un ciclo |
| DELETE | `/terms/{id}` | Borrar ciclo |
| POST/PUT/DELETE | `/blocks` | Bloques |
| POST/DELETE | `/courses` | Cursos |
| POST/PUT/DELETE | `/tasks` | Tareas |
| POST | `/study-logs` | Minutos de estudio |
| POST | `/exercise-sessions` | Sesión de plan |
| POST/DELETE | `/exercise-logs` | Bitácora (upsert por fecha + sesión) |
| POST | `/routines` | Rutina del día |
| POST/DELETE | `/checks` | Checklist |
| POST/DELETE | `/exceptions` | Excepciones |
| POST/PUT/DELETE | `/topics` | Temas y exámenes |
| POST/DELETE | `/skips` | Ocultar / mostrar un bloque en una fecha |

CORS permitido: `http://localhost:4200` y `http://127.0.0.1:4200`.

---

## Arquitectura

```
frontend/          Angular 19 (PWA, rutas lazy)
  src/app/features   Hoy, Semana, Tareas, Ejercicio, Análisis, Ciclos, constructor
  src/app/core       store, API, motor de insights, modelos
  src/app/shared     editor de bloque, modal de confirmación

backend/           FastAPI + SQLAlchemy + PostgreSQL
  app/routers/api.py   endpoints
  app/generator.py     arma bloques y rutinas
  app/services.py      persistencia e import
  app/conflicts.py     cruces (mismo criterio que el frontend)
```

El **store** (`PlannerStore`) carga `/planner` al arrancar, filtra el ciclo seleccionado y llama a la API en cada cambio. Si falla, marca `offline`.

Tema visual: fondo claro, acento cobalto. Títulos en **Outfit**; textos y controles en **Source Sans 3**.

---

## Flujo típico

1. Crear un ciclo en **Nuevo horario** (fechas, trabajo, cursos, ejercicio).
2. Revisar **Semana**: ajustar un día, agregar una junta, marcar un feriado.
3. Usar **Hoy** para el checklist y el hueco siguiente.
4. Cargar **tareas y temas**; aceptar sugerencias de estudio si encajan.
5. Registrar **ejercicio** (hecho o motivo).
6. Ver **Análisis** a mitad de semana.
7. En **Ciclos**, copiar el periodo al siguiente o descargar un JSON.

---

## Límites y notas

- Los avisos no suenan con la pestaña cerrada.
- Restaurar un JSON **reemplaza** toda la base.
- Actualizar el horario de un ciclo **regenera** bloques y derivados; excepciones y temas de ese ciclo también se limpian.
- El checklist no se puede adelantar: hay que esperar la hora de inicio (o un día ya pasado).
- Tras cambiar el esquema del backend, reinicia uvicorn para migrar columnas (`protected_days`, `date` en bloques, excepciones, temas, omisiones).
- El `README` de `frontend/` describe una etapa anterior (datos de demostración y LocalStorage). **Ya no aplica**: el estado vive en la API y arranca vacío.

El historial de cambios de código está en [`CAMBIOS.md`](CAMBIOS.md).
