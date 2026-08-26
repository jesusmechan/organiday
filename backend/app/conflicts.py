from .generator import WEEK_ORDER, derive_day, make_block, to_minutes
from .schemas import ScheduleDraft

DAY_LABELS = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
}


def _day(value) -> int:
    try:
        day = int(value)
    except (TypeError, ValueError):
        return 0
    return day if 0 <= day <= 6 else 0


def _segments(start: int, end: int, wrap: bool) -> list[tuple[int, int]]:
    if start == end:
        return []
    if wrap or end < start:
        return [(start, 24 * 60), (0, end)]
    return [(start, end)]


def _overlaps(left: dict, right: dict) -> bool:
    for start_a, end_a in _segments(left["start"], left["end"], left["wrap"]):
        for start_b, end_b in _segments(right["start"], right["end"], right["wrap"]):
            if start_a < end_b and start_b < end_a:
                return True
    return False


def _push_slot(
    slots: list[dict],
    errors: list[str],
    day: int,
    start: str,
    end: str,
    label: str,
    source: str,
    *,
    allow_overnight: bool = False,
    wrap: bool = False,
) -> None:
    if not start or not end:
        return
    start_min = to_minutes(start)
    end_min = to_minutes(end)
    if start_min == end_min:
        return
    overnight = wrap or end_min < start_min
    if end_min <= start_min and not allow_overnight:
        errors.append(f"{DAY_LABELS[day]}: {label} termina antes de empezar.")
        return
    slots.append(
        {
            "day": day,
            "start": start_min,
            "end": end_min,
            "label": f"{label} ({start}–{end})",
            "wrap": overnight,
            "source": source,
        }
    )


def _course_label(course, index: int) -> str:
    name = course.short_name.strip() or course.name.strip()
    return name or f"Curso {index + 1}"


def _class_blocks_for_day(draft: ScheduleDraft, day: int):
    blocks = []
    for course in draft.courses:
        if course.modality == "virtual-247":
            continue
        category = "university" if course.modality == "presencial" else "virtual"
        for session in course.sessions:
            if not session.start or not session.end:
                continue
            if to_minutes(session.end) <= to_minutes(session.start):
                continue
            if _day(session.day_of_week) != day:
                continue
            blocks.append(
                make_block(
                    course.name.strip() or "Curso",
                    category,
                    day,
                    session.start,
                    session.end,
                    "preview",
                    session.location,
                    course.modality,
                )
            )
    return blocks


def find_schedule_conflicts(draft: ScheduleDraft) -> list[str]:
    slots: list[dict] = []
    errors: list[str] = []

    for work in draft.work:
        if not work.enabled:
            continue
        _push_slot(slots, errors, _day(work.day_of_week), work.start, work.end, "Trabajo", "user")

    for index, course in enumerate(draft.courses):
        if course.modality == "virtual-247":
            continue
        name = _course_label(course, index)
        for session in course.sessions:
            _push_slot(
                slots,
                errors,
                _day(session.day_of_week),
                session.start,
                session.end,
                name,
                "user",
            )

    for exercise in draft.exercises:
        if not exercise.enabled:
            continue
        name = exercise.title.strip() or "Ejercicio"
        _push_slot(
            slots,
            errors,
            _day(exercise.day_of_week),
            exercise.start,
            exercise.end,
            name,
            "user",
        )

    for day in WEEK_ORDER:
        work = next((item for item in draft.work if _day(item.day_of_week) == day), None)
        exercise = next(
            (item for item in draft.exercises if item.enabled and _day(item.day_of_week) == day),
            None,
        )
        derived = derive_day(day, work, exercise, _class_blocks_for_day(draft, day), draft, "preview")
        for block in derived:
            if block.category == "sleep":
                continue
            _push_slot(
                slots,
                errors,
                day,
                block.start,
                block.end,
                block.title,
                "derived",
            )

    for i, left in enumerate(slots):
        for right in slots[i + 1 :]:
            if left["day"] != right["day"]:
                continue
            if left["source"] == "derived" and right["source"] == "derived":
                continue
            if not _overlaps(left, right):
                continue
            errors.append(
                f"{DAY_LABELS[left['day']]}: cruce entre {left['label']} y {right['label']}."
            )

    return list(dict.fromkeys(errors))
