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

# aplicația mobilă (în terminal apasă „a” pentru emulatorul Android)
npm run mobile

# serverul (http://localhost:3000/api/health)
npm run api

# baza de date
cp .env.example .env   # completează POSTGRES_PASSWORD
docker compose up -d
```

Pe iPhone: instalează **Expo Go** din App Store și scanează codul QR afișat de `npm run mobile`.

## Teste

```bash
npm test            # toate testele
npm run typecheck   # verificarea tipurilor
```

## Stadiul actual

- [x] Calculul necesarului energetic (Mifflin-St Jeor) și al macronutrienților
- [x] Verificarea obiectivului de greutate și sugerarea unei perioade realiste
- [x] Ecran de bun venit, înregistrare și autentificare (interfață; conectarea la server urmează)
- [x] Chestionarul inițial: date personale, înălțime și greutate, obiectiv, greutate dorită, nivel de activitate
- [x] Pagina „Acasă”: salut personalizat, obiectiv caloric, macronutrienți, recomandarea zilei
- [x] Interfață în română și engleză
- [x] Server NestJS: `GET /api/health`, `POST /api/energy/plan`
- [ ] Conturi și sesiuni pe server, PostgreSQL cu Row Level Security
- [ ] Programul de antrenament
- [ ] Planul alimentar și rețetele
- [ ] Jurnalul alimentar și recunoașterea alimentelor din fotografie
- [ ] Nutriționist și programări
- [ ] Blog, asistent virtual, panourile de administrare
