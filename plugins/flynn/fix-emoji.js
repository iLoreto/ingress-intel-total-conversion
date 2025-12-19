const fs = require('fs');
const path = require('path');

// Files to fix
const files = [
  'PACKAGE-SUMMARY.md',
  'README-AUTOMATION-SETUP.md',
  'README-PORTAL-INTEL.md'
];

// Comprehensive emoji mappings
const replacements = [
  // Headers with specific emoji
  ['## ??? Architecture Overview', '## 🏗️ Architecture Overview'],
  ['## ?? Table of Contents', '## 📑 Table of Contents'],
  ['## ?? Prerequisites', '## 📋 Prerequisites'],
  ['## ?? Azure Function Setup', '## ☁️ Azure Function Setup'],
  ['## ?? Chrome Automation Setup', '## 🤖 Chrome Automation Setup'],
  ['## ?? Usage Examples', '## 💡 Usage Examples'],
  ['## ?? Complete Workflow', '## 🔄 Complete Workflow'],
  ['## ?? Monitoring and Logs', '## 📊 Monitoring and Logs'],
  ['## ?? Performance Tips', '## ⚡ Performance Tips'],
  ['## ?? Security Best Practices', '## 🔒 Security Best Practices'],
  ['## ?? Maintenance Tasks', '## 🛠️ Maintenance Tasks'],
  ['## ?? Additional Resources', '## 📚 Additional Resources'],
  ['## ?? Overview', '## 📖 Overview'],
  ['## ?? Plugins Included', '## 🔌 Plugins Included'],
  ['## ?? Installation', '## 📥 Installation'],
  ['## ??? Azure SQL Database Setup', '## ☁️ Azure SQL Database Setup'],
  ['## ?? UI Components', '## 🎨 UI Components'],
  ['## ?? Configuration Options', '## ⚙️ Configuration Options'],
  ['## ?? Automated Collection', '## 🤖 Automated Collection'],
  ['## ?? Database Queries', '## 📊 Database Queries'],
  ['## ?? Data Format', '## 📋 Data Format'],
  ['## ?? Security Considerations', '## 🔒 Security Considerations'],
  ['## ?? Contributing', '## 🤝 Contributing'],
  ['## ?? What Has Been Created', '## 📦 What Has Been Created'],
  ['## ?? Quick Start', '## ⚡ Quick Start'],
  ['## ?? Data Schema', '## 📊 Data Schema'],
  ['## ?? Configuration', '## ⚙️ Configuration'],
  ['## ?? Sample Queries', '## 📊 Sample Queries'],
  ['## ??? Security', '## 🔒 Security'],
  ['## ?? Cost Breakdown', '## 💰 Cost Breakdown'],
  ['## ?? Learning Resources', '## 📚 Learning Resources'],
  ['## ?? Common Issues', '## ⚠️ Common Issues'],
  ['## ? Complete Checklist', '## ✅ Complete Checklist'],
  ['## ? Quick Start Checklist', '## ✅ Quick Start Checklist'],
  ['## ?? Next Steps', '## 🎓 Next Steps'],
  ['## ?? Credits', '## 🙏 Credits'],
  ['## ?? Support', '## 💬 Support'],
  ['## ?? License', '## 📄 License'],
  ['## ?? Use Cases', '## 🎯 Use Cases'],
  ['## ?? Troubleshooting', '## 🔧 Troubleshooting'],
  
  // Inline security markers
  ['### ? **', '### ✅ **'],
  ['### ?? Security', '### ⚠️ Security'],
  
  // Checkmarks and bullets in lists
  ['? Auto-capture', '✓ Auto-capture'],
  ['? Batch', '✓ Batch'],
  ['? Configurable', '✓ Configurable'],
  ['? Real-time', '✓ Real-time'],
  ['? localStorage', '✓ localStorage'],
  ['? Export', '✓ Export'],
  ['? API', '✓ API'],
  ['? Sync', '✓ Sync'],
  ['? Progress', '✓ Progress'],
  ['? Connection', '✓ Connection'],
  ['? Error', '✓ Error'],
  ['? ', '✓ '],
  
  // Remaining generic double question marks
  ['??', '📦'],
  
  // Box drawing characters for ASCII art - replace with simpler versions
  ['???????????????????????????????????????????????????????????', '╔════════════════════════════════════════════╗'],
  ['???????????????????????????????????????????????????????????', '╚════════════════════════════════════════════╝'],
  ['?????????????????????????????????????????????????', '├──────────────────────────────────────┤'],
  ['?', '│'],
  ['?', '│'],
  ['?', '─'],
  ['?', '↓'],
  ['�', '•'],
];

console.log('🔧 Fixing emoji in markdown files...\n');

files.forEach(filename => {
  const filepath = path.join(__dirname, filename);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filename}`);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  let originalContent = content;
  
  // Apply all replacements in order
  replacements.forEach(([broken, fixed]) => {
    content = content.split(broken).join(fixed);
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ Fixed emoji in: ${filename}`);
  } else {
    console.log(`✓  No changes needed: ${filename}`);
  }
});

console.log('\n🎉 Emoji fix complete!');
console.log('📝 All markdown files should now display correctly on GitHub.');
