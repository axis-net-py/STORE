-- Diretório de utilizadores no control plane.
--
-- Existe por uma razão só: no login não se sabe ainda de que cliente é a
-- pessoa, e com bases dedicadas não se sabe onde procurar o e-mail. Guarda o
-- e-mail e o cliente a que pertence — nunca a palavra-passe, que fica na base
-- do cliente.

CREATE TABLE "UserDirectory" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserDirectory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserDirectory_email_key" ON "UserDirectory"("email");
CREATE INDEX "UserDirectory_registryId_idx" ON "UserDirectory"("registryId");
