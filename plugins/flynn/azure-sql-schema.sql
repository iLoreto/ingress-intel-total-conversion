-- =============================================
-- Portal Intelligence Database Schema
-- For Azure SQL Database
-- Version: 1.0
-- =============================================

USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'IngressIntel')
BEGIN
    CREATE DATABASE IngressIntel;
END
GO

USE IngressIntel;
GO

-- =============================================
-- Table: PortalIntelligence
-- Purpose: Store comprehensive portal data from Ingress Intel
-- =============================================

IF OBJECT_ID('dbo.PortalIntelligence', 'U') IS NOT NULL
    DROP TABLE dbo.PortalIntelligence;
GO

CREATE TABLE dbo.PortalIntelligence
(
    -- === PRIMARY KEY ===
    PortalGUID NVARCHAR(64) NOT NULL PRIMARY KEY,
    
    -- === LOCATION DATA ===
    Latitude DECIMAL(10, 7) NOT NULL,
    Longitude DECIMAL(10, 7) NOT NULL,
    LatE6 INT NOT NULL,
    LngE6 INT NOT NULL,
    
    -- === BASIC INFO ===
    PortalName NVARCHAR(255) NULL,
    ImageURL NVARCHAR(512) NULL,
    
    -- === STATUS ===
    Team NVARCHAR(20) NULL,  -- RESISTANCE, ENLIGHTENED, MACHINA, NEUTRAL
    Level TINYINT NULL,
    Health TINYINT NULL,
    ResonatorCount TINYINT NULL,
    
    -- === OWNER ===
    OwnerName NVARCHAR(100) NULL,
    
    -- === LINKS & FIELDS ===
    LinkCount INT NULL DEFAULT 0,
    IncomingLinks INT NULL DEFAULT 0,
    OutgoingLinks INT NULL DEFAULT 0,
    FieldCount INT NULL DEFAULT 0,
    
    -- === HISTORY ===
    HistoryVisited BIT NULL DEFAULT 0,
    HistoryCaptured BIT NULL DEFAULT 0,
    HistoryScoutControlled BIT NULL DEFAULT 0,
    
    -- === COMPLEX DATA (JSON) ===
    ResonatorsJSON NVARCHAR(MAX) NULL,  -- Array of 8 resonators with details
    ModsJSON NVARCHAR(MAX) NULL,        -- Array of 4 mods with details
    
    -- === METADATA ===
    FirstSeen DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    LastUpdated DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    UpdateCount INT NOT NULL DEFAULT 1,
    
    -- === SYNC TRACKING ===
    SyncStatus NVARCHAR(20) NULL DEFAULT 'pending',
    LastSyncAttempt DATETIME2 NULL,
    SyncError NVARCHAR(MAX) NULL,
    
    -- === AUDIT ===
    CreatedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ModifiedDate DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);
GO

-- =============================================
-- INDEXES
-- =============================================

-- Location-based queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_Location
ON dbo.PortalIntelligence (Latitude, Longitude);
GO

-- Team and level queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_Team_Level
ON dbo.PortalIntelligence (Team, Level)
INCLUDE (Health, ResonatorCount);
GO

-- Owner queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_Owner
ON dbo.PortalIntelligence (OwnerName)
WHERE OwnerName IS NOT NULL;
GO

-- Last updated queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_LastUpdated
ON dbo.PortalIntelligence (LastUpdated DESC);
GO

-- Sync status queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_SyncStatus
ON dbo.PortalIntelligence (SyncStatus)
WHERE SyncStatus = 'pending' OR SyncStatus = 'error';
GO

-- History queries
CREATE NONCLUSTERED INDEX IX_PortalIntelligence_History
ON dbo.PortalIntelligence (HistoryCaptured, HistoryVisited, HistoryScoutControlled);
GO

-- =============================================
-- STORED PROCEDURES
-- =============================================

-- Upsert (Merge) Portal Data
IF OBJECT_ID('dbo.usp_UpsertPortalIntel', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_UpsertPortalIntel;
GO

CREATE PROCEDURE dbo.usp_UpsertPortalIntel
    @PortalGUID NVARCHAR(64),
    @Latitude DECIMAL(10, 7),
    @Longitude DECIMAL(10, 7),
    @LatE6 INT,
    @LngE6 INT,
    @PortalName NVARCHAR(255),
    @ImageURL NVARCHAR(512),
    @Team NVARCHAR(20),
    @Level TINYINT,
    @Health TINYINT,
    @ResonatorCount TINYINT,
    @OwnerName NVARCHAR(100),
    @LinkCount INT,
    @IncomingLinks INT,
    @OutgoingLinks INT,
    @FieldCount INT,
    @HistoryVisited BIT,
    @HistoryCaptured BIT,
    @HistoryScoutControlled BIT,
    @ResonatorsJSON NVARCHAR(MAX),
    @ModsJSON NVARCHAR(MAX),
    @FirstSeen DATETIME2,
    @LastUpdated DATETIME2,
    @UpdateCount INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        MERGE dbo.PortalIntelligence AS target
        USING (SELECT @PortalGUID AS PortalGUID) AS source
        ON target.PortalGUID = source.PortalGUID
        
        WHEN MATCHED THEN
            UPDATE SET
                Latitude = @Latitude,
                Longitude = @Longitude,
                LatE6 = @LatE6,
                LngE6 = @LngE6,
                PortalName = @PortalName,
                ImageURL = @ImageURL,
                Team = @Team,
                Level = @Level,
                Health = @Health,
                ResonatorCount = @ResonatorCount,
                OwnerName = @OwnerName,
                LinkCount = @LinkCount,
                IncomingLinks = @IncomingLinks,
                OutgoingLinks = @OutgoingLinks,
                FieldCount = @FieldCount,
                HistoryVisited = @HistoryVisited,
                HistoryCaptured = @HistoryCaptured,
                HistoryScoutControlled = @HistoryScoutControlled,
                ResonatorsJSON = @ResonatorsJSON,
                ModsJSON = @ModsJSON,
                LastUpdated = @LastUpdated,
                UpdateCount = @UpdateCount,
                SyncStatus = 'synced',
                LastSyncAttempt = GETUTCDATE(),
                SyncError = NULL,
                ModifiedDate = GETUTCDATE()
        
        WHEN NOT MATCHED THEN
            INSERT (
                PortalGUID, Latitude, Longitude, LatE6, LngE6,
                PortalName, ImageURL, Team, Level, Health,
                ResonatorCount, OwnerName, LinkCount, IncomingLinks,
                OutgoingLinks, FieldCount, HistoryVisited, HistoryCaptured,
                HistoryScoutControlled, ResonatorsJSON, ModsJSON,
                FirstSeen, LastUpdated, UpdateCount, SyncStatus,
                LastSyncAttempt, CreatedDate, ModifiedDate
            )
            VALUES (
                @PortalGUID, @Latitude, @Longitude, @LatE6, @LngE6,
                @PortalName, @ImageURL, @Team, @Level, @Health,
                @ResonatorCount, @OwnerName, @LinkCount, @IncomingLinks,
                @OutgoingLinks, @FieldCount, @HistoryVisited, @HistoryCaptured,
                @HistoryScoutControlled, @ResonatorsJSON, @ModsJSON,
                @FirstSeen, @LastUpdated, @UpdateCount, 'synced',
                GETUTCDATE(), GETUTCDATE(), GETUTCDATE()
            );
        
        COMMIT TRANSACTION;
        RETURN 0;
        
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
        DECLARE @ErrorState INT = ERROR_STATE();
        
        RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
        RETURN -1;
    END CATCH
END
GO

-- =============================================
-- VIEWS
-- =============================================

-- View: Portal Summary Statistics
IF OBJECT_ID('dbo.vw_PortalSummaryStats', 'V') IS NOT NULL
    DROP VIEW dbo.vw_PortalSummaryStats;
GO

CREATE VIEW dbo.vw_PortalSummaryStats
AS
SELECT
    Team,
    Level,
    COUNT(*) AS PortalCount,
    AVG(CAST(Health AS FLOAT)) AS AvgHealth,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields,
    COUNT(DISTINCT OwnerName) AS UniqueOwners
FROM dbo.PortalIntelligence
WHERE Team IS NOT NULL
GROUP BY Team, Level;
GO

-- View: Top Portal Owners
IF OBJECT_ID('dbo.vw_TopPortalOwners', 'V') IS NOT NULL
    DROP VIEW dbo.vw_TopPortalOwners;
GO

CREATE VIEW dbo.vw_TopPortalOwners
AS
SELECT TOP 100
    OwnerName,
    Team,
    COUNT(*) AS PortalCount,
    AVG(CAST(Level AS FLOAT)) AS AvgPortalLevel,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields,
    MAX(LastUpdated) AS LastSeen
FROM dbo.PortalIntelligence
WHERE OwnerName IS NOT NULL
GROUP BY OwnerName, Team
ORDER BY PortalCount DESC;
GO

-- View: Portal Activity Timeline
IF OBJECT_ID('dbo.vw_PortalActivityTimeline', 'V') IS NOT NULL
    DROP VIEW dbo.vw_PortalActivityTimeline;
GO

CREATE VIEW dbo.vw_PortalActivityTimeline
AS
SELECT
    CAST(LastUpdated AS DATE) AS ActivityDate,
    Team,
    COUNT(*) AS PortalsUpdated,
    COUNT(DISTINCT OwnerName) AS ActiveOwners,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields
FROM dbo.PortalIntelligence
WHERE LastUpdated >= DATEADD(DAY, -30, GETUTCDATE())
GROUP BY CAST(LastUpdated AS DATE), Team;
GO

-- =============================================
-- FUNCTIONS
-- =============================================

-- Calculate distance between two points (Haversine formula)
IF OBJECT_ID('dbo.fn_CalculateDistance', 'FN') IS NOT NULL
    DROP FUNCTION dbo.fn_CalculateDistance;
GO

CREATE FUNCTION dbo.fn_CalculateDistance
(
    @Lat1 DECIMAL(10, 7),
    @Lng1 DECIMAL(10, 7),
    @Lat2 DECIMAL(10, 7),
    @Lng2 DECIMAL(10, 7)
)
RETURNS DECIMAL(10, 2)
AS
BEGIN
    DECLARE @R DECIMAL(10, 2) = 6371.0; -- Earth radius in kilometers
    DECLARE @dLat DECIMAL(10, 7) = RADIANS(@Lat2 - @Lat1);
    DECLARE @dLng DECIMAL(10, 7) = RADIANS(@Lng2 - @Lng1);
    
    DECLARE @a DECIMAL(20, 10) = 
        SIN(@dLat / 2) * SIN(@dLat / 2) +
        COS(RADIANS(@Lat1)) * COS(RADIANS(@Lat2)) *
        SIN(@dLng / 2) * SIN(@dLng / 2);
    
    DECLARE @c DECIMAL(20, 10) = 2 * ATN2(SQRT(@a), SQRT(1 - @a));
    DECLARE @distance DECIMAL(10, 2) = @R * @c;
    
    RETURN @distance;
END
GO

-- =============================================
-- SAMPLE QUERIES
-- =============================================

-- Query 1: Get all portals within radius
/*
DECLARE @CenterLat DECIMAL(10,7) = 40.7128;
DECLARE @CenterLng DECIMAL(10,7) = -74.0060;
DECLARE @RadiusKm DECIMAL(10,2) = 5.0;

SELECT 
    PortalGUID,
    PortalName,
    Team,
    Level,
    Health,
    OwnerName,
    Latitude,
    Longitude,
    dbo.fn_CalculateDistance(@CenterLat, @CenterLng, Latitude, Longitude) AS DistanceKm
FROM dbo.PortalIntelligence
WHERE dbo.fn_CalculateDistance(@CenterLat, @CenterLng, Latitude, Longitude) <= @RadiusKm
ORDER BY DistanceKm;
*/

-- Query 2: Portal statistics by team
/*
SELECT 
    Team,
    COUNT(*) AS TotalPortals,
    AVG(CAST(Level AS FLOAT)) AS AvgLevel,
    AVG(CAST(Health AS FLOAT)) AS AvgHealth,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields
FROM dbo.PortalIntelligence
GROUP BY Team
ORDER BY TotalPortals DESC;
*/

-- Query 3: Top 20 most connected portals
/*
SELECT TOP 20
    PortalGUID,
    PortalName,
    Team,
    Level,
    LinkCount,
    IncomingLinks,
    OutgoingLinks,
    FieldCount,
    OwnerName
FROM dbo.PortalIntelligence
ORDER BY LinkCount DESC;
*/

-- Query 4: Recently updated portals
/*
SELECT TOP 50
    PortalGUID,
    PortalName,
    Team,
    Level,
    Health,
    OwnerName,
    LastUpdated,
    UpdateCount
FROM dbo.PortalIntelligence
ORDER BY LastUpdated DESC;
*/

-- Query 5: Resonator ownership analysis
/*
SELECT 
    JSON_VALUE(value, '$.owner') AS ResonatorOwner,
    JSON_VALUE(value, '$.level') AS ResonatorLevel,
    COUNT(*) AS ResonatorCount
FROM dbo.PortalIntelligence
CROSS APPLY OPENJSON(ResonatorsJSON)
WHERE JSON_VALUE(value, '$.owner') IS NOT NULL
GROUP BY 
    JSON_VALUE(value, '$.owner'),
    JSON_VALUE(value, '$.level')
ORDER BY ResonatorCount DESC;
*/

-- Query 6: Mod deployment statistics
/*
SELECT 
    JSON_VALUE(value, '$.name') AS ModName,
    JSON_VALUE(value, '$.rarity') AS ModRarity,
    JSON_VALUE(value, '$.owner') AS ModOwner,
    COUNT(*) AS ModCount
FROM dbo.PortalIntelligence
CROSS APPLY OPENJSON(ModsJSON)
WHERE JSON_VALUE(value, '$.name') IS NOT NULL
GROUP BY 
    JSON_VALUE(value, '$.name'),
    JSON_VALUE(value, '$.rarity'),
    JSON_VALUE(value, '$.owner')
ORDER BY ModCount DESC;
*/

-- Query 7: Portal history summary
/*
SELECT
    SUM(CASE WHEN HistoryVisited = 1 THEN 1 ELSE 0 END) AS VisitedCount,
    SUM(CASE WHEN HistoryCaptured = 1 THEN 1 ELSE 0 END) AS CapturedCount,
    SUM(CASE WHEN HistoryScoutControlled = 1 THEN 1 ELSE 0 END) AS ScoutControlledCount,
    COUNT(*) AS TotalPortals,
    CAST(SUM(CASE WHEN HistoryVisited = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 AS VisitedPercent,
    CAST(SUM(CASE WHEN HistoryCaptured = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 AS CapturedPercent
FROM dbo.PortalIntelligence;
*/

-- Query 8: Sync status overview
/*
SELECT
    SyncStatus,
    COUNT(*) AS Count,
    MAX(LastSyncAttempt) AS LastSync
FROM dbo.PortalIntelligence
GROUP BY SyncStatus
ORDER BY Count DESC;
*/

-- =============================================
-- MAINTENANCE PROCEDURES
-- =============================================

-- Clean up old pending sync records
IF OBJECT_ID('dbo.usp_CleanupOldPendingSyncs', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_CleanupOldPendingSyncs;
GO

CREATE PROCEDURE dbo.usp_CleanupOldPendingSyncs
    @DaysOld INT = 30
AS
BEGIN
    SET NOCOUNT ON;
    
    DELETE FROM dbo.PortalIntelligence
    WHERE SyncStatus = 'pending'
    AND LastUpdated < DATEADD(DAY, -@DaysOld, GETUTCDATE());
    
    SELECT @@ROWCOUNT AS RowsDeleted;
END
GO

-- Update statistics
IF OBJECT_ID('dbo.usp_UpdateStatistics', 'P') IS NOT NULL
    DROP PROCEDURE dbo.usp_UpdateStatistics;
GO

CREATE PROCEDURE dbo.usp_UpdateStatistics
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE STATISTICS dbo.PortalIntelligence WITH FULLSCAN;
    
    SELECT 'Statistics updated' AS Status;
END
GO

-- =============================================
-- PERMISSIONS (Example - adjust as needed)
-- =============================================

/*
-- Create a read-only user
CREATE USER IngressIntelReader WITH PASSWORD = 'YourSecurePassword';
GRANT SELECT ON dbo.PortalIntelligence TO IngressIntelReader;
GRANT SELECT ON dbo.vw_PortalSummaryStats TO IngressIntelReader;
GRANT SELECT ON dbo.vw_TopPortalOwners TO IngressIntelReader;
GRANT SELECT ON dbo.vw_PortalActivityTimeline TO IngressIntelReader;

-- Create a write user (for Azure Function)
CREATE USER IngressIntelWriter WITH PASSWORD = 'YourSecurePassword';
GRANT SELECT, INSERT, UPDATE ON dbo.PortalIntelligence TO IngressIntelWriter;
GRANT EXECUTE ON dbo.usp_UpsertPortalIntel TO IngressIntelWriter;
*/

-- =============================================
-- BACKUP AND MAINTENANCE
-- =============================================

/*
-- Regular maintenance tasks (run weekly):
EXEC dbo.usp_UpdateStatistics;
EXEC dbo.usp_CleanupOldPendingSyncs @DaysOld = 30;

-- Index maintenance (run monthly):
ALTER INDEX ALL ON dbo.PortalIntelligence REORGANIZE;

-- Full backup (configure Azure SQL auto-backup):
-- Azure SQL Database handles automatic backups
-- Configure retention policy in Azure Portal
*/

PRINT 'Portal Intelligence Database Schema created successfully!';
GO
