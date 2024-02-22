const fs = require('fs');

try {
  fs.rmSync('./build', { recursive: true });
} catch(e) {
  if (e.code !== 'ENOENT') {
     throw e;
  }
}
