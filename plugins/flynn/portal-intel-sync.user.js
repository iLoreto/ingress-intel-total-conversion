// ==UserScript==
// @author         YourName
// @name           Portal Intel Azure Sync
// @category       Info
// @version        0.1.9
// @description    Sync cached portal intelligence to Azure SQL Database
// @id             portal-intel-sync
// @namespace      https://github.com/IITC-CE/ingress-intel-total-conversion
// @match          https://intel.ingress.com/*
// @grant          none
// ==/UserScript==

console.log('[Azure Sync] Updated to version 0.1.9');
console.log('[Azure Sync] Plugin version: 0.1.9');

/* exported setup --eslint */
/* global IITC -- eslint */

console.log('[Azure Sync] ========== PLUGIN LOADING START ==========');
console.log('[Azure Sync] Timestamp:', new Date().toISOString());

var changelog = [
  {
    version: '0.1.9',
    changes: [
      'Fixed toolbox sync buttons to actually trigger HTTP sync',
      'Improved detection/handshake with Portal Intel Cache plugin when load order differs'
    ]
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

portalIntelSync.portalIntelCache = null;
portalIntelSync._cacheWaitTimer = null;

portalIntelSync._resolvePortalIntelCache = function() {
  if (portalIntelSync.portalIntelCache) return portalIntelSync.portalIntelCache;

  if (window.plugin && window.plugin.portalIntelCache) {
    portalIntelSync.portalIntelCache = window.plugin.portalIntelCache;
    console.log('[Azure Sync] ✅ Portal Intel Cache plugin detected');
    return portalIntelSync.portalIntelCache;
  }

  if (window.portalIntelCache) {
    portalIntelSync.portalIntelCache = window.portalIntelCache;
    console.log('[Azure Sync] ✅ Portal Intel Cache plugin detected via window.portalIntelCache');
    return portalIntelSync.portalIntelCache;
  }

  return null;
};

portalIntelSync.waitForPortalIntelCache = function() {
  // If already resolved, nothing to do
  if (portalIntelSync._resolvePortalIntelCache()) return;

  // Start a single polling loop (avoid multiple overlapping timers)
  if (portalIntelSync._cacheWaitTimer) return;

  console.warn('[Azure Sync] ⚠️ Portal Intel Cache plugin NOT detected, starting retry loop...');
  portalIntelSync._cacheWaitTimer = setInterval(function() {
    if (portalIntelSync._resolvePortalIntelCache()) {
      clearInterval(portalIntelSync._cacheWaitTimer);
      portalIntelSync._cacheWaitTimer = null;
      console.log('[Azure Sync] ✅ Cache plugin handshake complete');
    }
  }, 1000);
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
 * Convenience wrappers for toolbox buttons (ensures "manual" behavior)
 */
portalIntelSync.syncAllManual = function() {
  return portalIntelSync.syncAll(true);
};

portalIntelSync.syncPendingManual = function() {
  return portalIntelSync.syncPending(true);
};

/**
 * Sync all cached portals to Azure SQL
 */
portalIntelSync.syncAll = function(manualTrigger) {
  if (manualTrigger === undefined) manualTrigger = false;

  // Resolve cache plugin at call time (load-order independent)
  portalIntelSync._resolvePortalIntelCache();
  if (!portalIntelSync.portalIntelCache) {
    portalIntelSync.waitForPortalIntelCache();
    alert('Portal Intelligence Cache plugin is required (still loading). Try again in a second.');
    return;
  }

  console.log('[Azure Sync] Sync all triggered. manualTrigger=', manualTrigger);

  var records = portalIntelSync.portalIntelCache.exportForSync();
  if (!records || records.length === 0) {
    console.error('[Azure Sync] No cache found. Sync aborted.');
    if (manualTrigger) alert('No cached portal data found to sync!');
    return;
  }

  // Filter pending records for auto-sync
  if (!manualTrigger) {
    records = records.filter(function(record) {
      return record.SyncStatus === 'pending';
    });

    if (records.length === 0) {
      console.log('[Azure Sync] No pending records to sync. Auto-sync skipped.');
      return;
    }
  }

  portalIntelSync.loadConfig();
  if (!portalIntelSync.config.apiEndpoint) {
    if (manualTrigger) {
      alert('Please configure Azure API endpoint first!');
      portalIntelSync.configure();
    }
    return;
  }

  if (manualTrigger) {
    if (!confirm('Sync ' + records.length + ' portals to Azure SQL?\n\nEndpoint: ' + portalIntelSync.config.apiEndpoint)) return;
    portalIntelSync.showProgressBar(records.length, 0);
  }

  // Real HTTP sync in batches
  portalIntelSync.syncRecords(records, manualTrigger);
};

/**
 * Sync only pending records (not yet synced)
 */
portalIntelSync.syncPending = function(manualTrigger) {
  if (manualTrigger === undefined) manualTrigger = false;

  // Resolve cache plugin at call time (load-order independent)
  portalIntelSync._resolvePortalIntelCache();
  if (!portalIntelSync.portalIntelCache) {
    portalIntelSync.waitForPortalIntelCache();
    alert('Portal Intelligence Cache plugin is required (still loading). Try again in a second.');
    return;
  }

  portalIntelSync.loadConfig();
  if (!portalIntelSync.config.apiEndpoint) {
    alert('Please configure Azure API endpoint first!');
    portalIntelSync.configure();
    return;
  }

  var allRecords = portalIntelSync.portalIntelCache.exportForSync();
  var pendingRecords = allRecords.filter(function(r) {
    return r.SyncStatus === 'pending';
  });

  if (pendingRecords.length === 0) {
    alert('No pending portals to sync!');
    return;
  }

  if (manualTrigger) {
    if (!confirm('Sync ' + pendingRecords.length + ' pending portals to Azure SQL?')) return;
    portalIntelSync.showProgressBar(pendingRecords.length, 0);
  }

  // Real HTTP sync in batches
  portalIntelSync.syncRecords(pendingRecords, manualTrigger);
};

/**
 * Show progress bar logic for manual sync
 */
portalIntelSync.showProgressBar = function(total, current) {
  var progressBar = document.getElementById('sync-progress-bar');
  if (!progressBar) {
    progressBar = document.createElement('div');
    progressBar.id = 'sync-progress-bar';
    progressBar.style.position = 'fixed';
    progressBar.style.bottom = '10px';
    progressBar.style.left = '10px';
    progressBar.style.width = '300px';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#ccc';
    progressBar.style.border = '1px solid #000';

    var progress = document.createElement('div');
    progress.id = 'sync-progress';
    progress.style.height = '100%';
    progress.style.width = '0%';
    progress.style.backgroundColor = '#4caf50';
    progressBar.appendChild(progress);

    document.body.appendChild(progressBar);
  }

  var progress = document.getElementById('sync-progress');
  progress.style.width = ((current / total) * 100) + '%';

  if (current >= total) {
    setTimeout(function() {
      progressBar.remove();
    }, 2000);
  }
};

/**
 * Sync records in batches using real HTTP
 */
portalIntelSync.syncRecords = function(records, manualTrigger) {
  if (manualTrigger === undefined) manualTrigger = false;

  console.log('[Azure Sync] Syncing ' + records.length + ' portals to Azure SQL...');

  var batchSize = parseInt(portalIntelSync.config.batchSize, 10) || 100;
  var batches = [];
  for (var i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  var total = records.length;
  var completed = 0;
  var successCount = 0;
  var errorCount = 0;

  var sendNextBatch = function(batchIndex) {
    if (batchIndex >= batches.length) {
      console.log('[Azure Sync] Sync completed. Success:', successCount, 'Failed:', errorCount);
      if (manualTrigger) {
        portalIntelSync.showProgressBar(total, total);
        alert('Sync complete!\n\nSuccess: ' + successCount + '\nFailed: ' + errorCount + '\nTotal: ' + (successCount + errorCount));
      }
      return;
    }

    var batch = batches[batchIndex];

    portalIntelSync.sendBatch(batch, function(success) {
      completed += batch.length;

      if (success) {
        successCount += batch.length;
      } else {
        errorCount += batch.length;
      }

      // Update visible progress for manual runs
      if (manualTrigger) {
        portalIntelSync.showProgressBar(total, completed);
      }

      // Update cache entry statuses
      if (portalIntelSync.portalIntelCache && portalIntelSync.portalIntelCache.cache) {
        batch.forEach(function(record) {
          var entry = portalIntelSync.portalIntelCache.cache[record.PortalGUID];
          if (!entry) return;

          entry.lastSyncAttempt = new Date().toISOString();
          if (success) {
            entry.syncStatus = 'synced';
            entry.syncError = null;
          } else {
            entry.syncStatus = 'error';
            entry.syncError = 'Sync failed';
          }
        });

        // Recompute pendingSync stats in cache plugin if available
        if (portalIntelSync.portalIntelCache.stats) {
          var pending = 0;
          for (var guid in portalIntelSync.portalIntelCache.cache) {
            var st = portalIntelSync.portalIntelCache.cache[guid].syncStatus || 'pending';
            if (st === 'pending') pending++;
          }
          portalIntelSync.portalIntelCache.stats.pendingSync = pending;
          if (typeof portalIntelSync.portalIntelCache.updateStatusDisplay === 'function') {
            portalIntelSync.portalIntelCache.updateStatusDisplay();
          }
        }

        if (typeof portalIntelSync.portalIntelCache.saveCache === 'function') {
          portalIntelSync.portalIntelCache.saveCache();
        }
      }

      setTimeout(function() {
        sendNextBatch(batchIndex + 1);
      }, 250);
    });
  };

  sendNextBatch(0);
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
      action: portalIntelSync.syncAllManual
    });

    IITC.toolbox.addButton({
      label: 'Sync Pending to Azure',
      title: 'Upload only pending (unsynced) portal data to Azure SQL',
      action: portalIntelSync.syncPendingManual
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

  portalIntelSync.waitForPortalIntelCache();

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
  console.log('[Azure Sync] Plugin version: 0.1.9');
  console.log('[Azure Sync] Ready to sync portal data to Azure SQL');
  console.log('[Azure Sync] Use "Configure Azure Sync" button to set endpoint');
  console.log('[Azure Sync] ==========================================================');

  // Auto-sync functionality
  portalIntelSync.autoSyncInterval = null;
  portalIntelSync.startAutoSync = function() {
    if (portalIntelSync.autoSyncInterval) {
      console.log('[Azure Sync] Auto-sync is already running.');
      return;
    }

    console.log('[Azure Sync] Starting auto-sync...');
    portalIntelSync.autoSyncInterval = setInterval(function() {
      portalIntelSync.syncAll(false);
    }, 60000);
  };

  portalIntelSync.stopAutoSync = function() {
    if (portalIntelSync.autoSyncInterval) {
      clearInterval(portalIntelSync.autoSyncInterval);
      portalIntelSync.autoSyncInterval = null;
      console.log('[Azure Sync] Auto-sync stopped.');
    }
  };

  // Start auto-sync when the plugin initializes
  portalIntelSync.startAutoSync();
};

// Register plugin with IITC boot sequence so wrapper or IITC will call setup
window.bootPlugins = window.bootPlugins || [];
window.bootPlugins.push(setup);
// If IITC already loaded, run setup now
if (window.iitcLoaded) setup();
