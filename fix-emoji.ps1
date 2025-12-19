# PowerShell script to fix emoji in markdown files
$files = @(
    "plugins\flynn\PACKAGE-SUMMARY.md",
    "plugins\flynn\README-AUTOMATION-SETUP.md",
    "plugins\flynn\README-PORTAL-INTEL.md"
)

$replacements = @{
    '## ??? Architecture Overview' = '## ??? Architecture Overview'
    '## ?? Table of Contents' = '## ?? Table of Contents'
    '## ?? Prerequisites' = '## ?? Prerequisites'
    '## ?? Azure Function Setup' = '## ?? Azure Function Setup'
    '## ?? Chrome Automation Setup' = '## ?? Chrome Automation Setup'
    '## ?? Usage Examples' = '## ?? Usage Examples'
    '## ?? Complete Workflow' = '## ?? Complete Workflow'
    '## ?? Monitoring and Logs' = '## ?? Monitoring and Logs'
    '## ?? Performance Tips' = '## ? Performance Tips'
    '## ?? Security Best Practices' = '## ?? Security Best Practices'
    '## ?? Maintenance Tasks' = '## ??? Maintenance Tasks'
    '## ?? Additional Resources' = '## ?? Additional Resources'
    '## ?? Overview' = '## ?? Overview'
    '## ?? Plugins Included' = '## ?? Plugins Included'
    '## ?? Installation' = '## ?? Installation'
    '## ??? Azure SQL Database Setup' = '## ?? Azure SQL Database Setup'
    '## ?? UI Components' = '## ?? UI Components'
    '## ?? Configuration Options' = '## ?? Configuration Options'
    '## ?? Automated Collection' = '## ?? Automated Collection'
    '## ?? Database Queries' = '## ?? Database Queries'
    '## ?? Data Format' = '## ?? Data Format'
    '## ?? Security Considerations' = '## ?? Security Considerations'
    '## ?? Contributing' = '## ?? Contributing'
    '## ?? Quick Start' = '## ? Quick Start'
    '## ?? Data Schema' = '## ?? Data Schema'
    '## ?? Configuration' = '## ?? Configuration'
    '## ?? Sample Queries' = '## ?? Sample Queries'
    '## ??? Security' = '## ?? Security'
    '## ?? Cost Breakdown' = '## ?? Cost Breakdown'
    '## ?? Learning Resources' = '## ?? Learning Resources'
    '## ?? Common Issues' = '## ?? Common Issues'
    '## ? Complete Checklist' = '## ? Complete Checklist'
    '## ? Quick Start Checklist' = '## ? Quick Start Checklist'
    '## ?? Next Steps' = '## ?? Next Steps'
    '## ?? Credits' = '## ?? Credits'
    '## ?? Support' = '## ?? Support'
    '## ?? License' = '## ?? License'
    '## ?? Use Cases' = '## ?? Use Cases'
    '## ?? Troubleshooting' = '## ?? Troubleshooting'
    '### ?? Security' = '### ?? Security'
    '? Auto-capture' = '? Auto-capture'
    '? Batch' = '? Batch'
    '? Configurable' = '? Configurable'
    '? Real-time' = '? Real-time'
    '? localStorage' = '? localStorage'
    '? Export' = '? Export'
    '? API' = '? API'
    '? Sync' = '? Sync'
    '? Progress' = '? Progress'
    '? Connection' = '? Connection'
    '? Error' = '? Error'
}

Write-Host "?? Fixing emoji in markdown files...`n" -ForegroundColor Cyan

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        $original = $content
        
        foreach ($key in $replacements.Keys) {
            $content = $content.Replace($key, $replacements[$key])
        }
        
        # Replace remaining ?? with ??
        $content = $content.Replace('??', '??')
        
        if ($content -ne $original) {
            $content | Set-Content $file -Encoding UTF8 -NoNewline
            Write-Host "? Fixed emoji in: $file" -ForegroundColor Green
        } else {
            Write-Host "?  No changes needed: $file" -ForegroundColor Gray
        }
    } else {
        Write-Host "??  File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`n?? Emoji fix complete!" -ForegroundColor Green
