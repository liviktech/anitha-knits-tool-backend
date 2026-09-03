-- ============================================================
-- Migration: Enum types
-- Every enum used by later table definitions — must run before anything
-- that references one as a column type. Values verified against the live
-- database's pg_enum catalog; keep in sync with src/types/enums.ts.
-- ============================================================

CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'SUPERVISOR', 'EMPLOYEE');
CREATE TYPE "PlatformAdminRole" AS ENUM ('SUPER_ADMIN');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "AttendanceStatus" AS ENUM ('DAY_SHIFT', 'NIGHT_SHIFT', 'ABSENT', 'HALF_DAY', 'COMPANY_HOLIDAY');
CREATE TYPE "ProductionStage" AS ENUM ('EXTRUDER', 'LOOMS', 'FABRIC_CHECKING', 'DELIVERY');
CREATE TYPE "ProductionType" AS ENUM ('PRODUCTION', 'SAMPLE');
CREATE TYPE "ProductionRecordType" AS ENUM ('NORMAL', 'ADJUSTMENT', 'REVERSAL');
CREATE TYPE "InventoryType" AS ENUM ('HDPE', 'CHEMICAL', 'COLOR');
CREATE TYPE "KoraEntryType" AS ENUM ('CREDIT', 'DEBIT');
CREATE TYPE "RightAction" AS ENUM ('VIEW', 'ADD', 'EDIT', 'DELETE');
