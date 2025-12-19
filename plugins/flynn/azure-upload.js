/**
 * =============================================
 * Direct Azure Upload Script
 * Upload collected portal intelligence to Azure SQL
 * =============================================
 * 
 * This script uploads exported portal data directly to Azure
 * without needing the browser plugin.
 * 
 * Usage:
 *   node azure-upload.js <json-file>
 *   node azure-upload.js collected-intel.json
 */

const https = require('https');
const fs = require('fs').promises;

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Azure Function endpoint (from setup script output)
  functionUrl: 'https://YOUR-FUNCTION-APP.azurewebsites.net/api/UploadPortals',
  functionKey: 'YOUR-FUNCTION-KEY',
  
  // Upload settings
  batchSize: 100,      // Portals per request
  retryAttempts: 3,    // Retry failed batches
  retryDelay: 2000,    // Delay between retries (ms)
  delayBetweenBatches: 1000  // Delay between successful batches (ms)
};

// Load config from environment variables if available
if (process.env.AZURE_FUNCTION_URL) {
  CONFIG.functionUrl = process.env.AZURE_FUNCTION_URL;
}
if (process.env.AZURE_FUNCTION_KEY) {
  CONFIG.functionKey = process.env.AZURE_FUNCTION_KEY;
}

// =============================================
// HTTP REQUEST HELPER
// =============================================

/**
 * Make HTTPS POST request to Azure Function
 */
function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'x-functions-key': CONFIG.functionKey
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const result = JSON.parse(body);
            resolve({ success: true, status: res.statusCode, data: result });
          } catch (err) {
            resolve({ success: true, status: res.statusCode, data: body });
          }
        } else {
          reject({
            success: false,
            status: res.statusCode,
            error: body
          });
        }
      });
    });
    
    req.on('error', (err) => {
      reject({
        success: false,
        error: err.message
      });
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
      reject({
        success: false,
        error: 'Request timeout'
      });
    });
    
    req.write(postData);
    req.end();
  });
}

// =============================================
// UPLOAD FUNCTIONS
// =============================================

/**
 * Upload a batch of portals
 */
async function uploadBatch(batch, batchNum, totalBatches, attempt = 1) {
  const progress = `[${batchNum}/${totalBatches}]`;
  
  try {
    console.log(`${progress} Uploading batch of ${batch.length} portals (attempt ${attempt})...`);
    
    const response = await makeRequest(CONFIG.functionUrl, { portals: batch });
    
    if (response.success) {
      console.log(`${progress} ✓ Success: ${response.data.message || 'Uploaded successfully'}`);
      return { success: true, count: batch.length };
    } else {
      throw new Error('Upload failed');
    }
  } catch (err) {
    console.error(`${progress} ✗ Failed: ${err.error || err.message}`);
    
    // Retry logic
    if (attempt < CONFIG.retryAttempts) {
      console.log(`${progress} Retrying in ${CONFIG.retryDelay}ms...`);
      await sleep(CONFIG.retryDelay);
      return uploadBatch(batch, batchNum, totalBatches, attempt + 1);
    } else {
      console.error(`${progress} ✗ Failed after ${CONFIG.retryAttempts} attempts`);
      return { success: false, count: 0, error: err };
    }
  }
}

/**
 * Upload all portals in batches
 */
async function uploadAll(portals) {
  // Split into batches
  const batches = [];
  for (let i = 0; i < portals.length; i += CONFIG.batchSize) {
    batches.push(portals.slice(i, i + CONFIG.batchSize));
  }
  
  console.log(`\nUploading ${portals.length} portals in ${batches.length} batches...\n`);
  
  const results = {
    total: portals.length,
    success: 0,
    failed: 0,
    errors: []
  };
  
  // Upload batches sequentially
  for (let i = 0; i < batches.length; i++) {
    const result = await uploadBatch(batches[i], i + 1, batches.length);
    
    if (result.success) {
      results.success += result.count;
    } else {
      results.failed += batches[i].length;
      results.errors.push({
        batch: i + 1,
        error: result.error
      });
    }
    
    // Delay between batches
    if (i < batches.length - 1) {
      await sleep(CONFIG.delayBetweenBatches);
    }
  }
  
  return results;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// FILE LOADING
// =============================================

/**
 * Load portal data from JSON file
 */
async function loadPortalData(filePath) {
  try {
    console.log(`Loading portal data from: ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8');
    const portals = JSON.parse(data);
    
    if (!Array.isArray(portals)) {
      throw new Error('File must contain an array of portals');
    }
    
    console.log(`✓ Loaded ${portals.length} portals`);
    return portals;
  } catch (err) {
    console.error(`✗ Failed to load file: ${err.message}`);
    throw err;
  }
}

/**
 * Validate portal data structure
 */
function validatePortalData(portals) {
  console.log('Validating portal data...');
  
  const required = [
    'PortalGUID', 'Latitude', 'Longitude', 'LatE6', 'LngE6'
  ];
  
  const invalid = [];
  
  portals.forEach((portal, index) => {
    const missing = required.filter(field => portal[field] === undefined);
    if (missing.length > 0) {
      invalid.push({
        index: index,
        guid: portal.PortalGUID || 'unknown',
        missing: missing
      });
    }
  });
  
  if (invalid.length > 0) {
    console.warn(`⚠ Warning: ${invalid.length} portals have missing required fields:`);
    invalid.slice(0, 5).forEach(p => {
      console.warn(`  - Portal ${p.index} (${p.guid}): Missing ${p.missing.join(', ')}`);
    });
    if (invalid.length > 5) {
      console.warn(`  ... and ${invalid.length - 5} more`);
    }
  } else {
    console.log('✓ All portals have required fields');
  }
  
  return invalid.length === 0;
}

// =============================================
// CONNECTION TEST
// =============================================

/**
 * Test connection to Azure Function
 */
async function testConnection() {
  console.log('Testing connection to Azure Function...');
  
  try {
    const healthUrl = CONFIG.functionUrl.replace(/\?.*$/, '/health') + 
                     (CONFIG.functionUrl.includes('?') ? '&' : '?') +
                     `code=${CONFIG.functionKey}`;
    
    const response = await makeRequest(healthUrl.replace('/UploadPortals', '/UploadPortals/health'), {});
    
    console.log('✓ Connection successful!');
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${JSON.stringify(response.data)}`);
    return true;
  } catch (err) {
    console.error('✗ Connection failed!');
    console.error(`  Error: ${err.error || err.message}`);
    return false;
  }
}

// =============================================
// MAIN FUNCTION
// =============================================

/**
 * Main upload process
 */
async function main() {
  console.log('==========================================');
  console.log('Azure Portal Intelligence Direct Upload');
  console.log('==========================================\n');
  
  // Check arguments
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage:
  node azure-upload.js <json-file> [options]

Arguments:
  <json-file>       Path to exported portal JSON file

Options:
  --test            Test connection only, don't upload
  --batch-size N    Upload N portals per batch (default: 100)
  --validate        Validate data structure only, don't upload
  --help, -h        Show this help

Environment Variables:
  AZURE_FUNCTION_URL    Azure Function endpoint URL
  AZURE_FUNCTION_KEY    Azure Function key

Examples:
  # Upload portals
  node azure-upload.js collected-intel.json

  # Test connection
  node azure-upload.js --test

  # Validate data only
  node azure-upload.js data.json --validate

  # Custom batch size
  node azure-upload.js data.json --batch-size 50
    `);
    process.exit(0);
  }
  
  // Parse options
  const filePath = args.find(arg => !arg.startsWith('--'));
  const testOnly = args.includes('--test');
  const validateOnly = args.includes('--validate');
  
  if (args.includes('--batch-size')) {
    const idx = args.indexOf('--batch-size');
    CONFIG.batchSize = parseInt(args[idx + 1]) || CONFIG.batchSize;
  }
  
  // Validate configuration
  if (!CONFIG.functionUrl || CONFIG.functionUrl.includes('YOUR-FUNCTION')) {
    console.error('✗ Azure Function URL not configured!');
    console.error('  Edit azure-upload.js and set CONFIG.functionUrl');
    console.error('  Or set environment variable: AZURE_FUNCTION_URL');
    process.exit(1);
  }
  
  if (!CONFIG.functionKey || CONFIG.functionKey.includes('YOUR-FUNCTION')) {
    console.error('✗ Azure Function Key not configured!');
    console.error('  Edit azure-upload.js and set CONFIG.functionKey');
    console.error('  Or set environment variable: AZURE_FUNCTION_KEY');
    process.exit(1);
  }
  
  console.log('Configuration:');
  console.log(`  Function URL: ${CONFIG.functionUrl.substring(0, 50)}...`);
  console.log(`  Function Key: ***${CONFIG.functionKey.slice(-4)}`);
  console.log(`  Batch Size: ${CONFIG.batchSize}`);
  console.log('');
  
  // Test connection
  if (testOnly) {
    await testConnection();
    process.exit(0);
  }
  
  // Load portal data
  if (!filePath) {
    console.error('✗ No file specified!');
    console.error('  Usage: node azure-upload.js <json-file>');
    process.exit(1);
  }
  
  const portals = await loadPortalData(filePath);
  
  // Validate data
  const isValid = validatePortalData(portals);
  
  if (validateOnly) {
    if (isValid) {
      console.log('\n✓ Data validation passed!');
      process.exit(0);
    } else {
      console.error('\n✗ Data validation failed!');
      process.exit(1);
    }
  }
  
  if (!isValid) {
    console.warn('\n⚠ Data validation warnings detected. Continue anyway? (Ctrl+C to cancel)');
    await sleep(3000);
  }
  
  // Test connection before upload
  console.log('');
  const connected = await testConnection();
  
  if (!connected) {
    console.error('\n✗ Cannot connect to Azure Function. Aborting upload.');
    process.exit(1);
  }
  
  // Upload
  console.log('');
  const results = await uploadAll(portals);
  
  // Results summary
  console.log('\n==========================================');
  console.log('Upload Complete!');
  console.log('==========================================');
  console.log(`Total Portals: ${results.total}`);
  console.log(`✓ Success: ${results.success}`);
  console.log(`✗ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => {
      console.log(`  Batch ${err.batch}: ${err.error.error || err.error.message || 'Unknown error'}`);
    });
  }
  
  if (results.failed > 0) {
    console.log('\n⚠ Some portals failed to upload. Check errors above.');
    process.exit(1);
  } else {
    console.log('\n✓ All portals uploaded successfully!');
    process.exit(0);
  }
}

// =============================================
// RUN
// =============================================

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('\n✗ Unhandled error:', err);
  process.exit(1);
});

// Run main function
main().catch(err => {
  console.error('\n✗ Fatal error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
