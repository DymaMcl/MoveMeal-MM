// Porneste tot mediul de dezvoltare cu o singura comanda: npm run dev
//  1. verifica porturile 3000 si 8081 (elibereaza procesele ramase din proiect)
//  2. baza de date PostgreSQL (Docker)
//  3. migrarile
//  4. serverul NestJS (port 3000)
//  5. Expo (afiseaza codul QR pentru telefon)
// La oprire (Ctrl+C sau inchiderea terminalului) se inchid toate procesele pornite.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';
const PORTS = { 3000: 'serverul', 8081: 'Expo' };

// Comenzile sunt fixe (fara date de la utilizator), deci pot fi rulate ca text in shell.
function run(commandLine, label) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(commandLine, { cwd: root, stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`\n✖ Pasul „${label}” a esuat.`);
    process.exit(result.status ?? 1);
  }
}

function docker() {
  if (spawnSync('docker --version', { shell: true }).status === 0) return 'docker';
  const desktop = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
  if (isWindows && existsSync(desktop)) return `"${desktop}"`;
  console.error('✖ Docker nu a fost gasit. Porneste Docker Desktop si incearca din nou.');
  process.exit(1);
}

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal && /^(192\.168|10\.)/.test(net.address)) {
        return net.address;
      }
    }
  }
  return null;
}

/** Inchide un proces impreuna cu toate procesele pornite de el. */
function killTree(pid) {
  if (!pid) return;
  if (isWindows) {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGTERM'); // grupul de procese (pornit cu detached: true)
    } catch {
      /* procesul s-a oprit deja */
    }
  }
}

/** Procesul care asculta pe un port: { pid, command } sau null. */
function portOwner(port) {
  if (isWindows) {
    const ps = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        `$c = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; ` +
          `if ($c) { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)"; "$($c.OwningProcess)|$($p.CommandLine)" }`,
      ],
      { encoding: 'utf8' },
    );
    const line = ps.stdout?.trim();
    if (!line) return null;
    const [pid, ...rest] = line.split('|');
    return { pid: Number(pid), command: rest.join('|') };
  }
  const lsof = spawnSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  const pid = Number(lsof.stdout?.trim().split('\n')[0]);
  if (!pid) return null;
  const ps = spawnSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  return { pid, command: ps.stdout?.trim() ?? '' };
}

/** Raspunde portul 3000 ca serverul MoveMeal (GET /api/health)? */
async function isMoveMealServer() {
  try {
    const res = await fetch('http://localhost:3000/api/health', { signal: AbortSignal.timeout(2000) });
    const body = await res.json();
    return body?.status === 'ok' && typeof body?.time === 'string';
  } catch {
    return false;
  }
}

/** Procesul de pe port este o instanta ramasa din acest proiect? */
async function isLeftover(port, command) {
  const projectDir = root.toLowerCase().replace(/\\/g, '/');
  const cmd = command.toLowerCase().replace(/\\/g, '/');
  if (cmd.includes(projectDir) || cmd.includes('movemeal')) return true;
  if (port === '3000') return isMoveMealServer();
  if (port === '8081') return cmd.includes('expo') && cmd.includes('node');
  return false;
}

/**
 * Daca un port este ocupat de un proces ramas din acest proiect (de exemplu dupa inchiderea
 * brusca a unui terminal), il inchide; altfel explica ce program ocupa portul.
 */
async function freePorts() {
  for (const [port, name] of Object.entries(PORTS)) {
    const owner = portOwner(port);
    if (!owner) continue;
    if (await isLeftover(port, owner.command)) {
      console.log(`  Portul ${port} (${name}) era ocupat de un proces ramas din MoveMeal. Il inchid.`);
      killTree(owner.pid);
      // Supraveghetorul „nest --watch” ramas poate reporni serverul; il inchidem si pe el.
      if (isWindows) {
        spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-Command',
            `Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ` +
              `Where-Object { $_.CommandLine -match 'nest\\.js.*start --watch' -and $_.ProcessId -ne ${process.pid} } | ` +
              `ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }`,
          ],
          { stdio: 'ignore' },
        );
      }
    } else {
      console.error(
        `✖ Portul ${port} (necesar pentru ${name}) este ocupat de alt program (PID ${owner.pid}):\n  ${owner.command}\n` +
          '  Inchide acel program si incearca din nou.',
      );
      process.exit(1);
    }
  }
}

if (!existsSync(join(root, '.env'))) {
  console.error('✖ Lipseste fisierul .env. Copiaza .env.example in .env si completeaza parolele.');
  process.exit(1);
}

console.log('▶ Verific porturile');
await freePorts();
run(`${docker()} compose up -d --wait`, 'Pornesc baza de date');
run('npm run db:migrate --workspace=@movemeal/api', 'Aplic migrarile');

const ip = lanAddress();
console.log('\n▶ Pornesc serverul si aplicatia');
if (ip) {
  console.log(`  Serverul va fi disponibil in retea la http://${ip}:3000/api/health`);
  console.log('  Telefonul trebuie sa fie conectat la aceeasi retea Wi-Fi ca acest calculator.');
}

// --preserveWatchOutput: serverul nu sterge ecranul (si codul QR afisat de Expo) la recompilare.
const api = spawn('npm run start:dev --workspace=@movemeal/api -- --preserveWatchOutput', {
  cwd: root,
  shell: true,
  detached: !isWindows,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const prefix = (chunk) =>
  chunk
    .toString()
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => `[server] ${line}`)
    .join('\n');
api.stdout.on('data', (c) => console.log(prefix(c)));
api.stderr.on('data', (c) => console.error(prefix(c)));

const mobile = spawn('npm run start --workspace=@movemeal/mobile', {
  cwd: root,
  shell: true,
  detached: !isWindows,
  stdio: 'inherit',
});

let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  console.log('\n▶ Opresc serverul si Expo...');
  killTree(api.pid);
  killTree(mobile.pid);
  process.exit(0);
}
// Ctrl+C, inchiderea terminalului (SIGHUP pe Windows) sau oprirea Expo.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(signal, stop);
process.on('exit', () => {
  if (!stopping) {
    killTree(api.pid);
    killTree(mobile.pid);
  }
});
mobile.on('exit', stop);
