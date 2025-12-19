# Portal Intelligence Cache & Azure Sync Plugins

Two-phase intelligence gathering system for Ingress portals with Azure SQL Database integration.

## ?? Overview

These plugins enable automated collection and synchronization of portal intelligence data from the Ingress Intel map to an Azure SQL Database.

### Architecture

```
???????????????????????????????????????????????????????????????
?  Phase 1: Data Collection (Browser)                        ?
?  ??????????????????????????????????????????????????????    ?
?  ?  User Browses Map ? Clicks Portals ? Auto-Capture  ?    ?
?  ?  Data stored in browser localStorage               ?    ?
?  ??????????????????????????????????????????????????????    ?
???????????????????????????????????????????????????????????????
                           ?
???????????????????????????????????????????????????????????????
?  Phase 2: Automated Collection (Chrome Driver - Optional)  ?
?  ??????????????????????????????????????????????????????    ?
?  ?  Export Portal List ? Automate Browser Navigation  ?    ?
?  ?  Auto-capture via same hooks                       ?    ?
?  ??????????????????????????????????????????????????????    ?
???????????????????????????????????????????????????????????????
                           ?
???????????????????????????????????????????????????????????????
?  Phase 3: Database Sync                                     ?
?  ??????????????????????????????????????????????????????    ?
?  ?  Batch Upload ? Azure SQL Database                 ?    ?
?  ?  MERGE/UPSERT by Portal GUID                       ?    ?
?  ??????????????????????????????????????????????????????    ?
???????????????????????????????????????????????????????????????
```

## ?? Plugins Included

### 1. Portal Intelligence Cache (`portal-intel-cache.user.js`)

**Purpose**: Automatically capture and cache portal details as you browse the map.

**Features**:
- ? Auto-capture on portal click
- ? localStorage persistence
- ? Real-time statistics display
- ? Export to JSON/CSV
- ? Session tracking
- ? Storage quota management

**Data Captured**:
- Portal GUID, name, location (lat/lng)
- Team ownership (Resistance/Enlightened/Machina/Neutral)
- Portal level and health
- Owner name
- All 8 resonators (level, owner, energy, position)
- All 4 mods (type, rarity, owner, stats)
- Link counts (incoming/outgoing)
- Field counts
- Portal history (visited, captured, scout controlled)
- Timestamps (first seen, last updated)

### 2. Portal Intel Azure Sync (`portal-intel-sync.user.js`)

**Purpose**: Upload cached portal data to Azure SQL Database.

**Features**:
- ? Batch upload (100 portals per request)
- ? Configurable Azure endpoint
- ? API key authentication
- ? Sync status tracking
- ? Progress monitoring
- ? Error handling and retry logic
- ? Connection testing

## ?? Installation

### Step 1: Add Plugins to IITC

1. Copy both `.user.js` files to your IITC plugins folder
2. Reload IITC
3. Plugins will appear in the toolbox sidebar

### Step 2: Start Using

**Manual Collection Mode**:
```
1. Browse the Ingress Intel map
2. Click on portals to view details
3. Data automatically captured to cache
4. Monitor status bar at bottom-left of screen
```

**Export Data**:
```
Click "Export Intel (JSON)" or "Export Intel (CSV)" button
```

**View Statistics**:
```
Click green status bar or "Intel Stats" button
```

## ?? Azure SQL Database Setup

### Step 1: Create Database

```sql
-- See azure-sql-schema.sql for complete schema
CREATE DATABASE FlynnDB;
GO

USE FlynnDB;
GO
```

### Step 2: Create Table

Run the schema from `azure-sql-schema.sql` (included in this folder)

### Step 3: Create Azure Function API

Create an Azure Function (HTTP trigger) to receive the data:

```javascript
// function.json
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post"]
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

```javascript
// index.js
const sql = require('mssql');

module.exports = async function (context, req) {
    const portals = req.body.portals;
    
    if (!portals || !Array.isArray(portals)) {
        context.res = {
            status: 400,
            body: "Invalid request. Expected 'portals' array."
        };
        return;
    }

    try {
        const pool = await sql.connect({
            server: process.env["SQL_SERVER"],
            database: process.env["SQL_DATABASE"],
            user: process.env["SQL_USER"],
            password: process.env["SQL_PASSWORD"],
            options: {
                encrypt: true
            }
        });

        for (const portal of portals) {
            await pool.request()
                .input('PortalGUID', sql.NVarChar(64), portal.PortalGUID)
                .input('Latitude', sql.Decimal(10, 7), portal.Latitude)
                .input('Longitude', sql.Decimal(10, 7), portal.Longitude)
                .input('LatE6', sql.Int, portal.LatE6)
                .input('LngE6', sql.Int, portal.LngE6)
                .input('PortalName', sql.NVarChar(255), portal.PortalName)
                .input('ImageURL', sql.NVarChar(512), portal.ImageURL)
                .input('Team', sql.NVarChar(20), portal.Team)
                .input('Level', sql.TinyInt, portal.Level)
                .input('Health', sql.TinyInt, portal.Health)
                .input('ResonatorCount', sql.TinyInt, portal.ResonatorCount)
                .input('OwnerName', sql.NVarChar(100), portal.OwnerName)
                .input('LinkCount', sql.Int, portal.LinkCount)
                .input('IncomingLinks', sql.Int, portal.IncomingLinks)
                .input('OutgoingLinks', sql.Int, portal.OutgoingLinks)
                .input('FieldCount', sql.Int, portal.FieldCount)
                .input('HistoryVisited', sql.Bit, portal.HistoryVisited)
                .input('HistoryCaptured', sql.Bit, portal.HistoryCaptured)
                .input('HistoryScoutControlled', sql.Bit, portal.HistoryScoutControlled)
                .input('ResonatorsJSON', sql.NVarChar(sql.MAX), portal.ResonatorsJSON)
                .input('ModsJSON', sql.NVarChar(sql.MAX), portal.ModsJSON)
                .input('FirstSeen', sql.DateTime2, portal.FirstSeen)
                .input('LastUpdated', sql.DateTime2, portal.LastUpdated)
                .input('UpdateCount', sql.Int, portal.UpdateCount)
                .execute('usp_UpsertPortalIntel');
        }

        context.res = {
            status: 200,
            body: `Successfully processed ${portals.length} portals`
        };

    } catch (err) {
        context.log.error('Error:', err);
        context.res = {
            status: 500,
            body: `Error: ${err.message}`
        };
    }
};
```

### Step 4: Configure Plugin

1. Click "Configure Azure Sync" button
2. Enter Azure Function URL: `https://your-function-app.azurewebsites.net/api/UploadPortals`
3. Enter Function Key (from Azure Portal)
4. Click "Test Azure Connection" to verify

### Step 5: Sync Data

- **Sync All**: Uploads all cached portals
- **Sync Pending**: Uploads only unsynced portals

## ?? UI Components

### Status Bar (Bottom-Left)
```
?? Intel Cache: 1,247 total | 23 this session | 150 pending sync
```
- Click to view detailed statistics
- Real-time updates
- Color-coded status

### Toolbox Buttons

**Portal Intelligence Cache**:
- Export Intel (JSON) - For Azure sync
- Export Intel (CSV) - For Excel analysis
- Intel Stats - View statistics
- Clear Intel Cache - Clear all data

**Azure Sync**:
- Configure Azure Sync - Set endpoint/API key
- Test Azure Connection - Verify connectivity
- Sync All to Azure - Upload all portals
- Sync Pending to Azure - Upload unsynced only
- Azure Sync Stats - View sync status

## ?? Configuration Options

### Cache Configuration

Edit in `portal-intel-cache.user.js`:

```javascript
portalIntelCache.config = {
  storageKey: 'iitc_portal_intel_cache',  // localStorage key
  autoSave: true,                          // Auto-save after each capture
  maxCacheSize: 10000,                     // Max portals before cleanup
  debugMode: true                          // Console logging
};
```

### Sync Configuration

Edit in `portal-intel-sync.user.js`:

```javascript
portalIntelSync.config = {
  apiEndpoint: '',     // Azure Function URL
  apiKey: '',          // Function key
  batchSize: 100,      // Portals per batch
  retryAttempts: 3,    // Retry on failure
  retryDelay: 2000     // Delay between retries (ms)
};
```

## ?? Automated Collection (Chrome Driver)

### Setup Selenium

```bash
npm install selenium-webdriver
```

### Example Automation Script

```javascript
const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');

async function collectPortalIntel(portalList) {
    // Setup Chrome with IITC
    let options = new chrome.Options();
    options.addExtensions('path/to/iitc-button.crx');
    
    let driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    
    try {
        for (let portal of portalList) {
            console.log(`Collecting: ${portal.name}`);
            
            // Navigate to portal
            let url = `https://intel.ingress.com/intel?pll=${portal.lat},${portal.lng}`;
            await driver.get(url);
            
            // Wait for portal details
            await driver.wait(until.elementLocated(By.id('portaldetails')), 10000);
            await driver.sleep(2000); // Allow plugin to capture
            
            // Verify capture
            let captured = await driver.executeScript(
                'return window.portalIntelCache.cache[arguments[0]] !== undefined',
                portal.guid
            );
            
            console.log(captured ? '? Captured' : '? Failed');
        }
        
        // Export final cache
        await driver.executeScript('window.portalIntelCache.downloadCache()');
        
    } finally {
        await driver.quit();
    }
}

// Load portal list from export
const portals = JSON.parse(fs.readFileSync('portal-export.json'));
collectPortalIntel(portals);
```

## ?? Database Queries

### Basic Statistics

```sql
-- Portal count by team
SELECT Team, COUNT(*) as Count
FROM PortalIntelligence
GROUP BY Team
ORDER BY Count DESC;

-- Portal count by level
SELECT Level, COUNT(*) as Count
FROM PortalIntelligence
GROUP BY Level
ORDER BY Level;

-- Top portal owners
SELECT TOP 10 OwnerName, COUNT(*) as PortalCount
FROM PortalIntelligence
WHERE OwnerName IS NOT NULL
GROUP BY OwnerName
ORDER BY PortalCount DESC;
```

### Geospatial Queries

```sql
-- Portals within radius
DECLARE @CenterLat DECIMAL(10,7) = 40.7128;
DECLARE @CenterLng DECIMAL(10,7) = -74.0060;
DECLARE @RadiusKm DECIMAL(10,2) = 5.0;

SELECT *, 
    geography::Point(Latitude, Longitude, 4326)
        .STDistance(geography::Point(@CenterLat, @CenterLng, 4326)) / 1000 as DistanceKm
FROM PortalIntelligence
WHERE geography::Point(Latitude, Longitude, 4326)
    .STDistance(geography::Point(@CenterLat, @CenterLng, 4326)) <= @RadiusKm * 1000
ORDER BY DistanceKm;
```

### Advanced Analysis

```sql
-- Portals with most links
SELECT TOP 20
    PortalGUID,
    PortalName,
    Team,
    Level,
    LinkCount,
    IncomingLinks,
    OutgoingLinks
FROM PortalIntelligence
ORDER BY LinkCount DESC;

-- Resonator ownership analysis
SELECT 
    JSON_VALUE(value, '$.owner') as Owner,
    COUNT(*) as ResonatorCount
FROM PortalIntelligence
CROSS APPLY OPENJSON(ResonatorsJSON)
WHERE JSON_VALUE(value, '$.owner') IS NOT NULL
GROUP BY JSON_VALUE(value, '$.owner')
ORDER BY ResonatorCount DESC;
```

## ?? Troubleshooting

### Cache Issues

**Problem**: Storage quota exceeded
**Solution**: 
- Export and clear cache regularly
- Plugin auto-cleans oldest 20% when quota exceeded

**Problem**: Data not capturing
**Solution**:
- Check browser console for errors
- Verify `portalDetailsUpdated` hook is working
- Ensure portal details are loading

### Sync Issues

**Problem**: Connection timeout
**Solution**:
- Check Azure Function URL
- Verify API key is correct
- Test connection using "Test Azure Connection" button

**Problem**: Batch upload fails
**Solution**:
- Reduce batch size in config
- Check Azure Function logs
- Verify SQL connection string in Azure

### Browser Issues

**Problem**: Performance degradation with large cache
**Solution**:
- Export and clear cache periodically
- Reduce `maxCacheSize` in config
- Use CSV export for analysis, not JSON

## ?? Data Format

### JSON Export Format

```json
[
  {
    "PortalGUID": "abc123.16",
    "PortalName": "City Hall",
    "Team": "RESISTANCE",
    "Level": 7,
    "Health": 85,
    "OwnerName": "AgentName",
    "Latitude": 40.7128,
    "Longitude": -74.0060,
    "LatE6": 40712800,
    "LngE6": -74006000,
    "ResonatorCount": 8,
    "LinkCount": 12,
    "IncomingLinks": 5,
    "OutgoingLinks": 7,
    "FieldCount": 3,
    "HistoryVisited": true,
    "HistoryCaptured": false,
    "HistoryScoutControlled": false,
    "ResonatorsJSON": "[{\"slot\":0,\"level\":7,...}]",
    "ModsJSON": "[{\"slot\":0,\"name\":\"Portal Shield\",...}]",
    "FirstSeen": "2024-01-15T10:30:00Z",
    "LastUpdated": "2024-01-15T14:22:00Z",
    "UpdateCount": 3,
    "SyncStatus": "pending"
  }
]
```

## ?? Security Considerations

1. **API Keys**: Store Azure function keys securely
2. **CORS**: Configure Azure Function CORS for intel.ingress.com
3. **Authentication**: Use function-level auth (not anonymous)
4. **SQL Injection**: Stored procedure uses parameterized queries
5. **Data Privacy**: Portal data is game data, but handle responsibly

## ?? License

Same as IITC-CE: ISC License

## ?? Contributing

These are custom plugins for your fork. Modify as needed for your use case.

## ?? Support

Check browser console logs for debugging:
- `[Intel Cache]` prefix for cache plugin logs
- `[Azure Sync]` prefix for sync plugin logs

## ?? Use Cases

- **Coordination**: Track enemy portal status for team planning
- **Analysis**: Identify strategic targets and vulnerable portals
- **History**: Maintain historical records of portal ownership
- **Intelligence**: Monitor specific areas for activity patterns
- **Reporting**: Generate reports on team/enemy infrastructure
