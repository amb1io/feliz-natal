/*
  Warnings:

  - Added the required column `usuario_id` to the `presentes` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_presentes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuario_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" TEXT,
    "source" TEXT NOT NULL,
    "image" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
    CONSTRAINT "presentes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_presentes" ("created_at", "deleted_at", "id", "image", "price", "slug", "source", "titulo") SELECT "created_at", "deleted_at", "id", "image", "price", "slug", "source", "titulo" FROM "presentes";
DROP TABLE "presentes";
ALTER TABLE "new_presentes" RENAME TO "presentes";
CREATE UNIQUE INDEX "presentes_slug_key" ON "presentes"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
