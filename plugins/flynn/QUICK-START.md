# ?? Quick Start Guide

Get up and running with Portal Intelligence Collection in 15 minutes!

## ? Fast Track Setup

### Step 1: Azure Setup (5 minutes)

```bash
# Clone or download the repository
cd plugins

# Edit the setup script
nano azure-function-setup.sh  # or azure-function-setup.ps1 on Windows

# Change SQL_ADMIN_PASSWORD to something secure!
SQL_ADMIN_PASSWORD="YourSecurePassword123!"

# Run the setup
./azure-function-setup.sh  # or .\azure-function-setup.ps1 on Windows
```

**Save the output!** You need:
- Function URL
- Function Key

### Step 2: Browser Plugin Setup (2 minutes)

1. Install IITC-CE in Chrome (if not already installed)
2. Copy these files to IITC plugins folder:
   - `portal-intel-cache.user.js`
   - `portal-intel-sync.user.js`
3. Reload IITC
4. Navigate to Ingress Intel map
5. Configure Azure Sync with URL and Key from Step 1

### Step 3: Start Collecting! (1 minute)

**Manual Collection:**
- Just browse the map and click portals
- Data is automatically cached
- Use "Sync to Azure" button when ready

**Automated Collection:**
```bash
# Install dependencies
npm install

# Edit chrome-automation-example.js
# Update chromeUserDataDir path

# Create portal list (or use example)
cp portal-list-example.json portal-list.json

# Run automation
node chrome-automation-example.js --portal-list portal-list.json
```

---

## ?? One-Command Setup (Advanced)

If you have Azure CLI and Node.js installed:

```bash
# Run everything in one go
cd plugins && \
chmod +x azure-function-setup.sh && \
./azure-function-setup.sh && \
npm install && \
node chrome-automation-example.js --help
```

---

## ?? Common Use Cases

### Use Case 1: Monitor Specific Area

```json
// portal-list.json
[
  {"lat": 40.7128, "lng": -74.0060, "name": "My City Center"}
]
```

```bash
node chrome-automation-example.js --portal-list portal-list.json
```

### Use Case 2: Nightly Updates

**Linux/Mac (crontab):**
```bash
0 2 * * * cd /path/to/plugins && node chrome-automation-example.js --headless --portal-list nightly.json >> logs/collection.log 2>&1
```

**Windows (Task Scheduler):**
- Program: `node`
- Arguments: `chrome-automation-example.js --headless --portal-list nightly.json`
- Start in: `C:\path\to\plugins`

### Use Case 3: Manual + Auto Sync

1. Browse map manually during the day
2. Data auto-caches in browser
3. At night, automated script syncs to Azure:

```javascript
// auto-sync.js
const { exec } = require('child_process');

exec('node azure-upload.js collected-intel.json', (err, stdout) => {
  console.log(stdout);
  if (err) console.error(err);
});
```

---

## ?? Verify Setup

### Check Azure Resources

```bash
# List resources
az resource list --resource-group ingress-intel-rg --output table

# Should show:
# - SQL Server
# - SQL Database
# - Storage Account
# - Function App
```

### Test Function

```bash
curl "https://YOUR-FUNCTION.azurewebsites.net/api/UploadPortals/health?code=YOUR-KEY"

# Should return: {"status":"healthy","timestamp":"..."}
```

### Test Database

```bash
sqlcmd -S ingress-intel-sql.database.windows.net -d IngressIntel -U sqladmin -Q "SELECT COUNT(*) FROM PortalIntelligence"
```

### Test Automation

```bash
node chrome-automation-example.js --help
```

---

## ?? Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Azure CLI not found | Install: `https://aka.ms/installazurecli` |
| Node.js not found | Install: `https://nodejs.org/` |
| SQL connection fails | Check firewall rules, add your IP |
| Chrome automation fails | Update `chromeUserDataDir` path |
| IITC not loading | Verify IITC installed in correct profile |
| Function key not working | Check CORS settings, use full URL with `?code=` |

---

## ?? View Your Data

### Quick Queries

```sql
-- Total portals by team
SELECT Team, COUNT(*) as Count 
FROM PortalIntelligence 
GROUP BY Team;

-- Recent activity
SELECT TOP 10 PortalName, Team, Level, OwnerName, LastUpdated 
FROM PortalIntelligence 
ORDER BY LastUpdated DESC;

-- Top portal owners
SELECT TOP 10 OwnerName, COUNT(*) as Portals 
FROM PortalIntelligence 
GROUP BY OwnerName 
ORDER BY Portals DESC;
```

### Power BI Connection

1. Open Power BI Desktop
2. Get Data ? Azure SQL Database
3. Server: `ingress-intel-sql.database.windows.net`
4. Database: `IngressIntel`
5. Use views: `vw_PortalSummaryStats`, `vw_TopPortalOwners`

---

## ?? Cost Estimate

| Resource | Tier | Monthly Cost |
|----------|------|--------------|
| Azure SQL Database | S0 (10 DTU) | ~$15 |
| Azure Function | Consumption | ~$0-5 |
| Azure Storage | Standard LRS | ~$0-1 |
| **Total** | | **~$15-20** |

**Ways to reduce costs:**
- Use Azure SQL Basic tier (~$5/month) for testing
- Stop/start SQL database when not in use
- Use serverless SQL compute tier (pay per query)

---

## ?? Next Steps

1. **Basic**: Use manual collection + browser sync
2. **Intermediate**: Schedule automated collection
3. **Advanced**: Build dashboards with Power BI
4. **Expert**: Add custom analytics, ML predictions

---

## ?? Documentation Links

- **Full Setup Guide**: `README-AUTOMATION-SETUP.md`
- **Plugin Documentation**: `README-PORTAL-INTEL.md`
- **SQL Schema**: `azure-sql-schema.sql`
- **Example Scripts**: `chrome-automation-example.js`, `azure-upload.js`

---

## ? Success Checklist

- [ ] Azure resources created
- [ ] Database schema deployed
- [ ] Function deployed and tested
- [ ] Browser plugins installed
- [ ] Azure sync configured
- [ ] Collected first portal
- [ ] Synced to database
- [ ] Verified data in SQL

**?? You're ready to collect intelligence!**

---

## ?? Get Help

1. Check `README-AUTOMATION-SETUP.md` ? Troubleshooting section
2. Review Azure Portal logs
3. Check browser console (F12)
4. Test connection: `node azure-upload.js --test`

---

**Happy Intelligence Gathering! ??????**
