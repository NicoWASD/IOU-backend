-- CreateEnum
CREATE TYPE "TipoDivision" AS ENUM ('IGUAL', 'MONTOS', 'PORCENTAJE');

-- CreateTable
CREATE TABLE "gastos" (
    "id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "descripcion" VARCHAR(100) NOT NULL,
    "monto_centavos" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "pagado_por" UUID NOT NULL,
    "tipo_division" "TipoDivision" NOT NULL,
    "creado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participaciones_gasto" (
    "gasto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "monto_centavos" BIGINT NOT NULL,
    "porcentaje" DECIMAL(5,2),

    CONSTRAINT "participaciones_gasto_pkey" PRIMARY KEY ("gasto_id","usuario_id")
);

-- CreateIndex
CREATE INDEX "gastos_grupo_id_fecha_created_at_idx" ON "gastos"("grupo_id", "fecha" DESC, "created_at" DESC);

-- CreateIndex
CREATE INDEX "participaciones_gasto_usuario_id_idx" ON "participaciones_gasto"("usuario_id");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_pagado_por_fkey" FOREIGN KEY ("pagado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_gasto" ADD CONSTRAINT "participaciones_gasto_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participaciones_gasto" ADD CONSTRAINT "participaciones_gasto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
