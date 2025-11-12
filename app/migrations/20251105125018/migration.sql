/*
  Warnings:

  - Made the column `slug` on table `grupo` required. This step will fail if there are existing NULL values in that column.

*/

-- Provisionally add the slug column so we can backfill data before the table redefinition.
ALTER TABLE "grupo" ADD COLUMN "slug" TEXT;

-- Seed slug values based on the current title using a basic slugify routine.
UPDATE "grupo"
SET "slug" = lower(
    replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  replace(
                                    replace(
                                      replace(
                                        replace(
                                          replace(
                                            replace(
                                              replace(
                                                replace(
                                                  replace(
                                                    trim(titulo),
                                                    ' ', '-'
                                                  ),
                                                  'á', 'a'
                                                ),
                                                'à', 'a'
                                              ),
                                              'â', 'a'
                                            ),
                                            'ã', 'a'
                                          ),
                                          'ä', 'a'
                                        ),
                                        'é', 'e'
                                      ),
                                      'è', 'e'
                                    ),
                                    'ê', 'e'
                                  ),
                                  'ë', 'e'
                                ),
                                'í', 'i'
                              ),
                              'ì', 'i'
                            ),
                            'î', 'i'
                          ),
                          'ï', 'i'
                        ),
                        'ó', 'o'
                      ),
                      'ò', 'o'
                    ),
                    'ô', 'o'
                  ),
                  'õ', 'o'
                ),
                'ö', 'o'
              ),
              'ú', 'u'
            ),
            'ù', 'u'
          ),
          'û', 'u'
        ),
        'ü', 'u'
      ),
      'ç', 'c'
    )
  )
WHERE "slug" IS NULL OR "slug" = '';

-- Strip punctuation that can interfere with URL-safe slugs.
UPDATE "grupo"
SET "slug" = replace(
  replace(
    replace(
      replace(
        replace(
          "slug",
          '''', ''
        ),
        '"', ''
      ),
      '.', ''
    ),
    ',', ''
  ),
  ';', ''
)
WHERE "slug" IS NOT NULL;

-- Collapse repeated separators to a single dash.
UPDATE "grupo"
SET "slug" = replace(replace("slug", '---', '-'), '--', '-')
WHERE "slug" LIKE '%--%' OR "slug" LIKE '%---%';

UPDATE "grupo"
SET "slug" = replace("slug", '__', '-')
WHERE "slug" LIKE '%__%';

-- Remove leading and trailing hyphens.
UPDATE "grupo"
SET "slug" = trim("slug", '-')
WHERE "slug" IS NOT NULL;

-- Ensure every row has a fallback slug value.
UPDATE "grupo"
SET "slug" = lower(hex(randomblob(4)))
WHERE "slug" IS NULL OR "slug" = '';

-- De-duplicate any conflicting slugs by appending a numeric suffix.
WITH ranked AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM grupo
)
UPDATE grupo
SET slug = slug || '-' || (
  SELECT rn - 1 FROM ranked WHERE ranked.id = grupo.id
)
WHERE id IN (
  SELECT id FROM ranked WHERE rn > 1
);

-- Redefine the table so the slug column becomes NOT NULL and enforce uniqueness.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_grupo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "criado_por" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data_sorteio" DATETIME,
    "data_revelacao" DATETIME,
    "status" TEXT NOT NULL,
    "criado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "grupo_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_grupo" ("criado_em", "criado_por", "data_revelacao", "data_sorteio", "descricao", "id", "slug", "status", "titulo")
SELECT "criado_em", "criado_por", "data_revelacao", "data_sorteio", "descricao", "id", "slug", "status", "titulo" FROM "grupo";
DROP TABLE "grupo";
ALTER TABLE "new_grupo" RENAME TO "grupo";
CREATE UNIQUE INDEX "grupo_slug_key" ON "grupo"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
