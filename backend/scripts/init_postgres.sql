-- Organi Day — Postgres local (pgAdmin).
--
-- Conéctate a la base "postgres" de tu servidor local.
-- CREATE DATABASE no puede ir en la misma transacción: ejecuta cada paso aparte
-- (selecciona el bloque y pulsa Execute).

-- Paso 1
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'organi') THEN
    CREATE ROLE organi LOGIN PASSWORD 'organi_local';
  END IF;
END
$$;

-- Paso 2 (ejecutar solo esta línea)
CREATE DATABASE organi_day OWNER organi;
