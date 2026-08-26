-- Ejecuta esto conectado a la base "postgres" (usuario postgres).
-- Corrige el rol de la app y le da la base organi_day.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'organi') THEN
    CREATE ROLE organi LOGIN PASSWORD 'organi_local';
  ELSE
    ALTER ROLE organi WITH LOGIN PASSWORD 'organi_local';
  END IF;
END
$$;

ALTER DATABASE organi_day OWNER TO organi;
GRANT ALL PRIVILEGES ON DATABASE organi_day TO organi;
