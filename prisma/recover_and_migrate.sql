-- Script de migração segura de dados para o Neon PostgreSQL
-- Use este script APÓS restaurar o banco de dados pelo painel do Neon para o ponto antes do reset.

-- 1. Adiciona a nova coluna 'name' como anulável para evitar erros com linhas existentes
ALTER TABLE "Product" ADD COLUMN "name" TEXT;

-- 2. Copia os nomes existentes para a nova coluna (dando prioridade ao namePt)
UPDATE "Product" SET "name" = COALESCE("namePt", "nameEs", '');

-- 3. Altera a coluna 'name' para ser NOT NULL
ALTER TABLE "Product" ALTER COLUMN "name" SET NOT NULL;

-- 4. Remove as colunas antigas que não são mais utilizadas
ALTER TABLE "Product" DROP COLUMN "namePt", DROP COLUMN "nameEs";
