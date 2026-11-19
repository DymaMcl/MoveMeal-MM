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

Prima dată:

```bash
npm install
cp .env.example .env   # completează POSTGRES_PASSWORD și APP_DB_PASSWORD
```

Apoi, de fiecare dată, cu Docker Desktop pornit:

```bash
npm run dev
```

Comanda pornește baza de date, aplică migrările, pornește serverul (portul 3000) și Expo.
În terminalul Expo apasă **a** pentru emulatorul Android sau scanează codul QR cu telefonul.

- **iPhone:** vezi [docs/iphone.md](docs/iphone.md) (prin Expo Go, fără Mac).
- **Android:** instalează Expo Go din Play Store și scanează codul QR din aplicație.

Aplicația se conectează la serverul de pe calculatorul pe care rulează Expo.
Adresa poate fi schimbată cu variabila `EXPO_PUBLIC_API_URL`.

Părțile pot fi pornite și separat: `npm run api`, `npm run mobile`,
`npm run db:migrate --workspace=@movemeal/api`.

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
- [x] Programul de antrenament: chestionar (loc, nivel, zile, echipament, sporturi, limitări, accent),
      generator automat, calendarul săptămânii, bifarea exercițiilor efectuate
- [x] Biblioteca de exerciții (50 de exerciții, pe grupe musculare și dificultate)
- [x] Rulare pe iPhone prin Expo Go
- [ ] Animații proprii pentru exerciții (acum: alternarea pozițiilor de start și final)
- [ ] Planul alimentar și rețetele
- [ ] Jurnalul alimentar și recunoașterea alimentelor din fotografie
- [ ] Nutriționist și programări
- [ ] Blog, asistent virtual, panourile de administrare
