-- Add slug column to grupo table
ALTER TABLE "grupo" ADD COLUMN "slug" TEXT;

-- Populate slug for existing records using a basic sanitization of the title
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

-- Remove a set of punctuation characters
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

-- Collapse consecutive hyphens and underscores
UPDATE "grupo"
SET "slug" = replace(replace("slug", '---', '-'), '--', '-')
WHERE "slug" LIKE '%--%' OR "slug" LIKE '%---%';

UPDATE "grupo"
SET "slug" = replace("slug", '__', '-')
WHERE "slug" LIKE '%__%';

-- Trim leading and trailing hyphens
UPDATE "grupo"
SET "slug" = trim("slug", '-')
WHERE "slug" IS NOT NULL;

-- Fallback to a random suffix when slug is empty after sanitization
UPDATE "grupo"
SET "slug" = lower(hex(randomblob(4)))
WHERE "slug" IS NULL OR "slug" = '';

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

-- Create a unique index on slug for lookup
CREATE UNIQUE INDEX IF NOT EXISTS "grupo_slug_key" ON "grupo" ("slug");
