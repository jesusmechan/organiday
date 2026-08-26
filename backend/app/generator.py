from datetime import datetime, timezone
from uuid import uuid4

from .schemas import (
    DayRoutineIn,
    ExerciseSessionIn,
    ScheduleDraft,
    TaskIn,
    TimeBlockIn,
    WorkDaySpec,
)

WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
COLORS = ["#7c3aff", "#ff2d7b", "#00c2a8", "#2f7cff", "#ffb020", "#ff6a3d"]


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def to_minutes(hhmm: str) -> int:
    hours, minutes = hhmm.split(":")
    return int(hours) * 60 + int(minutes)


def from_minutes(total: int) -> str:
    normalized = total % (24 * 60)
    return f"{normalized // 60:02d}:{normalized % 60:02d}"


def generate_schedule(draft: ScheduleDraft, term_id: str) -> dict:
    blocks: list[TimeBlockIn] = []
    courses = []
    exercise_sessions: list[ExerciseSessionIn] = []
    tasks: list[TaskIn] = []

    for index, course in enumerate(draft.courses):
        if not course.name.strip():
            continue
        course_id = uid("course")
        courses.append(
            {
                "id": course_id,
                "name": course.name.strip(),
                "short_name": course.short_name.strip() or course.name.strip()[:18],
                "modality": course.modality,
                "color": COLORS[index % len(COLORS)],
                "term_id": term_id,
            }
        )
        if course.modality != "virtual-247":
            for session in course.sessions:
                if not session.start or not session.end:
                    continue
                blocks.append(
                    make_block(
                        course.name.strip(),
                        "university" if course.modality == "presencial" else "virtual",
                        session.day_of_week,
                        session.start,
                        session.end,
                        term_id,
                        session.location,
                        course.modality,
                    )
                )
        if draft.create_course_tasks:
            tasks.append(
                TaskIn(
                    title=f"Estudiar {course.short_name.strip() or course.name.strip()}",
                    course_id=course_id,
                    priority="high" if index < 2 else "medium",
                    estimated_minutes=120,
                    term_id=term_id,
                )
            )

    for day in WEEK_ORDER:
        work = next((item for item in draft.work if item.day_of_week == day), None)
        exercise = next((item for item in draft.exercises if item.enabled and item.day_of_week == day), None)
        classes = [block for block in blocks if block.day_of_week == day and block.category in {"university", "virtual"}]

        if work and work.enabled:
            blocks.append(make_block("Trabajo", "work", day, work.start, work.end, term_id))
        if exercise:
            blocks.append(make_block(exercise.title, "exercise", day, exercise.start, exercise.end, term_id))
            exercise_sessions.append(
                ExerciseSessionIn(
                    day_of_week=day,
                    start=exercise.start,
                    end=exercise.end,
                    type=exercise.type,
                    title=exercise.title,
                    intensity=exercise.intensity,
                    term_id=term_id,
                )
            )
        blocks.extend(derive_day(day, work, exercise, classes, draft, term_id))

    routines = []
    for day in WEEK_ORDER:
        day_blocks = [block for block in blocks if block.day_of_week == day]
        active = [block for block in day_blocks if block.category != "sleep"]
        last = last_end(active)
        first = first_start(active)
        overloaded = last >= 22 * 60
        protected = day in (draft.protected_days or [])
        reason = None
        if overloaded:
            reason = "Este día termina muy tarde. No agregues más actividades."
        elif protected:
            reason = "Día protegido: sin estudio extra ni carga añadida."
        routines.append(
            DayRoutineIn(
                day_of_week=day,
                wake_time=from_minutes(max(first - 30, 6 * 60)) if first is not None else default_wake(day),
                sleep_time="23:30" if last >= 22 * 60 + 15 else "23:00",
                overloaded=overloaded,
                overload_reason=reason,
                term_id=term_id,
            )
        )

    return {
        "term": {"name": draft.name.strip(), "start_date": draft.start_date, "end_date": draft.end_date},
        "blocks": blocks,
        "courses": courses,
        "exercise_sessions": exercise_sessions,
        "routines": routines,
        "tasks": tasks,
    }


def derive_day(
    day: int,
    work: WorkDaySpec | None,
    exercise,
    classes: list[TimeBlockIn],
    draft: ScheduleDraft,
    term_id: str,
) -> list[TimeBlockIn]:
    out: list[TimeBlockIn] = []
    class_start = first_start(classes)
    class_end = last_end(classes) if classes else None
    work_start = to_minutes(work.start) if work and work.enabled else None
    work_end = to_minutes(work.end) if work and work.enabled else None

    if draft.derive_meals:
        morning_ex = exercise if exercise and to_minutes(exercise.start) < 12 * 60 else None
        if morning_ex and work_start is not None and to_minutes(morning_ex.end) < work_start:
            _timed(out, "Ducha, desayuno y preparación", "meal", day, morning_ex.end, work.start, term_id)
        elif work_start is not None:
            breakfast_start = work_start - 45
            if not (morning_ex and to_minutes(morning_ex.end) > breakfast_start):
                _timed(
                    out,
                    "Desayuno y preparación",
                    "meal",
                    day,
                    from_minutes(breakfast_start),
                    work.start,
                    term_id,
                )
        elif exercise:
            _timed(
                out,
                "Desayuno",
                "meal",
                day,
                from_minutes(to_minutes(exercise.start) - 60),
                exercise.start,
                term_id,
            )

    if draft.derive_commute and work_end is not None:
        if class_start is not None and class_start > work_end:
            _timed(out, "Traslado a la universidad", "commute", day, work.end, from_minutes(class_start), term_id)
        elif class_start is None:
            _timed(
                out,
                "Regreso a casa",
                "commute",
                day,
                work.end,
                from_minutes(work_end + 30),
                term_id,
            )

    sorted_classes = sorted(classes, key=lambda item: to_minutes(item.start))
    for previous, current in zip(sorted_classes, sorted_classes[1:]):
        gap = to_minutes(current.start) - to_minutes(previous.end)
        if 0 < gap <= 20:
            _timed(out, "Receso", "personal", day, previous.end, current.start, term_id)

    cursor = class_end if class_end is not None else work_end

    if draft.derive_commute and work_end is not None and class_end is not None:
        home_end = class_end + 30
        _timed(out, "Regreso a casa", "commute", day, from_minutes(class_end), from_minutes(home_end), term_id)
        cursor = home_end
    elif draft.derive_commute and work_end is not None and class_start is None:
        cursor = work_end + 30

    if draft.derive_meals and cursor is not None and cursor < 23 * 60:
        dinner_end = min(cursor + 45, 23 * 60)
        if dinner_end - cursor >= 20:
            title = "Cena rápida" if cursor >= 21 * 60 else "Cena y desconexión"
            _timed(out, title, "meal", day, from_minutes(cursor), from_minutes(dinner_end), term_id)
            cursor = dinner_end

    if draft.derive_sleep:
        sleep_start = 23 * 60
        if cursor is not None:
            sleep_start = max(sleep_start, cursor)
        if sleep_start >= 24 * 60:
            sleep_start = 23 * 60 + 30
        if exercise and to_minutes(exercise.start) < 12 * 60:
            wake = from_minutes(to_minutes(exercise.start) - 30)
        elif work_start is not None:
            wake = from_minutes(work_start - 60)
        else:
            wake = default_wake(day)
        out.append(make_block("Sueño", "sleep", day, from_minutes(sleep_start), wake, term_id))

    return out


def _timed(
    out: list[TimeBlockIn],
    title: str,
    category: str,
    day: int,
    start: str,
    end: str,
    term_id: str,
) -> None:
    if not start or not end:
        return
    if to_minutes(end) <= to_minutes(start):
        return
    out.append(make_block(title, category, day, start, end, term_id))


def make_block(
    title: str,
    category: str,
    day: int,
    start: str,
    end: str,
    term_id: str,
    location: str | None = None,
    modality: str | None = None,
) -> TimeBlockIn:
    notes = None
    if modality == "virtual-live":
        notes = "Sesión en vivo"
    elif modality == "virtual-247":
        notes = "Flexible 24/7"
    return TimeBlockIn(
        title=title,
        category=category,  # type: ignore[arg-type]
        day_of_week=day,
        start=start,
        end=end,
        location=location or None,
        notes=notes,
        term_id=term_id,
        modality=modality,  # type: ignore[arg-type]
    )


def first_start(blocks: list[TimeBlockIn]) -> int | None:
    if not blocks:
        return None
    return min(to_minutes(block.start) for block in blocks)


def last_end(blocks: list[TimeBlockIn]) -> int:
    if not blocks:
        return 0
    return max(to_minutes(block.end) for block in blocks)


def default_wake(day: int) -> str:
    if day == 6:
        return "08:30"
    if day == 0:
        return "09:00"
    return "07:00"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
