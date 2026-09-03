-- Bootstrap: the seeded owner account becomes the OWNER (one bootstrap
-- per Round  — OWNER is the org-owner role; there is exactly one).
UPDATE "User" SET "role" = 'OWNER' WHERE "email" = 'owner@example.in';