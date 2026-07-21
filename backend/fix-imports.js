const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(path.join(__dirname, 'src'));
let changedCount = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    
    // Replace import ... from './path' -> './path.js'
    // Matches relative imports ending without an extension
    content = content.replace(/(from\s+['"])(\.[^'"]+?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.endsWith('.js') && !p2.endsWith('.ts')) {
            return `${p1}${p2}.js${p3}`;
        }
        return match;
    });

    // Replace import './path' -> './path.js' (side-effect imports)
    content = content.replace(/(import\s+['"])(\.[^'"]+?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.endsWith('.js') && !p2.endsWith('.ts')) {
            return `${p1}${p2}.js${p3}`;
        }
        return match;
    });
    
    // Replace dynamic import('./path') -> import('./path.js')
    content = content.replace(/(import\s*\(\s*['"])(\.[^'"]+?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.endsWith('.js') && !p2.endsWith('.ts')) {
            return `${p1}${p2}.js${p3}`;
        }
        return match;
    });
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        changedCount++;
        console.log(`Updated ${file}`);
    }
});

console.log(`Fixed imports in ${changedCount} files.`);
