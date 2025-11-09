-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notificacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "lido" BOOLEAN NOT NULL DEFAULT false,
    "lido_em" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grupo_id" TEXT,
    "mensagem_id" TEXT,
    CONSTRAINT "notificacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notificacao_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notificacao_mensagem_id_fkey" FOREIGN KEY ("mensagem_id") REFERENCES "mensagem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notificacao" ("body", "created_at", "grupo_id", "id", "lido", "lido_em", "title", "usuario_id") SELECT "body", "created_at", "grupo_id", "id", "lido", "lido_em", "title", "usuario_id" FROM "notificacao";
DROP TABLE "notificacao";
ALTER TABLE "new_notificacao" RENAME TO "notificacao";
CREATE INDEX "idx_notificacao_mensagem_id" ON "notificacao"("mensagem_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
