const mariadb = require('mariadb');

// MariaDB connection config from environment variables
const dbConfig = {
    host: process.env['MYSQL_HOST'],
    database: process.env['MYSQL_DATABASE'],
    user: process.env['MYSQL_USER'],
    password: process.env['MYSQL_PASSWORD'],
    connectTimeout: 10000,
    waitForConnections: true,
    connectionLimit: 10
};

// Only require SSL for Azure (non-localhost)
if (process.env['MYSQL_HOST'] && !process.env['MYSQL_HOST'].includes('localhost')) {
    dbConfig.ssl = { rejectUnauthorized: true };
}

let pool = null;

async function getPool() {
    if (!pool) {
        pool = mariadb.createPool(dbConfig);
    }
    return pool;
}

module.exports = async function (context, req) {
    context.log('Portal Intelligence Upload function triggered');
    context.log(`Request method: ${req.method}`);
    context.log(`Request URL: ${req.url}`);

    // Extract just the path from the URL (remove protocol, host, port)
    let urlPath = req.url;
    try {
        const parsedUrl = new URL(req.url);
        urlPath = parsedUrl.pathname;
    } catch (e) {
        // If parsing fails, assume it's already a path
        urlPath = req.url;
    }

    // Normalize the route to handle trailing slashes and case sensitivity
    const normalizedUrl = urlPath.toLowerCase().replace(/\/$/, '');
    context.log(`Normalized URL path: ${normalizedUrl}`);

    // Handle health check (GET or HEAD request)
    if ((req.method === 'GET' || req.method === 'HEAD') && normalizedUrl === '/api/uploadportals/health') {
        context.log('Health check route matched');

        // Test database connection on health check
        try {
            const dbPool = await getPool();
            const connection = await dbPool.getConnection();
            await connection.ping();
            connection.release();

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: req.method === 'HEAD' ? undefined : {
                    status: 'healthy',
                    database: 'connected',
                    host: process.env['MYSQL_HOST'],
                    timestamp: new Date().toISOString()
                }
            };
        } catch (err) {
            context.res = {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
                body: req.method === 'HEAD' ? undefined : {
                    status: 'unhealthy',
                    database: 'disconnected',
                    error: err.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
        return;
    }

    context.log('Health check route not matched');

    // Validate request for portal upload
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
                    await connection.query(
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