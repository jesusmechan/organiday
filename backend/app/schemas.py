from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def camel_config() -> ConfigDict:
    return ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        alias_generator=lambda name: "".join(
            part.capitalize() if i else part for i, part in enumerate(name.split("_"))
        ),
    )


CourseModality = Literal["presencial", "virtual-live", "virtual-247"]
BlockCategory = Literal[
    "work", "university", "exercise", "study", "meal", "commute", "personal", "sleep", "virtual"
]
Priority = Literal["high", "medium", "low"]
ExerciseType = Literal["walk", "run", "workout", "recovery"]
SkipReason = Literal["tired", "work", "university", "personal", "no-motivation"]


class TermIn(BaseModel):
    model_config = camel_config()
    name: str
    start_date: date
    end_date: date
    protected_days: str = "4"

    @field_validator("protected_days", mode="before")
    @classmethod
    def default_protected_days(cls, value: str | None) -> str:
        return value or "4"


class TermOut(TermIn):
    id: str


class TimeBlockIn(BaseModel):
    model_config = camel_config()
    title: str
    category: BlockCategory
    day_of_week: int = Field(ge=0, le=6)
    start: str
    end: str
    location: str | None = None
    notes: str | None = None
    recurring: bool = True
    optional: bool = False
    term_id: str
    modality: CourseModality | None = None
    date: str | None = None


class TimeBlockOut(TimeBlockIn):
    id: str


class CourseIn(BaseModel):
    model_config = camel_config()
    name: str
    short_name: str
    modality: CourseModality
    color: str
    term_id: str


class CourseOut(CourseIn):
    id: str


class TaskIn(BaseModel):
    model_config = camel_config()
    title: str
    course_id: str | None = None
    priority: Priority = "medium"
    deadline: str | None = None
    estimated_minutes: int = 60
    logged_minutes: int = 0
    completed: bool = False
    notes: str | None = None
    term_id: str


class TaskOut(TaskIn):
    id: str
    created_at: str


class StudyLogIn(BaseModel):
    model_config = camel_config()
    task_id: str | None = None
    course_id: str | None = None
    date: str
    minutes: int
    note: str | None = None


class StudyLogOut(StudyLogIn):
    id: str


class ExerciseSessionIn(BaseModel):
    model_config = camel_config()
    day_of_week: int = Field(ge=0, le=6)
    start: str
    end: str
    type: ExerciseType
    title: str
    intensity: Literal["light", "moderate", "full"]
    term_id: str


class ExerciseSessionOut(ExerciseSessionIn):
    id: str


class ExerciseLogIn(BaseModel):
    model_config = camel_config()
    date: str
    session_id: str
    completed: bool = False
    skipped: bool = False
    reason: SkipReason | None = None
    type: ExerciseType | None = None
    note: str | None = None


class ExerciseLogOut(ExerciseLogIn):
    id: str


class DayRoutineIn(BaseModel):
    model_config = camel_config()
    day_of_week: int = Field(ge=0, le=6)
    wake_time: str
    sleep_time: str
    overloaded: bool = False
    overload_reason: str | None = None
    term_id: str


class DayRoutineOut(DayRoutineIn):
    id: str


class BlockCheckIn(BaseModel):
    model_config = camel_config()
    block_id: str
    date: str
    completed: bool = True
    completed_at: str


class BlockCheckOut(BlockCheckIn):
    id: str


ExceptionKind = Literal["holiday", "off-work", "meeting", "exam", "custom"]
TopicKind = Literal["exam", "assignment", "topic"]


class DayExceptionIn(BaseModel):
    model_config = camel_config()
    date: str
    kind: ExceptionKind
    title: str
    start: str | None = None
    end: str | None = None
    term_id: str


class DayExceptionOut(DayExceptionIn):
    id: str


class CourseTopicIn(BaseModel):
    model_config = camel_config()
    course_id: str
    title: str
    kind: TopicKind
    due_date: str
    done: bool = False
    term_id: str


class CourseTopicOut(CourseTopicIn):
    id: str


class BlockSkipIn(BaseModel):
    model_config = camel_config()
    block_id: str
    date: str


class BlockSkipOut(BlockSkipIn):
    id: str


class WorkDaySpec(BaseModel):
    model_config = camel_config()
    day_of_week: int
    enabled: bool
    start: str
    end: str


class ClassSpec(BaseModel):
    model_config = camel_config()
    day_of_week: int
    start: str
    end: str
    location: str = ""


class CourseSpec(BaseModel):
    model_config = camel_config()
    name: str
    short_name: str = ""
    modality: CourseModality
    sessions: list[ClassSpec] = []


class ExerciseSpec(BaseModel):
    model_config = camel_config()
    enabled: bool
    day_of_week: int
    start: str
    end: str
    title: str
    type: ExerciseType
    intensity: Literal["light", "moderate", "full"]


class ScheduleDraft(BaseModel):
    model_config = camel_config()
    name: str
    start_date: date
    end_date: date
    mode: Literal["new", "replace"] = "new"
    replace_term_id: str | None = None
    work: list[WorkDaySpec]
    courses: list[CourseSpec] = []
    exercises: list[ExerciseSpec] = []
    derive_meals: bool = True
    derive_commute: bool = True
    derive_sleep: bool = True
    create_course_tasks: bool = True
    protected_days: list[int] = Field(default_factory=lambda: [4])


class PlannerState(BaseModel):
    model_config = camel_config()
    version: int = 4
    terms: list[TermOut]
    selected_term_id: str
    blocks: list[TimeBlockOut]
    courses: list[CourseOut]
    tasks: list[TaskOut]
    study_logs: list[StudyLogOut]
    exercise_sessions: list[ExerciseSessionOut]
    exercise_logs: list[ExerciseLogOut]
    routines: list[DayRoutineOut]
    block_checks: list[BlockCheckOut]
    exceptions: list[DayExceptionOut] = []
    topics: list[CourseTopicOut] = []
    block_skips: list[BlockSkipOut] = []


class HealthOut(BaseModel):
    model_config = camel_config()
    ok: bool
    service: str


class OkOut(BaseModel):
    model_config = camel_config()
    ok: bool = True


class RegisterIn(BaseModel):
    model_config = camel_config()
    name: str
    email: str
    password: str


class LoginIn(BaseModel):
    model_config = camel_config()
    email: str
    password: str


class UserOut(BaseModel):
    model_config = camel_config()
    id: str
    name: str
    email: str


class TokenOut(BaseModel):
    model_config = camel_config()
    access_token: str
    refresh_token: str
    user: UserOut


class RefreshIn(BaseModel):
    model_config = camel_config()
    refresh_token: str
