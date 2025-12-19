-- =============================================
-- Portal Intelligence Database Schema
-- For Azure Database for MySQL (Flexible Server)
-- Version: 1.0
-- =============================================

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS IngressIntel
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE IngressIntel;

-- =============================================
-- Table: PortalIntelligence
-- Purpose: Store comprehensive portal data from Ingress Intel
-- =============================================

DROP TABLE IF EXISTS PortalIntelligence;

CREATE TABLE PortalIntelligence (
    -- === PRIMARY KEY ===
    PortalGUID VARCHAR(64) NOT NULL PRIMARY KEY,
    
    -- === LOCATION DATA ===
    Latitude DECIMAL(10, 7) NOT NULL,
    Longitude DECIMAL(10, 7) NOT NULL,
    LatE6 INT NOT NULL,
    LngE6 INT NOT NULL,
    
    -- === BASIC INFO ===
    PortalName VARCHAR(255) NULL,
    ImageURL VARCHAR(512) NULL,
    
    -- === STATUS ===
    Team VARCHAR(20) NULL COMMENT 'RESISTANCE, ENLIGHTENED, MACHINA, NEUTRAL',
    Level TINYINT UNSIGNED NULL,
    Health TINYINT UNSIGNED NULL,
    ResonatorCount TINYINT UNSIGNED NULL,
    
    -- === OWNER ===
    OwnerName VARCHAR(100) NULL,
    
    -- === LINKS & FIELDS ===
    LinkCount INT NULL DEFAULT 0,
    IncomingLinks INT NULL DEFAULT 0,
    OutgoingLinks INT NULL DEFAULT 0,
    FieldCount INT NULL DEFAULT 0,
    
    -- === HISTORY ===
    HistoryVisited BOOLEAN NULL DEFAULT FALSE,
    HistoryCaptured BOOLEAN NULL DEFAULT FALSE,
    HistoryScoutControlled BOOLEAN NULL DEFAULT FALSE,
    
    -- === COMPLEX DATA (JSON) ===
    ResonatorsJSON JSON NULL COMMENT 'Array of 8 resonators with details',
    ModsJSON JSON NULL COMMENT 'Array of 4 mods with details',
    
    -- === METADATA ===
    FirstSeen DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    LastUpdated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UpdateCount INT NOT NULL DEFAULT 1,
    
    -- === SYNC TRACKING ===
    SyncStatus VARCHAR(20) NULL DEFAULT 'pending',
    LastSyncAttempt DATETIME NULL,
    SyncError TEXT NULL,
    
    -- === AUDIT ===
    CreatedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ModifiedDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_location (Latitude, Longitude),
    INDEX idx_team_level (Team, Level),
    INDEX idx_owner (OwnerName),
    INDEX idx_last_updated (LastUpdated DESC),
    INDEX idx_sync_status (SyncStatus),
    INDEX idx_history (HistoryCaptured, HistoryVisited, HistoryScoutControlled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- STORED PROCEDURES
-- =============================================

-- Upsert (Insert or Update) Portal Data
DROP PROCEDURE IF EXISTS usp_UpsertPortalIntel;

DELIMITER //

CREATE PROCEDURE usp_UpsertPortalIntel(
    IN p_PortalGUID VARCHAR(64),
    IN p_Latitude DECIMAL(10, 7),
    IN p_Longitude DECIMAL(10, 7),
    IN p_LatE6 INT,
    IN p_LngE6 INT,
    IN p_PortalName VARCHAR(255),
    IN p_ImageURL VARCHAR(512),
    IN p_Team VARCHAR(20),
    IN p_Level TINYINT UNSIGNED,
    IN p_Health TINYINT UNSIGNED,
    IN p_ResonatorCount TINYINT UNSIGNED,
    IN p_OwnerName VARCHAR(100),
    IN p_LinkCount INT,
    IN p_IncomingLinks INT,
    IN p_OutgoingLinks INT,
    IN p_FieldCount INT,
    IN p_HistoryVisited BOOLEAN,
    IN p_HistoryCaptured BOOLEAN,
    IN p_HistoryScoutControlled BOOLEAN,
    IN p_ResonatorsJSON JSON,
    IN p_ModsJSON JSON,
    IN p_FirstSeen DATETIME,
    IN p_LastUpdated DATETIME,
    IN p_UpdateCount INT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO PortalIntelligence (
        PortalGUID, Latitude, Longitude, LatE6, LngE6,
        PortalName, ImageURL, Team, Level, Health,
        ResonatorCount, OwnerName, LinkCount, IncomingLinks,
        OutgoingLinks, FieldCount, HistoryVisited, HistoryCaptured,
        HistoryScoutControlled, ResonatorsJSON, ModsJSON,
        FirstSeen, LastUpdated, UpdateCount, SyncStatus,
        LastSyncAttempt, CreatedDate, ModifiedDate
    )
    VALUES (
        p_PortalGUID, p_Latitude, p_Longitude, p_LatE6, p_LngE6,
        p_PortalName, p_ImageURL, p_Team, p_Level, p_Health,
        p_ResonatorCount, p_OwnerName, p_LinkCount, p_IncomingLinks,
        p_OutgoingLinks, p_FieldCount, p_HistoryVisited, p_HistoryCaptured,
        p_HistoryScoutControlled, p_ResonatorsJSON, p_ModsJSON,
        p_FirstSeen, p_LastUpdated, p_UpdateCount, 'synced',
        NOW(), NOW(), NOW()
    )
    ON DUPLICATE KEY UPDATE
        Latitude = p_Latitude,
        Longitude = p_Longitude,
        LatE6 = p_LatE6,
        LngE6 = p_LngE6,
        PortalName = p_PortalName,
        ImageURL = p_ImageURL,
        Team = p_Team,
        Level = p_Level,
        Health = p_Health,
        ResonatorCount = p_ResonatorCount,
        OwnerName = p_OwnerName,
        LinkCount = p_LinkCount,
        IncomingLinks = p_IncomingLinks,
        OutgoingLinks = p_OutgoingLinks,
        FieldCount = p_FieldCount,
        HistoryVisited = p_HistoryVisited,
        HistoryCaptured = p_HistoryCaptured,
        HistoryScoutControlled = p_HistoryScoutControlled,
        ResonatorsJSON = p_ResonatorsJSON,
        ModsJSON = p_ModsJSON,
        LastUpdated = p_LastUpdated,
        UpdateCount = p_UpdateCount,
        SyncStatus = 'synced',
        LastSyncAttempt = NOW(),
        SyncError = NULL,
        ModifiedDate = NOW();
    
    COMMIT;
END//

DELIMITER ;

-- =============================================
-- VIEWS
-- =============================================

-- View: Portal Summary Statistics
DROP VIEW IF EXISTS vw_PortalSummaryStats;

CREATE VIEW vw_PortalSummaryStats AS
SELECT
    Team,
    Level,
    COUNT(*) AS PortalCount,
    AVG(Health) AS AvgHealth,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields,
    COUNT(DISTINCT OwnerName) AS UniqueOwners
FROM PortalIntelligence
WHERE Team IS NOT NULL
GROUP BY Team, Level;

-- View: Top Portal Owners
DROP VIEW IF EXISTS vw_TopPortalOwners;

CREATE VIEW vw_TopPortalOwners AS
SELECT
    OwnerName,
    Team,
    COUNT(*) AS PortalCount,
    AVG(Level) AS AvgPortalLevel,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields,
    MAX(LastUpdated) AS LastSeen
FROM PortalIntelligence
WHERE OwnerName IS NOT NULL
GROUP BY OwnerName, Team
ORDER BY PortalCount DESC
LIMIT 100;

-- View: Portal Activity Timeline
DROP VIEW IF EXISTS vw_PortalActivityTimeline;

CREATE VIEW vw_PortalActivityTimeline AS
SELECT
    DATE(LastUpdated) AS ActivityDate,
    Team,
    COUNT(*) AS PortalsUpdated,
    COUNT(DISTINCT OwnerName) AS ActiveOwners,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields
FROM PortalIntelligence
WHERE LastUpdated >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(LastUpdated), Team;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Calculate distance between two points (Haversine formula)
DROP FUNCTION IF EXISTS fn_CalculateDistance;

DELIMITER //

CREATE FUNCTION fn_CalculateDistance(
    lat1 DECIMAL(10, 7),
    lng1 DECIMAL(10, 7),
    lat2 DECIMAL(10, 7),
    lng2 DECIMAL(10, 7)
)
RETURNS DECIMAL(10, 2)
DETERMINISTIC
BEGIN
    DECLARE R DECIMAL(10, 2) DEFAULT 6371.0; -- Earth radius in kilometers
    DECLARE dLat DECIMAL(10, 7);
    DECLARE dLng DECIMAL(10, 7);
    DECLARE a DECIMAL(20, 10);
    DECLARE c DECIMAL(20, 10);
    DECLARE distance DECIMAL(10, 2);
    
    SET dLat = RADIANS(lat2 - lat1);
    SET dLng = RADIANS(lng2 - lng1);
    
    SET a = SIN(dLat / 2) * SIN(dLat / 2) +
            COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
            SIN(dLng / 2) * SIN(dLng / 2);
    
    SET c = 2 * ATAN2(SQRT(a), SQRT(1 - a));
    SET distance = R * c;
    
    RETURN distance;
END//

DELIMITER ;

-- =============================================
-- MAINTENANCE PROCEDURES
-- =============================================

-- Clean up old pending sync records
DROP PROCEDURE IF EXISTS usp_CleanupOldPendingSyncs;

DELIMITER //

CREATE PROCEDURE usp_CleanupOldPendingSyncs(IN days_old INT)
BEGIN
    DELETE FROM PortalIntelligence
    WHERE SyncStatus = 'pending'
    AND LastUpdated < DATE_SUB(NOW(), INTERVAL days_old DAY);
    
    SELECT ROW_COUNT() AS RowsDeleted;
END//

DELIMITER ;

-- Optimize tables
DROP PROCEDURE IF EXISTS usp_OptimizeTables;

DELIMITER //

CREATE PROCEDURE usp_OptimizeTables()
BEGIN
    OPTIMIZE TABLE PortalIntelligence;
    SELECT 'Tables optimized' AS Status;
END//

DELIMITER ;

-- =============================================
-- SAMPLE QUERIES
-- =============================================

/*
-- Query 1: Get all portals within radius
SELECT 
    PortalGUID,
    PortalName,
    Team,
    Level,
    Health,
    OwnerName,
    Latitude,
    Longitude,
    fn_CalculateDistance(40.7128, -74.0060, Latitude, Longitude) AS DistanceKm
FROM PortalIntelligence
WHERE fn_CalculateDistance(40.7128, -74.0060, Latitude, Longitude) <= 5.0
ORDER BY DistanceKm;

-- Query 2: Portal statistics by team
SELECT 
    Team,
    COUNT(*) AS TotalPortals,
    AVG(Level) AS AvgLevel,
    AVG(Health) AS AvgHealth,
    SUM(LinkCount) AS TotalLinks,
    SUM(FieldCount) AS TotalFields
FROM PortalIntelligence
GROUP BY Team
ORDER BY TotalPortals DESC;

-- Query 3: Top 20 most connected portals
SELECT
    PortalGUID,
    PortalName,
    Team,
    Level,
    LinkCount,
    IncomingLinks,
    OutgoingLinks,
    FieldCount,
    OwnerName
FROM PortalIntelligence
ORDER BY LinkCount DESC
LIMIT 20;

-- Query 4: Recently updated portals
SELECT
    PortalGUID,
    PortalName,
    Team,
    Level,
    Health,
    OwnerName,
    LastUpdated,
    UpdateCount
FROM PortalIntelligence
ORDER BY LastUpdated DESC
LIMIT 50;

-- Query 5: Resonator ownership analysis
SELECT 
    JSON_UNQUOTE(JSON_EXTRACT(reso, '$.owner')) AS ResonatorOwner,
    JSON_UNQUOTE(JSON_EXTRACT(reso, '$.level')) AS ResonatorLevel,
    COUNT(*) AS ResonatorCount
FROM PortalIntelligence,
     JSON_TABLE(
         ResonatorsJSON,
         '$[*]' COLUMNS (
             reso JSON PATH '$'
         )
     ) AS resonators
WHERE JSON_UNQUOTE(JSON_EXTRACT(reso, '$.owner')) IS NOT NULL
GROUP BY ResonatorOwner, ResonatorLevel
ORDER BY ResonatorCount DESC;

-- Query 6: Mod deployment statistics
SELECT 
    JSON_UNQUOTE(JSON_EXTRACT(mod, '$.name')) AS ModName,
    JSON_UNQUOTE(JSON_EXTRACT(mod, '$.rarity')) AS ModRarity,
    JSON_UNQUOTE(JSON_EXTRACT(mod, '$.owner')) AS ModOwner,
    COUNT(*) AS ModCount
FROM PortalIntelligence,
     JSON_TABLE(
         ModsJSON,
         '$[*]' COLUMNS (
             mod JSON PATH '$'
         )
     ) AS mods
WHERE JSON_UNQUOTE(JSON_EXTRACT(mod, '$.name')) IS NOT NULL
GROUP BY ModName, ModRarity, ModOwner
ORDER BY ModCount DESC;

-- Query 7: Portal history summary
SELECT
    SUM(CASE WHEN HistoryVisited = TRUE THEN 1 ELSE 0 END) AS VisitedCount,
    SUM(CASE WHEN HistoryCaptured = TRUE THEN 1 ELSE 0 END) AS CapturedCount,
    SUM(CASE WHEN HistoryScoutControlled = TRUE THEN 1 ELSE 0 END) AS ScoutControlledCount,
    COUNT(*) AS TotalPortals,
    (SUM(CASE WHEN HistoryVisited = TRUE THEN 1 ELSE 0 END) / COUNT(*)) * 100 AS VisitedPercent,
    (SUM(CASE WHEN HistoryCaptured = TRUE THEN 1 ELSE 0 END) / COUNT(*)) * 100 AS CapturedPercent
FROM PortalIntelligence;

-- Query 8: Sync status overview
SELECT
    SyncStatus,
    COUNT(*) AS Count,
    MAX(LastSyncAttempt) AS LastSync
FROM PortalIntelligence
GROUP BY SyncStatus
ORDER BY Count DESC;
*/

-- =============================================
-- USAGE EXAMPLES
-- =============================================

/*
-- Regular maintenance tasks (run weekly):
CALL usp_OptimizeTables();
CALL usp_CleanupOldPendingSyncs(30);

-- Example upsert:
CALL usp_UpsertPortalIntel(
    'abc123.16',           -- PortalGUID
    40.7128,               -- Latitude
    -74.0060,              -- Longitude
    40712800,              -- LatE6
    -74006000,             -- LngE6
    'City Hall',           -- PortalName
    'https://...',         -- ImageURL
    'RESISTANCE',          -- Team
    7,                     -- Level
    85,                    -- Health
    8,                     -- ResonatorCount
    'AgentName',           -- OwnerName
    12, 5, 7,              -- LinkCount, IncomingLinks, OutgoingLinks
    3,                     -- FieldCount
    TRUE, FALSE, FALSE,    -- HistoryVisited, HistoryCaptured, HistoryScoutControlled
    '[{"slot":0,"level":8}]',  -- ResonatorsJSON
    '[{"slot":0,"name":"Shield"}]',  -- ModsJSON
    NOW(),                 -- FirstSeen
    NOW(),                 -- LastUpdated
    1                      -- UpdateCount
);
*/

SELECT 'Portal Intelligence Database Schema created successfully!' AS Status;
