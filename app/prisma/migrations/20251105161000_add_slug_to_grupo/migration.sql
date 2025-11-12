-- Populate slug for existing records using a simple sanitized version of the title
UPDATE "grupo"
SET "slug" = lower(trim(titulo))
WHERE "slug" IS NULL OR "slug" = '';

-- Replace spaces and common separators with hyphens
UPDATE "grupo"
SET "slug" = replace(replace(replace("slug", ' ', '-'), '_', '-'), '--', '-')
WHERE "slug" IS NOT NULL;

-- Remove leading and trailing hyphens
UPDATE "grupo"
SET "slug" = trim("slug", '-')
WHERE "slug" IS NOT NULL;

-- Fallback slug for rows that may still be empty
UPDATE "grupo"
SET "slug" = lower(hex(randomblob(4)))
WHERE "slug" IS NULL OR "slug" = '';

-- Ensure uniqueness by appending a numeric suffix if needed
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

-- Create a unique index on the slug field
CREATE UNIQUE INDEX IF NOT EXISTS "grupo_slug_key" ON "grupo" ("slug");
