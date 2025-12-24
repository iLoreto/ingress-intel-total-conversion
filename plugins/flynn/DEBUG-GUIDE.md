# Flynn Portal Intelligence - Debug Guide

## Overview
This guide will help you debug and verify that the Portal Intelligence Cache and Azure Sync plugins are working correctly.

## Updated Features (Latest Version)

### Enhanced Console Logging
Both plugins now include comprehensive console logging to help you track:
- Plugin loading and initialization
- Hook registration
- Portal data capture
- Data synchronization to Azure

### Version Information
- **Portal Intelligence Cache**: v0.1.1
- **Portal Intel Azure Sync**: v0.1.1

## Step-by-Step Debugging Process

### 1. Open Browser Console
1. Navigate to https://intel.ingress.com
2. Press `F12` or `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Click on the **Console** tab
4. Make sure **all log levels** are enabled (Info, Warnings, Errors)

### 2. Verify Plugin Loading

After the page loads, you should see these messages in the console:

```
[Intel Cache] ========== PLUGIN LOADING START ==========
[Intel Cache] Timestamp: 2024-XX-XXTXX:XX:XX.XXXZ
[Intel Cache] Namespace created: window.plugin.portalIntelCache
[Intel Cache] Configuration: {storageKey: "iitc_portal_intel_cache", ...}
```

and

```
[Azure Sync] ========== PLUGIN LOADING START ==========
[Azure Sync] Timestamp: 2024-XX-XXTXX:XX:XX.XXXZ
[Azure Sync] Namespace created: window.plugin.portalIntelSync
```

### 3. Verify Plugin Setup

Look for these setup messages:

```
[Intel Cache] ========== SETUP FUNCTION CALLED ==========
[Intel Cache] window.addHook available: true
[Intel Cache] ??? Hook registered successfully using window.addHook
[Intel Cache] ? Verified: Hook is in window._hooks array
[Intel Cache] ========== PLUGIN INITIALIZED SUCCESSFULLY ==========
```

**If you see ? marks**, there's a problem with hook registration.

### 4. Test Portal Capture

1. Click on any portal on the map
2. Wait for the portal details panel to appear
3. Check console for:

```
[Intel Cache] ===== HOOK TRIGGERED: portalDetailsUpdated =====
[Intel Cache] Hook data received: {guid: "...", portal: {...}, portalDetails: {...}}
[Intel Cache] Processing portal: abc123.16
[Intel Cache] Portal title: Example Portal
[Intel Cache] Portal team: RESISTANCE
[Intel Cache] Portal level: 7
[Intel Cache] ? Successfully captured and stored portal intel
```

### 5. Verify Data in Cache

After selecting a few portals, check the cache status:

1. **Via Status Bar**: Look at the bottom-left corner of the screen for the green status bar showing portal counts
2. **Via Console**:
   ```javascript
   console.log('Cached portals:', Object.keys(window.portalIntelCache.cache).length);
   console.log('Cache contents:', window.portalIntelCache.cache);
   ```

### 6. Configure Azure Sync

1. Click the **"Configure Azure Sync"** button in the toolbox
2. Enter your Azure Function endpoint URL (e.g., `https://yourapp.azurewebsites.net/api/UploadPortals`)
3. Enter your API key (if required)
4. Console should show:
   ```
   [Azure Sync] Configuration loaded:
   [Azure Sync]   - Endpoint: https://yourapp.azurewebsites.net/api/UploadPortals
   [Azure Sync]   - API Key: Set (***)
   ```

### 7. Test Azure Connection

1. Click **"Test Azure Connection"** button
2. Watch console for:
   ```
   [Azure Sync] Testing connection...
   [Azure Sync] Testing URL: https://yourapp.azurewebsites.net/api/UploadPortals/health
   [Azure Sync] Connection test response: 200 OK
   [Azure Sync] Response body: {"status":"healthy","database":"connected",...}
   ```

### 8. Sync Data to Azure

1. Click **"Sync All to Azure"** or **"Sync Pending to Azure"**
2. Monitor the console:
   ```
   [Azure Sync] ===== SYNC ALL TRIGGERED =====
   [Azure Sync] Exported 50 portal records
   [Azure Sync] ===== SENDING BATCH =====
   [Azure Sync] Batch size: 50 portals
   [Azure Sync] First portal in batch:
   [Azure Sync]   GUID: abc123.16
   [Azure Sync]   Name: Example Portal
   [Azure Sync] XHR opened: POST https://...
   [Azure Sync] XHR request sent, waiting for response...
   [Azure Sync] ===== XHR ONLOAD =====
   [Azure Sync] Response status: 200 OK
   [Azure Sync] ??? Batch synced successfully: 50 records
   ```

## Common Issues and Solutions

### Issue 1: No Console Messages
**Problem**: Console is completely empty or only shows stock Intel messages

**Solutions**:
1. Verify the plugins are actually installed in your userscript manager (Tampermonkey/Greasemonkey)
2. Check that the plugins are enabled
3. Make sure you're using a compatible browser (Chrome, Firefox, Edge)
4. Try refreshing the page (`F5`)

### Issue 2: Hook Not Triggering
**Problem**: Plugin loads but no messages appear when selecting portals

**Console shows**:
```
[Intel Cache] ??? window.addHook is not a function!
```

**Solutions**:
1. Check IITC-CE version - hooks were added in specific versions
2. Verify IITC core is loaded before plugins
3. Try installing IITC-CE from the official source

### Issue 3: Data Not Capturing
**Problem**: Hook triggers but no data is captured

**Console shows**:
```
[Intel Cache] Could not find portal details in hook data
```

**Solutions**:
1. The portal data structure may have changed - check the full data dump in console
2. Look for the data in `data.portal.options.data` or `data.portalDetails`
3. Report the issue with the console output

### Issue 4: Azure Sync Fails
**Problem**: Connection test or sync fails

**Console shows**:
```
[Azure Sync] ??? Batch failed with status: 404 Not Found
```

**Solutions**:
1. **404 Error**: Check the endpoint URL - make sure it's exactly `https://yourapp.azurewebsites.net/api/UploadPortals` (no `/health`)
2. **401/403 Error**: Verify your API key is correct
3. **CORS Error**: The Azure Function needs proper CORS configuration
4. **500 Error**: Check Azure Function logs for database connection issues

### Issue 5: Toolbox Buttons Not Showing
**Problem**: Plugins load but no buttons in IITC toolbox

**Console shows**:
```
[Intel Cache] ?? IITC.toolbox.addButton not available
```

**Solutions**:
1. This is usually fine - you can still access features via:
   - Status bar (bottom-left, green bar)
   - Console commands: `window.portalIntelCache.showStats()`
   - Console commands: `window.portalIntelCache.downloadCache()`
2. If needed, update IITC-CE to latest version for toolbox support

## Manual Testing via Console

You can manually test the plugins using these console commands:

### Check if plugins are loaded:
```javascript
console.log('Cache plugin:', typeof window.plugin.portalIntelCache);
console.log('Sync plugin:', typeof window.plugin.portalIntelSync);
```

### View cache stats:
```javascript
window.portalIntelCache.showStats();
```

### Export cache manually:
```javascript
var data = window.portalIntelCache.exportForSync();
console.log('Exported portals:', data.length);
console.log('Sample:', data[0]);
```

### Download cache as JSON:
```javascript
window.portalIntelCache.downloadCache();
```

### Test sync manually:
```javascript
window.portalIntelSync.testConnection();
```

### Force a sync:
```javascript
window.portalIntelSync.syncAll();
```

### Check hook registration:
```javascript
console.log('Registered hooks:', window._hooks);
console.log('portalDetailsUpdated hooks:', window._hooks.portalDetailsUpdated);
```

## Understanding the Console Output

### Green ? symbols
Indicate successful operations - everything is working correctly

### Yellow ?? symbols
Warnings - functionality may be limited but plugin should still work

### Red ? symbols
Errors - something went wrong and needs attention

### Log Prefixes
- `[Intel Cache]` - Messages from the Portal Intelligence Cache plugin
- `[Azure Sync]` - Messages from the Azure Sync plugin
- `[XHR]` - XMLHttpRequest/network activity

## Getting Help

If you're still having issues:

1. **Collect Console Output**: Copy all console messages from page load through the error
2. **Note the Exact Steps**: What you clicked, what you expected, what happened
3. **Check Browser**: Name and version (e.g., Chrome 120)
4. **Check IITC Version**: Help ? About IITC

## Advanced Debugging

### Enable Debug Mode
The plugins already have debug mode enabled by default in the config:
```javascript
debugMode: true
```

### Monitor Network Traffic
1. Open DevTools ? **Network** tab
2. Try a sync operation
3. Look for requests to your Azure endpoint
4. Check request headers, payload, and response

### Check LocalStorage
```javascript
// View stored cache
console.log(localStorage.getItem('iitc_portal_intel_cache'));

// View stored config
console.log(localStorage.getItem('azure_sync_endpoint'));
console.log(localStorage.getItem('azure_sync_apikey'));

// Clear cache (if needed)
localStorage.removeItem('iitc_portal_intel_cache');
```

## Success Indicators

When everything is working correctly, you should see:

1. ? Plugins load without errors
2. ? Hooks register successfully  
3. ? Portal selection triggers data capture
4. ? Green status bar shows increasing portal counts
5. ? Azure connection test succeeds (200 OK)
6. ? Sync operations complete successfully
7. ? Data appears in your Azure SQL database

## Next Steps

Once debugging is complete and everything works:
1. You can reduce console verbosity by setting `debugMode: false` in the plugin config
2. Set up automated syncing if desired
3. Monitor your Azure Function costs and performance
4. Consider backing up the localStorage cache periodically
