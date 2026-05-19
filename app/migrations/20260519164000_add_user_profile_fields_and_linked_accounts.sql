ALTER TABLE "usuario" ADD COLUMN "telefone" TEXT;
ALTER TABLE "usuario" ADD COLUMN "login_campo" TEXT NOT NULL DEFAULT 'email';

CREATE TABLE "usuario_conta_linkada" (
    "usuario_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "linked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("usuario_id", "provider", "provider_user_id"),
    CONSTRAINT "usuario_conta_linkada_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_usuario_conta_linkada_usuario" ON "usuario_conta_linkada"("usuario_id");
