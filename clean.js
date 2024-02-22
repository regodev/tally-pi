const fs = require('fs');

try {
  fs.rmSync('./dist', { recursive: true });
} catch(e) {
  if (e.code !== 'ENOENT') {
     throw e;
  }
}
