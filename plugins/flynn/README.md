# Portal Intelligence Collection System

Complete automated system for collecting Ingress portal intelligence and storing it in Azure MySQL Database.

## ?? Documentation

Start here based on your needs:

### ?? **New User? Start Here:**
**[QUICK-START.md](QUICK-START.md)** - Get up and running in 15 minutes

### ?? **Complete Guides:**
- **[README-PORTAL-INTEL.md](README-PORTAL-INTEL.md)** - Plugin documentation and features
- **[README-AUTOMATION-SETUP.md](README-AUTOMATION-SETUP.md)** - Complete setup guide with troubleshooting
- **[PACKAGE-SUMMARY.md](PACKAGE-SUMMARY.md)** - System architecture and file overview
- **[MIGRATION-TO-MYSQL.md](MIGRATION-TO-MYSQL.md)** - Why we use MySQL (70% cost savings!)

## ?? What's Included

### Browser Plugins (Userscripts)
- `portal-intel-cache.user.js` - Auto-capture portal data in browser
- `portal-intel-sync.user.js` - Sync data to Azure MySQL

### Azure Deployment
- `azure-function-setup.sh` - Automated setup (Linux/Mac)
- `azure-function-setup.ps1` - Automated setup (Windows)
- `azure-mysql-schema.sql` - Complete database schema (MySQL)

### Automation Scripts
- `chrome-automation-example.js` - Selenium-based portal collection
- `azure-upload.js` - Direct upload to Azure MySQL
- `package.json` - Node.js dependencies

### Examples
- `portal-list-example.json` - Sample portal list format

## ? Quick Start

### 1. Azure Setup (One Command)
```bash
./azure-function-setup.sh  # or .ps1 on Windows
```

### 2. Install Browser Plugins
Copy `*.user.js` files to IITC plugins folder and reload.

### 3. Start Collecting
**Manual:** Browse map, click portals ? Data auto-caches  
**Automated:** `node chrome-automation-example.js --portal-list portal-list.json`

## ?? Use Cases

- **Team Coordination** - Track enemy portal status for planning
- **Strategic Analysis** - Identify vulnerable targets
- **Historical Records** - Monitor portal ownership changes
- **Activity Patterns** - Detect area activity trends
- **Reporting** - Generate infrastructure reports

## ? Features

? Automatic portal data capture  
? Browser localStorage caching  
? Azure MySQL Database sync  
? Chrome automation support  
? Batch upload (100 portals per request)  
? Real-time statistics  
? Export to JSON/CSV  
? MERGE/UPSERT stored procedures  
? Analytics views  
? Error handling and retry logic  

## ?? Data Collected

- Portal GUID, name, location
- Team ownership and portal level
- Health and resonator count
- All 8 resonators (level, owner, energy)
- All 4 mods (type, rarity, stats)
- Link and field counts
- Portal history (visited, captured, scout controlled)
- Timestamps and update tracking

## ?? Cost

~$5-6/month for Azure resources (70% cheaper than Azure SQL!):
- Azure MySQL Flexible Server (B1ms): ~$5/month
- Azure Function (Consumption): ~$0/month (free tier)
- Azure Storage: ~$0.50/month
- Virtual Network: Free

**Note:** Migrated from Azure SQL Database (~$15-20/month) to save costs.  
See **[MIGRATION-TO-MYSQL.md](MIGRATION-TO-MYSQL.md)** for details.

## ?? Security

- Function-level authentication
- API key required
- CORS configured for intel.ingress.com
- **VNet-only access** - MySQL has no public endpoint
- SQL parameterized queries
- Private networking by default
- TLS/SSL encryption

## ?? Troubleshooting

See **[README-AUTOMATION-SETUP.md](README-AUTOMATION-SETUP.md)** ? Troubleshooting section

Quick checks:
```bash
# Test Azure connection
node azure-upload.js --test

# Verify resources
az resource list --resource-group ingress-intel-rg --output table

# Test database (via Azure Cloud Shell - MySQL is VNet-only)
az mysql flexible-server connect -n ingress-intel-mysql -u mysqladmin -d IngressIntel
```

## ?? Sample Query

```sql
-- Top 10 portal owners
SELECT OwnerName, COUNT(*) as Portals
FROM PortalIntelligence
GROUP BY OwnerName
ORDER BY Portals DESC
LIMIT 10;
```

## ?? Learning Path

1. **Beginner**: Manual collection ? Export CSV ? Excel analysis
2. **Intermediate**: Automated collection ? SQL queries ? Scheduled runs
3. **Advanced**: Power BI dashboards ? Real-time monitoring
4. **Expert**: ML predictions ? Custom analytics applications

## ?? Support

1. Check documentation (README files)
2. Review browser console logs (F12)
3. Check Azure Function logs (Azure Portal)
4. Verify configuration (API keys, endpoints, firewall rules)

## ?? License

ISC License (same as IITC-CE)

## ?? Credits

Built for the Ingress community using IITC-CE platform.

---

**Ready to collect intelligence? See [QUICK-START.md](QUICK-START.md)!** ??
