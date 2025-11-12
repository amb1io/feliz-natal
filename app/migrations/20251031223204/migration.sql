-- CreateTable
CREATE TABLE "convite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupo_id" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "enviado_em" DATETIME,
    "aceito_em" DATETIME,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "convite_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "convite_token_key" ON "convite"("token");
