# SuperAdmin Dashboard & Nastavení Uživatelů - Plán implementace

Tento plán popisuje propojení hotového SuperAdmin backendu s Next.js frontendem, zahrnuje kompletní lokalizaci do češtiny a přidává novou funkcionalitu pro úpravu e-mailu a hesla běžnými uživateli (s automatickým propsáním změn do `user_vault` pro SuperAdmina).

## Fáze 1: Rozšíření Backend API (apps/server)

**Cíl:** Rozšířit stávající SuperAdmin API a přidat bezpečné API pro úpravu uživatelských údajů, které synchronizuje heslo s trezorem.

*   [ ] **Krok 1.1: Úprava uživatelských údajů (`PUT /api/user/settings`)**
    *   **Akce:** Vytvořit nový endpoint pro běžné uživatele.
    *   **Logika (Email):** Pokud payload obsahuje `email`, zavolat Supabase Admin API (`admin.updateUserById`) pro aktualizaci e-mailu v `auth.users` a následně updatovat `profiles` tabulku.
    *   **Logika (Heslo):** Pokud payload obsahuje `password`, zavolat Supabase Admin API pro změnu hesla v `auth.users`. Následně vzít toto *nové čisté heslo*, zašifrovat ho (použitím existující `crypto` utility) a přepsat starý záznam v tabulce `user_vault`.
    *   **Ověření:** Změnit heslo a email přes API. Zkontrolovat přes SuperAdmin `/vault/reveal`, že se po dešifrování zobrazí *nové* heslo.

*   [ ] **Krok 1.2: SuperAdmin Data Fetching (`GET /api/superadmin/users`)**
    *   **Akce:** Vytvořit/upravit endpoint pro zisk seznamu všech uživatelů včetně jejich e-mailu, plného jména a stavu (`unassigned`, `sub`).
    *   **Ověření:** API musí vrátit JSON pole profilů.

## Fáze 2: Frontend Data Access & Hooks (apps/web)

**Cíl:** Připravit React Hooks pro bezproblémové napojení na backend s využitím přihlašovacího JWT tokenu.

*   [ ] **Krok 2.1: Zabezpečený API Klient**
    *   **Akce:** Vytvořit pomocnou funkci (např. `src/lib/api-client.ts`), která ke každému požadavku automaticky přiloží Supabase session token do hlavičky `Authorization: Bearer <token>`.
*   [ ] **Krok 2.2: React Hooks**
    *   **Akce:** Vytvořit hooky `useSuperAdminUsers`, `useClaimUser`, `useRevealPassword` a `useUpdateAppConfig` pracující s novým API klientem.

## Fáze 3: Frontend UI - SuperAdmin Dashboard (`/superadmin`)

**Cíl:** Sestavit UI pro kontrolu nad systémem. **Vše musí být výhradně v češtině.**

*   [ ] **Krok 3.1: Seznam uživatelů (Volní a Podřízení)**
    *   **Akce:** Načíst data a rozdělit je na dvě tabulky: "Čekající na přiřazení" a "Moji podřízení".
*   [ ] **Krok 3.2: Tlačítko "Přiřadit"**
    *   **Akce:** K volným uživatelům přidat tlačítko "Přiřadit". Po kliknutí zavolá `/api/superadmin/claim/:id` a přesune uživatele do tabulky podřízených.
*   [ ] **Krok 3.3: Tlačítko "Zobrazit heslo" (Ikona oka)**
    *   **Akce:** V tabulce podřízených i volných uživatelů přidat ikonku oka. Po kliknutí se zavolá `/api/superadmin/vault/reveal/:id` a heslo se zobrazí.
*   [ ] **Krok 3.4: Konfigurace Modulů**
    *   **Akce:** Pro každého podřízeného zobrazit přepínače pro "Chat", "Úkoly" a "Galerii". Přepnutí okamžitě zavolá PATCH endpoint a upraví JSON v databázi.

## Fáze 4: Frontend UI - Nastavení Uživatelů (`/settings`)

**Cíl:** Implementovat obrazovku, kde si může běžný uživatel i DOM měnit přihlašovací údaje.

*   [ ] **Krok 4.1: Formulář pro změnu údajů**
    *   **Akce:** Na stránce `/settings` vytvořit formulář s poli "Nový e-mail" a "Nové heslo".
    *   **Akce:** Formulář napojit na endpoint `PUT /api/user/settings` z Kroku 1.1.
    *   **Akce:** Po úspěšném odeslání zobrazit "toast" notifikaci se zprávou "Údaje byly úspěšně změněny".
    *   **Ověření:** Zkusit si změnit heslo jako obyčejný uživatel a následně zkontrolovat jako DOM v SuperAdmin Dashboardu, že DOM vidí toto nové heslo.

*   [ ] **Krok 4.2: Fáze 1 & Auth hotovo**
    *   **Poznámka:** Zbytek SuperAdmin a řízení rolí dokončíme v pozdější fázi. Považujte Fázi 1 a auth scaffolding za převážně hotové.
