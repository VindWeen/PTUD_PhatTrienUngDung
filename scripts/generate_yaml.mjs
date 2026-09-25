import fs from 'fs';

function formatString(str) {
  if (str.includes('\n')) {
    return '|\n' + str.split('\n').map(l => '  ' + l).join('\n');
  }
  if (/[:{}[\]&*#?|<>=!%@`,]/.test(str) || str === '' || !isNaN(str) || str.startsWith(' ') || str.endsWith(' ')) {
    return JSON.stringify(str);
  }
  return str;
}

function toYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'boolean' || typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') return formatString(obj);

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        const itemYaml = toYaml(item, indent + 1);
        const lines = itemYaml.split('\n');
        return '\n' + pad + '- ' + lines[0].trimStart() + (lines.length > 1 ? '\n' + lines.slice(1).join('\n') : '');
      }
      return '\n' + pad + '- ' + toYaml(item, indent + 1);
    }).join('');
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    return keys.map(k => {
      const val = obj[k];
      const keyStr = /[:{}[\]&*#?|<>=!%@`,\s]/.test(k) ? JSON.stringify(k) : k;
      if (typeof val === 'object' && val !== null) {
        if (Array.isArray(val) && val.length === 0) {
          return '\n' + pad + keyStr + ': []';
        }
        if (!Array.isArray(val) && Object.keys(val).length === 0) {
          return '\n' + pad + keyStr + ': {}';
        }
        return '\n' + pad + keyStr + ':' + toYaml(val, indent + 1);
      }
      return '\n' + pad + keyStr + ': ' + toYaml(val, indent);
    }).join('');
  }

  return String(obj);
}

const spec = JSON.parse(fs.readFileSync('docs/api/openapi.json', 'utf8'));
const yaml = toYaml(spec).trim() + '\n';
fs.writeFileSync('docs/api/openapi.yaml', yaml, 'utf8');
console.log('Successfully generated docs/api/openapi.yaml, size:', fs.statSync('docs/api/openapi.yaml').size);
