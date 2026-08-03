-- Existing publication records retain their state while the worker status is renamed.
ALTER TYPE "PublicationStatus" RENAME VALUE 'PUBLISHING' TO 'PROCESSING';
