-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "de_usuario" UUID NOT NULL,
    "a_usuario" UUID NOT NULL,
    "monto_centavos" BIGINT NOT NULL,
    "fecha" DATE NOT NULL,
    "creado_por" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_grupo_id_fecha_idx" ON "pagos"("grupo_id", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_de_usuario_fkey" FOREIGN KEY ("de_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_a_usuario_fkey" FOREIGN KEY ("a_usuario") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
