-- Rôles V2 : chat d'incident (suivi de lecture par utilisateur)
CREATE TABLE "IncidentRead" (
    "incidentId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "lastReadMessageId" INTEGER NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentRead_pkey" PRIMARY KEY ("incidentId","userId")
);

CREATE INDEX "IncidentRead_userId_idx" ON "IncidentRead"("userId");

ALTER TABLE "IncidentRead" ADD CONSTRAINT "IncidentRead_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IncidentRead" ADD CONSTRAINT "IncidentRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
