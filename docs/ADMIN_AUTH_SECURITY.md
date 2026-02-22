# Admin auth – Kalpsite password and game-only access

Kalpsite admin uses **its own username/password** for the login form. It does **not** use the Nakama Console (Dashboard) password. Only **game sessions** can call the game backend; console users cannot.

---

## 1. Kalpsite has its own password

- You log in to **Kalpsite Admin** with **KALPSITE_ADMIN_USERNAME** and **KALPSITE_ADMIN_PASSWORD** (set in `.env`).
- These are **not** the Nakama Console credentials. So the same person who can open the Nakama Dashboard does not automatically have Kalpsite access unless you give them the Kalpsite password (or use the same string by choice).
- You can change the Kalpsite password anytime by updating `KALPSITE_ADMIN_PASSWORD` and restarting Kalpsite.

---

## 2. Who can access the game backend?

- **Game backend** (NAKAMA_URL, e.g. port 7350) is only called with **game session tokens** (from `/v2/account/authenticate/email` or other game auth).
- **Game players** get a game session when they sign in (email, device, etc.) and use it for all game RPCs.
- **Kalpsite admin** gets a game session by having the backend authenticate the **admin game user** (NAKAMA_ADMIN_EMAIL / NAKAMA_ADMIN_PASSWORD) after you pass the Kalpsite login. That token is stored in a cookie and used for admin RPCs.
- **Nakama Console users** (Dashboard, port 7351) use the **Console API**, not the game API. They do **not** get a game session and **cannot** call game RPCs with their console token. So console login does not grant access to the game backend; only game sessions do.

So: **only game players** (and the admin game user when logged in via Kalpsite) have a game session and can hit the game backend. Console-only users cannot.

---

## 3. What you need to do

### Create an admin game user in Nakama

1. In your game (or Nakama Console → Users), create a user with **email** and **password** (e.g. `admin@example.com`).
2. Set that user’s **metadata** to include **`is_admin: true`** (or the string `"true"`).
3. Use that email and password in Kalpsite env (see below). You do **not** need to put the user’s UUID in env anymore.

### Configure Kalpsite `.env`

- **KALPSITE_ADMIN_USERNAME** – Username for the Kalpsite login form (e.g. `admin`).
- **KALPSITE_ADMIN_PASSWORD** – Password for the Kalpsite login form (choose a strong value).
- **NAKAMA_ADMIN_EMAIL** – Email of the Nakama user that has `is_admin: true`.
- **NAKAMA_ADMIN_PASSWORD** – That user’s password (so the backend can get a game session for them).
- **NAKAMA_URL** – Game server URL (e.g. `http://127.0.0.1:7350`).
- **NAKAMA_SERVER_KEY** – Server key (for authenticating the admin user).

You do **not** need **NAKAMA_CONSOLE_URL** or **NAKAMA_ADMIN_USER_ID** for Kalpsite admin.

### Log in to Kalpsite

1. Open Kalpsite → Admin → log in with **KALPSITE_ADMIN_USERNAME** and **KALPSITE_ADMIN_PASSWORD**.
2. Admin actions (store, sync, etc.) run as the admin game user; the backend checks `is_admin` on that user.

---

## 4. Security summary

- **Kalpsite password is separate** – Not tied to Nakama Console; you control it in env.
- **No console dependency** – Admin RPCs call the game API with a game token only.
- **Backend only sees game sessions** – Only game players (and the admin game user when logged in via Kalpsite) can call game RPCs.
- **Revocation** – Remove `is_admin` from the admin user or change **KALPSITE_ADMIN_PASSWORD** to revoke or restrict access.
