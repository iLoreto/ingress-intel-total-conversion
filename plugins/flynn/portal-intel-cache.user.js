// ==UserScript==
// @author         YourName
// @name           Portal Intelligence Cache
// @category       Info
// @version        0.3.0
// @description    Captures portal details to browser localStorage for later Azure SQL sync with sequential scan
// @id             portal-intel-cache
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

console.log('[Intel Cache] Updated to version 0.3.0')

/* exported setup --eslint */
/* global IITC -- eslint */

console.log('[Intel Cache] ========== PLUGIN LOADING START ==========');
console.log('[Intel Cache] Timestamp:', new Date().toISOString());

var changelog = [
  {
    version: '0.3.0',
    changes: [
      'Added checkbox to toggle between View and Synch Cache scanning', 
      'View mode (default): Only scans VISIBLE portals on map (respects filters, ~78 portals)',
      'Synch Cache mode: Scans ALL portals in persistent localStorage cache by panning to each location',
      'Cache mode automatically pans map to each portal and loads tiles (1.5s delay per portal)',
      'Fixed: View mode now properly filters to visible portals, not all loaded tiles',
      'Status display shows which source is being used (View/Cache) and progress'
    ]
  },
  {
    version: '0.2.0',
    changes: ['Added sequential portal scanning with Start/Pause/Stop controls in status bar', 'Integrated with superdata.js loaded portals', '1-second throttle between portal detail loads', 'Progress tracking display']
  },
  {
    version: '0.1.9',
    changes: ['Version bump for compatibility with Azure Sync 0.1.9']
  },
  {
    version: '0.1.8',
    changes: ['Fixed setup function to initialize directly when called by IITC']
  },
  {
    version: '0.1.7',
    changes: ['Added debug logs to IITC loading detection']
  },
  {
    version: '0.1.6',
    changes: ['Improved IITC loading detection with polling mechanism']
  },
  {
    version: '0.1.5',
    changes: ['Fixed setup timing by hooking to iitcLoaded event']
  },
  {
    version: '0.1.4',
    changes: ['Version bump to force script reload', 'Fixed window.plugin initialization']
  },
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
window.plugin = window.plugin || {};
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

// Sequential processing state
portalIntelCache.sequential = {
  loadedPortals: [],  // All portals currently in view (from window.portals)
  isProcessing: false,
  isPaused: false,
  currentIndex: 0,
  processedCount: 0,
  totalToProcess: 0,
  lastProcessTime: 0,
  processingTimeout: null,
  useCache: false  // New: toggle between View and Cache
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

  // Save cache only if autoSave is enabled
  if (portalIntelCache.config.autoSave) {
    clearTimeout(portalIntelCache._saveTimeout);
    portalIntelCache._saveTimeout = setTimeout(() => {
      portalIntelCache.saveCache();
    }, 1000); // Debounce saves to avoid excessive writes
  }

  // Update UI
  portalIntelCache.updateStatusDisplay();

  if (portalIntelCache.config.debugMode) {
    var action = isNew ? 'NEW' : 'UPDATE';
    console.log('[Intel Cache] ' + action + ':', intel.title, '(' + guid + ')');
  }
};

// Prevent duplicate sync updates by tracking processed GUIDs
portalIntelCache.processedGuids = new Set();

portalIntelCache.onPortalDetailsUpdated = function (data) {
  console.log('[Intel Cache] Hook triggered: portalDetailsUpdated');
  console.log('[Intel Cache] Data received:', data);

  if (!data || !data.portalDetails) {
    console.error('[Intel Cache] No portal details found in the data.');
    return;
  }

  if (portalIntelCache.processedGuids.has(data.guid)) {
    console.log('[Intel Cache] Duplicate update ignored for GUID:', data.guid);
    return;
  }

  console.log('[Intel Cache] Processing portal details for GUID:', data.guid);
  try {
    var intel = portalIntelCache.extractIntel(data);
    portalIntelCache.storeIntel(intel);
    portalIntelCache.processedGuids.add(data.guid);
    console.log('[Intel Cache] Portal details processed and stored successfully for GUID:', data.guid);
  } catch (e) {
    console.error('[Intel Cache] Error processing portal details:', e);
  }
};

portalIntelCache.onPortalSelected = function (data) {
  console.log('[Intel Cache] Hook triggered: portalSelected');
  console.log('[Intel Cache] Selected portal GUID:', data.selectedPortalGuid);
  console.log('[Intel Cache] Unselected portal GUID:', data.unselectedPortalGuid);
  console.log('[Intel Cache] Event:', data.event);

  if (data.selectedPortalGuid) {
    if (portalIntelCache.processedGuids.has(data.selectedPortalGuid)) {
      console.log('[Intel Cache] Duplicate selection ignored for GUID:', data.selectedPortalGuid);
      return;
    }

    var portal = window.portals[data.selectedPortalGuid];
    if (portal) {
      console.log('[Intel Cache] Portal object found for GUID:', data.selectedPortalGuid);
      if (portal.hasFullDetails()) {
        var details = portal.getDetails();
        console.log('[Intel Cache] Full portal details available:', details);
        try {
          var intel = portalIntelCache.extractIntel({ guid: data.selectedPortalGuid, portalDetails: details });
          portalIntelCache.storeIntel(intel);
          portalIntelCache.processedGuids.add(data.selectedPortalGuid);
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
 * Capture all currently loaded portals from the map view
 */
portalIntelCache.updateLoadedPortals = function() {
  if (portalIntelCache.sequential.useCache) {
    // Use synch cache portals (those stored for Azure sync)
    portalIntelCache.sequential.loadedPortals = Object.keys(portalIntelCache.cache);
    console.log('[Intel Cache] Updated from synch cache:', portalIntelCache.sequential.loadedPortals.length);
  } else {
    // Use only VISIBLE portals in current view (respects filters and map bounds)
    var visiblePortals = [];
    var displayBounds = window.map.getBounds();
    
    // Iterate through window.portals and filter for visible ones
    for (var guid in window.portals) {
      var portal = window.portals[guid];
      
      // Check if portal is actually on the map (visible)
      if (window.map.hasLayer(portal)) {
        // Double-check it's within display bounds
        if (displayBounds.contains(portal.getLatLng())) {
          // Check if portal has title (not a placeholder)
          if (portal.options && portal.options.data && portal.options.data.title) {
            visiblePortals.push(guid);
          }
        }
      }
    }
    
    portalIntelCache.sequential.loadedPortals = visiblePortals;
    console.log('[Intel Cache] Updated from visible portals in view:', portalIntelCache.sequential.loadedPortals.length, '(out of', Object.keys(window.portals || {}).length, 'loaded)');
  }
};

/**
 * Start sequential portal detail extraction
 */
portalIntelCache.startSequentialProcessing = function() {
  if (portalIntelCache.sequential.isProcessing && !portalIntelCache.sequential.isPaused) {
    console.log('[Intel Cache] Already processing');
    return;
  }

  // If paused, resume from current index
  if (portalIntelCache.sequential.isPaused) {
    portalIntelCache.sequential.isPaused = false;
    console.log('[Intel Cache] Resuming from index:', portalIntelCache.sequential.currentIndex);
    portalIntelCache.updateStatusDisplay();
    portalIntelCache.processNextPortal();
    return;
  }

  // Fresh start
  portalIntelCache.updateLoadedPortals();
  portalIntelCache.sequential.isProcessing = true;
  portalIntelCache.sequential.isPaused = false;
  portalIntelCache.sequential.currentIndex = 0;
  portalIntelCache.sequential.processedCount = 0;
  portalIntelCache.sequential.totalToProcess = portalIntelCache.sequential.loadedPortals.length;

  console.log('[Intel Cache] Starting sequential processing of', portalIntelCache.sequential.totalToProcess, 'portals from', portalIntelCache.sequential.useCache ? 'cache' : 'view');
  portalIntelCache.updateStatusDisplay();
  portalIntelCache.processNextPortal();
};

/**
 * Pause sequential processing (remember position)
 */
portalIntelCache.pauseSequentialProcessing = function() {
  if (!portalIntelCache.sequential.isProcessing) {
    console.log('[Intel Cache] Not currently processing');
    return;
  }

  portalIntelCache.sequential.isPaused = true;
  if (portalIntelCache.sequential.processingTimeout) {
    clearTimeout(portalIntelCache.sequential.processingTimeout);
    portalIntelCache.sequential.processingTimeout = null;
  }
  console.log('[Intel Cache] Paused at index:', portalIntelCache.sequential.currentIndex);
  portalIntelCache.updateStatusDisplay();
};

/**
 * Stop sequential processing (reset position)
 */
portalIntelCache.stopSequentialProcessing = function() {
  portalIntelCache.sequential.isProcessing = false;
  portalIntelCache.sequential.isPaused = false;
  portalIntelCache.sequential.currentIndex = 0;
  portalIntelCache.sequential.processedCount = 0;

  if (portalIntelCache.sequential.processingTimeout) {
    clearTimeout(portalIntelCache.sequential.processingTimeout);
    portalIntelCache.sequential.processingTimeout = null;
  }

  console.log('[Intel Cache] Stopped sequential processing');
  portalIntelCache.updateStatusDisplay();
};

/**
 * Process next portal in sequence
 */
portalIntelCache.processNextPortal = function() {
  if (!portalIntelCache.sequential.isProcessing || portalIntelCache.sequential.isPaused) {
    return;
  }

  // Check if we've reached the end
  if (portalIntelCache.sequential.currentIndex >= portalIntelCache.sequential.loadedPortals.length) {
    console.log('[Intel Cache] Sequential processing complete!');
    portalIntelCache.sequential.isProcessing = false;
    portalIntelCache.updateStatusDisplay();
    return;
  }

  var guid = portalIntelCache.sequential.loadedPortals[portalIntelCache.sequential.currentIndex];
  
  if (portalIntelCache.sequential.useCache) {
    // When using synch cache, we process ALL cached portals
    // We need to pan to each portal's location and load its details
    var cachedPortal = portalIntelCache.cache[guid];
    
    if (cachedPortal) {
      // Pan map to portal location (this will load tiles if needed)
      var lat = cachedPortal.lat;
      var lng = cachedPortal.lng;
      
      // Set map view to portal location
      window.map.setView([lat, lng], window.map.getZoom());
      
      console.log('[Intel Cache] Processing cached portal', portalIntelCache.sequential.currentIndex + 1, 'of', portalIntelCache.sequential.totalToProcess, ':', cachedPortal.title, '(' + guid + ')');
      
      // Wait for tiles to load, then trigger portal details
      setTimeout(function() {
        // Check if portal is now loaded
        if (window.portals[guid]) {
          window.renderPortalDetails(guid);
          console.log('[Intel Cache] Loaded details for cached portal:', cachedPortal.title);
        } else {
          console.warn('[Intel Cache] Portal not loaded after panning, may need more time:', cachedPortal.title);
          // Still try to render in case it loads
          window.renderPortalDetails(guid);
        }
      }, 500); // Give 500ms for tiles to load before requesting details
      
    } else {
      console.error('[Intel Cache] Cached portal data missing for GUID:', guid);
    }
  } else {
    // Using visible view portals - these should all be accessible
    if (window.portals[guid] && window.map.hasLayer(window.portals[guid])) {
      // Select the portal to trigger detail loading
      window.renderPortalDetails(guid);
      console.log('[Intel Cache] Processing visible portal', portalIntelCache.sequential.currentIndex + 1, 'of', portalIntelCache.sequential.totalToProcess, ':', guid);
    } else {
      console.warn('[Intel Cache] Visible portal no longer on map, skipping:', guid);
    }
  }

  // Move to next portal after delay
  portalIntelCache.sequential.currentIndex++;
  portalIntelCache.sequential.processedCount++;
  portalIntelCache.updateStatusDisplay();

  // When using cache, need longer delay to account for map panning and tile loading
  var delay = portalIntelCache.sequential.useCache ? 1500 : 1000;
  
  portalIntelCache.sequential.processingTimeout = setTimeout(function() {
    portalIntelCache.processNextPortal();
  }, delay);
};

/**
 * Toggle between View and Cache scanning
 */
portalIntelCache.toggleScanSource = function() {
  portalIntelCache.sequential.useCache = !portalIntelCache.sequential.useCache;
  console.log('[Intel Cache] Scan source toggled to:', portalIntelCache.sequential.useCache ? 'Cache' : 'View');
  portalIntelCache.updateStatusDisplay();
  
  // Update checkbox state
  var $checkbox = $('#intel-cache-use-cache');
  if ($checkbox.length > 0) {
    $checkbox.prop('checked', portalIntelCache.sequential.useCache);
  }
};

/**
 * Update status display in UI
 */
portalIntelCache.updateStatusDisplay = function() {
  var $status = $('#intel-cache-status');
  if ($status.length === 0) return;
  
  var statsHtml = '<strong>📊 Intel Cache:</strong> ' +
    portalIntelCache.stats.totalCaptured + ' cached | ' +
    '<span style="color: #0f0;">' + portalIntelCache.stats.sessionCaptures + ' session</span> | ' +
    '<span style="color: #ff0;">' + portalIntelCache.stats.pendingSync + ' pending</span>';

  // Add sequential processing status
  if (portalIntelCache.sequential.isProcessing || portalIntelCache.sequential.currentIndex > 0) {
    var progress = portalIntelCache.sequential.processedCount + ' / ' + portalIntelCache.sequential.totalToProcess;
    var statusIndicator = portalIntelCache.sequential.isProcessing && !portalIntelCache.sequential.isPaused ? '⏳' : '⏸';
    var source = portalIntelCache.sequential.useCache ? 'Cache' : 'View';
    statsHtml += ' | <span style="color: #ff6;">' + statusIndicator + ' ' + progress + ' (' + source + ')</span>';
  }

  $status.html(statsHtml);
};

/**
 * Setup UI controls
 */
portalIntelCache.setupUI = function() {
  console.log('[Intel Cache] Setting up UI...');
  
  // Create button styles
  var buttonStyle = {
    'margin': '0 3px',
    'padding': '2px 6px',
    'border': '1px solid #0f0',
    'background': 'rgba(0, 0, 0, 0.7)',
    'color': '#0f0',
    'cursor': 'pointer',
    'font-family': 'Courier New, monospace',
    'font-size': '10px',
    'font-weight': 'bold',
    'vertical-align': 'middle'
  };

  var checkboxLabelStyle = {
    'margin': '0 3px',
    'padding': '2px 6px',
    'color': '#0f0',
    'cursor': 'pointer',
    'font-family': 'Courier New, monospace',
    'font-size': '10px',
    'font-weight': 'bold',
    'vertical-align': 'middle'
  };

  // Status bar container
  var $statusContainer = $('<div>')
    .attr('id', 'intel-cache-container')
    .css({
      'position': 'fixed',
      'bottom': '0',
      'left': '0',
      'background': 'rgba(0, 0, 0, 0.9)',
      'color': '#0f0',
      'padding': '8px 15px',
      'font-family': 'Courier New, monospace',
      'font-size': '11px',
      'z-index': '9999',
      'border-top': '2px solid #0f0',
      'border-right': '2px solid #0f0',
      'box-shadow': '0 0 10px rgba(0, 255, 0, 0.5)',
      'min-height': '20px'
    });

  // Status text
  var $status = $('<div>')
    .attr('id', 'intel-cache-status')
    .css({
      'display': 'inline-block',
      'cursor': 'pointer',
      'margin-right': '10px'
    })
    .click(portalIntelCache.showStats);

  // Controls
  var $controls = $('<div>')
    .attr('id', 'intel-cache-controls')
    .css({
      'display': 'inline-block'
    });

  // Start button
  var $btnStart = $('<button>')
    .text('▶ Start')
    .css(buttonStyle)
    .click(function(e) {
      e.stopPropagation();
      portalIntelCache.startSequentialProcessing();
    });

  // Pause button
  var $btnPause = $('<button>')
    .text('⏸ Pause')
    .css(buttonStyle)
    .click(function(e) {
      e.stopPropagation();
      portalIntelCache.pauseSequentialProcessing();
    });

  // Stop button
  var $btnStop = $('<button>')
    .text('⏹ Stop')
    .css(buttonStyle)
    .click(function(e) {
      e.stopPropagation();
      portalIntelCache.stopSequentialProcessing();
    });

  // Checkbox for Cache/View toggle
  var $checkboxLabel = $('<label>')
    .css(checkboxLabelStyle)
    .text(' Use Cache');

  var $checkbox = $('<input>')
    .attr({
      'type': 'checkbox',
      'id': 'intel-cache-use-cache'
    })
    .prop('checked', portalIntelCache.sequential.useCache)
    .css({
      'margin-right': '3px',
      'vertical-align': 'middle',
      'cursor': 'pointer'
    })
    .change(function(e) {
      e.stopPropagation();
      portalIntelCache.toggleScanSource();
    });

  $checkboxLabel.prepend($checkbox);
  $controls.append($btnStart).append($btnPause).append($btnStop).append($checkboxLabel);
  $statusContainer.append($status).append($controls);
  $('body').append($statusContainer);
  
  console.log('[Intel Cache] Status bar with controls added to page');
  
  // Check if IITC.toolbox exists and has addButton method
  console.log('[Intel Cache] Checking for IITC.toolbox...');
  
  if (typeof IITC !== 'undefined' && IITC.toolbox && typeof IITC.toolbox.addButton === 'function') {
    console.log('[Intel Cache] ✅ IITC.toolbox.addButton available, adding export buttons...');
    
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
      
      console.log('[Intel Cache] ✅ All export buttons added successfully');
    } catch (e) {
      console.error('[Intel Cache] ❌ Error adding toolbox buttons:', e);
    }
  } else {
    console.warn('[Intel Cache] ⚠️ IITC.toolbox.addButton not available');
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
  var teamStats = { RESISTANCE: 0, ENLIGHTENED: 0, MACHINA: 0, NEUTRAL: 0, UNKNOWN: 0 };
  var levelStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  var syncStats = { pending: 0, synced: 0, error: 0, unknown: 0 };

  var normalizeTeam = function(team) {
    // IITC can represent teams as strings or numeric constants depending on source
    if (team === undefined || team === null || team === '') return 'UNKNOWN';

    // string values
    if (typeof team === 'string') {
      var t = team.toUpperCase();
      if (t === 'R' || t === 'RESISTANCE') return 'RESISTANCE';
      if (t === 'E' || t === 'ENLIGHTENED') return 'ENLIGHTENED';
      if (t === 'M' || t === 'MACHINA') return 'MACHINA';
      if (t === 'N' || t === 'NEUTRAL') return 'NEUTRAL';
      return 'UNKNOWN';
    }

    // numeric values (common mapping in IITC: 0 neutral, 1 resistance, 2 enlightened; machina varies)
    if (typeof team === 'number') {
      if (team === 0) return 'NEUTRAL';
      if (team === 1) return 'RESISTANCE';
      if (team === 2) return 'ENLIGHTENED';
      // Some builds use 3 for Machina
      if (team === 3) return 'MACHINA';
      return 'UNKNOWN';
    }

    // object/other
    return 'UNKNOWN';
  };

  for (var guid in portalIntelCache.cache) {
    var intel = portalIntelCache.cache[guid];

    // team
    var teamKey = normalizeTeam(intel.team);
    if (teamStats[teamKey] === undefined) teamStats.UNKNOWN++;
    else teamStats[teamKey]++;

    // level
    var lvl = parseInt(intel.level, 10);
    if (levelStats[lvl] !== undefined) levelStats[lvl]++;

    // sync
    var st = (intel.syncStatus || intel.SyncStatus || 'pending').toLowerCase();
    if (st === 'pending') syncStats.pending++;
    else if (st === 'synced') syncStats.synced++;
    else if (st === 'error') syncStats.error++;
    else syncStats.unknown++;
  }

  // Keep the status bar "pending sync" accurate
  portalIntelCache.stats.pendingSync = syncStats.pending;

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
    '<span style="color: #ccc;">■</span> <strong>Neutral:</strong> ' + teamStats.NEUTRAL + '<br>' +
    '<span style="color: #999;">■</span> <strong>Unknown:</strong> ' + teamStats.UNKNOWN
  ));
  
  html.append($('<h4>').text('Level Distribution'));
  var levelHTML = '';
  for (var i = 1; i <= 8; i++) {
    levelHTML += '<strong>L' + i + ':</strong> ' + levelStats[i] + ' | ';
  }
  html.append($('<div>').html(levelHTML));
  
  html.append($('<h4>').text('Sync Status'));
  html.append($('<div>').html(
    '<span style="color: #ff0;">⏳</span> <strong>Pending:</strong> ' + syncStats.pending + '<br>' +
    '<span style="color: #0f0;">✅</span> <strong>Synced:</strong> ' + syncStats.synced + '<br>' +
    '<span style="color: #f00;">❌</span> <strong>Error:</strong> ' + syncStats.error + (syncStats.unknown ? ('<br><span style="color:#999;">■</span> <strong>Unknown:</strong> ' + syncStats.unknown) : '')
  ));

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
  console.log('[Intel Cache] Plugin version: 0.3.0');
  console.log('[Intel Cache] Current cache size:', Object.keys(portalIntelCache.cache).length, 'portals');
  console.log('[Intel Cache] Debug mode:', portalIntelCache.config.debugMode);
  console.log('[Intel Cache] ========== NOW WAITING FOR PORTAL SELECTION ==========');
  console.log('[Intel Cache] Select a portal to test the hook...');
};

// Register plugin with IITC boot sequence so wrapper or IITC will call setup
window.bootPlugins = window.bootPlugins || [];
window.bootPlugins.push(setup);
// If IITC already loaded, run setup now
if (window.iitcLoaded) setup();

/**
 * Import cache from JSON file
 */
portalIntelCache.importCache = function() {
  // Create file input element
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'application/json,.json';
  
  fileInput.onchange = function(e) {
    var file = e.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(event) {
      try {
        var importedData = JSON.parse(event.target.result);
        
        // Validate imported data
        if (!Array.isArray(importedData)) {
          alert('Invalid file format. Expected JSON array of portal records.');
          return;
        }
        
        // Show import options dialog
        portalIntelCache.showImportDialog(importedData, file.name);
        
      } catch (e) {
        console.error('[Intel Cache] Import error:', e);
        alert('Error reading file: ' + e.message);
      }
    };
    
    reader.readAsText(file);
  };
  
  // Trigger file selection
  fileInput.click();
};

/**
 * Show import dialog with options
 */
portalIntelCache.showImportDialog = function(importedData, filename) {
  var importCount = importedData.length;
  var currentCount = Object.keys(portalIntelCache.cache).length;
  
  var html = $('<div>').css({ 'font-family': 'monospace', 'font-size': '12px' });
  
  html.append($('<h3>').text('📥 Import Portal Cache'));
  
  html.append($('<div>').html(
    '<strong>File:</strong> ' + filename + '<br>' +
    '<strong>Portals in file:</strong> ' + importCount + '<br>' +
    '<strong>Current cache size:</strong> ' + currentCount + '<br><br>' +
    'Choose import mode:'
  ));
  
  var $importModeSelect = $('<select>')
    .css({
      'width': '100%',
      'padding': '5px',
      'margin': '10px 0',
      'background': '#1b415e',
      'color': '#fff',
      'border': '1px solid #0f0',
      'font-family': 'monospace'
    })
    .append($('<option>').val('merge').text('Merge - Add new portals, update existing'))
    .append($('<option>').val('replace').text('Replace - Clear cache and import'))
    .append($('<option>').val('add-only').text('Add Only - Skip existing portals'));
  
  html.append($('<div>').text('Import Mode:'));
  html.append($importModeSelect);
  
  // Add filter options
  html.append($('<div>').css('margin-top', '15px').html('<strong>Optional Filters:</strong>'));
  
  var $filterContainer = $('<div>').css('margin', '10px 0');
  
  // Team filter
  var $teamFilter = $('<select>')
    .css({
      'width': '100%',
      'padding': '5px',
      'margin': '5px 0',
      'background': '#1b415e',
      'color': '#fff',
      'border': '1px solid #0f0',
      'font-family': 'monospace'
    })
    .append($('<option>').val('all').text('All Teams'))
    .append($('<option>').val('RESISTANCE').text('Resistance Only'))
    .append($('<option>').val('ENLIGHTENED').text('Enlightened Only'))
    .append($('<option>').val('NEUTRAL').text('Neutral Only'))
    .append($('<option>').val('MACHINA').text('Machina Only'));
  
  $filterContainer.append($('<div>').text('Team Filter:'));
  $filterContainer.append($teamFilter);
  
  // Level filter
  var $levelFilterMin = $('<input>')
    .attr('type', 'number')
    .attr('min', '1')
    .attr('max', '8')
    .attr('placeholder', 'Min Level (1-8)')
    .css({
      'width': '48%',
      'padding': '5px',
      'margin': '5px 1% 5px 0',
      'background': '#1b415e',
      'color': '#fff',
      'border': '1px solid #0f0',
      'font-family': 'monospace'
    });
  
  var $levelFilterMax = $('<input>')
    .attr('type', 'number')
    .attr('min', '1')
    .attr('max', '8')
    .attr('placeholder', 'Max Level (1-8)')
    .css({
      'width': '48%',
      'padding': '5px',
      'margin': '5px 0 5px 1%',
      'background': '#1b415e',
      'color': '#fff',
      'border': '1px solid #0f0',
      'font-family': 'monospace'
    });
  
  $filterContainer.append($('<div>').text('Level Range:'));
  $filterContainer.append($levelFilterMin);
  $filterContainer.append($levelFilterMax);
  
  html.append($filterContainer);
  
  // Buttons
  var $buttonContainer = $('<div>').css('margin-top', '15px');
  
  var $importBtn = $('<button>')
    .text('Import')
    .css({
      'padding': '8px 15px',
      'margin-right': '10px',
      'background': '#0f0',
      'color': '#000',
      'border': 'none',
      'cursor': 'pointer',
      'font-weight': 'bold'
    })
    .click(function() {
      var mode = $importModeSelect.val();
      var teamFilter = $teamFilter.val();
      var minLevel = parseInt($levelFilterMin.val()) || 1;
      var maxLevel = parseInt($levelFilterMax.val()) || 8;
      
      portalIntelCache.executeImport(importedData, mode, {
        team: teamFilter,
        minLevel: minLevel,
        maxLevel: maxLevel
      });
      
      // Close dialog
      $('.ui-dialog-content:visible').dialog('close');
    });
  
  var $cancelBtn = $('<button>')
    .text('Cancel')
    .css({
      'padding': '8px 15px',
      'background': '#666',
      'color': '#fff',
      'border': 'none',
      'cursor': 'pointer'
    })
    .click(function() {
      $('.ui-dialog-content:visible').dialog('close');
    });
  
  $buttonContainer.append($importBtn).append($cancelBtn);
  html.append($buttonContainer);
  
  window.dialog({
    html: html,
    title: 'Import Portal Cache',
    width: 500
  });
};

/**
 * Execute cache import with filters
 */
portalIntelCache.executeImport = function(importedData, mode, filters) {
  console.log('[Intel Cache] Starting import...', { mode: mode, filters: filters, count: importedData.length });
  
  var stats = {
    total: importedData.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    filtered: 0
  };
  
  // Handle replace mode - clear cache first
  if (mode === 'replace') {
    if (confirm('This will DELETE all ' + Object.keys(portalIntelCache.cache).length + ' cached portals.\n\nAre you sure?')) {
      portalIntelCache.cache = {};
      console.log('[Intel Cache] Cache cleared for replace mode');
    } else {
      console.log('[Intel Cache] Import cancelled');
      return;
    }
  }
  
  // Convert imported records back to cache format
  importedData.forEach(function(record) {
    // Apply filters
    if (filters.team !== 'all' && record.Team !== filters.team) {
      stats.filtered++;
      return;
    }
    
    if (record.Level < filters.minLevel || record.Level > filters.maxLevel) {
      stats.filtered++;
      return;
    }
    
    // Convert from export format to cache format
    var intel = {
      guid: record.PortalGUID,
      latE6: record.LatE6,
      lngE6: record.LngE6,
      lat: record.Latitude,
      lng: record.Longitude,
      title: record.PortalName,
      image: record.ImageURL,
      team: record.Team,
      level: record.Level,
      health: record.Health,
      resCount: record.ResonatorCount,
      owner: record.OwnerName,
      linkCount: record.LinkCount,
      incomingLinks: record.IncomingLinks,
      outgoingLinks: record.OutgoingLinks,
      fieldCount: record.FieldCount,
      history: {
        visited: record.HistoryVisited,
        captured: record.HistoryCaptured,
        scoutControlled: record.HistoryScoutControlled
      },
      resonators: JSON.parse(record.ResonatorsJSON || '[]'),
      mods: JSON.parse(record.ModsJSON || '[]'),
      firstSeen: record.FirstSeen,
      lastUpdated: record.LastUpdated,
      updateCount: record.UpdateCount,
      syncStatus: record.SyncStatus || 'pending',
      lastSyncAttempt: record.LastSyncAttempt,
      syncError: record.SyncError
    };
    
    var guid = intel.guid;
    var exists = portalIntelCache.cache[guid];
    
    // Handle different import modes
    if (mode === 'add-only' && exists) {
      stats.skipped++;
      return;
    }
    
    if (exists) {
      // Preserve original firstSeen date
      intel.firstSeen = exists.firstSeen;
      intel.updateCount = (exists.updateCount || 1) + 1;
      stats.updated++;
    } else {
      stats.imported++;
    }
    
    portalIntelCache.cache[guid] = intel;
  });
  
  // Update stats
  portalIntelCache.stats.totalCaptured = Object.keys(portalIntelCache.cache).length;
  portalIntelCache.stats.pendingSync = portalIntelCache.stats.totalCaptured;
  
  // Save cache
  portalIntelCache.saveCache();
  portalIntelCache.updateStatusDisplay();
  
  // Show results
  var message = 'Import Complete!\n\n' +
    'Total in file: ' + stats.total + '\n' +
    'Imported (new): ' + stats.imported + '\n' +
    'Updated: ' + stats.updated + '\n' +
    'Skipped: ' + stats.skipped + '\n' +
    'Filtered out: ' + stats.filtered + '\n\n' +
    'Final cache size: ' + portalIntelCache.stats.totalCaptured;
  
  alert(message);
  console.log('[Intel Cache] Import complete:', stats);
};
