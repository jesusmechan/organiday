from sqlalchemy.orm import Session

from . import models, schemas
from .generator import generate_schedule, now_iso, uid


def term_ids_for(db: Session, user_id: str) -> list[str]:
    return [item.id for item in db.query(models.Term).filter(models.Term.user_id == user_id).all()]


def owned_term(db: Session, user_id: str, term_id: str) -> models.Term | None:
    return (
        db.query(models.Term)
        .filter(models.Term.id == term_id, models.Term.user_id == user_id)
        .first()
    )


def owned_item(db: Session, model, item_id: str, user_id: str):
    item = db.query(model).filter(model.id == item_id).first()
    if not item:
        return None
    if hasattr(item, "user_id"):
        return item if item.user_id == user_id else None
    term_id = getattr(item, "term_id", None)
    if term_id and owned_term(db, user_id, term_id):
        return item
    return None


def selected_term_id(db: Session, user_id: str) -> str:
    selected = (
        db.query(models.Term)
        .filter(models.Term.user_id == user_id, models.Term.selected.is_(True))
        .first()
    )
    if selected:
        return selected.id
    first = db.query(models.Term).filter(models.Term.user_id == user_id).first()
    return first.id if first else ""


def protected_days_csv(days: list[int] | None) -> str:
    values = [str(day) for day in (days or [4]) if 0 <= day <= 6]
    return ",".join(values) or "4"


def empty_state(user_id: str) -> schemas.PlannerState:
    return schemas.PlannerState(
        version=4,
        terms=[],
        selected_term_id="",
        blocks=[],
        courses=[],
        tasks=[],
        study_logs=[],
        exercise_sessions=[],
        exercise_logs=[],
        routines=[],
        block_checks=[],
        exceptions=[],
        topics=[],
        block_skips=[],
    )


def build_state(db: Session, user_id: str, term_id: str | None = None) -> schemas.PlannerState:
    ids = term_ids_for(db, user_id)
    if not ids:
        return empty_state(user_id)
    current = term_id if term_id in ids else selected_term_id(db, user_id)
    terms = db.query(models.Term).filter(models.Term.user_id == user_id).order_by(models.Term.start_date).all()
    return schemas.PlannerState(
        version=4,
        terms=terms,
        selected_term_id=current,
        blocks=db.query(models.TimeBlock).filter(models.TimeBlock.term_id.in_(ids)).all(),
        courses=db.query(models.Course).filter(models.Course.term_id.in_(ids)).all(),
        tasks=db.query(models.Task).filter(models.Task.term_id.in_(ids)).all(),
        study_logs=db.query(models.StudyLog).filter(models.StudyLog.user_id == user_id).all(),
        exercise_sessions=db.query(models.ExerciseSession).filter(models.ExerciseSession.term_id.in_(ids)).all(),
        exercise_logs=db.query(models.ExerciseLog).filter(models.ExerciseLog.user_id == user_id).all(),
        routines=db.query(models.DayRoutine).filter(models.DayRoutine.term_id.in_(ids)).all(),
        block_checks=db.query(models.BlockCheck).filter(models.BlockCheck.user_id == user_id).all(),
        exceptions=db.query(models.DayException).filter(models.DayException.term_id.in_(ids)).all(),
        topics=db.query(models.CourseTopic).filter(models.CourseTopic.term_id.in_(ids)).all(),
        block_skips=db.query(models.BlockSkip).filter(models.BlockSkip.user_id == user_id).all(),
    )


def select_term(db: Session, user_id: str, term_id: str) -> models.Term | None:
    term = owned_term(db, user_id, term_id)
    if not term:
        return None
    for item in db.query(models.Term).filter(models.Term.user_id == user_id).all():
        item.selected = item.id == term_id
    db.commit()
    db.refresh(term)
    return term


def create_term(db: Session, user_id: str, payload: schemas.TermIn) -> models.Term:
    has_any = db.query(models.Term).filter(models.Term.user_id == user_id).first()
    term = models.Term(id=uid("term"), user_id=user_id, **payload.model_dump(), selected=not has_any)
    if term.selected:
        for item in db.query(models.Term).filter(models.Term.user_id == user_id).all():
            item.selected = False
        term.selected = True
    db.add(term)
    db.commit()
    db.refresh(term)
    return term


def update_term(db: Session, user_id: str, term_id: str, payload: schemas.TermIn) -> models.Term | None:
    term = owned_term(db, user_id, term_id)
    if not term:
        return None
    term.name = payload.name
    term.start_date = payload.start_date
    term.end_date = payload.end_date
    term.protected_days = payload.protected_days or "4"
    db.commit()
    db.refresh(term)
    return term


def delete_term(db: Session, user_id: str, term_id: str) -> bool:
    term = owned_term(db, user_id, term_id)
    if not term:
        return False
    block_ids = [block.id for block in term.blocks]
    session_ids = [session.id for session in term.exercise_sessions]
    if block_ids:
        db.query(models.BlockCheck).filter(models.BlockCheck.block_id.in_(block_ids)).delete(synchronize_session=False)
        db.query(models.BlockSkip).filter(models.BlockSkip.block_id.in_(block_ids)).delete(synchronize_session=False)
    if session_ids:
        db.query(models.ExerciseLog).filter(models.ExerciseLog.session_id.in_(session_ids)).delete(synchronize_session=False)
    db.delete(term)
    remaining = db.query(models.Term).filter(models.Term.user_id == user_id).first()
    if remaining:
        remaining.selected = True
    db.commit()
    return True


def update_task(db: Session, user_id: str, task_id: str, payload: schemas.TaskIn) -> models.Task | None:
    task = owned_item(db, models.Task, task_id, user_id)
    if not task:
        return None
    if not owned_term(db, user_id, payload.term_id):
        return None
    for key, value in payload.model_dump().items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


def update_item(db: Session, model, item_id: str, payload, user_id: str):
    item = owned_item(db, model, item_id, user_id)
    if not item:
        return None
    data = payload.model_dump()
    term_id = data.get("term_id")
    if term_id and not owned_term(db, user_id, term_id):
        return None
    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


def upsert_exercise_log(db: Session, user_id: str, payload: schemas.ExerciseLogIn) -> models.ExerciseLog | None:
    session = owned_item(db, models.ExerciseSession, payload.session_id, user_id)
    if not session:
        return None
    data = payload.model_dump()
    existing = (
        db.query(models.ExerciseLog)
        .filter(
            models.ExerciseLog.date == data["date"],
            models.ExerciseLog.session_id == data["session_id"],
            models.ExerciseLog.user_id == user_id,
        )
        .first()
    )
    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
        existing.user_id = user_id
        db.commit()
        db.refresh(existing)
        return existing
    return add_item(db, models.ExerciseLog, payload, user_id, extra={"user_id": user_id})


def upsert_block_skip(db: Session, user_id: str, payload: schemas.BlockSkipIn) -> models.BlockSkip | None:
    block = owned_item(db, models.TimeBlock, payload.block_id, user_id)
    if not block:
        return None
    data = payload.model_dump()
    existing = (
        db.query(models.BlockSkip)
        .filter(
            models.BlockSkip.block_id == data["block_id"],
            models.BlockSkip.date == data["date"],
            models.BlockSkip.user_id == user_id,
        )
        .first()
    )
    if existing:
        return existing
    return add_item(db, models.BlockSkip, payload, user_id, extra={"user_id": user_id})


def clear_all(db: Session, user_id: str) -> None:
    ids = term_ids_for(db, user_id)
    db.query(models.BlockSkip).filter(models.BlockSkip.user_id == user_id).delete()
    db.query(models.BlockCheck).filter(models.BlockCheck.user_id == user_id).delete()
    db.query(models.ExerciseLog).filter(models.ExerciseLog.user_id == user_id).delete()
    db.query(models.StudyLog).filter(models.StudyLog.user_id == user_id).delete()
    if ids:
        db.query(models.DayRoutine).filter(models.DayRoutine.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.ExerciseSession).filter(models.ExerciseSession.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.CourseTopic).filter(models.CourseTopic.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.DayException).filter(models.DayException.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.Task).filter(models.Task.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.TimeBlock).filter(models.TimeBlock.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.Course).filter(models.Course.term_id.in_(ids)).delete(synchronize_session=False)
        db.query(models.Term).filter(models.Term.user_id == user_id).delete(synchronize_session=False)
    db.commit()


def import_planner(db: Session, user_id: str, state: schemas.PlannerState) -> str:
    clear_all(db, user_id)
    selected = state.selected_term_id
    for term in state.terms:
        db.add(
            models.Term(
                id=term.id,
                name=term.name,
                start_date=term.start_date,
                end_date=term.end_date,
                selected=term.id == selected,
                protected_days=term.protected_days or "4",
                user_id=user_id,
            )
        )
    for course in state.courses:
        db.add(models.Course(id=course.id, **course.model_dump(exclude={"id"})))
    for block in state.blocks:
        db.add(models.TimeBlock(id=block.id, **block.model_dump(exclude={"id"})))
    for task in state.tasks:
        db.add(models.Task(id=task.id, **task.model_dump(exclude={"id"})))
    for log in state.study_logs:
        db.add(models.StudyLog(id=log.id, user_id=user_id, **log.model_dump(exclude={"id"})))
    for session in state.exercise_sessions:
        db.add(models.ExerciseSession(id=session.id, **session.model_dump(exclude={"id"})))
    for log in state.exercise_logs:
        db.add(models.ExerciseLog(id=log.id, user_id=user_id, **log.model_dump(exclude={"id"})))
    for routine in state.routines:
        db.add(models.DayRoutine(id=routine.id, **routine.model_dump(exclude={"id"})))
    for check in state.block_checks:
        db.add(models.BlockCheck(id=check.id, user_id=user_id, **check.model_dump(exclude={"id"})))
    for item in state.exceptions:
        db.add(models.DayException(id=item.id, **item.model_dump(exclude={"id"})))
    for topic in state.topics:
        db.add(models.CourseTopic(id=topic.id, **topic.model_dump(exclude={"id"})))
    for skip in state.block_skips:
        db.add(models.BlockSkip(id=skip.id, user_id=user_id, **skip.model_dump(exclude={"id"})))
    if not selected and state.terms:
        first = db.query(models.Term).filter(models.Term.id == state.terms[0].id).first()
        if first:
            first.selected = True
            selected = first.id
    db.commit()
    return selected


def apply_generated(db: Session, user_id: str, draft: schemas.ScheduleDraft) -> str:
    protected = protected_days_csv(draft.protected_days)
    if draft.mode == "replace" and draft.replace_term_id:
        term_id = draft.replace_term_id
        term = owned_term(db, user_id, term_id)
        if not term:
            raise ValueError("El ciclo a reemplazar no existe.")
        term.name = draft.name
        term.start_date = draft.start_date
        term.end_date = draft.end_date
        term.protected_days = protected
        _clear_term(db, term_id)
    else:
        term_id = uid("term")
        for item in db.query(models.Term).filter(models.Term.user_id == user_id).all():
            item.selected = False
        db.add(
            models.Term(
                id=term_id,
                name=draft.name,
                start_date=draft.start_date,
                end_date=draft.end_date,
                selected=True,
                protected_days=protected,
                user_id=user_id,
            )
        )

    generated = generate_schedule(draft, term_id)
    for course in generated["courses"]:
        db.add(models.Course(**course))
    for block in generated["blocks"]:
        db.add(models.TimeBlock(id=uid("blk"), **block.model_dump()))
    for session in generated["exercise_sessions"]:
        db.add(models.ExerciseSession(id=uid("exs"), **session.model_dump()))
    for routine in generated["routines"]:
        db.add(models.DayRoutine(id=uid("rtn"), **routine.model_dump()))
    for task in generated["tasks"]:
        data = task.model_dump()
        db.add(models.Task(id=uid("task"), created_at=now_iso(), **data))

    db.commit()
    return term_id


def _clear_term(db: Session, term_id: str) -> None:
    block_ids = [item.id for item in db.query(models.TimeBlock).filter(models.TimeBlock.term_id == term_id).all()]
    if block_ids:
        db.query(models.BlockSkip).filter(models.BlockSkip.block_id.in_(block_ids)).delete(synchronize_session=False)
        db.query(models.BlockCheck).filter(models.BlockCheck.block_id.in_(block_ids)).delete(synchronize_session=False)
    db.query(models.TimeBlock).filter(models.TimeBlock.term_id == term_id).delete()
    db.query(models.Course).filter(models.Course.term_id == term_id).delete()
    db.query(models.Task).filter(models.Task.term_id == term_id).delete()
    db.query(models.ExerciseSession).filter(models.ExerciseSession.term_id == term_id).delete()
    db.query(models.DayRoutine).filter(models.DayRoutine.term_id == term_id).delete()
    db.query(models.DayException).filter(models.DayException.term_id == term_id).delete()
    db.query(models.CourseTopic).filter(models.CourseTopic.term_id == term_id).delete()


def add_item(db: Session, model, payload, user_id: str, extra: dict | None = None):
    data = payload.model_dump()
    term_id = data.get("term_id")
    if term_id and not owned_term(db, user_id, term_id):
        return None
    if extra:
        data.update(extra)
    if "user_id" in getattr(model, "__table__").columns and "user_id" not in data:
        data["user_id"] = user_id
    item = model(id=uid(model.__tablename__[:3]), **data)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def delete_item(db: Session, model, item_id: str, user_id: str) -> bool:
    item = owned_item(db, model, item_id, user_id)
    if not item:
        return False
    db.delete(item)
    db.commit()
    return True


def claim_orphan_data(db: Session, user_id: str) -> None:
    if db.query(models.User).count() > 1:
        return
    db.query(models.Term).filter(models.Term.user_id.is_(None)).update({models.Term.user_id: user_id})
    db.query(models.StudyLog).filter(models.StudyLog.user_id.is_(None)).update({models.StudyLog.user_id: user_id})
    db.query(models.ExerciseLog).filter(models.ExerciseLog.user_id.is_(None)).update({models.ExerciseLog.user_id: user_id})
    db.query(models.BlockCheck).filter(models.BlockCheck.user_id.is_(None)).update({models.BlockCheck.user_id: user_id})
    db.query(models.BlockSkip).filter(models.BlockSkip.user_id.is_(None)).update({models.BlockSkip.user_id: user_id})
    db.commit()
