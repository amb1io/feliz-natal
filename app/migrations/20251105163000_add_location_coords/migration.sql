-- Add latitude and longitude columns for group metadata
ALTER TABLE "grupo_metadata" ADD COLUMN "localizacao_lat" REAL;
ALTER TABLE "grupo_metadata" ADD COLUMN "localizacao_lng" REAL;
