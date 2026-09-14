-- Store proof that the user explicitly accepted the current personal-data consent text.
ALTER TABLE "Lead" ADD COLUMN "consentAcceptedAt" DATETIME;
ALTER TABLE "Lead" ADD COLUMN "consentVersion" TEXT;
