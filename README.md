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

## Roluri

Orice cont nou are rolul „utilizator”. Primul administrator se stabilește din linia de comandă
(contul trebuie să existe deja):

```bash
npm run user:role --workspace=apps/api -- email@exemplu.md admin
```

Apoi administratorul poate face alte conturi nutriționist sau administrator din panoul său
(meniul cu 3 linii → „Panoul administratorului” → „Conturi”).

## Asistentul AI și fotografierea mesei (Google Gemini)

Cheia se obține gratuit din [Google AI Studio](https://aistudio.google.com/apikey) și se pune în
`.env` (fișierul nu se trimite pe GitHub):

```bash
GEMINI_API_KEY=cheia-ta
```

- Cheia rămâne pe server; aplicația mobilă nu o cunoaște.
- Modelele implicite sunt `gemini-3.5-flash-lite` (chat) și `gemini-3.5-flash` (fotografii); se pot
  schimba cu `GEMINI_CHAT_MODEL` și `GEMINI_VISION_MODEL`. Dacă modelul principal nu răspunde în
  câteva secunde, serverul pornește în paralel modelul de rezervă și folosește primul răspuns valid.
- Modelului i se trimit doar prenumele, datele din profil, ținta și jurnalul zilei (fără e-mail).
  Fotografia mesei este micșorată pe telefon și nu se salvează pe server (decât dacă utilizatorul o
  publică); se păstrează doar alimentele recunoscute, iar valorile din jurnal sunt calculate pe server.
- Utilizatorul poate descrie masa în câteva cuvinte, poate corecta un aliment recunoscut greșit (din
  catalog sau după denumire, cu valorile estimate de AI) și poate adăuga alimente lipsă.
- Limita zilnică pe utilizator (implicit 60 de întrebări și 15 fotografii) se modifică din panoul
  administratorului.
- Fără cheie (sau dacă Gemini nu răspunde), asistentul folosește răspunsurile din regulile aplicației,
  iar fotografierea mesei trimite la adăugarea manuală.
- Pe nivelul gratuit, Google poate folosi datele trimise pentru a-și îmbunătăți produsele; pe nivelul
  plătit, nu.

## Adăugarea rapidă în jurnal

- **Cod de bare**: camera telefonului citește codul (EAN-13, EAN-8, UPC), iar serverul caută produsul în
  [Open Food Facts](https://world.openfoodfacts.org) (bază de date deschisă, licența ODbL). Produsul găsit
  se păstrează în tabela `products`, ca următoarea scanare să nu mai depindă de serviciul extern; codurile
  negăsite nu se cer din nou timp de o oră. Codul se poate introduce și manual.
- **Produse proprii**: un produs negăsit se adaugă cu valorile de pe etichetă; tabelul nutrițional poate fi
  citit de AI dintr-o fotografie, iar utilizatorul verifică valorile înainte de salvare. Produsele proprii
  sunt vizibile doar autorului (Row Level Security), iar valorile din jurnal se calculează pe server.
- **Descrie masa**: utilizatorul scrie sau dictează (cu microfonul tastaturii) ce a mâncat, iar Gemini
  împarte descrierea în alimente cu gramaje; rezultatul se verifică și se corectează ca la fotografie.
- **Mesele mele**: alimentele unei mese din jurnal se salvează și se adaugă apoi dintr-o atingere.
- **Copiere**: o masă din ziua precedentă, o masă în ziua de azi sau toată ziua de ieri.
- **Calorii rapide**: doar numărul de calorii (de exemplu la restaurant), cu macronutrienți opționali.
- **Închide ziua**: bilanțul față de necesarul zilnic și prognoza „dacă fiecare zi ar fi ca azi”, pe 5
  săptămâni (7700 kcal ≈ 1 kg). Sub minimul sigur (1200/1500 kcal) prognoza nu se afișează, iar aplicația
  explică riscurile unei restricții prea mari.

## Comunitate, blog și profil

- **Comunitate** (tab separat): fotografii cu mese și activități sportive, ca idei pentru ceilalți;
  aprecieri, salvări și raportări. Fiecare postare poate fi privată (doar în albumul propriu) sau
  publică (și în comunitate).
- **Verificarea automată (Gemini)**: înainte de salvare, fotografia este verificată pentru conținut
  pentru adulți, violență, droguri sau text jignitor; în comunitate se acceptă doar imagini legate de
  alimentație și sport. Dacă serviciul AI nu răspunde, postarea publică așteaptă aprobarea unui
  administrator. După 3 raportări, postarea dispare automat din comunitate până la verificare.
- **Profilul**: fotografie, nume afișat, descriere, albumul, „Salvate” (postări și articole) și
  procentul atins din obiectiv (slăbire/creștere: din greutate; menținere/masă musculară: din jurnal
  și antrenamente). Ceilalți văd doar procentul, fără date de sănătate, și doar dacă utilizatorul
  permite.
- **Blog**: articole scrise de nutriționiști și administratori (ciornă, publicare, copertă,
  categorii, căutare). Cititorii apreciază și salvează articolele; fiecare articol arată numărul de
  persoane care l-au citit (fiecare cititor este numărat o singură dată, fără să se afișeze cine).
- Fotografiile se păstrează în PostgreSQL (tabela `media`) și sunt servite doar prin
  `GET /api/media/:id`, cu verificarea accesului prin Row Level Security.

## Panoul administratorului

- Tablou de bord: conturi (noi, active, blocate), activitatea pe 14 zile, comunitate, verificarea
  automată, utilizarea AI, blogul (cele mai citite articole) și programările.
- Conturi: căutare după nume sau e-mail, filtre după rol și stare, fișa contului (activitate fără date
  de sănătate), schimbarea rolului, blocare cu motiv, deconectare de pe toate dispozitivele, deblocarea
  autentificării.
- Moderare: postări în așteptare, raportate și ascunse; aprobare, ascundere cu motiv (autorul primește
  notificare), respingerea raportărilor, ștergere definitivă.
- Blog: toate articolele, fixare sus, arhivare, republicare, modificare, ștergere.
- Anunțuri: notificare trimisă tuturor conturilor sau doar utilizatorilor / nutriționiștilor.
- Jurnalul acțiunilor (cu filtre) și parametrii: comunitate activă, verificare manuală, limitele de
  postări și AI, oferta primei consultații.

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
- [x] Interfață în română, engleză și rusă (inclusiv catalogul de alimente, rețete și exerciții)
- [x] Temă luminoasă și întunecată și culoarea interfeței (albastru, roz, roșu, verde), din setări
- [x] Server NestJS: `GET /api/health`, `POST /api/energy/plan`
- [x] Conturi și sesiuni pe server (parole scrypt, blocare după 5 încercări greșite)
- [x] PostgreSQL cu Row Level Security: fiecare utilizator accesează doar datele proprii
- [x] Profilul salvat pe server: `GET/PUT /api/me/profile`
- [x] Programul de antrenament: chestionar (loc, nivel, zile, echipament, sporturi, limitări, accent),
      generator automat, calendarul săptămânii, bifarea exercițiilor efectuate
- [x] Biblioteca de exerciții (50 de exerciții, pe grupe musculare și dificultate)
- [x] Rulare pe iPhone prin Expo Go
- [ ] Animații proprii pentru exerciții (acum: alternarea pozițiilor de start și final)
- [x] Planul alimentar pe 7 zile: dietă, cei 14 alergeni, alimente excluse și preferate, buget, 3–5 mese;
      porții 0,5–2, totalul zilei în ±5% față de țintă, proteine între 90% din țintă și 2,0 g/kg
- [x] Rețete cu valori, alergeni și diete calculate din ingrediente; înlocuirea ingredientelor
- [x] Alternative pentru o masă, regenerarea unei zile sau a săptămânii, lista de cumpărături
- [x] Jurnalul alimentar: căutare (recente primele), grame sau bucăți, „Mâncat” din plan, ultimele 14 zile
- [x] Greutatea și apa; pagina „Progres” cu media pe 7 zile (4, 8, 12 săptămâni)
- [x] Ajustarea automată a țintei calorice (minimum 6 cântăriri, jurnal în 10 din 14 zile, ±5%)
- [x] Fotografierea mesei: Gemini recunoaște alimentele și estimează gramajul; utilizatorul corectează și salvează în jurnal
- [x] Cod de bare (Open Food Facts), produse proprii cu citirea etichetei de către AI
- [x] Descrierea mesei în cuvinte, mesele salvate, copierea mesei sau a zilei, calorii rapide
- [x] „Închide ziua”: bilanțul zilei și prognoza greutății pe 5 săptămâni
- [ ] Înregistrarea seriilor (greutate, repetări), cronometrul de pauză și recordurile personale
- [x] Roluri: utilizator, nutriționist, administrator (verificate pe server la fiecare cerere)
- [x] Meniul cu 3 linii (dreapta sus) cu toate paginile, în funcție de rol
- [x] Nutriționist și programări: profil, calendar liber, solicitare, anulare, prima consultație gratuită
- [x] Acordul de acces: nutriționistul vede planul și progresul doar cu acordul utilizatorului (RLS)
- [x] Panoul nutriționistului în aplicație: solicitări (confirmare, respingere, reprogramare), program
      săptămânal și zile libere, clienți, ajustarea țintei și a planului („ajustat de nutriționist”), profil
- [x] Panoul administratorului în aplicație: tablou de bord, conturi, moderare, blog, anunțuri, jurnal, parametri
- [x] Notificări în aplicație (programări, ajustări, moderare, anunțuri)
- [x] Cântar ponderal: IMC (clasificarea OMS), greutate sănătoasă, grăsime estimată, metabolism bazal, talie
- [x] Asistent (chat) cu Google Gemini, pe baza profilului și jurnalului zilei; fără AI răspunde din regulile aplicației
- [x] Blog: articole ale nutriționiștilor și administratorilor, aprecieri, salvări, numărul de cititori
- [x] Comunitate: postări cu mese și sport, verificare automată (AI), aprecieri, salvări, raportări
- [x] Profil public: album, salvate, procentul atins din obiectiv
- [ ] Notificări push și raportul săptămânal
- [ ] Site web separat pentru panourile de administrare și al nutriționistului
- [ ] Catalogul complet: 150 de exerciții, 200 de rețete
