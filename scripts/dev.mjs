// Porneste tot mediul de dezvoltare cu o singura comanda: npm run dev
//  1. baza de date PostgreSQL (Docker)
//  2. migrarile
//  3. serverul NestJS (port 3000)
//  4. Expo (afiseaza codul QR pentru telefon)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

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

if (!existsSync(join(root, '.env'))) {
  console.error('✖ Lipseste fisierul .env. Copiaza .env.example in .env si completeaza parolele.');
  process.exit(1);
}

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
  stdio: 'inherit',
});

const stop = () => {
  api.kill();
  mobile.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
mobile.on('exit', stop);
