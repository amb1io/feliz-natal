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
    CONSTRAINT "notificacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notificacao_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_notificacao" ("body", "created_at", "id", "lido", "lido_em", "title", "usuario_id") SELECT "body", "created_at", "id", "lido", "lido_em", "title", "usuario_id" FROM "notificacao";
DROP TABLE "notificacao";
ALTER TABLE "new_notificacao" RENAME TO "notificacao";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
