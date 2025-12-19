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