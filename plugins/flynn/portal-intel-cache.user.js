// ==UserScript==
// @author         YourName
// @name           Portal Intelligence Cache
// @category       Info
// @version        0.1.3
// @description    Captures portal details to browser localStorage for later Azure SQL sync
// @id             portal-intel-cache
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

console.log('[Intel Cache] Updated to version 0.1.3')

/* exported setup --eslint */
/* global IITC -- eslint */

console.log('[Intel Cache] ========== PLUGIN LOADING START ==========');
console.log('[Intel Cache] Timestamp:', new Date().toISOString());

var changelog = [
  {
    version: '0.1.3',
    changes: ['Added portalSelected hook for immediate capture on portal selection', 'Enhanced logging for portal details on selection']
  },
  {
    version: '0.1.2',
    changes: ['Added comprehensive debugging', 'Fixed hook registration', 'Improved error handling']
  },
  {
    version: '0.1.1',
    changes: ['Initial release', 'Captures portal details to localStorage', 'Export functionality for Azure SQL sync']
  }
];

// Use own namespace for plugin
var portalIntelCache = {};
window.plugin.portalIntelCache = portalIntelCache;

console.log('[Intel Cache] Namespace created: window.plugin.portalIntelCache');

// Configuration
portalIntelCache.config = {
  storageKey: 'iitc_portal_intel_cache',
  autoSave: true,
  maxCacheSize: 10000,
  debugMode: true
};

console.log('[Intel Cache] Configuration:', portalIntelCache.config);

// Initialize cache and stats
portalIntelCache.cache = {};
portalIntelCache.stats = {
  totalCaptured: 0,
  lastUpdate: null,
  pendingSync: 0,
  sessionCaptures: 0
};

/**
 * Load cache from localStorage
 */
portalIntelCache.loadCache = function() {
  try {
    var stored = localStorage.getItem(portalIntelCache.config.storageKey);
    if (stored) {
      portalIntelCache.cache = JSON.parse(stored);
      portalIntelCache.stats.totalCaptured = Object.keys(portalIntelCache.cache).length;
      portalIntelCache.stats.pendingSync = portalIntelCache.stats.totalCaptured;
      console.log('[Intel Cache] Loaded ' + portalIntelCache.stats.totalCaptured + ' cached portals');
    }
  } catch (e) {
    console.error('[Intel Cache] Failed to load cache:', e);
    portalIntelCache.cache = {};
  }
};

/**
 * Save cache to localStorage
 */
portalIntelCache.saveCache = function() {
  console.log('[Intel Cache] Saving cache to localStorage...');
  try {
    var cacheStr = JSON.stringify(portalIntelCache.cache);
    localStorage.setItem(portalIntelCache.config.storageKey, cacheStr);
    portalIntelCache.stats.lastUpdate = new Date().toISOString();
    
    if (portalIntelCache.config.debugMode) {
      var sizeKB = (cacheStr.length / 1024).toFixed(2);
      console.log('[Intel Cache] Saved ' + Object.keys(portalIntelCache.cache).length + ' portals (' + sizeKB + ' KB)');
    }
  } catch (e) {
    console.error('[Intel Cache] Failed to save cache:', e);
    
    // Handle quota exceeded
    if (e.name === 'QuotaExceededError') {
      alert('Storage quota exceeded! Please export and clear cache.');
      portalIntelCache.cleanupOldEntries();
    }
  }
};

/**
 * Extract comprehensive intel from portal details
 */
portalIntelCache.extractIntel = function(data) {
  var details = data.portalDetails;
  var guid = data.guid;
  
  var intel = {
    // === UNIQUE IDENTIFIERS ===
    guid: guid,
    latE6: details.latE6,
    lngE6: details.lngE6,
    lat: details.latE6 / 1e6,
    lng: details.lngE6 / 1e6,
    
    // === BASIC INFO ===
    title: details.title || 'Unknown Portal',
    image: details.image || null,
    
    // === STATUS ===
    team: details.team, // RESISTANCE, ENLIGHTENED, MACHINA, NEUTRAL
    level: details.level,
    health: details.health,
    resCount: details.resCount || 0,
    
    // === OWNER ===
    owner: details.owner || null,
    
    // === RESONATORS ===
    resonators: [],
    
    // === MODS ===
    mods: [],
    
    // === LINKS & FIELDS ===
    linkCount: 0,
    incomingLinks: 0,
    outgoingLinks: 0,
    fieldCount: 0,
    
    // === HISTORY ===
    history: {
      visited: details.history ? details.history.visited : false,
      captured: details.history ? details.history.captured : false,
      scoutControlled: details.history ? details.history.scoutControlled : false
    },
    
    // === METADATA ===
    firstSeen: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    updateCount: 1,
    
    // === SYNC TRACKING ===
    syncStatus: 'pending',
    lastSyncAttempt: null,
    syncError: null
  };
  
  // Extract resonator details
  if (details.resonators && details.resonators.length > 0) {
    details.resonators.forEach(function(reso, slot) {
      if (reso) {
        intel.resonators.push({
          slot: slot,
          level: parseInt(reso.level),
          owner: reso.owner,
          energy: parseInt(reso.energy),
          energyTotal: window.RESO_NRG[parseInt(reso.level)],
          distanceToPortal: reso.distanceToPortal || 0,
          healthPercent: Math.round((reso.energy / window.RESO_NRG[parseInt(reso.level)]) * 100)
        });
      } else {
        intel.resonators.push(null);
      }
    });
  }
  
  // Extract mod details
  if (details.mods && details.mods.length > 0) {
    details.mods.forEach(function(mod, slot) {
      if (mod) {
        intel.mods.push({
          slot: slot,
          name: mod.name || mod.displayName,
          rarity: mod.rarity,
          owner: mod.owner || mod.installingUser,
          stats: mod.stats || {}
        });
      } else {
        intel.mods.push(null);
      }
    });
  }
  
  // Get link/field counts
  try {
    var links = window.getPortalLinks(guid);
    intel.incomingLinks = links.in.length;
    intel.outgoingLinks = links.out.length;
    intel.linkCount = intel.incomingLinks + intel.outgoingLinks;
    intel.fieldCount = window.getPortalFieldsCount(guid);
  } catch (e) {
    console.warn('[Intel Cache] Could not get link/field data for', guid);
  }
  
  return intel;
};

/**
 * Store or update portal intel in cache
 */
portalIntelCache.storeIntel = function(intel) {
  var guid = intel.guid;
  var isNew = !portalIntelCache.cache[guid];
  
  // Update existing entry
  if (!isNew) {
    var existing = portalIntelCache.cache[guid];
    intel.firstSeen = existing.firstSeen;
    intel.updateCount = (existing.updateCount || 1) + 1;
  }
  
  // Store in cache
  portalIntelCache.cache[guid] = intel;
  
  // Update stats
  if (isNew) {
    portalIntelCache.stats.totalCaptured++;
    portalIntelCache.stats.sessionCaptures++;
  }
  portalIntelCache.stats.pendingSync++;
  
  // Auto-save
  if (portalIntelCache.config.autoSave) {
    portalIntelCache.saveCache();
  }
  
  // Update UI
  portalIntelCache.updateStatusDisplay();
  
  if (portalIntelCache.config.debugMode) {
    var action = isNew ? 'NEW' : 'UPDATE';
    console.log('[Intel Cache] ' + action + ':', intel.title, '(' + guid + ')');
  }
};

/**
 * Hook: Capture portal details when viewed
 */
portalIntelCache.onPortalDetailsUpdated = function (data) {
  console.log('[Intel Cache] Hook triggered: portalDetailsUpdated');
  console.log('[Intel Cache] Data received:', data);

  if (!data || !data.portalDetails) {
    console.error('[Intel Cache] No portal details found in the data.');
    return;
  }

  console.log('[Intel Cache] Processing portal details for GUID:', data.guid);
  try {
    var intel = portalIntelCache.extractIntel(data);
    portalIntelCache.storeIntel(intel);
    console.log('[Intel Cache] Portal details processed and stored successfully for GUID:', data.guid);
  } catch (e) {
    console.error('[Intel Cache] Error processing portal details:', e);
  }
};

/**
 * Hook: Log portal selection and capture details if available
 */
portalIntelCache.onPortalSelected = function (data) {
  console.log('[Intel Cache] Hook triggered: portalSelected');
  console.log('[Intel Cache] Selected portal GUID:', data.selectedPortalGuid);
  console.log('[Intel Cache] Unselected portal GUID:', data.unselectedPortalGuid);
  console.log('[Intel Cache] Event:', data.event);

  if (data.selectedPortalGuid) {
    var portal = window.portals[data.selectedPortalGuid];
    if (portal) {
      console.log('[Intel Cache] Portal object found for GUID:', data.selectedPortalGuid);
      if (portal.hasFullDetails()) {
        var details = portal.getDetails();
        console.log('[Intel Cache] Full portal details available:', details);
        try {
          var intel = portalIntelCache.extractIntel({ guid: data.selectedPortalGuid, portalDetails: details });
          portalIntelCache.storeIntel(intel);
          console.log('[Intel Cache] Portal details captured and stored on selection for GUID:', data.selectedPortalGuid);
        } catch (e) {
          console.error('[Intel Cache] Error processing portal details on selection:', e);
        }
      } else {
        console.log('[Intel Cache] Portal details not yet fully loaded for GUID:', data.selectedPortalGuid, '- will capture on portalDetailsUpdated');
      }
    } else {
      console.warn('[Intel Cache] Portal object not found for GUID:', data.selectedPortalGuid);
    }
  }
};

/**
 * Export cache as JSON for Azure SQL sync
 */
portalIntelCache.exportForSync = function() {
  var records = [];
  
  for (var guid in portalIntelCache.cache) {
    var intel = portalIntelCache.cache[guid];
    
    // Format for SQL MERGE/UPSERT
    var record = {
      // Primary key
      PortalGUID: intel.guid,
      
      // Location
      Latitude: intel.lat,
      Longitude: intel.lng,
      LatE6: intel.latE6,
      LngE6: intel.lngE6,
      
      // Basic info
      PortalName: intel.title,
      ImageURL: intel.image,
      
      // Status
      Team: intel.team,
      Level: intel.level,
      Health: intel.health,
      ResonatorCount: intel.resCount,
      
      // Owner
      OwnerName: intel.owner,
      
      // Links/Fields
      LinkCount: intel.linkCount,
      IncomingLinks: intel.incomingLinks,
      OutgoingLinks: intel.outgoingLinks,
      FieldCount: intel.fieldCount,
      
      // History
      HistoryVisited: intel.history.visited,
      HistoryCaptured: intel.history.captured,
      HistoryScoutControlled: intel.history.scoutControlled,
      
      // Complex data (JSON columns)
      ResonatorsJSON: JSON.stringify(intel.resonators),
      ModsJSON: JSON.stringify(intel.mods),
      
      // Metadata
      FirstSeen: intel.firstSeen,
      LastUpdated: intel.lastUpdated,
      UpdateCount: intel.updateCount,
      
      // Sync tracking
      SyncStatus: intel.syncStatus,
      LastSyncAttempt: intel.lastSyncAttempt,
      SyncError: intel.syncError
    };
    
    records.push(record);
  }
  
  return records;
};

/**
 * Download cache as JSON file
 */
portalIntelCache.downloadCache = function() {
  var data = portalIntelCache.exportForSync();
  var json = JSON.stringify(data, null, 2);
  var blob = new Blob([json], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  var filename = 'portal_intel_' + timestamp + '.json';
  
  var link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  alert('Exported ' + data.length + ' portal records to ' + filename);
  console.log('[Intel Cache] Exported ' + data.length + ' records');
};

/**
 * Download cache as CSV for Excel
 */
portalIntelCache.downloadCacheCSV = function() {
  var records = portalIntelCache.exportForSync();
  
  // CSV header
  var csv = [
    'PortalGUID,PortalName,Team,Level,Health,Owner,Latitude,Longitude,' +
    'ResonatorCount,LinkCount,IncomingLinks,OutgoingLinks,FieldCount,' +
    'FirstSeen,LastUpdated,UpdateCount'
  ];
  
  // CSV rows
  records.forEach(function(r) {
    csv.push([
      r.PortalGUID,
      '"' + (r.PortalName || '').replace(/"/g, '""') + '"',
      r.Team,
      r.Level,
      r.Health,
      r.OwnerName || '',
      r.Latitude,
      r.Longitude,
      r.ResonatorCount,
      r.LinkCount,
      r.IncomingLinks,
      r.OutgoingLinks,
      r.FieldCount,
      r.FirstSeen,
      r.LastUpdated,
      r.UpdateCount
    ].join(','));
  });
  
  var csvContent = csv.join('\n');
  var blob = new Blob([csvContent], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  
  var timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  var filename = 'portal_intel_' + timestamp + '.csv';
  
  var link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  alert('Exported ' + records.length + ' portal records to ' + filename);
};

/**
 * Clear cache with confirmation
 */
portalIntelCache.clearCache = function() {
  var count = Object.keys(portalIntelCache.cache).length;
  
  if (confirm('Clear all ' + count + ' cached portals?\n\nThis cannot be undone! Consider exporting first.')) {
    portalIntelCache.cache = {};
    portalIntelCache.stats.totalCaptured = 0;
    portalIntelCache.stats.pendingSync = 0;
    portalIntelCache.stats.sessionCaptures = 0;
    portalIntelCache.saveCache();
    portalIntelCache.updateStatusDisplay();
    
    alert('Cache cleared!');
    console.log('[Intel Cache] Cache cleared');
  }
};

/**
 * Cleanup old entries if quota exceeded
 */
portalIntelCache.cleanupOldEntries = function() {
  var entries = Object.keys(portalIntelCache.cache).map(function(guid) {
    return {
      guid: guid,
      lastUpdated: portalIntelCache.cache[guid].lastUpdated
    };
  });
  
  // Sort by date, oldest first
  entries.sort(function(a, b) {
    return new Date(a.lastUpdated) - new Date(b.lastUpdated);
  });
  
  // Remove oldest 20%
  var toRemove = Math.floor(entries.length * 0.2);
  for (var i = 0; i < toRemove; i++) {
    delete portalIntelCache.cache[entries[i].guid];
  }
  
  console.log('[Intel Cache] Cleaned up ' + toRemove + ' old entries');
  portalIntelCache.saveCache();
};

/**
 * Update status display in UI
 */
portalIntelCache.updateStatusDisplay = function() {
  var $status = $('#intel-cache-status');
  if ($status.length === 0) return;
  
  $status.html(
    '<strong>📊 Intel Cache:</strong> ' +
    portalIntelCache.stats.totalCaptured + ' total | ' +
    '<span style="color: #0f0;">' + portalIntelCache.stats.sessionCaptures + ' this session</span> | ' +
    '<span style="color: #ff0;">' + portalIntelCache.stats.pendingSync + ' pending sync</span>'
  );
};

/**
 * Setup UI controls
 */
portalIntelCache.setupUI = function() {
  console.log('[Intel Cache] Setting up UI...');
  
  // Status bar at bottom
  var $status = $('<div>')
    .attr('id', 'intel-cache-status')
    .css({
      'position': 'fixed',
      'bottom': '0',
      'left': '0',
      'background': 'rgba(0, 0, 0, 0.9)',
      'color': '#0f0',
      'padding': '8px 15px',
      'font-family': 'Courier New, monospace',
      'font-size': '11px',
      'z-index': 9999,
      'border-top': '2px solid #0f0',
      'border-right': '2px solid #0f0',
      'box-shadow': '0 0 10px rgba(0, 255, 0, 0.5)',
      'cursor': 'pointer'
    })
    .click(portalIntelCache.showStats);
  
  $('body').append($status);
  console.log('[Intel Cache] Status bar added to page');
  
  // Check if IITC.toolbox exists and has addButton method
  console.log('[Intel Cache] Checking for IITC.toolbox...');
  console.log('[Intel Cache] typeof IITC:', typeof IITC);
  console.log('[Intel Cache] typeof IITC.toolbox:', typeof IITC !== 'undefined' ? typeof IITC.toolbox : 'IITC undefined');
  console.log('[Intel Cache] IITC.toolbox.addButton:', typeof IITC !== 'undefined' && IITC.toolbox ? typeof IITC.toolbox.addButton : 'not available');
  
  if (typeof IITC !== 'undefined' && IITC.toolbox && typeof IITC.toolbox.addButton === 'function') {
    console.log('[Intel Cache] ✅ IITC.toolbox.addButton available, adding buttons...');
    
    try {
      IITC.toolbox.addButton({
        label: 'Export Intel (JSON)',
        title: 'Download cached portal intelligence as JSON for Azure SQL sync',
        action: portalIntelCache.downloadCache
      });
      console.log('[Intel Cache] Added Export Intel (JSON) button');
      
      IITC.toolbox.addButton({
        label: 'Export Intel (CSV)',
        title: 'Download cached portal intelligence as CSV for Excel',
        action: portalIntelCache.downloadCacheCSV
      });
      console.log('[Intel Cache] Added Export Intel (CSV) button');
      
      IITC.toolbox.addButton({
        label: 'Intel Stats',
        title: 'View cache statistics',
        action: portalIntelCache.showStats
      });
      console.log('[Intel Cache] Added Intel Stats button');
      
      IITC.toolbox.addButton({
        label: 'Clear Intel Cache',
        title: 'Clear all cached portal data',
        action: portalIntelCache.clearCache
      });
      console.log('[Intel Cache] Added Clear Intel Cache button');
      
      console.log('[Intel Cache] ✅ All toolbox buttons added successfully');
    } catch (e) {
      console.error('[Intel Cache] ❌ Error adding toolbox buttons:', e);
      console.error('[Intel Cache] Error stack:', e.stack);
    }
  } else {
    console.warn('[Intel Cache] ⚠️ IITC.toolbox.addButton not available - buttons not added');
    console.log('[Intel Cache] Will rely on status bar for access to features');
  }
  
  portalIntelCache.updateStatusDisplay();
  console.log('[Intel Cache] ✅ UI setup complete');
};

/**
 * Show statistics dialog
 */
portalIntelCache.showStats = function() {
  var cacheSize = JSON.stringify(portalIntelCache.cache).length;
  var cacheSizeKB = (cacheSize / 1024).toFixed(2);
  var cacheSizeMB = (cacheSize / 1024 / 1024).toFixed(2);
  
  // Calculate team breakdown
  var teamStats = { RESISTANCE: 0, ENLIGHTENED: 0, MACHINA: 0, NEUTRAL: 0 };
  var levelStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  
  for (var guid in portalIntelCache.cache) {
    var intel = portalIntelCache.cache[guid];
    teamStats[intel.team]++;
    levelStats[intel.level]++;
  }
  
  var html = $('<div>').css({ 'font-family': 'monospace', 'font-size': '12px' });
  
  html.append($('<h3>').text('📊 Portal Intelligence Cache Statistics'));
  
  html.append($('<h4>').text('Cache Status'));
  html.append($('<div>').html(
    '<strong>Total Portals:</strong> ' + portalIntelCache.stats.totalCaptured + '<br>' +
    '<strong>This Session:</strong> ' + portalIntelCache.stats.sessionCaptures + '<br>' +
    '<strong>Pending Sync:</strong> ' + portalIntelCache.stats.pendingSync + '<br>' +
    '<strong>Cache Size:</strong> ' + cacheSizeKB + ' KB (' + cacheSizeMB + ' MB)<br>' +
    '<strong>Last Update:</strong> ' + (portalIntelCache.stats.lastUpdate || 'Never')
  ));
  
  html.append($('<h4>').text('Team Breakdown'));
  html.append($('<div>').html(
    '<span style="color: #0088ff;">■</span> <strong>Resistance:</strong> ' + teamStats.RESISTANCE + '<br>' +
    '<span style="color: #03dc03;">■</span> <strong>Enlightened:</strong> ' + teamStats.ENLIGHTENED + '<br>' +
    '<span style="color: #ff0028;">■</span> <strong>Machina:</strong> ' + teamStats.MACHINA + '<br>' +
    '<span style="color: #ccc;">■</span> <strong>Neutral:</strong> ' + teamStats.NEUTRAL
  ));
  
  html.append($('<h4>').text('Level Distribution'));
  var levelHTML = '';
  for (var i = 1; i <= 8; i++) {
    levelHTML += '<strong>L' + i + ':</strong> ' + levelStats[i] + ' | ';
  }
  html.append($('<div>').html(levelHTML));
  
  html.append($('<h4>').text('Storage'));
  html.append($('<div>').html(
    '<strong>Method:</strong> localStorage<br>' +
    '<strong>Auto-Save:</strong> ' + (portalIntelCache.config.autoSave ? 'Enabled' : 'Disabled') + '<br>' +
    '<strong>Debug Mode:</strong> ' + (portalIntelCache.config.debugMode ? 'Enabled' : 'Disabled')
  ));
  
  window.dialog({
    html: html,
    title: 'Portal Intel Cache Stats',
    width: 450
  });
};

/**
 * Setup function - called by IITC
 */
var setup = function() {
  console.log('[Intel Cache] ========== SETUP FUNCTION CALLED ==========');
  console.log('[Intel Cache] Setup called at:', new Date().toISOString());
  console.log('[Intel Cache] window object available:', typeof window !== 'undefined');
  console.log('[Intel Cache] $ (jQuery) available:', typeof $ !== 'undefined');
  console.log('[Intel Cache] window.addHook available:', typeof window.addHook !== 'undefined');
  console.log('[Intel Cache] window.addHook type:', typeof window.addHook);
  
  // Debug: List all hook-related properties
  if (typeof window !== 'undefined') {
    var hookProps = Object.keys(window).filter(k => k.toLowerCase().includes('hook'));
    console.log('[Intel Cache] Hook-related properties on window:', hookProps);
  }
  
  // Load existing cache
  console.log('[Intel Cache] Loading cache from localStorage...');
  portalIntelCache.loadCache();
  console.log('[Intel Cache] ✅ Cache loaded, total portals:', Object.keys(portalIntelCache.cache).length);
  
  // Hook into portal details
  console.log('[Intel Cache] ========== REGISTERING HOOKS ==========');
  console.log('[Intel Cache] Attempting to register portalDetailsUpdated hook...');
  
  if (typeof window.addHook === 'function') {
    try {
      window.addHook('portalDetailsUpdated', portalIntelCache.onPortalDetailsUpdated);
      console.log('[Intel Cache] ✅ Hook registered successfully for portalDetailsUpdated');
      
      window.addHook('portalSelected', portalIntelCache.onPortalSelected);
      console.log('[Intel Cache] ✅ Hook registered successfully for portalSelected');
    } catch (e) {
      console.error('[Intel Cache] ❌ Error registering hooks:', e);
    }
  } else {
    console.error('[Intel Cache] ❌ window.addHook is not available. Hook registration failed.');
  }
  
  // Setup UI
  console.log('[Intel Cache] Setting up UI...');
  portalIntelCache.setupUI();
  
  // Periodic auto-save every 30 seconds
  console.log('[Intel Cache] Setting up auto-save interval (30s)...');
  setInterval(function() {
    if (portalIntelCache.config.autoSave) {
      portalIntelCache.saveCache();
    }
  }, 30000);
  console.log('[Intel Cache] ✅ Auto-save interval configured');
  
  // Make globally accessible for automation
  window.portalIntelCache = portalIntelCache;
  console.log('[Intel Cache] ✅ Exposed as window.portalIntelCache');
  
  console.log('[Intel Cache] ========== PLUGIN INITIALIZED SUCCESSFULLY ==========');
  console.log('[Intel Cache] Plugin version: 0.1.3');
  console.log('[Intel Cache] Current cache size:', Object.keys(portalIntelCache.cache).length, 'portals');
  console.log('[Intel Cache] Debug mode:', portalIntelCache.config.debugMode);
  console.log('[Intel Cache] ========== NOW WAITING FOR PORTAL SELECTION ==========');
  console.log('[Intel Cache] Select a portal to test the hook...');
};
