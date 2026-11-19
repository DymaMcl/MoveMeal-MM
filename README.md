# MoveMeal

Aplicație mobilă (Android și iOS) pentru personalizarea antrenamentelor și a alimentației
în funcție de caracteristicile fizice, obiectivele și preferințele fiecărui utilizator,
cu posibilitatea de programare la un nutriționist licențiat.

Proiect de licență – Universitatea Tehnică a Moldovei, FCIM.

## Structura

| Director | Conținut |
|---|---|
| `apps/mobile` | Aplicația mobilă – Expo / React Native, TypeScript |
| `apps/api` | Serverul de aplicație – NestJS, TypeScript |
| `packages/shared` | Logica și tipurile comune (calculul necesarului energetic, validarea obiectivelor) |

Ulterior: site web separat pentru blog, panoul administratorului și panoul nutriționistului.

## Cerințe

- Node.js 24+
- Android Studio cu un emulator Android (sau un telefon cu aplicația Expo Go)
- Docker Desktop – pentru baza de date PostgreSQL

## Pornire

```bash
npm install

# 1. baza de date (o singură dată: completează parolele în .env)
cp .env.example .env   # POSTGRES_PASSWORD și APP_DB_PASSWORD
docker compose up -d
npm run db:migrate --workspace=@movemeal/api

# 2. serverul (http://localhost:3000/api/health)
npm run api

# 3. aplicația mobilă (în terminal apasă „a” pentru emulatorul Android)
npm run mobile
```

Aplicația se conectează la serverul de pe același calculator pe care rulează Expo (portul 3000).
Adresa poate fi schimbată cu variabila `EXPO_PUBLIC_API_URL`.

Pe iPhone: instalează **Expo Go** din App Store și scanează codul QR afișat de `npm run mobile`
(telefonul și calculatorul trebuie să fie în aceeași rețea).

## Teste

```bash
npm test                                                     # testele unitare
npm run test:e2e --workspace=@movemeal/api                   # testele de integrare (necesită baza de date)
npm run typecheck                                            # verificarea tipurilor
```

## Stadiul actual

- [x] Calculul necesarului energetic (Mifflin-St Jeor) și al macronutrienților
- [x] Verificarea obiectivului de greutate și sugerarea unei perioade realiste
- [x] Ecran de bun venit, înregistrare și autentificare
- [x] Chestionarul inițial: date personale, înălțime și greutate, obiectiv, greutate dorită, nivel de activitate
- [x] Pagina „Acasă”: salut personalizat, obiectiv caloric, macronutrienți, recomandarea zilei
- [x] Interfață în română și engleză
- [x] Temă luminoasă și întunecată, alegere din setări
- [x] Server NestJS: `GET /api/health`, `POST /api/energy/plan`
- [x] Conturi și sesiuni pe server (parole scrypt, blocare după 5 încercări greșite)
- [x] PostgreSQL cu Row Level Security: fiecare utilizator accesează doar datele proprii
- [x] Profilul salvat pe server: `GET/PUT /api/me/profile`
- [ ] Programul de antrenament
- [ ] Planul alimentar și rețetele
- [ ] Jurnalul alimentar și recunoașterea alimentelor din fotografie
- [ ] Nutriționist și programări
- [ ] Blog, asistent virtual, panourile de administrare
