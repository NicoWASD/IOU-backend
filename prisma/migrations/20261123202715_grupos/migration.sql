-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'MIEMBRO');

-- CreateTable
CREATE TABLE "grupos" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(60) NOT NULL,
    "descripcion" VARCHAR(200),
    "moneda" CHAR(3) NOT NULL DEFAULT 'ARS',
    "archivado" BOOLEAN NOT NULL DEFAULT false,
    "creado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "miembros_grupo" (
    "grupo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'MIEMBRO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fecha_alta" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembros_grupo_pkey" PRIMARY KEY ("grupo_id","usuario_id")
);

-- CreateIndex
CREATE INDEX "miembros_grupo_usuario_id_idx" ON "miembros_grupo"("usuario_id");

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_grupo" ADD CONSTRAINT "miembros_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "miembros_grupo" ADD CONSTRAINT "miembros_grupo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
