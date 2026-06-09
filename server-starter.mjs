import { spawn } from 'child_process';

function startServer() {
  const now = new Date().toISOString();
  console.log(`[${now}] Starting Next.js dev server...`);
  
  const child = spawn('node', ['node_modules/.bin/next', 'dev', '-p', '3000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    cwd: '/home/z/my-project'
  });

  child.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  child.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  child.on('exit', (code, signal) => {
    const now2 = new Date().toISOString();
    console.log(`[${now2}] Server exited with code ${code}, signal ${signal}. Restarting in 3s...`);
    setTimeout(startServer, 3000);
  });
}

startServer();

// Keep the process alive
setInterval(() => {}, 60000);
