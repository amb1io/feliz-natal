-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "avatar" TEXT,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "grupo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "criado_por" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data_sorteio" DATETIME,
    "data_revelacao" DATETIME,
    "status" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grupo_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupo_metadata" (
    "grupo_id" TEXT NOT NULL PRIMARY KEY,
    "tipo_presente" TEXT,
    "orcamento_minimo" DECIMAL,
    "orcamento_maximo" DECIMAL,
    "orcamento_sem_limites" BOOLEAN NOT NULL DEFAULT false,
    "localizacao" TEXT,
    CONSTRAINT "grupo_metadata_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupo_tag" (
    "grupo_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    PRIMARY KEY ("grupo_id", "tag"),
    CONSTRAINT "grupo_tag_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "grupo_participante" (
    "grupo_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "perfil" TEXT,
    "is_confirmado" BOOLEAN NOT NULL DEFAULT false,
    "is_revelado" BOOLEAN NOT NULL DEFAULT false,
    "is_ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aderido_em" DATETIME,

    PRIMARY KEY ("grupo_id", "usuario_id"),
    CONSTRAINT "grupo_participante_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "grupo_participante_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sorteio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupo_id" TEXT NOT NULL,
    "sorteado_em" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    CONSTRAINT "sorteio_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sorteio_resultado" (
    "sorteio_id" TEXT NOT NULL,
    "recipiente_id" TEXT NOT NULL,
    "remetente_id" TEXT NOT NULL,

    PRIMARY KEY ("sorteio_id", "remetente_id"),
    CONSTRAINT "sorteio_resultado_sorteio_id_fkey" FOREIGN KEY ("sorteio_id") REFERENCES "sorteio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sorteio_resultado_recipiente_id_fkey" FOREIGN KEY ("recipiente_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sorteio_resultado_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "mensagem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "grupo_id" TEXT NOT NULL,
    "recipiente_id" TEXT,
    "remetente_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletado_em" DATETIME,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "mensagem_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mensagem_recipiente_id_fkey" FOREIGN KEY ("recipiente_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "mensagem_remetente_id_fkey" FOREIGN KEY ("remetente_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");
