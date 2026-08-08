-- Bir hesaba doğrulanmış ek eğitimler eklenebilir.
ALTER TYPE "VerificationPurpose" ADD VALUE IF NOT EXISTS 'ADD_EDUCATION';

CREATE TABLE "UserEducation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailDomain" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "classYear" INTEGER NOT NULL,
    "isStudentAddress" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEducation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserEducation_email_key" ON "UserEducation"("email");
CREATE INDEX "UserEducation_userId_idx" ON "UserEducation"("userId");
CREATE INDEX "UserEducation_universityId_department_idx" ON "UserEducation"("universityId", "department");

ALTER TABLE "UserEducation" ADD CONSTRAINT "UserEducation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserEducation" ADD CONSTRAINT "UserEducation_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
