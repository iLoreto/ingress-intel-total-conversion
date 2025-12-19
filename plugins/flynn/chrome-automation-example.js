/**
 * =============================================
 * Chrome Automation for Portal Intelligence Collection
 * Using Selenium WebDriver
 * =============================================
 * 
 * This script automates the process of navigating to portals
 * in the Ingress Intel map and capturing their intelligence data
 * using the Portal Intelligence Cache plugin.
 * 
 * Prerequisites:
 * - Node.js installed
 * - Chrome browser installed
 * - IITC-CE and Portal Intel Cache plugin installed in Chrome
 * - Ingress Intel account with valid session
 * 
 * Setup:
 * npm install selenium-webdriver
 * npm install chromedriver
 */

const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs').promises;
const path = require('path');

// =============================================
// CONFIGURATION
// =============================================

const CONFIG = {
  // Chrome profile with IITC installed
  chromeUserDataDir: 'C:\\Users\\YourUser\\AppData\\Local\\Google\\Chrome\\User Data',
  chromeProfile: 'Default',
  
  // Input/Output files
  portalListFile: './portal-list.json',  // List of portals to scan
  outputFile: './collected-intel.json',   // Final collected data
  
  // Timing (milliseconds)
  pageLoadTimeout: 15000,
  portalDetailsTimeout: 5000,
  delayBetweenPortals: 3000,
  
  // Coordinates for area scan
  areaScan: {
    enabled: false,
    centerLat: 40.7128,
    centerLng: -74.0060,
    radiusKm: 5,
    gridSize: 10  // Number of grid points to sample
  },
  
  // Headless mode (false = show browser, true = hidden)
  headless: false
};

// =============================================
// PORTAL LIST MANAGEMENT
// =============================================

/**
 * Load portal list from file or generate from area scan
 */
async function loadPortalList() {
  try {
    // Try loading from file first
    const data = await fs.readFile(CONFIG.portalListFile, 'utf8');
    const portals = JSON.parse(data);
    console.log(`✓ Loaded ${portals.length} portals from ${CONFIG.portalListFile}`);
    return portals;
  } catch (err) {
    console.log('! Portal list file not found, will scan visible area');
    return [];
  }
}

/**
 * Generate portal list by scanning an area
 */
async function generateAreaScan(driver) {
  console.log('Generating area scan grid...');
  
  const { centerLat, centerLng, radiusKm, gridSize } = CONFIG.areaScan;
  const points = [];
  
  // Generate grid of points in a circle
  const kmPerDegree = 111.32;  // Approximate at equator
  const degreeRadius = radiusKm / kmPerDegree;
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * degreeRadius;
      
      const lat = centerLat + (distance * Math.sin(angle));
      const lng = centerLng + (distance * Math.cos(angle));
      
      points.push({
        lat: lat,
        lng: lng,
        name: `Scan Point ${i}-${j}`,
        guid: null  // Will be determined when portal is clicked
      });
    }
  }
  
  console.log(`Generated ${points.length} scan points`);
  return points;
}

// =============================================
// CHROME DRIVER SETUP
// =============================================

/**
 * Setup and configure Chrome WebDriver
 */
async function setupDriver() {
  console.log('Setting up Chrome WebDriver...');
  
  const options = new chrome.Options();
  
  // Use existing Chrome profile with IITC installed
  if (CONFIG.chromeUserDataDir && CONFIG.chromeProfile) {
    options.addArguments(
      `--user-data-dir=${CONFIG.chromeUserDataDir}`,
      `--profile-directory=${CONFIG.chromeProfile}`
    );
    console.log(`✓ Using Chrome profile: ${CONFIG.chromeProfile}`);
  }
  
  // Additional Chrome options
  options.addArguments(
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-gpu'
  );
  
  if (CONFIG.headless) {
    options.addArguments('--headless=new');
    console.log('✓ Running in headless mode');
  }
  
  // Build driver
  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
  
  // Set timeouts
  await driver.manage().setTimeouts({
    pageLoad: CONFIG.pageLoadTimeout,
    implicit: 2000
  });
  
  console.log('✓ Chrome WebDriver ready');
  return driver;
}

// =============================================
// INTEL MAP NAVIGATION
// =============================================

/**
 * Navigate to Intel map at specific coordinates
 */
async function navigateToPortal(driver, portal) {
  const url = `https://intel.ingress.com/intel?ll=${portal.lat},${portal.lng}&z=18`;
  console.log(`→ Navigating to: ${portal.name || 'Unknown'} (${portal.lat}, ${portal.lng})`);
  
  try {
    await driver.get(url);
    await driver.sleep(2000);  // Wait for map to load
    return true;
  } catch (err) {
    console.error(`✗ Failed to navigate: ${err.message}`);
    return false;
  }
}

/**
 * Wait for Intel map to be fully loaded
 */
async function waitForMapLoad(driver) {
  try {
    // Wait for map container
    await driver.wait(until.elementLocated(By.id('map')), 10000);
    
    // Wait for IITC to initialize
    await driver.sleep(2000);
    
    // Check if logged in
    const loginCheck = await driver.executeScript(
      'return window.PLAYER !== undefined && window.PLAYER.nickname !== null;'
    );
    
    if (!loginCheck) {
      console.error('✗ Not logged in to Ingress Intel!');
      return false;
    }
    
    console.log('✓ Intel map loaded');
    return true;
  } catch (err) {
    console.error(`✗ Map load error: ${err.message}`);
    return false;
  }
}

/**
 * Click on portal at coordinates to view details
 */
async function clickPortalAtLocation(driver, lat, lng) {
  try {
    // Execute script to find and click portal
    const clicked = await driver.executeScript(`
      // Find portal nearest to coordinates
      let nearestPortal = null;
      let minDistance = Infinity;
      
      for (let guid in window.portals) {
        const portal = window.portals[guid];
        const latlng = portal.getLatLng();
        const distance = Math.sqrt(
          Math.pow(latlng.lat - ${lat}, 2) + 
          Math.pow(latlng.lng - ${lng}, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestPortal = guid;
        }
      }
      
      if (nearestPortal && minDistance < 0.001) {
        // Click portal
        window.renderPortalDetails(nearestPortal);
        return nearestPortal;
      }
      
      return null;
    `);
    
    if (clicked) {
      console.log(`  ✓ Clicked portal: ${clicked}`);
      await driver.sleep(CONFIG.portalDetailsTimeout);
      return clicked;
    } else {
      console.log('  ! No portal found at coordinates');
      return null;
    }
  } catch (err) {
    console.error(`  ✗ Error clicking portal: ${err.message}`);
    return null;
  }
}

/**
 * Get all visible portals on current map view
 */
async function getVisiblePortals(driver) {
  try {
    const portals = await driver.executeScript(`
      const visible = [];
      for (let guid in window.portals) {
        const portal = window.portals[guid];
        const latlng = portal.getLatLng();
        const details = window.portalDetail.get(guid);
        
        visible.push({
          guid: guid,
          lat: latlng.lat,
          lng: latlng.lng,
          name: details ? details.title : 'Unknown',
          team: details ? details.team : null,
          level: details ? details.level : null
        });
      }
      return visible;
    `);
    
    return portals;
  } catch (err) {
    console.error(`✗ Error getting visible portals: ${err.message}`);
    return [];
  }
}

// =============================================
// DATA COLLECTION
// =============================================

/**
 * Check if portal data was captured by cache plugin
 */
async function verifyPortalCaptured(driver, guid) {
  try {
    const captured = await driver.executeScript(`
      if (window.portalIntelCache && window.portalIntelCache.cache) {
        return window.portalIntelCache.cache['${guid}'] !== undefined;
      }
      return false;
    `);
    
    return captured;
  } catch (err) {
    return false;
  }
}

/**
 * Get cached portal count
 */
async function getCacheStats(driver) {
  try {
    const stats = await driver.executeScript(`
      if (window.portalIntelCache) {
        return {
          total: Object.keys(window.portalIntelCache.cache).length,
          session: window.portalIntelCache.stats.sessionCaptures,
          pending: window.portalIntelCache.stats.pendingSync
        };
      }
      return null;
    `);
    
    return stats;
  } catch (err) {
    return null;
  }
}

/**
 * Export cached data from browser
 */
async function exportCachedData(driver, outputFile) {
  try {
    console.log('Exporting cached portal data...');
    
    const data = await driver.executeScript(`
      if (window.portalIntelCache) {
        return window.portalIntelCache.exportForSync();
      }
      return [];
    `);
    
    if (data && data.length > 0) {
      await fs.writeFile(outputFile, JSON.stringify(data, null, 2));
      console.log(`✓ Exported ${data.length} portals to ${outputFile}`);
      return data.length;
    } else {
      console.log('! No data to export');
      return 0;
    }
  } catch (err) {
    console.error(`✗ Export error: ${err.message}`);
    return 0;
  }
}

// =============================================
// MAIN COLLECTION PROCESS
// =============================================

/**
 * Main portal collection function
 */
async function collectPortalIntelligence() {
  console.log('==========================================');
  console.log('Portal Intelligence Collection Automation');
  console.log('==========================================\n');
  
  let driver = null;
  
  try {
    // Setup Chrome driver
    driver = await setupDriver();
    
    // Navigate to Intel map
    console.log('\nNavigating to Ingress Intel...');
    await driver.get('https://intel.ingress.com/intel');
    
    // Wait for map to load
    if (!await waitForMapLoad(driver)) {
      throw new Error('Failed to load Intel map. Please log in manually.');
    }
    
    // Load or generate portal list
    let portalList = await loadPortalList();
    
    if (portalList.length === 0 && CONFIG.areaScan.enabled) {
      portalList = await generateAreaScan(driver);
    }
    
    if (portalList.length === 0) {
      // Scan current view
      console.log('\nScanning visible portals in current view...');
      portalList = await getVisiblePortals(driver);
    }
    
    console.log(`\nTarget portals: ${portalList.length}`);
    console.log('Starting collection...\n');
    
    // Track progress
    let successCount = 0;
    let failCount = 0;
    let capturedCount = 0;
    
    // Process each portal
    for (let i = 0; i < portalList.length; i++) {
      const portal = portalList[i];
      const progress = `[${i + 1}/${portalList.length}]`;
      
      console.log(`${progress} Processing: ${portal.name || 'Unknown Portal'}`);
      
      // Navigate to portal
      if (!await navigateToPortal(driver, portal)) {
        failCount++;
        continue;
      }
      
      // Click portal to load details
      const guid = await clickPortalAtLocation(driver, portal.lat, portal.lng);
      
      if (guid) {
        // Verify capture
        await driver.sleep(1000);
        const captured = await verifyPortalCaptured(driver, guid);
        
        if (captured) {
          capturedCount++;
          console.log(`  ✓ Captured successfully`);
        } else {
          console.log(`  ! Data may not have been captured`);
        }
        
        successCount++;
      } else {
        failCount++;
      }
      
      // Show cache stats periodically
      if ((i + 1) % 10 === 0) {
        const stats = await getCacheStats(driver);
        if (stats) {
          console.log(`\n  📊 Cache: ${stats.total} total, ${stats.session} this session, ${stats.pending} pending\n`);
        }
      }
      
      // Delay between portals
      await driver.sleep(CONFIG.delayBetweenPortals);
    }
    
    // Final stats
    console.log('\n==========================================');
    console.log('Collection Complete!');
    console.log('==========================================');
    console.log(`Success: ${successCount}`);
    console.log(`Failed: ${failCount}`);
    console.log(`Captured: ${capturedCount}`);
    
    // Get final cache stats
    const finalStats = await getCacheStats(driver);
    if (finalStats) {
      console.log(`\nCache Status:`);
      console.log(`  Total: ${finalStats.total}`);
      console.log(`  Session: ${finalStats.session}`);
      console.log(`  Pending Sync: ${finalStats.pending}`);
    }
    
    // Export data
    console.log('');
    const exportedCount = await exportCachedData(driver, CONFIG.outputFile);
    
    console.log('\n✓ Automation complete!');
    console.log(`\nNext steps:`);
    console.log(`1. Review exported data in ${CONFIG.outputFile}`);
    console.log(`2. Use Portal Intel Sync plugin to upload to Azure SQL`);
    console.log(`3. Or use: node azure-upload.js ${CONFIG.outputFile}`);
    
  } catch (err) {
    console.error('\n✗ Fatal error:', err.message);
    console.error(err.stack);
  } finally {
    // Keep browser open for manual review
    if (driver) {
      console.log('\n! Browser will remain open for manual review.');
      console.log('! Press Ctrl+C to close when done.');
      
      // Wait indefinitely
      await new Promise(() => {});
    }
  }
}

// =============================================
// EXAMPLE USAGE FUNCTIONS
// =============================================

/**
 * Example: Collect portals from a list
 */
async function exampleCollectFromList() {
  // Create sample portal list
  const samplePortals = [
    { guid: 'portal1.16', lat: 40.7128, lng: -74.0060, name: 'City Hall' },
    { guid: 'portal2.16', lat: 40.7580, lng: -73.9855, name: 'Times Square' },
    { guid: 'portal3.16', lat: 40.7484, lng: -73.9857, name: 'Empire State' }
  ];
  
  await fs.writeFile(CONFIG.portalListFile, JSON.stringify(samplePortals, null, 2));
  console.log(`Created sample portal list: ${CONFIG.portalListFile}`);
  
  await collectPortalIntelligence();
}

/**
 * Example: Scan area and collect visible portals
 */
async function exampleAreaScan() {
  CONFIG.areaScan.enabled = true;
  CONFIG.areaScan.centerLat = 40.7128;
  CONFIG.areaScan.centerLng = -74.0060;
  CONFIG.areaScan.radiusKm = 2;
  CONFIG.areaScan.gridSize = 5;
  
  await collectPortalIntelligence();
}

// =============================================
// RUN
// =============================================

// Check command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Portal Intelligence Collection Automation

Usage:
  node chrome-automation-example.js [options]

Options:
  --portal-list <file>   Use portal list from file (JSON)
  --area-scan           Enable area scanning mode
  --headless            Run in headless mode (no browser window)
  --output <file>       Output file for collected data
  --help, -h            Show this help

Examples:
  # Collect from portal list
  node chrome-automation-example.js --portal-list portals.json

  # Scan area around coordinates
  node chrome-automation-example.js --area-scan

  # Run in headless mode
  node chrome-automation-example.js --headless --output intel.json
  `);
  process.exit(0);
}

// Parse arguments
if (args.includes('--portal-list')) {
  CONFIG.portalListFile = args[args.indexOf('--portal-list') + 1];
}

if (args.includes('--area-scan')) {
  CONFIG.areaScan.enabled = true;
}

if (args.includes('--headless')) {
  CONFIG.headless = true;
}

if (args.includes('--output')) {
  CONFIG.outputFile = args[args.indexOf('--output') + 1];
}

// Run collection
collectPortalIntelligence().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
