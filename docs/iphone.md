# Rularea aplicației pe iPhone

Aplicația rulează pe iPhone prin **Expo Go**, o aplicație gratuită din App Store.
Nu este nevoie de Mac și nici de un cont Apple Developer plătit.

Telefonul încarcă aplicația de pe calculatorul pe care rulează proiectul, prin rețeaua Wi-Fi.
De aceea calculatorul trebuie să fie pornit și să ruleze `npm run dev` cât timp folosești aplicația.

## Ce îți trebuie

- iPhone cu o versiune recentă de iOS;
- calculatorul și iPhone-ul conectate la **aceeași rețea Wi-Fi**;
- Docker Desktop pornit pe calculator;
- fișierul `.env` completat (vezi `README.md`).

## Pașii

1. **Instalează Expo Go** pe iPhone, din App Store (caută „Expo Go”).
2. **Pornește proiectul pe calculator.** În VS Code, deschide un terminal în folderul `MoveMeal-MM` și rulează:

   ```bash
   npm run dev
   ```

   Comanda pornește baza de date, serverul și aplicația. Așteaptă până apare un **cod QR** în terminal.
3. **Scanează codul QR** cu aplicația **Cameră** a iPhone-ului. Apasă pe notificarea „Deschide în Expo Go”.
4. La prima deschidere, iPhone-ul întreabă dacă Expo Go poate **găsi dispozitive în rețeaua locală**.
   Alege **Permite**. Fără această permisiune, telefonul nu poate ajunge la calculator.
5. Prima încărcare durează aproximativ 30 de secunde. Apoi creează un cont sau autentifică-te.

Când modifici codul și salvezi, aplicația de pe telefon se actualizează singură.

## Dacă ceva nu merge

| Problemă | Ce să faci |
|---|---|
| „Nu ne putem conecta la server” | Verifică dacă telefonul și calculatorul sunt în aceeași rețea Wi-Fi. În Safari pe iPhone deschide adresa afișată de `npm run dev` (de forma `http://192.168.x.x:3000/api/health`); trebuie să apară `"status":"ok"`. |
| Ai refuzat accesul la rețeaua locală | Pe iPhone: **Setări → Expo Go → Rețea locală** și activează opțiunea. |
| Codul QR nu se deschide sau se încarcă la nesfârșit | Unele routere (sau rețelele pentru oaspeți) blochează comunicarea dintre dispozitive. Încearcă altă rețea Wi-Fi sau pornește hotspotul de pe iPhone și conectează calculatorul la el. |
| Windows întreabă dacă Node.js are voie să acceseze rețeaua | Alege **Permite**, inclusiv pentru rețelele publice. |

## Mai târziu: instalare ca aplicație separată

Pentru ca MoveMeal să apară ca aplicație obișnuită pe iPhone, fără Expo Go și fără calculatorul pornit, sunt necesare:

1. un **cont Apple Developer** (99 $ pe an);
2. serverul publicat pe internet (cu domeniu și HTTPS, conform cerințelor din Laboratorul 2);
3. construirea aplicației cu **EAS Build** (serviciul Expo, funcționează și fără Mac) și distribuirea prin **TestFlight**.

Proiectul este deja pregătit pentru acest pas: are identificatorul `md.movemeal.app` și adresa serverului poate fi setată
prin variabila `EXPO_PUBLIC_API_URL`.
