const fs = require('fs');
const content = fs.readFileSync('src/routes/AppRoutes.jsx', 'utf8');
const lines = content.split('\n');
const importLines = lines.filter(l => l.startsWith('import '));
for (const line of importLines) {
  const match = line.match(/import\s+([\w]+)\s+from\s+['"]([^'"]+)['"]/);
  if (match) {
    let modulePath = match[2];
    if (modulePath.startsWith('.')) {
      let fullPath = require('path').join(__dirname, 'src/routes', modulePath);
      if (fs.existsSync(fullPath + '.jsx')) { fullPath += '.jsx'; }
      else if (fs.existsSync(fullPath + '.js')) { fullPath += '.js'; }
      else { continue; }
      
      const fileContent = fs.readFileSync(fullPath, 'utf8');
      if (!fileContent.includes('export default')) {
          console.log('No default export in:', fullPath);
      }
    }
  }
}
