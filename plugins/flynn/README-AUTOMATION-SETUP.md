# Portal Intelligence Automation Setup

Complete guide for setting up Azure Function and Chrome automation for automated portal intelligence collection.

## ?? Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Function Setup](#azure-function-setup)
3. [Chrome Automation Setup](#chrome-automation-setup)
4. [Usage Examples](#usage-examples)
5. [Troubleshooting](#troubleshooting)

---

## ?? Prerequisites

### Required Software

- **Azure Account** (with active subscription)
- **Azure CLI** installed ([Download](https://aka.ms/installazurecli))
- **Node.js** (v16 or higher) ([Download](https://nodejs.org/))
- **Azure Functions Core Tools v4** ([Installation Guide](https://learn.microsoft.com/azure/azure-functions/functions-run-local))
- **Chrome Browser** with IITC-CE installed
- **Git** (optional, for cloning repo)

### Azure Resources Required

- Azure SQL Database (S0 tier or higher)
- Azure Function App (Consumption plan)
- Azure Storage Account

### Estimated Costs

- **Azure SQL Database S0**: ~$15/month
- **Azure Function App**: Free tier + minimal usage (~$0-5/month)
- **Azure Storage**: Minimal (~$0-1/month)

**Total estimated cost: ~$15-20/month**

---

## ?? Azure Function Setup

### Option 1: Automated Setup (Recommended)

#### For Linux/Mac (Bash):

```bash
# Navigate to plugins directory
cd plugins

# Make script executable
chmod +x azure-function-setup.sh

# Edit configuration (IMPORTANT!)
nano azure-function-setup.sh
# Update these values:
# - SQL_ADMIN_PASSWORD (CHANGE THIS!)
# - RESOURCE_GROUP (optional)
# - LOCATION (optional)
# - Function/SQL names (optional)

# Run setup script
./azure-function-setup.sh
```

#### For Windows (PowerShell):

```powershell
# Navigate to plugins directory
cd plugins

# Edit configuration (IMPORTANT!)
notepad azure-function-setup.ps1
# Update these values:
# - SQL_ADMIN_PASSWORD (CHANGE THIS!)
# - RESOURCE_GROUP (optional)
# - LOCATION (optional)
# - Function/SQL names (optional)

# Run setup script
.\azure-function-setup.ps1
```

The script will:
1. ? Create Azure Resource Group
2. ? Create Azure SQL Server and Database
3. ? Configure firewall rules
4. ? Create Azure Storage Account
5. ? Create Azure Function App
6. ? Configure CORS for intel.ingress.com
7. ? Deploy function code
8. ? Provide connection credentials

**Save the output credentials!** You'll need:
- Function URL
- Function Key

### Option 2: Manual Setup

<details>
<summary>Click to expand manual setup instructions</summary>

#### 1. Create Azure Resources

```bash
# Login to Azure
az login

# Create resource group
az group create --name ingress-intel-rg --location eastus

# Create SQL Server
az sql server create \
  --name ingress-intel-sql \
  --resource-group ingress-intel-rg \
  --location eastus \
  --admin-user sqladmin \
  --admin-password YourSecurePassword123!

# Create SQL Database
az sql db create \
  --resource-group ingress-intel-rg \
  --server ingress-intel-sql \
  --name FlynnDB \
  --service-objective S0

# Create Storage Account
az storage account create \
  --name ingressintelstorage \
  --resource-group ingress-intel-rg \
  --location eastus \
  --sku Standard_LRS

# Create Function App
az functionapp create \
  --resource-group ingress-intel-rg \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name ingress-intel-function \
  --storage-account ingressintelstorage
```

#### 2. Deploy Database Schema

```bash
# Get SQL connection string
SQL_SERVER="ingress-intel-sql.database.windows.net"

# Run schema script
sqlcmd -S $SQL_SERVER -d FlynnDB -U sqladmin -P 'YourPassword' -i azure-sql-schema.sql
```

#### 3. Deploy Function Code

The `azure-function-setup.sh` or `azure-function-setup.ps1` scripts create the function code in the `azure-function` directory. Deploy it:

```bash
cd azure-function
npm install
func azure functionapp publish ingress-intel-function
```

</details>

### Testing Your Azure Function

```bash
# Test health endpoint
curl "https://YOUR-FUNCTION-APP.azurewebsites.net/api/UploadPortals/health?code=YOUR-FUNCTION-KEY"

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T12:00:00.000Z"}
```

---

## ?? Chrome Automation Setup

### 1. Install Dependencies

```bash
cd plugins

# Install Node.js dependencies
npm install

# This installs:
# - selenium-webdriver: Browser automation
# - chromedriver: Chrome WebDriver
```

### 2. Configure Chrome Profile

The automation uses your existing Chrome profile with IITC installed.

**Find your Chrome user data directory:**

- **Windows**: `C:\Users\YourUser\AppData\Local\Google\Chrome\User Data`
- **Mac**: `~/Library/Application Support/Google/Chrome`
- **Linux**: `~/.config/google-chrome`

**Edit `chrome-automation-example.js`:**

```javascript
const CONFIG = {
  // Update this path!
  chromeUserDataDir: 'C:\\Users\\YourUser\\AppData\\Local\\Google\\Chrome\\User Data',
  chromeProfile: 'Default',  // Or your profile name
  
  // Other settings...
};
```

### 3. Verify IITC Installation

Make sure IITC-CE and the Portal Intelligence Cache plugin are installed in your Chrome profile:

1. Open Chrome with your profile
2. Navigate to `chrome://extensions`
3. Verify IITC Button extension is installed and enabled
4. Navigate to `https://intel.ingress.com/intel`
5. Verify IITC loads and plugins appear in toolbox

---

## ?? Usage Examples

### Example 1: Collect from Portal List

Create a portal list file (`portal-list.json`):

```json
[
  {
    "guid": "portal1.16",
    "lat": 40.7128,
    "lng": -74.0060,
    "name": "City Hall"
  },
  {
    "guid": "portal2.16",
    "lat": 40.7580,
    "lng": -73.9855,
    "name": "Times Square"
  }
]
```

Run collection:

```bash
node chrome-automation-example.js --portal-list portal-list.json
```

### Example 2: Area Scan

Scan portals in a specific area:

```bash
# Edit chrome-automation-example.js and set:
CONFIG.areaScan = {
  enabled: true,
  centerLat: 40.7128,
  centerLng: -74.0060,
  radiusKm: 5,
  gridSize: 10
};

# Run
node chrome-automation-example.js --area-scan
```

### Example 3: Headless Collection

Run in background (no browser window):

```bash
node chrome-automation-example.js --headless --output intel.json
```

### Example 4: Manual Collection

1. Open Chrome with IITC
2. Navigate to Intel map
3. Click portals manually
4. Data is automatically cached
5. Use "Export Intel (JSON)" button
6. Use "Sync to Azure" button in IITC

---

## ?? Complete Workflow

### Automated Collection ? Azure Upload

```bash
# 1. Collect portal intelligence
node chrome-automation-example.js --portal-list portals.json

# This creates: collected-intel.json

# 2. Upload to Azure SQL
# Option A: Use IITC Portal Intel Sync plugin (browser)
# - Configure Azure endpoint
# - Click "Sync All to Azure"

# Option B: Use direct upload script (if created)
node azure-upload.js collected-intel.json
```

### Scheduled Collection (Advanced)

Use cron (Linux/Mac) or Task Scheduler (Windows) to run automated collections:

**Linux/Mac (crontab):**

```bash
# Run every night at 2 AM
0 2 * * * cd /path/to/plugins && node chrome-automation-example.js --headless --portal-list nightly.json
```

**Windows (Task Scheduler):**

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger (e.g., daily at 2 AM)
4. Action: Start a program
   - Program: `node`
   - Arguments: `chrome-automation-example.js --headless`
   - Start in: `C:\path\to\plugins`

---

## ?? Monitoring and Logs

### View Azure Function Logs

```bash
# Stream live logs
func azure functionapp logstream ingress-intel-function

# Or view in Azure Portal:
# Functions ? ingress-intel-function ? Monitor ? Logs
```

### View Database Records

```sql
-- Connect to Azure SQL
sqlcmd -S ingress-intel-sql.database.windows.net -d FlynnDB -U sqladmin

-- Check recent uploads
SELECT TOP 20 
    PortalName, 
    Team, 
    Level, 
    OwnerName, 
    LastUpdated 
FROM PortalIntelligence 
ORDER BY LastUpdated DESC;

-- Check sync status
SELECT 
    SyncStatus, 
    COUNT(*) as Count 
FROM PortalIntelligence 
GROUP BY SyncStatus;
```

---

## ?? Troubleshooting

### Azure Function Issues

**Problem**: "Function app not found"

```bash
# Verify function exists
az functionapp list --resource-group ingress-intel-rg

# Recreate if needed
az functionapp create --resource-group ingress-intel-rg ...
```

**Problem**: "SQL connection timeout"

```bash
# Check firewall rules
az sql server firewall-rule list \
  --resource-group ingress-intel-rg \
  --server ingress-intel-sql

# Add your IP
az sql server firewall-rule create \
  --resource-group ingress-intel-rg \
  --server ingress-intel-sql \
  --name AllowMyIP \
  --start-ip-address YOUR.IP.ADDRESS \
  --end-ip-address YOUR.IP.ADDRESS
```

**Problem**: "CORS error"

```bash
# Configure CORS
az functionapp cors add \
  --name ingress-intel-function \
  --resource-group ingress-intel-rg \
  --allowed-origins "https://intel.ingress.com"
```

### Chrome Automation Issues

**Problem**: "Chrome profile not found"

- Verify `chromeUserDataDir` path is correct
- Make sure Chrome is closed before running automation
- Try using `--profile-directory=Profile 1` or `Profile 2` if not default

**Problem**: "IITC not loading"

- Verify IITC is installed in the Chrome profile being used
- Open Chrome manually with that profile first
- Make sure you're logged into Ingress Intel

**Problem**: "Portal not found at coordinates"

- Increase `portalDetailsTimeout` in CONFIG
- Verify coordinates are correct (lat, lng order)
- Check if portal exists at those coordinates

**Problem**: "Storage quota exceeded"

```javascript
// In browser console:
window.portalIntelCache.clearCache();

// Or export and clear:
window.portalIntelCache.downloadCache();
window.portalIntelCache.clearCache();
```

### Database Issues

**Problem**: "Cannot connect to database"

```bash
# Test connection
sqlcmd -S ingress-intel-sql.database.windows.net \
  -d FlynnDB \
  -U sqladmin \
  -P 'YourPassword' \
  -Q "SELECT TOP 1 * FROM PortalIntelligence"
```

**Problem**: "Stored procedure not found"

```bash
# Re-run schema script
sqlcmd -S ingress-intel-sql.database.windows.net \
  -d FlynnDB \
  -U sqladmin \
  -P 'YourPassword' \
  -i azure-sql-schema.sql
```

---

## ? Performance Tips

### Optimize Collection Speed

```javascript
// In chrome-automation-example.js
CONFIG.delayBetweenPortals = 1000;  // Reduce delay (but may hit rate limits)
CONFIG.portalDetailsTimeout = 3000; // Reduce timeout
CONFIG.headless = true;             // Faster in headless mode
```

### Batch Upload Optimization

```javascript
// In portal-intel-sync.user.js
portalIntelSync.config.batchSize = 500;  // Increase batch size
```

### Database Performance

```sql
-- Update statistics weekly
EXEC dbo.usp_UpdateStatistics;

-- Reorganize indexes monthly
ALTER INDEX ALL ON dbo.PortalIntelligence REORGANIZE;

-- Clean old sync errors
DELETE FROM PortalIntelligence 
WHERE SyncStatus = 'error' 
AND LastUpdated < DATEADD(DAY, -30, GETUTCDATE());
```

---

## ?? Security Best Practices

1. **Never commit credentials** to Git
   - Add to `.gitignore`: `*.env`, `local.settings.json`, `credentials.json`

2. **Use Azure Key Vault** for production
   ```bash
   az keyvault create --name ingress-intel-kv --resource-group ingress-intel-rg
   az keyvault secret set --vault-name ingress-intel-kv --name sql-password --value "YourPassword"
   ```

3. **Restrict SQL firewall** to only necessary IPs

4. **Use function-level auth**, not anonymous

5. **Rotate keys regularly**
   ```bash
   az functionapp keys set --name ingress-intel-function --key-name default --key-value NEW_KEY
   ```

---

## ??? Maintenance Tasks

### Daily
- Monitor automation logs for errors
- Check Azure Function execution count

### Weekly
- Review collected data quality
- Update statistics: `EXEC dbo.usp_UpdateStatistics`
- Export data backup

### Monthly
- Review Azure costs
- Reorganize database indexes
- Clean old pending sync records: `EXEC dbo.usp_CleanupOldPendingSyncs`
- Review and update portal list

---

## ?? Additional Resources

- [Azure Functions Documentation](https://learn.microsoft.com/azure/azure-functions/)
- [Azure SQL Database Documentation](https://learn.microsoft.com/azure/azure-sql/)
- [Selenium WebDriver Documentation](https://www.selenium.dev/documentation/)
- [IITC-CE Documentation](https://iitc.app/documentation/)

---

## ?? Support

For issues:
1. Check troubleshooting section above
2. Review browser console logs (`F12` ? Console)
3. Check Azure Function logs in Azure Portal
4. Review SQL Server firewall rules

---

## ?? License

Same as IITC-CE: ISC License

---

## ? Quick Start Checklist

- [ ] Azure account created
- [ ] Azure CLI installed
- [ ] Node.js installed
- [ ] Edited setup script with secure password
- [ ] Ran Azure setup script
- [ ] Saved function URL and key
- [ ] Deployed database schema
- [ ] Tested function health endpoint
- [ ] Installed Node.js dependencies
- [ ] Configured Chrome profile path
- [ ] Verified IITC installation
- [ ] Created portal list
- [ ] Ran test collection
- [ ] Configured IITC sync plugin
- [ ] Tested data upload
- [ ] Verified data in SQL database

**Ready to collect intelligence! ??**
