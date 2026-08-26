from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)

    terms: Mapped[list["Term"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    expires_at: Mapped[str] = mapped_column(String, nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Term(Base):
    __tablename__ = "terms"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    selected: Mapped[bool] = mapped_column(Boolean, default=False)
    protected_days: Mapped[str] = mapped_column(String, default="4")
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    user: Mapped["User | None"] = relationship(back_populates="terms")
    blocks: Mapped[list["TimeBlock"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    courses: Mapped[list["Course"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    exercise_sessions: Mapped[list["ExerciseSession"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    routines: Mapped[list["DayRoutine"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    exceptions: Mapped[list["DayException"]] = relationship(back_populates="term", cascade="all, delete-orphan")
    topics: Mapped[list["CourseTopic"]] = relationship(back_populates="term", cascade="all, delete-orphan")


class TimeBlock(Base):
    __tablename__ = "time_blocks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start: Mapped[str] = mapped_column(String, nullable=False)
    end: Mapped[str] = mapped_column(String, nullable=False)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recurring: Mapped[bool] = mapped_column(Boolean, default=True)
    optional: Mapped[bool] = mapped_column(Boolean, default=False)
    modality: Mapped[str | None] = mapped_column(String, nullable=True)
    date: Mapped[str | None] = mapped_column(String, nullable=True)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="blocks")


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    short_name: Mapped[str] = mapped_column(String, nullable=False)
    modality: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="courses")


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    course_id: Mapped[str | None] = mapped_column(String, nullable=True)
    priority: Mapped[str] = mapped_column(String, default="medium")
    deadline: Mapped[str | None] = mapped_column(String, nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=60)
    logged_minutes: Mapped[int] = mapped_column(Integer, default=0)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="tasks")


class StudyLog(Base):
    __tablename__ = "study_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    course_id: Mapped[str | None] = mapped_column(String, nullable=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class ExerciseSession(Base):
    __tablename__ = "exercise_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start: Mapped[str] = mapped_column(String, nullable=False)
    end: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    intensity: Mapped[str] = mapped_column(String, nullable=False)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="exercise_sessions")


class ExerciseLog(Base):
    __tablename__ = "exercise_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    type: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class DayRoutine(Base):
    __tablename__ = "day_routines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    wake_time: Mapped[str] = mapped_column(String, nullable=False)
    sleep_time: Mapped[str] = mapped_column(String, nullable=False)
    overloaded: Mapped[bool] = mapped_column(Boolean, default=False)
    overload_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="routines")


class BlockCheck(Base):
    __tablename__ = "block_checks"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    block_id: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=True)
    completed_at: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)


class DayException(Base):
    __tablename__ = "day_exceptions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    date: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    start: Mapped[str | None] = mapped_column(String, nullable=True)
    end: Mapped[str | None] = mapped_column(String, nullable=True)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="exceptions")


class CourseTopic(Base):
    __tablename__ = "course_topics"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    course_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[str] = mapped_column(String, nullable=False)
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    term_id: Mapped[str] = mapped_column(ForeignKey("terms.id", ondelete="CASCADE"))

    term: Mapped[Term] = relationship(back_populates="topics")


class BlockSkip(Base):
    __tablename__ = "block_skips"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    block_id: Mapped[str] = mapped_column(String, nullable=False)
    date: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
