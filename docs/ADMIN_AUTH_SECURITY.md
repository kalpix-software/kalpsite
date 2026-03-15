# Admin auth – login only, verified from Nakama DB

Kalpsite admin has **no registration**. You create admin accounts **manually** in Nakama (Dashboard, API Explorer, or Postman), set **`is_admin: true`** in account metadata, then **log in** on Kalpsite with that account’s email and password. Kalpsite verifies that the user has `is_admin` in Nakama; if not, login is rejected.

---

## 1. How it works

- **Create the admin account** in Nakama (see below). Set **`is_admin: true`** in the user’s account metadata.
- **Log in on Kalpsite** at `/admin/login` with that account’s **email** and **password**.
- Kalpsite calls the game backend **auth/login_email** (same as Plazy). The backend returns **isAdmin** from the user’s account metadata in the login response (no extra RPC). If **isAdmin** is not true, Kalpsite returns **403** and does not set the session cookie.
- So: **only users with `is_admin` in Nakama account metadata** can access Kalpsite admin.

---

## 2. Creating an admin account (manual, no Kalpsite registration)

Create the player account in Nakama using one of:

- **Nakama Dashboard** – create user and set metadata.
- **API Explorer** – e.g. authenticate or add user, then update account metadata.
- **Postman** – call the game backend (e.g. register + verify, or use Console API to create user and set metadata).

Then ensure the user has **`is_admin: true`** in **account metadata**:

- In Nakama Console: **Users** → select user → **Metadata** → add `is_admin: true` (or `"true"`).
- Or use the backend: set **ADMIN_EMAIL** in kalpix-backend `.env` so the backend sets `is_admin` when a user registers or verifies with that email (see set_admin in backend).

There is **no registration or OTP flow on the Kalpsite login page**; admin accounts are always created outside Kalpsite.

---

## 3. Kalpsite `.env`

- **NAKAMA_URL** – Game server URL (e.g. `http://127.0.0.1:80` or `https://api.kalpixsoftware.com` in production).
- **NAKAMA_SERVER_KEY** – Server key (if needed by your setup).

---

## 4. Log in to Kalpsite

1. Open Kalpsite → **Admin** → **Login**.
2. Enter the **email** and **password** of a game user that has **`is_admin`** in metadata (created as above).
3. If the user does not have `is_admin`, you will see **“Not an admin account”** and login will fail.

---

## 5. Security summary

- **No registration on Kalpsite** – Admin accounts are created manually in Nakama.
- **Login only** – Kalpsite only offers login; admin is verified from Nakama DB (`is_admin` in account metadata).
- **Revocation** – Remove `is_admin` from the user in Nakama to revoke Kalpsite admin access.

---

## 6. "Not an admin account" – how to fix

If you see **"Not an admin account. Your account must have admin access in the game backend"**, the user exists and login worked, but the account does **not** have **`is_admin`** in Nakama account metadata. Use one of these:

### Option A: Set `is_admin` in Nakama (recommended for manually created accounts)

1. Open **Nakama Console** (e.g. `http://localhost:7351`).
2. Go to **Users** and find the user (by email or ID).
3. Open the user and edit **Metadata** (JSON). Add:
   ```json
   "is_admin": true
   ```
   If metadata is empty, use: `{"is_admin": true}`. If it already has other keys, add `"is_admin": true` to the same JSON.
4. Save. Log in again on Kalpsite.

### Option B: Use backend `ADMIN_EMAIL` (if the account has that email)

1. Ensure the user’s **email** is stored somewhere the backend can see it:
   - **Game-registered users:** Backend `users` table already has their email.
   - **Manually created users:** Add **`"email": "your@email.com"`** to the user’s **Nakama account metadata** (same place as above).
2. In **kalpix-backend** `.env`, set **`ADMIN_EMAIL`** to that exact email (e.g. `ADMIN_EMAIL=admin@example.com`).
3. Restart the backend, then **log in again on Kalpsite**. The backend will set `is_admin` when the email matches and the next login will succeed.
