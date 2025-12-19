const fs = require('fs');
const path = require('path');

// Files to fix
const files = [
  'PACKAGE-SUMMARY.md',
  'README-AUTOMATION-SETUP.md',
  'README-PORTAL-INTEL.md'
];

// Emoji mappings - map common broken patterns to proper emoji
const emojiMap = {
  // Common section headers
  '?? Table of Contents': '📑 Table of Contents',
  '?? Prerequisites': '📋 Prerequisites',
  '?? Azure Function Setup': '☁️ Azure Function Setup',
  '?? Chrome Automation Setup': '🤖 Chrome Automation Setup',
  '?? Usage Examples': '💡 Usage Examples',
  '?? Troubleshooting': '🔧 Troubleshooting',
  '?? Complete Workflow': '🔄 Complete Workflow',
  '?? Monitoring and Logs': '📊 Monitoring and Logs',
  '?? Performance Tips': '⚡ Performance Tips',
  '?? Security Best Practices': '🔒 Security Best Practices',
  '?? Maintenance Tasks': '🛠️ Maintenance Tasks',
  '?? Additional Resources': '📚 Additional Resources',
  '?? Support': '💬 Support',
  '?? License': '📄 License',
  '? Quick Start Checklist': '✅ Quick Start Checklist',
  '?? Overview': '📖 Overview',
  '?? Plugins Included': '🔌 Plugins Included',
  '?? Installation': '📥 Installation',
  '??? Azure SQL Database Setup': '☁️ Azure SQL Database Setup',
  '?? UI Components': '🎨 UI Components',
  '?? Configuration Options': '⚙️ Configuration Options',
  '?? Automated Collection': '🤖 Automated Collection',
  '?? Database Queries': '📊 Database Queries',
  '?? Data Format': '📋 Data Format',
  '?? Security Considerations': '🔒 Security Considerations',
  '?? Contributing': '🤝 Contributing',
  '?? Use Cases': '🎯 Use Cases',
  '?? What Has Been Created': '📦 What Has Been Created',
  '??? Architecture Overview': '🏗️ Architecture Overview',
  '?? Quick Start': '⚡ Quick Start',
  '?? Data Schema': '📊 Data Schema',
  '?? Configuration': '⚙️ Configuration',
  '?? Sample Queries': '📊 Sample Queries',
  '??? Security': '🔒 Security',
  '?? Cost Breakdown': '💰 Cost Breakdown',
  '?? Learning Resources': '📚 Learning Resources',
  '?? Common Issues': '⚠️ Common Issues',
  '? Complete Checklist': '✅ Complete Checklist',
  '?? Next Steps': '🎓 Next Steps',
  '?? Credits': '🙏 Credits',
  
  // Inline patterns
  '? Implemented Security Features': '✅ Implemented Security Features',
  '?? Security Best Practices': '⚠️ Security Best Practices',
  '? ': '✓ ',
  '? ': '✅ ',
  '? Auto-capture': '✓ Auto-capture',
  '? Batch': '✓ Batch',
  '? Configurable': '✓ Configurable',
  '? Real-time': '✓ Real-time',
  '? localStorage': '✓ localStorage',
  '? Export': '✓ Export',
  '? API': '✓ API',
  '? Sync': '✓ Sync',
  '? Progress': '✓ Progress',
  '? Connection': '✓ Connection',
  '? Error': '✓ Error',
  
  // Box drawing - replace with simple text boxes
  '?': '┌',
  '?': '└',
  '?': '│',
  '?': '─',
};

files.forEach(filename => {
  const filepath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  let changesMade = false;
  
  // Apply all replacements
  for (const [broken, fixed] of Object.entries(emojiMap)) {
    if (content.includes(broken)) {
      content = content.split(broken).join(fixed);
      changesMade = true;
    }
  }
  
  // Replace any remaining ?? patterns with 📦
  const remainingCount = (content.match(/\?\?/g) || []).length;
  if (remainingCount > 0) {
    content = content.replace(/\?\?/g, '📦');
    changesMade = true;
  }
  
  if (changesMade) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ Fixed emoji in: ${filename}`);
  } else {
    console.log(`✓  No changes needed: ${filename}`);
  }
});

console.log('\n🎉 Emoji fix complete!');
