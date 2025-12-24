// ==UserScript==
// @author         YourName
// @name           Portal Intel Azure Sync
// @category       Info
// @version        0.1.8
// @description    Sync cached portal intelligence to Azure SQL Database
// @id             portal-intel-sync
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

console.log('[Azure Sync] Updated to version 0.1.8');
console.log('[Azure Sync] Plugin version: 0.1.8');

/* exported setup --eslint */
/* global IITC -- eslint */

console.log('[Azure Sync] ========== PLUGIN LOADING START ==========');
console.log('[Azure Sync] Timestamp:', new Date().toISOString());

var changelog = [
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
    version: '0.1.1',
    changes: ['Added comprehensive debugging', 'Fixed API endpoint handling', 'Improved error reporting']
  },
  {
    version: '0.1.0',
    changes: ['Initial release', 'Azure SQL sync functionality', 'Batch upload support']
  }
];

var portalIntelSync = {};
window.plugin = window.plugin || {};
window.plugin.portalIntelSync = portalIntelSync;

console.log('[Azure Sync] Namespace created: window.plugin.portalIntelSync');

// Azure Function / API configuration
portalIntelSync.config = {
  apiEndpoint: '', // Will be set by user
  apiKey: '', // Will be set by user
  batchSize: 100, // Send 100 portals per request
  retryAttempts: 3,
  retryDelay: 2000 // 2 seconds
};

/**
 * Configure Azure API endpoint
 */
portalIntelSync.configure = function() {
  var endpoint = prompt(
    'Enter Azure Function API endpoint URL:',
    portalIntelSync.config.apiEndpoint
  );
  
  if (endpoint) {
    portalIntelSync.config.apiEndpoint = endpoint;
    localStorage.setItem('azure_sync_endpoint', endpoint);
  }
  
  var apiKey = prompt(
    'Enter API Key (optional):',
    portalIntelSync.config.apiKey
  );
  
  if (apiKey !== null) {
    portalIntelSync.config.apiKey = apiKey;
    localStorage.setItem('azure_sync_apikey', apiKey);
  }
  
  alert('Configuration saved!');
};

/**
 * Load saved configuration
 */
portalIntelSync.loadConfig = function() {
  var endpoint = localStorage.getItem('azure_sync_endpoint');
  var apiKey = localStorage.getItem('azure_sync_apikey');
  
  if (endpoint) portalIntelSync.config.apiEndpoint = endpoint;
  if (apiKey) portalIntelSync.config.apiKey = apiKey;
};

/**
 * Sync all cached portals to Azure SQL
 */
portalIntelSync.syncAll = function() {
  console.log('[Azure Sync] Sync all triggered.');

  if (!window.plugin.portalIntelCache) {
    console.error('[Azure Sync] Portal Intel Cache plugin is not available. Sync aborted.');
    return;
  }

  console.log('[Azure Sync] Cache plugin found');
  console.log('[Azure Sync] Endpoint configured:', portalIntelSync.config.apiEndpoint || '(none)');
  
  if (!portalIntelSync.config.apiEndpoint) {
    console.warn('[Azure Sync] No endpoint configured, prompting user...');
    alert('Please configure Azure API endpoint first!');
    portalIntelSync.configure();
    return;
  }
  
  var records = window.plugin.portalIntelCache.exportForSync();
  console.log('[Azure Sync] Exported', records.length, 'portal records');
  
  if (records.length === 0) {
    console.warn('[Azure Sync] No portals to sync');
    alert('No portals to sync!');
    return;
  }
  
  console.log('[Azure Sync] First record sample:', records[0]);
  
  if (!confirm('Sync ' + records.length + ' portals to Azure SQL?\n\nEndpoint: ' + portalIntelSync.config.apiEndpoint)) {
    console.log('[Azure Sync] User cancelled sync');
    return;
  }
  
  console.log('[Azure Sync] User confirmed, starting sync...');
  portalIntelSync.syncRecords(records);
};

/**
 * Sync only pending records (not yet synced)
 */
portalIntelSync.syncPending = function() {
  if (!window.plugin.portalIntelCache) {
    alert('Portal Intelligence Cache plugin is required!');
    return;
  }
  
  if (!portalIntelSync.config.apiEndpoint) {
    alert('Please configure Azure API endpoint first!');
    portalIntelSync.configure();
    return;
  }
  
  var allRecords = window.plugin.portalIntelCache.exportForSync();
  var pendingRecords = allRecords.filter(function(r) {
    return r.SyncStatus === 'pending';
  });
  
  if (pendingRecords.length === 0) {
    alert('No pending portals to sync!');
    return;
  }
  
  if (!confirm('Sync ' + pendingRecords.length + ' pending portals to Azure SQL?')) {
    return;
  }
  
  portalIntelSync.syncRecords(pendingRecords);
};

/**
 * Sync records in batches
 */
portalIntelSync.syncRecords = function(records) {
  var batches = [];
  var batchSize = portalIntelSync.config.batchSize;
  
  // Split into batches
  for (var i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }
  
  console.log('[Azure Sync] Syncing ' + records.length + ' records in ' + batches.length + ' batches');
  
  var syncDialog = portalIntelSync.showSyncProgress(batches.length);
  
  // Process batches sequentially
  portalIntelSync.processBatches(batches, 0, syncDialog, 0, 0);
};

/**
 * Process batches recursively
 */
portalIntelSync.processBatches = function(batches, index, dialog, successCount, errorCount) {
  if (index >= batches.length) {
    var totalProcessed = successCount + errorCount;
    dialog.updateProgress(
      index, 
      batches.length, 
      'Complete! ' + successCount + ' succeeded, ' + errorCount + ' failed'
    );
    
    console.log('[Azure Sync] Sync complete:', successCount, 'succeeded,', errorCount, 'failed');
    
    alert(
      'Sync complete!\n\n' +
      'Success: ' + successCount + ' portals\n' +
      'Failed: ' + errorCount + ' portals\n' +
      'Total: ' + totalProcessed + ' portals'
    );
    return;
  }
  
  var batch = batches[index];
  var currentBatch = index + 1;
  dialog.updateProgress(
    index, 
    batches.length, 
    'Syncing batch ' + currentBatch + ' of ' + batches.length + '...'
  );
  
  portalIntelSync.sendBatch(batch, function(success) {
    if (success) {
      // Mark as synced in cache
      batch.forEach(function(record) {
        if (window.plugin.portalIntelCache.cache[record.PortalGUID]) {
          window.plugin.portalIntelCache.cache[record.PortalGUID].syncStatus = 'synced';
          window.plugin.portalIntelCache.cache[record.PortalGUID].lastSyncAttempt = new Date().toISOString();
          window.plugin.portalIntelCache.cache[record.PortalGUID].syncError = null;
        }
      });
      window.plugin.portalIntelCache.saveCache();
      successCount += batch.length;
    } else {
      // Mark as error in cache
      batch.forEach(function(record) {
        if (window.plugin.portalIntelCache.cache[record.PortalGUID]) {
          window.plugin.portalIntelCache.cache[record.PortalGUID].syncStatus = 'error';
          window.plugin.portalIntelCache.cache[record.PortalGUID].lastSyncAttempt = new Date().toISOString();
          window.plugin.portalIntelCache.cache[record.PortalGUID].syncError = 'Sync failed';
        }
      });
      window.plugin.portalIntelCache.saveCache();
      errorCount += batch.length;
    }
    
    // Continue to next batch with delay
    setTimeout(function() {
      portalIntelSync.processBatches(batches, index + 1, dialog, successCount, errorCount);
    }, 500);
  });
};

/**
 * Test connection to Azure endpoint
 */
portalIntelSync.testConnection = function() {
  console.log('[Azure Sync] Testing connection to Azure endpoint:', portalIntelSync.config.apiEndpoint);

  if (!portalIntelSync.config.apiEndpoint) {
    console.error('[Azure Sync] No API endpoint configured.');
    return;
  }

  var testUrl = portalIntelSync.config.apiEndpoint;
  if (!testUrl.endsWith('/health')) {
    testUrl = testUrl.replace(/\/$/, '') + '/health';
  }
  
  console.log('[Azure Sync] Testing URL:', testUrl);
  
  var xhr = new XMLHttpRequest();
  xhr.open('GET', testUrl, true);
  
  if (portalIntelSync.config.apiKey) {
    xhr.setRequestHeader('x-functions-key', portalIntelSync.config.apiKey);
    console.log('[Azure Sync] API key added to request');
  }
  
  xhr.timeout = 10000;
  
  xhr.onload = function() {
    console.log('[Azure Sync] Connection test response:', xhr.status, xhr.statusText);
    console.log('[Azure Sync] Response body:', xhr.responseText);
    
    if (xhr.status >= 200 && xhr.status < 300) {
      alert('✅ Connection successful!\n\nEndpoint: ' + portalIntelSync.config.apiEndpoint);
    } else {
      alert('❌ Connection failed!\n\nStatus: ' + xhr.status + '\n' + xhr.statusText);
    }
  };
  
  xhr.onerror = function() {
    console.error('[Azure Sync] Network error during connection test');
    alert('❌ Network error!\n\nCannot reach endpoint.');
  };
  
  xhr.ontimeout = function() {
    console.error('[Azure Sync] Connection timeout');
    alert('❌ Connection timeout!\n\nEndpoint did not respond in time.');
  };
  
  xhr.send();
};

/**
 * Send a batch to Azure
 */
portalIntelSync.sendBatch = function(batch, callback) {
  console.log('[Azure Sync] ===== SENDING BATCH =====');
  console.log('[Azure Sync] Batch size:', batch.length, 'portals');
  console.log('[Azure Sync] Endpoint:', portalIntelSync.config.apiEndpoint);
  console.log('[Azure Sync] API Key configured:', portalIntelSync.config.apiKey ? 'Yes (***' + portalIntelSync.config.apiKey.slice(-4) + ')' : 'No');
  console.log('[Azure Sync] First portal in batch:');
  console.log('[Azure Sync]   GUID:', batch[0].PortalGUID);
  console.log('[Azure Sync]   Name:', batch[0].PortalName);
  console.log('[Azure Sync]   Team:', batch[0].Team);
  console.log('[Azure Sync]   Location:', batch[0].Latitude + ',' + batch[0].Longitude);
  
  var xhr = new XMLHttpRequest();
  
  // Event listeners for debugging
  xhr.addEventListener('loadstart', function() {
    console.log('[Azure Sync] XHR loadstart event');
  });
  
  xhr.addEventListener('progress', function(e) {
    console.log('[Azure Sync] XHR progress event:', e.loaded, '/', e.total);
  });
  
  xhr.addEventListener('abort', function() {
    console.error('[Azure Sync] XHR abort event');
  });
  
  xhr.addEventListener('error', function(e) {
    console.error('[Azure Sync] XHR error event:', e);
  });
  
  xhr.addEventListener('timeout', function() {
    console.error('[Azure Sync] XHR timeout event');
  });
  
  xhr.open('POST', portalIntelSync.config.apiEndpoint, true);
  console.log('[Azure Sync] XHR opened: POST', portalIntelSync.config.apiEndpoint);
  
  xhr.setRequestHeader('Content-Type', 'application/json');
  console.log('[Azure Sync] Set Content-Type header');
  
  if (portalIntelSync.config.apiKey) {
    xhr.setRequestHeader('x-functions-key', portalIntelSync.config.apiKey);
    console.log('[Azure Sync] Set x-functions-key header');
  }
  
  xhr.timeout = 30000; // 30 second timeout
  console.log('[Azure Sync] Set timeout: 30000ms');
  
  xhr.onload = function() {
    console.log('[Azure Sync] ===== XHR ONLOAD =====');
    console.log('[Azure Sync] Response status:', xhr.status, xhr.statusText);
    console.log('[Azure Sync] Response headers:', xhr.getAllResponseHeaders());
    console.log('[Azure Sync] Response body length:', xhr.responseText.length);
    console.log('[Azure Sync] Response body (first 500 chars):', xhr.responseText.substring(0, 500));
    
    try {
      var responseData = JSON.parse(xhr.responseText);
      console.log('[Azure Sync] Parsed response:', responseData);
    } catch (e) {
      console.error('[Azure Sync] Failed to parse response as JSON:', e);
    }
    
    if (xhr.status >= 200 && xhr.status < 300) {
      console.log('[Azure Sync] ✅✅✅ Batch synced successfully:', batch.length, 'records');
      callback(true);
    } else {
      console.error('[Azure Sync] ❌❌❌ Batch failed with status:', xhr.status, xhr.statusText);
      console.error('[Azure Sync] Full response:', xhr.responseText);
      callback(false);
    }
  };
  
  xhr.onerror = function(e) {
    console.error('[Azure Sync] ❌ Network error sending batch');
    console.error('[Azure Sync] Error event:', e);
    console.error('[Azure Sync] XHR state:', xhr.readyState);
    console.error('[Azure Sync] XHR status:', xhr.status);
    callback(false);
  };
  
  xhr.ontimeout = function() {
    console.error('[Azure Sync] ❌ Request timeout (30s exceeded)');
    callback(false);
  };
  
  var payload = { portals: batch };
  var payloadString = JSON.stringify(payload);
  console.log('[Azure Sync] Payload size:', payloadString.length, 'characters');
  console.log('[Azure Sync] Payload (first 500 chars):', payloadString.substring(0, 500));
  
  try {
    console.log('[Azure Sync] Sending XHR request...');
    xhr.send(payloadString);
    console.log('[Azure Sync] XHR request sent, waiting for response...');
  } catch (e) {
    console.error('[Azure Sync] ❌ Exception sending batch:', e);
    console.error('[Azure Sync] Error name:', e.name);
    console.error('[Azure Sync] Error message:', e.message);
    console.error('[Azure Sync] Stack trace:', e.stack);
    callback(false);
  }
};

/**
 * Show sync progress dialog
 */
portalIntelSync.showSyncProgress = function(totalBatches) {
  var html = $('<div>').css('font-family', 'monospace');
  
  var progressBar = $('<div>')
    .css({
      'width': '100%',
      'height': '30px',
      'background': '#333',
      'border': '1px solid #0f0',
      'position': 'relative',
      'margin': '10px 0'
    });
  
  var progressFill = $('<div>')
    .css({
      'width': '0%',
      'height': '100%',
      'background': '#0f0',
      'transition': 'width 0.3s'
    });
  
  var progressText = $('<div>')
    .css({
      'position': 'absolute',
      'width': '100%',
      'text-align': 'center',
      'line-height': '30px',
      'color': '#fff',
      'font-weight': 'bold'
    })
    .text('0%');
  
  progressBar.append(progressFill);
  progressBar.append(progressText);
  
  var statusText = $('<div>')
    .css({ 'text-align': 'center', 'margin': '10px 0' })
    .text('Starting sync...');
  
  html.append(
    $('<h3>').text('🔄 Syncing to Azure SQL'),
    statusText,
    progressBar
  );
  
  var dialog = window.dialog({
    html: html,
    title: 'Azure Sync Progress',
    width: 450
  });
  
  dialog.updateProgress = function(current, total, status) {
    var percent = Math.round((current / total) * 100);
    progressFill.css('width', percent + '%');
    progressText.text(percent + '%');
    statusText.text(status + ' (' + current + '/' + total + ')');
  };
  
  return dialog;
};

/**
 * Show sync statistics
 */
portalIntelSync.showStats = function() {
  if (!window.plugin.portalIntelCache) {
    alert('Portal Intelligence Cache plugin is required!');
    return;
  }
  
  var cache = window.plugin.portalIntelCache.cache;
  var syncStats = {
    pending: 0,
    synced: 0,
    error: 0,
    total: 0
  };
  
  for (var guid in cache) {
    syncStats.total++;
    var status = cache[guid].syncStatus || 'pending';
    syncStats[status]++;
  }
  
  var html = $('<div>').css('font-family', 'monospace');
  
  html.append($('<h3>').text('🔄 Azure Sync Statistics'));
  
  html.append($('<h4>').text('Sync Status'));
  html.append($('<div>').html(
    '<strong>Total Portals:</strong> ' + syncStats.total + '<br>' +
    '<span style="color: #ff0;">⏳ <strong>Pending:</strong> ' + syncStats.pending + '</span><br>' +
    '<span style="color: #0f0;">✅ <strong>Synced:</strong> ' + syncStats.synced + '</span><br>' +
    '<span style="color: #f00;">❌ <strong>Errors:</strong> ' + syncStats.error + '</span>'
  ));
  
  html.append($('<h4>').text('Configuration'));
  html.append($('<div>').html(
    '<strong>Endpoint:</strong> ' + (portalIntelSync.config.apiEndpoint || 'Not configured') + '<br>' +
    '<strong>API Key:</strong> ' + (portalIntelSync.config.apiKey ? '***' + portalIntelSync.config.apiKey.slice(-4) : 'Not set') + '<br>' +
    '<strong>Batch Size:</strong> ' + portalIntelSync.config.batchSize + ' portals/request'
  ));
  
  window.dialog({
    html: html,
    title: 'Azure Sync Stats',
    width: 450
  });
};

/**
 * Setup UI
 */
portalIntelSync.setupUI = function() {
  console.log('[Azure Sync] Setting up UI...');
  
  // Check if IITC.toolbox exists
  if (typeof IITC !== 'undefined' && IITC.toolbox) {
    console.log('[Azure Sync] IITC.toolbox available, adding buttons...');
    
    IITC.toolbox.addButton({
      label: 'Configure Azure Sync',
      title: 'Configure Azure SQL API endpoint and credentials',
      action: portalIntelSync.configure
    });
    
    IITC.toolbox.addButton({
      label: 'Test Azure Connection',
      title: 'Test connection to Azure SQL API',
      action: portalIntelSync.testConnection
    });
    
    IITC.toolbox.addButton({
      label: 'Sync All to Azure',
      title: 'Upload ALL cached portal data to Azure SQL Database',
      action: portalIntelSync.syncAll
    });
    
    IITC.toolbox.addButton({
      label: 'Sync Pending to Azure',
      title: 'Upload only pending (unsynced) portal data to Azure SQL',
      action: portalIntelSync.syncPending
    });
    
    IITC.toolbox.addButton({
      label: 'Azure Sync Stats',
      title: 'View Azure sync statistics',
      action: portalIntelSync.showStats
    });
    
    console.log('[Azure Sync] Toolbox buttons added');
  } else {
    console.warn('[Azure Sync] IITC.toolbox not available - buttons not added');
    console.log('[Azure Sync] IITC object:', typeof IITC !== 'undefined' ? IITC : 'undefined');
  }
  
  console.log('[Azure Sync] UI setup complete');
};

/**
 * Setup function
 */
var setup = function() {
  console.log('[Azure Sync] ========== SETUP FUNCTION CALLED ==========');
  console.log('[Azure Sync] Setup called at:', new Date().toISOString());
  console.log('[Azure Sync] Checking dependencies...');
  console.log('[Azure Sync] window.plugin exists:', typeof window.plugin !== 'undefined');
  console.log('[Azure Sync] window.plugin.portalIntelCache exists:', typeof window.plugin !== 'undefined' && typeof window.plugin.portalIntelCache !== 'undefined');
  
  if (typeof window.plugin !== 'undefined' && window.plugin.portalIntelCache) {
    console.log('[Azure Sync] ✅ Portal Intel Cache plugin detected');
    console.log('[Azure Sync] Cache size:', Object.keys(window.plugin.portalIntelCache.cache || {}).length);
  } else {
    console.warn('[Azure Sync] ⚠️ Portal Intel Cache plugin NOT detected (may load later)');
  }
  
  console.log('[Azure Sync] Loading configuration from localStorage...');
  portalIntelSync.loadConfig();
  console.log('[Azure Sync] Configuration loaded:');
  console.log('[Azure Sync]   - Endpoint:', portalIntelSync.config.apiEndpoint || '(not configured)');
  console.log('[Azure Sync]   - API Key:', portalIntelSync.config.apiKey ? 'Set (***' + portalIntelSync.config.apiKey.slice(-4) + ')' : '(not set)');
  console.log('[Azure Sync]   - Batch Size:', portalIntelSync.config.batchSize);
  console.log('[Azure Sync]   - Retry Attempts:', portalIntelSync.config.retryAttempts);
  console.log('[Azure Sync]   - Retry Delay:', portalIntelSync.config.retryDelay + 'ms');
  
  console.log('[Azure Sync] Setting up UI...');
  portalIntelSync.setupUI();
  
  // Make globally accessible for automation
  window.portalIntelSync = portalIntelSync;
  console.log('[Azure Sync] ✅ Exposed as window.portalIntelSync');
  
  console.log('[Azure Sync] ========== PLUGIN INITIALIZED SUCCESSFULLY ==========');
  console.log('[Azure Sync] Plugin version: 0.1.8');
  console.log('[Azure Sync] Ready to sync portal data to Azure SQL');
  console.log('[Azure Sync] Use "Configure Azure Sync" button to set endpoint');
  console.log('[Azure Sync] ==========================================================');
};

// Register plugin with IITC boot sequence so wrapper or IITC will call setup
window.bootPlugins = window.bootPlugins || [];
window.bootPlugins.push(setup);
// If IITC already loaded, run setup now
if (window.iitcLoaded) setup();
