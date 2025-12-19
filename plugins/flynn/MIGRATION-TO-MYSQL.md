# ?? Migration to Azure MySQL - Complete Guide

## ?? What Changed

### ? **From: Azure SQL Database**
- Cost: ~$15-20/month
- Public access with firewall rules
- Manual API key management
- Separate database creation steps

### ? **To: Azure MySQL Flexible Server**
- Cost: ~$5-6/month (60-70% reduction!)
- **Private VNet access only** (Function App only)
- **Fully automated** - one script does everything
- **Secure by default** - no public endpoint
- **Zero manual configuration** needed

---

## ?? Key Improvements

### 1. **Cost Reduction**
| Resource | Old (SQL) | New (MySQL) | Savings |
|----------|-----------|-------------|---------|
| Database | $15/month | $5/month | $10/month |
| Function App | Free | Free | $0 |
| Storage | $0.50/month | $0.50/month | $0 |
| **Total** | **$15-20/month** | **$5-6/month** | **~70% cheaper!** |

### 2. **Enhanced Security**
- ? **No public access** - MySQL is only accessible via VNet
- ? **VNet Integration** - Function App connects privately
- ? **Auto-generated passwords** - secure by default
- ? **No firewall rules** needed - private by design
- ? **SSL/TLS** enforced automatically

### 3. **Zero Manual Configuration**
**Old workflow:**
1. Run setup script
2. Manually add firewall rules
3. Get connection string
4. Manually configure Function App
5. Deploy schema separately
6. Configure API keys manually

**New workflow:**
1. Run ONE script
2. Done! ?

Everything is automated:
- MySQL server creation
- VNet creation and configuration
- Subnet delegation
- Function App VNet integration
- Database schema deployment
- Connection string configuration
- CORS setup
- Function deployment

### 4. **No Room for Human Error**
- ? Forgot to add firewall rule
- ? Wrong connection string
- ? Missed CORS configuration
- ? Didn't deploy schema
- ? Forgot API key

All eliminated! The script handles everything automatically.

---

## ?? New Files Created

### 1. **azure-mysql-schema.sql**
MySQL-compatible version of the database schema:
- Uses MySQL syntax (not T-SQL)
- JSON support (native in MySQL 8.0)
- Stored procedures with MySQL DELIMITER syntax
- Views and functions adapted for MySQL
- Optimized indexes for InnoDB engine

### 2. **Updated Setup Scripts**
- `azure-function-setup.sh` - Bash version
- `azure-function-setup.ps1` - PowerShell version

Both scripts now:
- Create Virtual Network automatically
- Create MySQL Flexible Server (Burstable B1ms tier)
- Configure VNet integration
- Deploy schema automatically
- Generate secure passwords
- Save credentials to `azure-credentials.txt`

### 3. **Updated Function Code**
Uses `mysql2` instead of `mssql`:
- Connection pooling
- SSL/TLS enforced
- Parameterized queries (same security)
- Compatible with stored procedures

---

## ?? How to Use

### Quick Start (New Deployment)

```bash
# Linux/Mac
cd plugins/flynn
chmod +x azure-function-setup.sh
./azure-function-setup.sh

# Windows PowerShell
cd plugins/flynn
.\azure-function-setup.ps1
```

**That's it!** The script will:
1. Create all Azure resources (~10 minutes)
2. Deploy database schema
3. Configure VNet security
4. Deploy Function App
5. Save credentials to `azure-credentials.txt`

### Migrating from Existing Azure SQL

If you already have data in Azure SQL:

```bash
# 1. Export your current data
# In your browser (IITC), click "Export Intel (JSON)"
# Or use existing portal-intel-*.json files

# 2. Run new MySQL setup script
./azure-function-setup.sh

# 3. Upload data to new MySQL database
node azure-upload.js your-exported-data.json

# 4. Delete old Azure SQL resources (to stop billing)
az sql db delete --resource-group ingress-intel-rg --server ingress-intel-sql --name FlynnDB
az sql server delete --resource-group ingress-intel-rg --name ingress-intel-sql
```

---

## ?? Security Architecture

### Old Architecture (Azure SQL)
```
Internet ? Azure SQL Database (Public endpoint)
                      ?
                      ? Firewall Rules
                      ?
                      ?
              Function App ? intel.ingress.com
```

### New Architecture (MySQL VNet)
```
Internet ? Function App ? intel.ingress.com
                      ?
                      ? VNet (Private)
                      ?
                      ?
              MySQL Server (No public access!)
```

**Benefits:**
- MySQL is **invisible** to the internet
- No attack surface on database
- Only Function App can connect
- Automatic SSL/TLS encryption
- No manual firewall management

---

## ?? Database Compatibility

### What's the Same
- ? All tables and columns
- ? All indexes
- ? Stored procedures (same logic)
- ? Views (same results)
- ? Functions (same calculations)
- ? JSON support (ResonatorsJSON, ModsJSON)

### What Changed
- MySQL syntax (DELIMITER, CALL vs EXEC)
- BOOLEAN instead of BIT
- VARCHAR instead of NVARCHAR
- DATETIME instead of DATETIME2
- JSON type native in MySQL
- `ON DUPLICATE KEY UPDATE` instead of MERGE

**Your application code doesn't need to change!** The Function App handles the database differences.

---

## ?? Cost Breakdown

### MySQL Flexible Server (B1ms Burstable)
- 1 vCore, 2GB RAM
- 20GB storage
- 7-day backup retention
- **~$5/month**

### Function App (Consumption Plan)
- 1 million executions FREE
- $0.20 per million after that
- You'll likely stay in free tier
- **~$0/month**

### Storage Account
- Used for Function App storage
- Minimal usage
- **~$0.50/month**

### Virtual Network
- VNet and subnets are FREE
- No data transfer charges (same region)
- **$0/month**

### Total: ~$5-6/month
Compared to ~$15-20/month with Azure SQL

---

## ?? Troubleshooting

### Script says "MySQL client not found"
The script will still complete successfully. Deploy schema manually:

```bash
# Install MySQL client
# Ubuntu/Debian:
sudo apt-get install mysql-client

# Mac:
brew install mysql-client

# Windows:
# Download from https://dev.mysql.com/downloads/mysql/

# Then deploy schema
mysql -h your-server.mysql.database.azure.com \
      -u mysqladmin \
      -p \
      --ssl-mode=REQUIRED \
      FlynnDB < azure-mysql-schema.sql
```

### Can't connect to MySQL from local machine
**This is expected!** MySQL has no public access. To connect:

```bash
# Option 1: Use Azure Cloud Shell
az mysql flexible-server connect -n ingress-intel-mysql -u mysqladmin -d FlynnDB

# Option 2: Enable public access temporarily (not recommended)
az mysql flexible-server update \
  --resource-group ingress-intel-rg \
  --name ingress-intel-mysql \
  --public-access 0.0.0.0

# Then disable it again after you're done
az mysql flexible-server update \
  --resource-group ingress-intel-rg \
  --name ingress-intel-mysql \
  --public-access None
```

### Function App can't connect to MySQL
Check VNet integration:

```bash
# Verify VNet integration is active
az functionapp vnet-integration list \
  --resource-group ingress-intel-rg \
  --name ingress-intel-function

# If not configured, add it:
az functionapp vnet-integration add \
  --resource-group ingress-intel-rg \
  --name ingress-intel-function \
  --vnet ingress-intel-vnet \
  --subnet ingress-intel-subnet
```

---

## ?? Rollback (If Needed)

If you need to go back to Azure SQL:

```bash
# 1. Keep your data - export first!
node azure-upload.js --export

# 2. Delete MySQL resources
az mysql flexible-server delete \
  --resource-group ingress-intel-rg \
  --name ingress-intel-mysql

# 3. Delete VNet
az network vnet delete \
  --resource-group ingress-intel-rg \
  --name ingress-intel-vnet

# 4. Run old Azure SQL setup
# (You'll need to restore the old setup scripts)
```

---

## ?? Important Notes

### Credentials File
- Script creates `azure-credentials.txt` with all connection info
- **Already in .gitignore** - won't be committed
- Keep this file secure!
- Use it to configure IITC browser plugins

### Password Generation
- Bash: Uses `openssl` to generate random password
- PowerShell: Uses random character generation
- Format: 16 random chars + "MyS3c!" (meets Azure requirements)

### VNet Integration
- Function App and MySQL are in same VNet
- Different subnets (security best practice)
- No NAT gateway needed (saves $30-40/month!)
- No public IPs needed

---

## ? Migration Checklist

- [ ] Export existing portal data (if migrating)
- [ ] Run new MySQL setup script
- [ ] Verify `azure-credentials.txt` created
- [ ] Test health endpoint: `curl "FUNCTION_URL/health?code=KEY"`
- [ ] Update IITC browser plugin configuration
  - [ ] New Function URL
  - [ ] New Function Key
- [ ] Test portal sync from browser
- [ ] Verify data in MySQL database
- [ ] (Optional) Delete old Azure SQL resources
- [ ] Update documentation with new costs

---

## ?? Benefits Summary

### Cost
- **70% cheaper**: $5-6/month vs $15-20/month
- **Burstable tier**: Only pay for what you use

### Security
- **Private by default**: No public access
- **VNet isolation**: Function App only access
- **Zero attack surface**: Invisible to internet

### Automation
- **One script**: Everything automated
- **No manual steps**: No room for error
- **Secure passwords**: Auto-generated

### Maintenance
- **Auto-backups**: 7-day retention
- **Auto-updates**: Managed by Azure
- **Connection pooling**: Built-in efficiency

---

## ?? Compatibility

### Browser Plugins
- ? **No changes needed!**
- Same JSON format
- Same API endpoints
- Same authentication

### Chrome Automation
- ? **No changes needed!**
- Same data collection
- Same export format
- Same upload process

### Queries
- ?? **Minor syntax changes**
- T-SQL ? MySQL syntax
- But same results!
- See `azure-mysql-schema.sql` for examples

---

## ?? Support

### Getting Help

1. **Check script output** - it shows detailed progress
2. **Review credentials file** - all connection info is there
3. **Test health endpoint** - verify function is working
4. **Check Azure Portal** - view resource status

### Common Issues

| Issue | Solution |
|-------|----------|
| "VNet creation failed" | Delete resource group and retry |
| "MySQL connection timeout" | Wait 2-3 minutes for server to fully start |
| "Schema deployment failed" | Run manually with mysql client |
| "Function deployment failed" | Ensure Azure Functions Core Tools installed |

---

**Ready to migrate?** Run the setup script and enjoy 70% cost savings! ????
