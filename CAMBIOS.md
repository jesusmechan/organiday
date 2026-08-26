# Organi Day — qué hay implementado

Planificador personal (PWA Angular + FastAPI + PostgreSQL) para trabajo, universidad, estudio y ejercicio. La interfaz está en español. Arranca vacío: tú cargas los datos. La guía completa está en [`FUNCIONALIDAD.md`](FUNCIONALIDAD.md).

**Cómo correrlo**

- Frontend: `npm start` en `frontend/` → http://localhost:4200/
- Backend (Git Bash, desde `backend/`): `source .venv/Scripts/activate` y `python -m uvicorn app.main:app --reload --port 8000`
- En local: PostgreSQL (`backend/.env`, base `organi_day`)
- API: `http://127.0.0.1:8000/api`
- Docker (Render): `docker build -t organi-day .` y `docker run -p 10000:10000 -e SECRET_KEY=cambia-esto organi-day`. En Render enlaza una PostgreSQL (`DATABASE_URL`).

**Regla:** cada cambio nuevo se documenta abajo, en **Historial**, con fecha.

---

## Funcionalidades actuales

### Ciclos y horario semanal

- Crear un ciclo con fechas, nombre, trabajo, cursos y ejercicio.
- Actualizar el mismo ciclo (`/nuevo-horario?modo=reemplazar`) sin borrar el ciclo.
- Copiar un ciclo a uno nuevo (`?copiar=1` o botón en Ciclos): trae trabajo, cursos y ejercicio; pone fechas después del ciclo actual.
- Modalidades de curso: presencial, virtual en vivo, virtual 24/7.
- El generador arma comidas, traslados, sueño y tareas de estudio si los activas. Por la noche: regreso → cena → sueño.
- Validación de cruces (frontend y API 409): trabajo, clases, ejercicio y derivados (comidas, traslados) el mismo día; fin ≤ inicio.
- Días protegidos (por defecto jueves): el motor **no sugiere estudio extra** esos días.
- En Trabajo: tira Lun–Dom, atajo Lun–Vie, horas solo en los días marcados, copiar horas a los demás.

### Hoy y Semana

- Checklist por fecha (el sueño no entra en el porcentaje).
- Un bloque o el ejercicio no se marca hecho hasta que llegue su hora; un día futuro tampoco.
- Editar un bloque: todas las semanas, o solo ese día (oculta el original y crea uno suelto).
- Agregar un bloque suelto a un día.
- Ocultar un bloque solo hoy.
- Excepciones de fecha: feriado, sin trabajo, junta, examen u otro. Feriado / sin trabajo ocultan trabajo y traslados ese día.
- Entregas y exámenes del día visibles en Semana y Hoy.
- Calendario mensual en Semana: se ve el día, se cambia de mes y se abre esa fecha.
- Hueco siguiente en Hoy (45 min o más).
- Exportar la semana a `.ics` desde Semana.

### Tareas, temas y ejercicio

- Tareas con curso, prioridad, fecha y registro de minutos.
- Sugerencias de estudio en huecos, evitando días protegidos.
- Temas / prácticas / exámenes por curso, con fecha; se ven en el calendario el día que vencen.
- Bitácora de ejercicio (hecho / no pude + motivo). Tipo e intensidad se eligen al generar el horario.

### Análisis, respaldo y avisos

- Resumen semanal de horas, sobrecarga y recomendaciones.
- Copia de seguridad JSON (descargar / restaurar) en Ciclos. Restaurar **reemplaza** todo.
- Avisos del navegador 10 minutos antes del siguiente bloque, si la app está abierta y diste permiso.

### Sistema

- Cuentas: registro e inicio de sesión. Access token (15 min) y refresh token (30 días, rotado). Cada usuario ve solo sus ciclos.
- En local y en Render: solo PostgreSQL (`DATABASE_URL`).
- Estado vacío al inicio (`createEmptyState`).
- Aviso si el API no responde.
- Autocompletado desactivado en formularios.
- Tema claro (fondo hielo, acento cobalto).
- PWA instalable.

---

## Historial

### 2026-08-26 — Selector de hora y fecha

- En iPhone el `input type=time` nativo no cabe (muestra 8:00 a. m.). Inicio/Fin usan hora y minuto en selects.
- Las fechas (ciclo, tareas) muestran `dd/mm/aaaa` y ya no desbordan la tarjeta.

### 2026-08-26 — Autocompletar correo en Entrar

- En Entrar, el campo Correo tiene `autocomplete="on"` y no lo apaga la directiva anti-autofill.

### 2026-08-26 — Horas en iPhone

- Inicio/Fin (`type=time` y `date`) ya no tienen ancho mínimo fijo. En iPhone 12 mini caben en Trabajo, Cursos y Ejercicio.

### 2026-08-26 — Solo PostgreSQL

- La API ya no acepta SQLite. Hace falta `DATABASE_URL` (local: `backend/.env`; Render: enlazar `organiday-db`).

### 2026-08-26 — Sesión al recargar

- Recargar ya no borra la sesión si `/auth/me` falla un momento (Render dormido o red). El interceptor sigue cerrando solo si el refresh no vale.
- El service worker no trata `/api` como navegación de la PWA.

### 2026-08-26 — PWA en Render (JS/CSS)

- Los archivos `.js` y `.css` de la PWA se sirven con el tipo MIME correcto. Si no, el navegador deja la pantalla en blanco aunque `/api/health` funcione.

### 2026-08-26 — PostgreSQL local (pgAdmin)

- El backend lee `backend/.env` (`DATABASE_URL`). Usuario `organi` / base `organi_day` para ver las tablas en pgAdmin.
- SQL de arranque en `backend/scripts/init_postgres.sql` y `init_postgres_schema.sql`. Sin `.env` sigue SQLite.

### 2026-08-26 — PostgreSQL en Render

- La API acepta `DATABASE_URL` de Render (`postgres://…`), usa `psycopg` y crea las tablas al arrancar.
- En local sigue SQLite. En Render los datos viven en Postgres y no se borran al redesplegar.

### 2026-08-26 — Docker para Render

- `Dockerfile` en la raíz: construye la PWA y la sirve con FastAPI en un solo servicio (`PORT`, health `/api/health`).
- En producción el front llama a `/api` del mismo origen. SQLite queda en `/var/data` para poder montar un disco en Render.

### 2026-08-26 — Refresh token

- Login y registro devuelven `accessToken` (15 min) y `refreshToken` (30 días, opaco y hasheado en `refresh_tokens`).
- `POST /auth/refresh` rota el refresh; `POST /auth/logout` lo anula. El access JWT solo vale si lleva `typ: access`.
- El interceptor renueva la sesión en el 401 (una vez, sin duplicar llamadas en vuelo). Sesiones viejas sin refresh piden entrar de nuevo.

### 2026-08-26 — Pantalla de entrar

- Entrar pasa a una pantalla completa: marca y beneficios a un lado, formulario al otro.
- Pestañas Entrar / Crear cuenta, ver contraseña, y un aviso de error más claro.
- Autocompletado desactivado, igual que en el resto de formularios.

### 2026-08-26 — Usuarios

- Registro e inicio de sesión (`/entrar`). El token se guarda en el navegador.
- Ciclos, bloques, tareas, checks y logs van ligados al usuario. Nadie ve el horario de otro.
- Si ya había datos sin dueño, la primera cuenta que se cree los toma.
- Botón **Salir** en la barra superior.

### 2026-08-25 — Orden de la noche

- Tras la última clase el motor encadena: regreso a casa → cena → sueño, sin solaparse.
- La cena ya no empieza a la misma hora que el traslado ni se mete en el sueño.
- En Hoy y Semana, si dos bloques empiezan igual, el más corto (el traslado) va primero.

### 2026-08-25 — Cruces en Nuevo horario

- La validación ahora cruza trabajo, clases, ejercicio y los bloques derivados (comidas, traslados).
- El día de cada clase se guarda como número, para que coincida con trabajo y ejercicio.
- También avisa si el curso aún no tiene nombre. El sueño no se usa en el cruce (cruza la medianoche y daba falsos positivos).

### 2026-08-23 — Guía de funcionalidad

- Se añadió `FUNCIONALIDAD.md` en la raíz: pantallas, conceptos, generador, API, datos y cómo correr la app.

### 2026-08-23 — Diseño de Ciclos

- Ciclos pasa a un tablero claro: resumen a la izquierda, datos a la derecha.
- El panel oscuro se reemplaza por una tarjeta con acento, chip de estado y barra de avance.
- Respaldo y avisos en una fila; borrar queda en una zona peligrosa al pie.

### 2026-08-23 — Organización de Semana

- El horario del día queda al frente; el mes va a un lado (en el celular, debajo).
- La tira de la semana vive junto al horario. Huecos en lista corta. Se quitó el mapa de carga, que repetía la tira.

### 2026-08-23 — No marcar antes de hora

- En Hoy, Semana y Ejercicio no se puede marcar un bloque o una sesión si aún no llegó su hora, ni en un día futuro. Desmarcar sigue permitido.

### 2026-08-23 — Tipografía

- Se quitó Cormorant Garamond + Figtree. Títulos en Outfit; textos, botones y campos en Source Sans 3.

### 2026-08-23 — Calendario en Semana

- Semana tiene un mes con fechas reales. Tocar un día abre ese horario.
- Los chips de la semana muestran el número de día. Hoy está marcado. Entregas y excepciones se ven como puntos.
- Se puede ir a otro mes o volver a hoy. El `.ics` exporta la semana abierta, no solo la actual.

### 2026-08-23 — Trabajo y ejercicio en el constructor

- Paso 2: las horas van en filas compactas (día + inicio + fin), no en una tarjeta por día.
- Un solo botón “Copiar [día] al resto” cuando los horarios no coinciden; se quitó “Aplicar a los demás” repetido.
- Paso 4: mismos chips de días; solo se editan las sesiones marcadas (hora, tipo, nivel y nombre).

### 2026-08-23 — Rediseño de Ciclos

- El ciclo abierto es un panel oscuro con nombre grande, barra de avance, días que quedan y conteo de bloques/cursos/tareas.
- Si hay varios ciclos, se cambian con una tira horizontal. Los datos (nombre y fechas) van en un panel aparte.
- Respaldo, restaurar y avisos pasan a tres atajos. Borrar ciclo o todo el horario queda como texto al pie, no como botón azul.

### 2026-08-23 — Sesión de base de datos duplicada

- `get_db()` en `backend/app/database.py` hacía `yield` dos veces. FastAPI espera una sola sesión por request; eso tiraba `RuntimeError: generator didn't stop` y `/api/planner` respondía 500.

### 2026-08-23 — Excepciones, edición suelta y el resto del lote

- Excepciones de fecha (feriado, sin trabajo, junta, examen, otro) en Semana. Feriado/sin trabajo ocultan trabajo y commute ese día.
- Editar / agregar / ocultar bloques sin regenerar el ciclo (Hoy y Semana). Alcance: solo hoy o todas las semanas.
- Entregas y exámenes en el chip del día y en el panel del día.
- Hueco siguiente en Hoy.
- Copiar ciclo anterior a uno nuevo.
- Días protegidos en el constructor; el motor de estudio los respeta.
- Temas y exámenes por curso en Tareas.
- Tipo e intensidad de ejercicio en el constructor.
- Exportar semana a `.ics`.
- Respaldo JSON import/export en Ciclos.
- Recordatorios locales 10 min antes (pestaña abierta).
- API: `PUT /blocks/{id}`, `/exceptions`, `/topics`, `/skips`, `POST /planner/import`. Estado v4: `exceptions`, `topics`, `blockSkips`, `protectedDays`, `date` en bloques.
- Este archivo y la regla `.cursor/rules/cambios.mdc` para registrar cambios futuros.

### 2026-08-22 — Constructor de horario

- Rediseño de Nuevo horario (crear y actualizar son la misma pantalla).
- Cursos en acordeón; sesiones con día, inicio, fin y aula.
- Ejercicio compacto; Trabajo pasó de 7 filas fijas a chips + tarjetas de horas.
- Campos `time` con ancho mínimo para que no se corte `08:00` en Windows.
- Filas que se apilan si la tarjeta es estrecha (container queries).

### 2026-08-22 y antes — Base de la app

- Rutas: Hoy, Semana, Tareas, Ejercicio, Análisis, Ciclos, Nuevo horario.
- Generador de horario + persistencia HTTP (FastAPI + SQLite).
- Checklist diaria, carga semanal, tareas, logs de ejercicio.
- Ciclos con fechas; se puede borrar el último y vaciar todo (modales solo al borrar).
- Actualizar horario ya no avisa “se eliminará todo”; borrar sí lista el impacto.
- Validación de cruces al crear y al actualizar.
- Sin datos de demostración.

---

## Notas de uso

- Los avisos no suenan si cierras la pestaña: el navegador no agenda notificaciones locales de forma fiable sin un servicio de push.
- Restaurar un JSON borra lo que haya en el servidor y carga el archivo.
- Tras actualizar el backend, reinicia uvicorn para crear las tablas/columnas nuevas (`protected_days`, `date` en bloques, excepciones, temas, omisiones).
