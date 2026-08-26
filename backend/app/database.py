from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


def _prepare_sqlite() -> None:
    url = make_url(settings.database_url)
    if not url.drivername.startswith("sqlite"):
        return
    database = url.database
    if database and database != ":memory:":
        Path(database).parent.mkdir(parents=True, exist_ok=True)


def _engine_kwargs() -> dict:
    options: dict = {"pool_pre_ping": True}
    if settings.is_sqlite:
        options["connect_args"] = {"check_same_thread": False}
        return options
    options["pool_size"] = 5
    options["max_overflow"] = 10
    options["pool_recycle"] = 300
    parsed = make_url(settings.database_url)
    if parsed.port == 6543:
        options["connect_args"] = {"prepare_threshold": None}
    return options


_prepare_sqlite()
engine = create_engine(settings.database_url, **_engine_kwargs())
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def _add_column(table: str, column: str, definition: str) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    cols = {item["name"] for item in inspector.get_columns(table)}
    if column in cols:
        return
    with engine.begin() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def migrate_schema() -> None:
    Base.metadata.create_all(bind=engine)
    _add_column("terms", "protected_days", "VARCHAR DEFAULT '4'")
    _add_column("time_blocks", "date", "VARCHAR")
    _add_column("terms", "user_id", "VARCHAR")
    _add_column("study_logs", "user_id", "VARCHAR")
    _add_column("exercise_logs", "user_id", "VARCHAR")
    _add_column("block_checks", "user_id", "VARCHAR")
    _add_column("block_skips", "user_id", "VARCHAR")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
