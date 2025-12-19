// ==UserScript==
// @author         YourName
// @name           Portal Intel Azure Sync
// @category       Info
// @version        0.1.0
// @description    Sync cached portal intelligence to Azure SQL Database
// @id             portal-intel-sync
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

/* exported setup --eslint */
/* global IITC -- eslint */

var changelog = [
  {
    version: '0.1.0',
    changes: ['Initial release', 'Azure SQL sync functionality', 'Batch upload support']
  }
];

var portalIntelSync = {};
window.plugin.portalIntelSync = portalIntelSync;

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
  if (!window.plugin.portalIntelCache) {
    alert('Portal Intelligence Cache plugin is required!');
    return;
  }
  
  if (!portalIntelSync.config.apiEndpoint) {
    alert('Please configure Azure API endpoint first!');
    portalIntelSync.configure();
    return;
  }
  
  var records = window.plugin.portalIntelCache.exportForSync();
  
  if (records.length === 0) {
    alert('No portals to sync!');
    return;
  }
  
  if (!confirm('Sync ' + records.length + ' portals to Azure SQL?')) {
    return;
  }
  
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
 * Send a batch to Azure
 */
portalIntelSync.sendBatch = function(batch, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('POST', portalIntelSync.config.apiEndpoint, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  
  if (portalIntelSync.config.apiKey) {
    xhr.setRequestHeader('x-functions-key', portalIntelSync.config.apiKey);
  }
  
  xhr.timeout = 30000; // 30 second timeout
  
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      console.log('[Azure Sync] Batch synced successfully:', batch.length, 'records');
      callback(true);
    } else {
      console.error('[Azure Sync] Batch failed:', xhr.status, xhr.statusText);
      console.error('[Azure Sync] Response:', xhr.responseText);
      callback(false);
    }
  };
  
  xhr.onerror = function() {
    console.error('[Azure Sync] Network error');
    callback(false);
  };
  
  xhr.ontimeout = function() {
    console.error('[Azure Sync] Request timeout');
    callback(false);
  };
  
  try {
    xhr.send(JSON.stringify({ portals: batch }));
  } catch (e) {
    console.error('[Azure Sync] Error sending batch:', e);
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
 * Test connection to Azure endpoint
 */
portalIntelSync.testConnection = function() {
  if (!portalIntelSync.config.apiEndpoint) {
    alert('Please configure Azure API endpoint first!');
    portalIntelSync.configure();
    return;
  }
  
  var xhr = new XMLHttpRequest();
  xhr.open('GET', portalIntelSync.config.apiEndpoint + '/health', true);
  
  if (portalIntelSync.config.apiKey) {
    xhr.setRequestHeader('x-functions-key', portalIntelSync.config.apiKey);
  }
  
  xhr.timeout = 10000;
  
  xhr.onload = function() {
    if (xhr.status >= 200 && xhr.status < 300) {
      alert('✅ Connection successful!\n\nEndpoint: ' + portalIntelSync.config.apiEndpoint);
    } else {
      alert('❌ Connection failed!\n\nStatus: ' + xhr.status + '\n' + xhr.statusText);
    }
  };
  
  xhr.onerror = function() {
    alert('❌ Network error!\n\nCannot reach endpoint.');
  };
  
  xhr.ontimeout = function() {
    alert('❌ Connection timeout!\n\nEndpoint did not respond in time.');
  };
  
  xhr.send();
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
};

/**
 * Setup function
 */
var setup = function() {
  portalIntelSync.loadConfig();
  portalIntelSync.setupUI();
  
  console.log('[Azure Sync] Plugin initialized');
  
  // Make globally accessible for automation
  window.portalIntelSync = portalIntelSync;
};
