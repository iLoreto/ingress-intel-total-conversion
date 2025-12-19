# 📦 Portal Intelligence Collection System - Complete Package

## 📦 What Has Been Created

This complete automation system enables you to collect Ingress portal intelligence and store it in Azure SQL Database.

### Files Created

#### 1. Database Schema
- **`azure-sql-schema.sql`** - Complete Azure SQL Database schema
  - Portal data table with all fields
  - Stored procedures for MERGE/UPSERT
  - Views for analytics
  - Indexes for performance
  - Sample queries

#### 2. Browser Plugins (Userscripts)
- **`portal-intel-cache.user.js`** - Automatic portal data capture
  - Captures portal details on click
  - localStorage persistence
  - Export to JSON/CSV
  - Real-time statistics
  - Session tracking

- **`portal-intel-sync.user.js`** - Azure SQL sync from browser
  - Batch upload to Azure
  - API key authentication
  - Sync status tracking
  - Progress monitoring
  - Error handling

#### 3. Azure Deployment Scripts
- **`azure-function-setup.sh`** - Bash setup script for Linux/Mac
  - Creates all Azure resources
  - Deploys function code
  - Configures database
  - Sets up CORS and firewall

- **`azure-function-setup.ps1`** - PowerShell setup script for Windows
  - Same functionality as bash version
  - Windows-optimized commands
  - PowerShell syntax

#### 4. Chrome Automation
- **`chrome-automation-example.js`** - Selenium-based automation
  - Navigate to portals automatically
  - Click portals to capture data
  - Export cached intelligence
  - Area scanning capability
  - Headless mode support

- **`azure-upload.js`** - Direct Azure upload script
  - Upload JSON files to Azure SQL
  - Batch processing
  - Retry logic
  - Connection testing
  - Data validation

#### 5. Configuration Files
- **`package.json`** - Node.js dependencies
  - selenium-webdriver
  - chromedriver
  - Project metadata

- **`portal-list-example.json`** - Sample portal list
  - Example portal coordinates
  - JSON structure template

- **`.gitignore`** - Protect sensitive data
  - Excludes credentials
  - Excludes collected data
  - Keeps examples

#### 6. Documentation
- **`README-PORTAL-INTEL.md`** - Plugin documentation
  - Architecture overview
  - Features and capabilities
  - Installation guide
  - Usage examples
  - Database queries

- **`README-AUTOMATION-SETUP.md`** - Complete setup guide
  - Prerequisites
  - Step-by-step Azure setup
  - Chrome automation guide
  - Troubleshooting
  - Performance tips
  - Security best practices

- **`QUICK-START.md`** - Fast track guide
  - 15-minute setup
  - Common use cases
  - Quick troubleshooting
  - Success checklist

- **`PACKAGE-SUMMARY.md`** - This file!

---

## ??? Architecture Overview

```
???????????????????????????????????????????????????????????
?  1. DATA COLLECTION                                     ?
?  ?????????????????????????????????????????????????     ?
?  ?  Browser (IITC)                               ?     ?
?  ?  � portal-intel-cache.user.js                 ?     ?
?  ?  � Auto-capture on portal click               ?     ?
?  ?  � localStorage caching                       ?     ?
?  ?????????????????????????????????????????????????     ?
?                     OR                                  ?
?  ?????????????????????????????????????????????????     ?
?  ?  Chrome Automation                            ?     ?
?  ?  � chrome-automation-example.js               ?     ?
?  ?  � Selenium WebDriver                         ?     ?
?  ?  � Automated portal clicking                  ?     ?
?  ?????????????????????????????????????????????????     ?
???????????????????????????????????????????????????????????
                          ?
???????????????????????????????????????????????????????????
?  2. DATA EXPORT                                         ?
?  � Export JSON from browser                             ?
?  � Export CSV for Excel                                 ?
?  � Batch preparation (100 portals per batch)            ?
???????????????????????????????????????????????????????????
                          ?
???????????????????????????????????????????????????????????
?  3. DATA SYNC                                           ?
?  ?????????????????????????????????????????????????     ?
?  ?  Browser Sync (portal-intel-sync.user.js)     ?     ?
?  ?  � Direct from browser to Azure               ?     ?
?  ?  � Progress monitoring                        ?     ?
?  ?????????????????????????????????????????????????     ?
?                     OR                                  ?
?  ?????????????????????????????????????????????????     ?
?  ?  Script Upload (azure-upload.js)              ?     ?
?  ?  � Upload JSON files                          ?     ?
?  ?  � Command-line tool                          ?     ?
?  ?????????????????????????????????????????????????     ?
???????????????????????????????????????????????????????????
                          ?
???????????????????????????????????????????????????????????
?  4. AZURE FUNCTION                                      ?
?  � HTTP POST endpoint                                   ?
?  � Receive portal batches                               ?
?  � Validate data                                        ?
?  � Connect to Azure SQL                                 ?
???????????????????????????????????????????????????????????
                          ?
???????????????????????????????????????????????????????????
?  5. AZURE SQL DATABASE                                  ?
?  � PortalIntelligence table                             ?
?  � MERGE/UPSERT stored procedure                        ?
?  � Analytics views                                      ?
?  � Indexes for performance                              ?
???????????????????????????????????????????????????????????
                          ?
???????????????????????????????????????????????????????????
?  6. ANALYTICS & REPORTING                               ?
?  � SQL queries                                          ?
?  � Power BI dashboards                                  ?
?  � Excel reports                                        ?
?  � Custom applications                                  ?
???????????????????????????????????????????????????????????
```

---

## 📦 Quick Start

### 1. Azure Setup (5 minutes)

```bash
cd plugins
./azure-function-setup.sh  # or .ps1 on Windows
```

**Save the output:**
- Function URL
- Function Key

### 2. Install Browser Plugins (2 minutes)

Copy to IITC plugins folder:
- `portal-intel-cache.user.js`
- `portal-intel-sync.user.js`

Reload IITC and configure Azure endpoint.

### 3. Start Collecting (1 minute)

**Manual:** Browse map, click portals, data auto-caches

**Automated:**
```bash
npm install
node chrome-automation-example.js --portal-list portal-list-example.json
```

---

## 📦 Data Schema

### Portal Intelligence Table

| Field | Type | Description |
|-------|------|-------------|
| PortalGUID | NVARCHAR(64) | Primary key |
| Latitude/Longitude | DECIMAL(10,7) | Coordinates |
| PortalName | NVARCHAR(255) | Portal title |
| Team | NVARCHAR(20) | RESISTANCE/ENLIGHTENED/MACHINA/NEUTRAL |
| Level | TINYINT | Portal level 1-8 |
| Health | TINYINT | Portal health 0-100 |
| OwnerName | NVARCHAR(100) | Portal owner |
| ResonatorCount | TINYINT | Number of resonators |
| LinkCount | INT | Total links |
| FieldCount | INT | Fields this portal creates |
| ResonatorsJSON | NVARCHAR(MAX) | Array of 8 resonator details |
| ModsJSON | NVARCHAR(MAX) | Array of 4 mod details |
| HistoryVisited | BIT | Player visited |
| HistoryCaptured | BIT | Player captured |
| HistoryScoutControlled | BIT | Player scout controlled |
| FirstSeen | DATETIME2 | First capture time |
| LastUpdated | DATETIME2 | Last update time |
| UpdateCount | INT | Number of updates |
| SyncStatus | NVARCHAR(20) | pending/synced/error |

### Sample Resonator JSON
```json
[
  {
    "slot": 0,
    "level": 8,
    "owner": "AgentName",
    "energy": 6000,
    "energyTotal": 6000,
    "healthPercent": 100
  }
]
```

### Sample Mod JSON
```json
[
  {
    "slot": 0,
    "name": "Portal Shield",
    "rarity": "VERY_RARE",
    "owner": "AgentName",
    "stats": {"MITIGATION": 70}
  }
]
```

---

## 📦 Configuration

### Azure Function Configuration

Edit in setup scripts:
```bash
RESOURCE_GROUP="ingress-intel-rg"
LOCATION="eastus"
SQL_SERVER_NAME="ingress-intel-sql"
SQL_DATABASE_NAME="IngressIntel"
SQL_ADMIN_PASSWORD="YourSecurePassword123!"  # CHANGE THIS!
```

### Browser Plugin Configuration

Edit in `.user.js` files:
```javascript
// portal-intel-cache.user.js
portalIntelCache.config = {
  storageKey: 'iitc_portal_intel_cache',
  autoSave: true,
  maxCacheSize: 10000,
  debugMode: true
};

// portal-intel-sync.user.js
portalIntelSync.config = {
  apiEndpoint: 'https://your-function.azurewebsites.net/api/UploadPortals',
  apiKey: 'your-function-key',
  batchSize: 100,
  retryAttempts: 3
};
```

### Chrome Automation Configuration

Edit in `chrome-automation-example.js`:
```javascript
const CONFIG = {
  chromeUserDataDir: 'C:\\Users\\YourUser\\AppData\\Local\\Google\\Chrome\\User Data',
  chromeProfile: 'Default',
  pageLoadTimeout: 15000,
  delayBetweenPortals: 3000,
  headless: false
};
```

---

## 📦 Sample Queries

### Portal Count by Team
```sql
SELECT Team, COUNT(*) as Count
FROM PortalIntelligence
GROUP BY Team;
```

### Top Portal Owners
```sql
SELECT TOP 10 OwnerName, COUNT(*) as Portals
FROM PortalIntelligence
GROUP BY OwnerName
ORDER BY Portals DESC;
```

### Portals Within Radius
```sql
SELECT *, 
  dbo.fn_CalculateDistance(40.7128, -74.0060, Latitude, Longitude) as DistanceKm
FROM PortalIntelligence
WHERE dbo.fn_CalculateDistance(40.7128, -74.0060, Latitude, Longitude) <= 5
ORDER BY DistanceKm;
```

### Recent Activity
```sql
SELECT TOP 50 PortalName, Team, Level, OwnerName, LastUpdated
FROM PortalIntelligence
ORDER BY LastUpdated DESC;
```

---

## ??? Security

### ? Implemented Security Features

1. **Function-level authentication** (not anonymous)
2. **API key required** for all requests
3. **CORS configured** for intel.ingress.com only
4. **SQL parameterized queries** (no SQL injection)
5. **Firewall rules** restrict SQL access
6. **TLS/SSL** encryption for all connections

### 📦 Security Best Practices

1. **Never commit credentials** to Git
2. **Use Azure Key Vault** for production
3. **Rotate keys regularly**
4. **Restrict SQL firewall** to necessary IPs only
5. **Monitor Azure logs** for suspicious activity
6. **Use strong passwords** (12+ characters, mixed case, numbers, symbols)

---

## 📦 Cost Breakdown

### Azure Resources

| Resource | Tier | Cost/Month | Notes |
|----------|------|------------|-------|
| Azure SQL Database | S0 (10 DTU) | ~$15 | Can use Basic ($5) for testing |
| Azure Function | Consumption | $0-5 | First 1M executions free |
| Azure Storage | Standard LRS | $0-1 | Minimal usage |
| **Total** | | **$15-20** | |

### Ways to Reduce Costs

1. **Use Azure SQL Basic tier** for development/testing
2. **Stop database** when not actively collecting
3. **Use serverless SQL compute** (pay per query)
4. **Clean old data** regularly
5. **Use reserved capacity** for production (up to 50% discount)

---

## 📦 Learning Resources

### Azure
- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure SQL Database Documentation](https://learn.microsoft.com/azure/azure-sql/)
- [Azure CLI Reference](https://learn.microsoft.com/cli/azure/)

### Selenium
- [Selenium WebDriver Documentation](https://www.selenium.dev/documentation/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)

### IITC
- [IITC-CE Documentation](https://iitc.app/documentation/)
- [IITC Plugin Development](https://iitc.app/develop/)

### SQL
- [T-SQL Reference](https://learn.microsoft.com/sql/t-sql/)
- [Query Performance Tuning](https://learn.microsoft.com/azure/azure-sql/performance-guidance)

---

## 📦 Common Issues

| Issue | Solution |
|-------|----------|
| "Function app not found" | Run setup script, verify resource group |
| "SQL connection timeout" | Add your IP to SQL firewall |
| "CORS error" | Configure CORS for intel.ingress.com |
| "Chrome profile not found" | Update chromeUserDataDir path |
| "IITC not loading" | Verify IITC installed in correct profile |
| "Storage quota exceeded" | Export and clear cache regularly |
| "Portal not found" | Check coordinates, increase timeout |

---

## 📦 Support

### Troubleshooting Steps

1. **Check documentation** in `README-AUTOMATION-SETUP.md`
2. **Review logs**:
   - Browser console (F12 ? Console)
   - Azure Function logs (Azure Portal)
   - Terminal output
3. **Test components**:
   ```bash
   node azure-upload.js --test
   ```
4. **Verify configuration**:
   - Azure resources exist
   - Firewall rules configured
   - API keys correct
   - Chrome profile path valid

---

## ? Complete Checklist

### Azure Setup
- [ ] Azure account created
- [ ] Azure CLI installed
- [ ] Resource group created
- [ ] SQL Server created
- [ ] SQL Database created
- [ ] Database schema deployed
- [ ] Function App created
- [ ] Function code deployed
- [ ] CORS configured
- [ ] Firewall rules set

### Browser Setup
- [ ] IITC-CE installed
- [ ] Portal Intel Cache plugin installed
- [ ] Portal Intel Sync plugin installed
- [ ] Azure endpoint configured
- [ ] API key configured
- [ ] Test portal captured
- [ ] Test sync successful

### Automation Setup
- [ ] Node.js installed
- [ ] Dependencies installed (`npm install`)
- [ ] Chrome profile path configured
- [ ] Portal list created
- [ ] Test automation run
- [ ] Data exported successfully

### Verification
- [ ] Function health check passes
- [ ] Data appears in SQL database
- [ ] Queries return results
- [ ] No errors in logs

---

## 📦 Next Steps

### Beginner
1. Use manual collection in browser
2. Export data to CSV
3. Analyze in Excel

### Intermediate
1. Set up automated collection
2. Schedule nightly runs
3. Create SQL views for common queries

### Advanced
1. Build Power BI dashboards
2. Set up alerts for portal changes
3. Integrate with other tools

### Expert
1. Add ML predictions for portal vulnerability
2. Create real-time monitoring
3. Build custom analytics applications

---

## 📦 License

Same as IITC-CE: **ISC License**

---

## 📦 Credits

- **IITC-CE Team** - For the excellent IITC platform
- **Niantic** - For Ingress
- **Azure Team** - For cloud services

---

## 📦 You're Ready!

Everything is set up and documented. Start collecting portal intelligence and gain valuable insights into Ingress gameplay!

**Happy Intelligence Gathering! ??????**

---

*Last updated: 2024-01-15*
*Version: 1.0.0*
