-- H6: @usuario, perfil, invitaciones y medios de cobro (RN-19 a RN-22)

-- Perfil: el nombre actual pasa a ser el nombre de pila; `nombre` queda como nombre visible
ALTER TABLE "usuarios"
  ADD COLUMN "usuario" VARCHAR(20),
  ADD COLUMN "nombre_real" VARCHAR(40),
  ADD COLUMN "apellido" VARCHAR(40),
  ADD COLUMN "tutorial_visto" BOOLEAN NOT NULL DEFAULT false;

UPDATE "usuarios" SET "nombre_real" = LEFT("nombre", 40);
-- Los que ya usan la app no ven la guía de primer uso
UPDATE "usuarios" SET "tutorial_visto" = true;

-- usuario = parte local del mail normalizada; si queda corta se completa; duplicados con _2, _3…
WITH base AS (
  SELECT id, created_at,
    LEFT(
      CASE WHEN LENGTH(b) < 3 THEN b || 'user' ELSE b END, 17
    ) AS b
  FROM (
    SELECT id, created_at,
      regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.]', '', 'g') AS b
    FROM "usuarios"
  ) x
), numerado AS (
  SELECT id, b, ROW_NUMBER() OVER (PARTITION BY b ORDER BY created_at, id) AS n FROM base
)
UPDATE "usuarios" u
SET "usuario" = CASE WHEN n.n = 1 THEN n.b ELSE n.b || '_' || n.n END
FROM numerado n WHERE n.id = u.id;

ALTER TABLE "usuarios" ALTER COLUMN "usuario" SET NOT NULL;
CREATE UNIQUE INDEX "usuarios_usuario_key" ON "usuarios"("usuario");

-- Invitaciones
CREATE TYPE "EstadoInvitacion" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'CANCELADA');

CREATE TABLE "invitaciones" (
    "id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "invitado_id" UUID NOT NULL,
    "invitador_id" UUID NOT NULL,
    "estado" "EstadoInvitacion" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "invitaciones_invitado_id_estado_idx" ON "invitaciones"("invitado_id", "estado");
CREATE INDEX "invitaciones_grupo_id_estado_idx" ON "invitaciones"("grupo_id", "estado");
-- RN-20: una sola invitación pendiente por persona y grupo
CREATE UNIQUE INDEX "invitaciones_pendiente_unica" ON "invitaciones"("grupo_id", "invitado_id") WHERE "estado" = 'PENDIENTE';
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_id_fkey" FOREIGN KEY ("invitado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitador_id_fkey" FOREIGN KEY ("invitador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Medios de cobro
CREATE TYPE "Plataforma" AS ENUM ('MERCADO_PAGO', 'UALA', 'BRUBANK', 'BANCO', 'OTRO');

CREATE TABLE "medios_cobro" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "valor" VARCHAR(60) NOT NULL,
    "nota" VARCHAR(60),
    "orden" INTEGER NOT NULL,
    CONSTRAINT "medios_cobro_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "medios_cobro_usuario_id_orden_idx" ON "medios_cobro"("usuario_id", "orden");
ALTER TABLE "medios_cobro" ADD CONSTRAINT "medios_cobro_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
