from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..conflicts import find_schedule_conflicts
from ..generator import now_iso
from ..services import (
    add_item,
    apply_generated,
    build_state,
    clear_all,
    create_term,
    delete_item,
    delete_term,
    import_planner,
    owned_item,
    owned_term,
    select_term,
    update_item,
    update_task,
    update_term,
    upsert_block_skip,
    upsert_exercise_log,
)

router = APIRouter()
UserDep = Annotated[models.User, Depends(get_current_user)]
DbDep = Annotated[Session, Depends(get_db)]


def found(item, message: str):
    if not item:
        raise HTTPException(status_code=404, detail=message)
    return item


@router.get(
    "/health",
    response_model=schemas.HealthOut,
    tags=["Sistema"],
    summary="Comprobar que el API está viva",
)
def health():
    return {"ok": True, "service": "mi-planificador"}


@router.get(
    "/planner",
    response_model=schemas.PlannerState,
    tags=["Planificador"],
    summary="Obtener el estado del planificador",
)
def get_planner(user: UserDep, db: DbDep, termId: str | None = None):
    if termId and not owned_term(db, user.id, termId):
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    return build_state(db, user.id, termId)


@router.post(
    "/planner/generate",
    response_model=schemas.PlannerState,
    tags=["Planificador"],
    summary="Generar un horario a partir de un borrador",
)
def generate_planner(draft: schemas.ScheduleDraft, user: UserDep, db: DbDep):
    conflicts = find_schedule_conflicts(draft)
    if conflicts:
        raise HTTPException(status_code=409, detail=conflicts)
    try:
        term_id = apply_generated(db, user.id, draft)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    return build_state(db, user.id, term_id)


@router.delete(
    "/planner",
    response_model=schemas.PlannerState,
    tags=["Planificador"],
    summary="Vaciar todo el planificador",
)
def reset_planner(user: UserDep, db: DbDep):
    clear_all(db, user.id)
    return build_state(db, user.id)


@router.post(
    "/planner/import",
    response_model=schemas.PlannerState,
    tags=["Planificador"],
    summary="Restaurar una copia de seguridad JSON",
)
def import_planner_state(payload: schemas.PlannerState, user: UserDep, db: DbDep):
    term_id = import_planner(db, user.id, payload)
    return build_state(db, user.id, term_id)


@router.get(
    "/terms",
    response_model=list[schemas.TermOut],
    tags=["Ciclos"],
    summary="Listar ciclos",
)
def list_terms(user: UserDep, db: DbDep):
    return db.query(models.Term).filter(models.Term.user_id == user.id).order_by(models.Term.start_date).all()


@router.post(
    "/terms",
    response_model=schemas.TermOut,
    tags=["Ciclos"],
    summary="Crear un ciclo",
    status_code=201,
)
def post_term(payload: schemas.TermIn, user: UserDep, db: DbDep):
    return create_term(db, user.id, payload)


@router.put(
    "/terms/{term_id}",
    response_model=schemas.TermOut,
    tags=["Ciclos"],
    summary="Actualizar un ciclo",
)
def put_term(term_id: str, payload: schemas.TermIn, user: UserDep, db: DbDep):
    return found(update_term(db, user.id, term_id, payload), "Ciclo no encontrado")


@router.post(
    "/terms/{term_id}/select",
    response_model=schemas.TermOut,
    tags=["Ciclos"],
    summary="Seleccionar el ciclo activo",
)
def post_select_term(term_id: str, user: UserDep, db: DbDep):
    return found(select_term(db, user.id, term_id), "Ciclo no encontrado")


@router.delete(
    "/terms/{term_id}",
    response_model=schemas.OkOut,
    tags=["Ciclos"],
    summary="Eliminar un ciclo",
)
def remove_term(term_id: str, user: UserDep, db: DbDep):
    if not delete_term(db, user.id, term_id):
        raise HTTPException(status_code=404, detail="Ciclo no encontrado")
    return {"ok": True}


@router.post(
    "/blocks",
    response_model=schemas.TimeBlockOut,
    tags=["Horario"],
    summary="Crear un bloque",
    status_code=201,
)
def post_block(payload: schemas.TimeBlockIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.TimeBlock, payload, user.id), "Ciclo no encontrado")


@router.put(
    "/blocks/{item_id}",
    response_model=schemas.TimeBlockOut,
    tags=["Horario"],
    summary="Actualizar un bloque",
)
def put_block(item_id: str, payload: schemas.TimeBlockIn, user: UserDep, db: DbDep):
    return found(update_item(db, models.TimeBlock, item_id, payload, user.id), "Bloque no encontrado")


@router.delete(
    "/blocks/{item_id}",
    response_model=schemas.OkOut,
    tags=["Horario"],
    summary="Eliminar un bloque",
)
def remove_block(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.TimeBlock, item_id, user.id):
        raise HTTPException(status_code=404, detail="Bloque no encontrado")
    return {"ok": True}


@router.post(
    "/courses",
    response_model=schemas.CourseOut,
    tags=["Cursos"],
    summary="Crear un curso",
    status_code=201,
)
def post_course(payload: schemas.CourseIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.Course, payload, user.id), "Ciclo no encontrado")


@router.delete(
    "/courses/{item_id}",
    response_model=schemas.OkOut,
    tags=["Cursos"],
    summary="Eliminar un curso",
)
def remove_course(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.Course, item_id, user.id):
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    return {"ok": True}


@router.post(
    "/tasks",
    response_model=schemas.TaskOut,
    tags=["Tareas"],
    summary="Crear una tarea",
    status_code=201,
)
def post_task(payload: schemas.TaskIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.Task, payload, user.id, extra={"created_at": now_iso()}), "Ciclo no encontrado")


@router.put(
    "/tasks/{item_id}",
    response_model=schemas.TaskOut,
    tags=["Tareas"],
    summary="Actualizar una tarea",
)
def put_task(item_id: str, payload: schemas.TaskIn, user: UserDep, db: DbDep):
    return found(update_task(db, user.id, item_id, payload), "Tarea no encontrada")


@router.delete(
    "/tasks/{item_id}",
    response_model=schemas.OkOut,
    tags=["Tareas"],
    summary="Eliminar una tarea",
)
def remove_task(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.Task, item_id, user.id):
        raise HTTPException(status_code=404, detail="Tarea no encontrada")
    return {"ok": True}


@router.post(
    "/study-logs",
    response_model=schemas.StudyLogOut,
    tags=["Tareas"],
    summary="Registrar minutos de estudio",
    status_code=201,
)
def post_study_log(payload: schemas.StudyLogIn, user: UserDep, db: DbDep):
    return add_item(db, models.StudyLog, payload, user.id, extra={"user_id": user.id})


@router.post(
    "/exercise-sessions",
    response_model=schemas.ExerciseSessionOut,
    tags=["Ejercicio"],
    summary="Crear una sesión de ejercicio",
    status_code=201,
)
def post_exercise_session(payload: schemas.ExerciseSessionIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.ExerciseSession, payload, user.id), "Ciclo no encontrado")


@router.post(
    "/exercise-logs",
    response_model=schemas.ExerciseLogOut,
    tags=["Ejercicio"],
    summary="Registrar o actualizar un log de ejercicio",
    status_code=201,
)
def post_exercise_log(payload: schemas.ExerciseLogIn, user: UserDep, db: DbDep):
    return found(upsert_exercise_log(db, user.id, payload), "Sesión no encontrada")


@router.delete(
    "/exercise-logs/{item_id}",
    response_model=schemas.OkOut,
    tags=["Ejercicio"],
    summary="Eliminar un log de ejercicio",
)
def remove_exercise_log(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.ExerciseLog, item_id, user.id):
        raise HTTPException(status_code=404, detail="Registro de ejercicio no encontrado")
    return {"ok": True}


@router.post(
    "/routines",
    response_model=schemas.DayRoutineOut,
    tags=["Rutinas"],
    summary="Crear una rutina diaria",
    status_code=201,
)
def post_routine(payload: schemas.DayRoutineIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.DayRoutine, payload, user.id), "Ciclo no encontrado")


@router.post(
    "/checks",
    response_model=schemas.BlockCheckOut,
    tags=["Checklist"],
    summary="Marcar un bloque como hecho",
    status_code=201,
)
def post_check(payload: schemas.BlockCheckIn, user: UserDep, db: DbDep):
    found(owned_item(db, models.TimeBlock, payload.block_id, user.id), "Bloque no encontrado")
    return add_item(db, models.BlockCheck, payload, user.id, extra={"user_id": user.id})


@router.delete(
    "/checks/{item_id}",
    response_model=schemas.OkOut,
    tags=["Checklist"],
    summary="Quitar la marca de un bloque",
)
def remove_check(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.BlockCheck, item_id, user.id):
        raise HTTPException(status_code=404, detail="Check no encontrado")
    return {"ok": True}


@router.post(
    "/exceptions",
    response_model=schemas.DayExceptionOut,
    tags=["Excepciones"],
    summary="Crear una excepción de fecha",
    status_code=201,
)
def post_exception(payload: schemas.DayExceptionIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.DayException, payload, user.id), "Ciclo no encontrado")


@router.delete(
    "/exceptions/{item_id}",
    response_model=schemas.OkOut,
    tags=["Excepciones"],
    summary="Eliminar una excepción",
)
def remove_exception(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.DayException, item_id, user.id):
        raise HTTPException(status_code=404, detail="Excepción no encontrada")
    return {"ok": True}


@router.post(
    "/topics",
    response_model=schemas.CourseTopicOut,
    tags=["Temas"],
    summary="Crear un tema o examen",
    status_code=201,
)
def post_topic(payload: schemas.CourseTopicIn, user: UserDep, db: DbDep):
    return found(add_item(db, models.CourseTopic, payload, user.id), "Ciclo no encontrado")


@router.put(
    "/topics/{item_id}",
    response_model=schemas.CourseTopicOut,
    tags=["Temas"],
    summary="Actualizar un tema",
)
def put_topic(item_id: str, payload: schemas.CourseTopicIn, user: UserDep, db: DbDep):
    return found(update_item(db, models.CourseTopic, item_id, payload, user.id), "Tema no encontrado")


@router.delete(
    "/topics/{item_id}",
    response_model=schemas.OkOut,
    tags=["Temas"],
    summary="Eliminar un tema",
)
def remove_topic(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.CourseTopic, item_id, user.id):
        raise HTTPException(status_code=404, detail="Tema no encontrado")
    return {"ok": True}


@router.post(
    "/skips",
    response_model=schemas.BlockSkipOut,
    tags=["Horario"],
    summary="Ocultar un bloque en una fecha",
    status_code=201,
)
def post_skip(payload: schemas.BlockSkipIn, user: UserDep, db: DbDep):
    return found(upsert_block_skip(db, user.id, payload), "Bloque no encontrado")


@router.delete(
    "/skips/{item_id}",
    response_model=schemas.OkOut,
    tags=["Horario"],
    summary="Mostrar de nuevo un bloque en una fecha",
)
def remove_skip(item_id: str, user: UserDep, db: DbDep):
    if not delete_item(db, models.BlockSkip, item_id, user.id):
        raise HTTPException(status_code=404, detail="Omisión no encontrada")
    return {"ok": True}
