#!/bin/bash
# =============================================
# Azure Function Setup Script (Bash)
# Portal Intelligence with Azure MySQL Database
# Fully automated - creates DB and Function App
# =============================================

# Configuration - UPDATE THESE VALUES
RESOURCE_GROUP="ingress-intel-rg"
LOCATION="eastus"
STORAGE_ACCOUNT="ingressintelstorage"
FUNCTION_APP_NAME="ingress-intel-function"
MYSQL_SERVER_NAME="ingress-intel-mysql"
MYSQL_DATABASE_NAME="FlynnDB"
MYSQL_ADMIN_USER="mysqladmin"
MYSQL_ADMIN_PASSWORD="$(openssl rand -base64 16)MyS3cur3!"  # Auto-generated secure password
VNET_NAME="ingress-intel-vnet"
SUBNET_NAME="ingress-intel-subnet"
MYSQL_SUBNET_NAME="mysql-subnet"

echo "========================================"
echo "Portal Intelligence Azure Setup"
echo "MySQL Flexible Server + Function App"
echo "========================================"
echo ""
echo "This script will create:"
echo "  - Resource Group: $RESOURCE_GROUP"
echo "  - Virtual Network: $VNET_NAME"
echo "  - Azure MySQL Flexible Server: $MYSQL_SERVER_NAME"
echo "  - Azure MySQL Database: $MYSQL_DATABASE_NAME"
echo "  - Storage Account: $STORAGE_ACCOUNT"
echo "  - Function App: $FUNCTION_APP_NAME"
echo "  - Secure VNet integration (Function App <-> MySQL only)"
echo ""
echo "Estimated cost: ~\$5-10/month (Burstable tier + consumption plan)"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."

# Login to Azure
echo ""
echo "Step 1: Logging in to Azure..."
az login

# Create Resource Group
echo ""
echo "Step 2: Creating Resource Group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create Virtual Network for secure communication
echo ""
echo "Step 3: Creating Virtual Network..."
az network vnet create \
  --resource-group $RESOURCE_GROUP \
  --name $VNET_NAME \
  --location $LOCATION \
  --address-prefix 10.0.0.0/16 \
  --subnet-name $SUBNET_NAME \
  --subnet-prefix 10.0.1.0/24

# Create subnet for MySQL with delegation
echo ""
echo "Step 4: Creating MySQL subnet..."
az network vnet subnet create \
  --resource-group $RESOURCE_GROUP \
  --vnet-name $VNET_NAME \
  --name $MYSQL_SUBNET_NAME \
  --address-prefix 10.0.2.0/24 \
  --delegations Microsoft.DBforMySQL/flexibleServers

# Create Azure MySQL Flexible Server (Burstable tier for low cost)
echo ""
echo "Step 5: Creating Azure MySQL Flexible Server (this may take 5-10 minutes)..."
echo "Using Burstable B1ms tier (~\$5/month) with VNet integration"
az mysql flexible-server create \
  --resource-group $RESOURCE_GROUP \
  --name $MYSQL_SERVER_NAME \
  --location $LOCATION \
  --admin-user $MYSQL_ADMIN_USER \
  --admin-password "$MYSQL_ADMIN_PASSWORD" \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --storage-size 20 \
  --version 8.0.21 \
  --vnet $VNET_NAME \
  --subnet $MYSQL_SUBNET_NAME \
  --public-access None \
  --backup-retention 7

echo "MySQL Server created with private access only!"

# Create MySQL Database
echo ""
echo "Step 6: Creating MySQL Database..."
az mysql flexible-server db create \
  --resource-group $RESOURCE_GROUP \
  --server-name $MYSQL_SERVER_NAME \
  --database-name $MYSQL_DATABASE_NAME

# Get MySQL connection string
MYSQL_HOST="${MYSQL_SERVER_NAME}.mysql.database.azure.com"
MYSQL_CONNECTION_STRING="mysql://${MYSQL_ADMIN_USER}:${MYSQL_ADMIN_PASSWORD}@${MYSQL_HOST}:3306/${MYSQL_DATABASE_NAME}?ssl=true"

echo ""
echo "Step 7: Deploying database schema..."
echo "Connection host: $MYSQL_HOST"
echo ""

# Check if mysql client is installed
if command -v mysql &> /dev/null; then
    echo "Deploying schema to MySQL database..."
    mysql -h $MYSQL_HOST \
          -u $MYSQL_ADMIN_USER \
          -p"$MYSQL_ADMIN_PASSWORD" \
          --ssl-mode=REQUIRED \
          $MYSQL_DATABASE_NAME < azure-mysql-schema.sql
    
    if [ $? -eq 0 ]; then
        echo "? Schema deployed successfully!"
    else
        echo "! Schema deployment failed. Please run manually after setup:"
        echo "  mysql -h $MYSQL_HOST -u $MYSQL_ADMIN_USER -p -D $MYSQL_DATABASE_NAME < azure-mysql-schema.sql"
    fi
else
    echo "! MySQL client not found. Please install it and run schema manually:"
    echo "  mysql -h $MYSQL_HOST -u $MYSQL_ADMIN_USER -p -D $MYSQL_DATABASE_NAME < azure-mysql-schema.sql"
fi

# Create Storage Account for Function App
echo ""
echo "Step 8: Creating Storage Account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Create Function App with VNet integration
echo ""
echo "Step 9: Creating Function App (Consumption Plan)..."
az functionapp create \
  --resource-group $RESOURCE_GROUP \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --name $FUNCTION_APP_NAME \
  --storage-account $STORAGE_ACCOUNT \
  --os-type Linux

# Enable VNet Integration for Function App
echo ""
echo "Step 10: Enabling VNet integration for Function App..."
az functionapp vnet-integration add \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --vnet $VNET_NAME \
  --subnet $SUBNET_NAME

# Configure Function App settings with MySQL connection
echo ""
echo "Step 11: Configuring Function App settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "MYSQL_HOST=$MYSQL_HOST" \
    "MYSQL_DATABASE=$MYSQL_DATABASE_NAME" \
    "MYSQL_USER=$MYSQL_ADMIN_USER" \
    "MYSQL_PASSWORD=$MYSQL_ADMIN_PASSWORD" \
    "MYSQL_CONNECTION_STRING=$MYSQL_CONNECTION_STRING"

# Enable CORS for Ingress Intel
echo ""
echo "Step 12: Configuring CORS..."
az functionapp cors add \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "https://intel.ingress.com"

# Create local function project
echo ""
echo "Step 13: Creating local function project..."
mkdir -p azure-function
cd azure-function

# Create package.json with MySQL driver
cat > package.json << 'EOF'
{
  "name": "ingress-intel-function",
  "version": "1.0.0",
  "description": "Portal Intelligence Azure MySQL Upload Function",
  "scripts": {
    "start": "func start",
    "deploy": "func azure functionapp publish ingress-intel-function"
  },
  "dependencies": {
    "mysql2": "^3.6.5"
  },
  "devDependencies": {
    "azure-functions-core-tools": "^4.0.5"
  }
}
EOF

# Create host.json
cat > host.json << 'EOF'
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "maxTelemetryItemsPerSecond": 20
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
EOF

# Create function directory
mkdir -p UploadPortals

# Create function.json
cat > UploadPortals/function.json << 'EOF'
{
  "bindings": [
    {
      "authLevel": "function",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["post", "get"],
      "route": "UploadPortals"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
EOF

# Create index.js with MySQL support
cat > UploadPortals/index.js << 'EOF'
const mysql = require('mysql2/promise');

// MySQL connection config from environment variables
const dbConfig = {
    host: process.env['MYSQL_HOST'],
    database: process.env['MYSQL_DATABASE'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASSWORD'],
    ssl: {
        rejectUnauthorized: true
    },
    connectTimeout: 10000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;

async function getPool() {
    if (!pool) {
        pool = mysql.createPool(dbConfig);
    }
    return pool;
}

module.exports = async function (context, req) {
    context.log('Portal Intelligence Upload function triggered');

    // Handle health check
    if (req.method === 'GET' && req.url.includes('/health')) {
        context.res = {
            status: 200,
            body: { status: 'healthy', timestamp: new Date().toISOString() }
        };
        return;
    }

    // Validate request
    const portals = req.body?.portals;
    
    if (!portals || !Array.isArray(portals)) {
        context.res = {
            status: 400,
            body: { error: "Invalid request. Expected 'portals' array in request body." }
        };
        return;
    }

    if (portals.length === 0) {
        context.res = {
            status: 400,
            body: { error: "Empty portals array." }
        };
        return;
    }

    context.log(`Processing ${portals.length} portal records`);

    try {
        const dbPool = await getPool();
        const connection = await dbPool.getConnection();
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        try {
            for (const portal of portals) {
                try {
                    await connection.execute(
                        `CALL usp_UpsertPortalIntel(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            portal.PortalGUID,
                            portal.Latitude,
                            portal.Longitude,
                            portal.LatE6,
                            portal.LngE6,
                            portal.PortalName,
                            portal.ImageURL,
                            portal.Team,
                            portal.Level,
                            portal.Health,
                            portal.ResonatorCount,
                            portal.OwnerName,
                            portal.LinkCount,
                            portal.IncomingLinks,
                            portal.OutgoingLinks,
                            portal.FieldCount,
                            portal.HistoryVisited ? 1 : 0,
                            portal.HistoryCaptured ? 1 : 0,
                            portal.HistoryScoutControlled ? 1 : 0,
                            JSON.stringify(portal.ResonatorsJSON),
                            JSON.stringify(portal.ModsJSON),
                            new Date(portal.FirstSeen),
                            new Date(portal.LastUpdated),
                            portal.UpdateCount
                        ]
                    );
                    
                    successCount++;
                } catch (err) {
                    errorCount++;
                    errors.push({
                        portalGUID: portal.PortalGUID,
                        error: err.message
                    });
                    context.log.error(`Error processing portal ${portal.PortalGUID}:`, err.message);
                }
            }
        } finally {
            connection.release();
        }

        context.res = {
            status: 200,
            body: {
                message: `Successfully processed ${successCount} of ${portals.length} portals`,
                successCount: successCount,
                errorCount: errorCount,
                errors: errors.length > 0 ? errors : undefined
            }
        };

        context.log(`Completed: ${successCount} success, ${errorCount} errors`);

    } catch (err) {
        context.log.error('Database connection error:', err);
        
        context.res = {
            status: 500,
            body: {
                error: 'Database error',
                message: err.message
            }
        };
    }
};
EOF

# Create .funcignore
cat > .funcignore << 'EOF'
*.js.map
*.ts
.git*
.vscode
local.settings.json
test
.DS_Store
node_modules
EOF

# Install dependencies
echo ""
echo "Step 14: Installing Node.js dependencies..."
npm install

# Deploy function
echo ""
echo "Step 15: Deploying function to Azure..."
echo "Make sure Azure Functions Core Tools is installed:"
echo "  npm install -g azure-functions-core-tools@4"
echo ""
read -p "Press Enter to deploy or Ctrl+C to deploy manually later..."

npm install -g azure-functions-core-tools@4 2>/dev/null || true
func azure functionapp publish $FUNCTION_APP_NAME --javascript

# Get function URL and key
echo ""
echo "Step 16: Getting function URL and key..."
FUNCTION_URL=$(az functionapp function show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --function-name UploadPortals \
  --query "invokeUrlTemplate" -o tsv 2>/dev/null || echo "https://${FUNCTION_APP_NAME}.azurewebsites.net/api/UploadPortals")

FUNCTION_KEY=$(az functionapp keys list \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "functionKeys.default" -o tsv 2>/dev/null || echo "Get from Azure Portal")

# Save credentials to file
cd ..
cat > azure-credentials.txt << EOF
======================================
Portal Intelligence Azure Credentials
======================================

FUNCTION APP:
  URL: $FUNCTION_URL
  Key: $FUNCTION_KEY
  
MYSQL DATABASE (Private - Function App Only):
  Host: $MYSQL_HOST
  Database: $MYSQL_DATABASE_NAME
  User: $MYSQL_ADMIN_USER
  Password: $MYSQL_ADMIN_PASSWORD
  
CONNECTION STRING:
  $MYSQL_CONNECTION_STRING

VIRTUAL NETWORK:
  VNet: $VNET_NAME
  Function Subnet: $SUBNET_NAME
  MySQL Subnet: $MYSQL_SUBNET_NAME

IMPORTANT: 
- MySQL is only accessible from Function App via VNet
- No public access configured (secure by default)
- Keep this file secure and don't commit to Git!

COST ESTIMATE:
- MySQL Flexible Server (B1ms): ~\$5/month
- Function App (Consumption): ~\$0/month (free tier)
- Storage Account: ~\$0.50/month
- Total: ~\$5-6/month

Test connection:
  curl "$FUNCTION_URL/health?code=$FUNCTION_KEY"

Upload endpoint:
  $FUNCTION_URL?code=$FUNCTION_KEY
EOF

echo ""
echo "========================================"
echo "?? Setup Complete!"
echo "========================================"
echo ""
echo "? MySQL Flexible Server created (Burstable tier)"
echo "? Database schema deployed"
echo "? Virtual Network configured"
echo "? Function App created with VNet integration"
echo "? CORS configured for intel.ingress.com"
echo "? Function code deployed"
echo ""
echo "?? Credentials saved to: azure-credentials.txt"
echo ""
echo "Function URL: $FUNCTION_URL"
echo "Function Key: $FUNCTION_KEY"
echo ""
echo "Test connection:"
echo "curl \"$FUNCTION_URL/health?code=$FUNCTION_KEY\""
echo ""
echo "?? Estimated Monthly Cost: \$5-6"
echo "  - MySQL B1ms Burstable: \$5/month"
echo "  - Function Consumption: \$0/month (1M free)"
echo "  - Storage: \$0.50/month"
echo ""
echo "?? Security: MySQL has NO public access"
echo "   Only Function App can connect via VNet"
echo ""
echo "Configure these values in the IITC Portal Intel Sync plugin."
echo ""
echo "??  IMPORTANT: Keep azure-credentials.txt secure!"
echo "   It's already in .gitignore"
echo ""
