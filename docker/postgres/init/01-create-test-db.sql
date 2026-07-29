-- Runs once on first volume init. Creates the isolated test database used by
-- the api integration/e2e suite so tests never touch dev data.
CREATE DATABASE oses_test OWNER oses;
