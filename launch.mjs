import { spawn } from 'node:child_process';
import { createStudioServer, VERSION } from './server.mjs';

const argIndex = process.argv.indexOf('--port');
const firstPort = argIndex >= 0 ? Number(process.argv[argIndex + 1]) : 4173;
const noBrowser = process.argv.includes('--no-browser');
if (!Number.isInteger(firstPort) || firstPort < 1024 || firstPort > 65525) {
  console.error('Choose a port from 1024 to 65525.'); process.exit(1);
}

async function start() {
  for (let port = firstPort; port < firstPort + 10; port++) {
    const server = createStudioServer();
    try {
      await new Promise((resolve, reject) => {
        server.once('error', reject); server.listen(port, '127.0.0.1', resolve);
      });
      const url = `http://127.0.0.1:${port}/`;
      console.log(`\n  LIGHTFIELD / 3D Portrait Lighting Studio v${VERSION}\n\n  ${url}\n\n  Works entirely offline. Keep this window open while using the studio.\n  Close this window or press Ctrl+C to stop.\n`);
      if (!noBrowser) {
        const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
        const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
        const browser = spawn(command, args, { detached:true, stdio:'ignore', windowsHide:true });
        browser.on('error', () => console.log(`Open this address in your browser: ${url}`)); browser.unref();
      }
      process.on('SIGINT', () => server.close(() => process.exit(0)));
      process.on('SIGTERM', () => server.close(() => process.exit(0)));
      return;
    } catch (error) {
      server.close();
      if (error.code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('Ports are busy. Try: node launch.mjs --port 4200');
}
start().catch(error => { console.error(error.message); process.exitCode = 1; });
