# Set up customer reviews

The website is a static GitHub Pages site. Customers submit reviews without creating an account. Supabase keeps new reviews pending until an authorized admin approves them. The browser uses the official Supabase JavaScript client and a **publishable** key; never place a `secret` key, `service_role` key, database password, or other privileged credential in this project.

## 1. Apply the database migration

1. Open the Supabase project and go to **SQL Editor**.
2. Open `supabase/migrations/202610130001_reviews.sql` in this project, copy the entire file, paste it into a new SQL query, and run it.
3. In **Table Editor**, confirm `reviews` and `review_admins` exist and that Row Level Security is enabled on both.

The migration does not delete review rows. It recreates policies on the two review-specific tables so an old permissive policy cannot remain alongside the new rules. If you already have tables with these names for another purpose, stop and inspect them before running the migration. On a new/unused project, and when rerun against these feature tables, it is safe to run: it creates or keeps the tables and resets their review policies and grants.

The rules allow visitors to read approved reviews only and insert only the review fields. New rows default to `pending`, and database privileges prevent visitors from setting or updating `status`. Only signed-in users listed in `review_admins` can see all statuses, update status, or delete a review.

## 2. Add the public Supabase settings

1. In Supabase, open **Project Settings → API Keys** (or the **Connect** dialog).
2. Copy the **Project URL** and the **publishable key** whose name starts with `sb_publishable_`.
3. Open `supabase-config.js` and put those values in `url` and `publishableKey`:

   ```js
   window.NAILSDOKUMA_SUPABASE_CONFIG = {
     url: 'https://YOUR-PROJECT.supabase.co',
     publishableKey: 'sb_publishable_YOUR_PUBLIC_KEY'
   };
   ```

These two values are public browser settings. Do not use the `secret` or `service_role` key. No customer account or sign-up is needed for review submissions.

## 3. Create and authorize Oksana’s admin account

1. In Supabase, open **Authentication → Users → Add user**. Create the admin account using Oksana’s email and a strong password. Do not enable public sign-ups just for reviews.
2. Copy the new user’s **User UID** from the Users table.
3. In **SQL Editor**, authorize only that account:

   ```sql
   insert into public.review_admins (user_id)
   values ('PASTE-ADMIN-USER-UID-HERE')
   on conflict do nothing;
   ```

4. Confirm that one row with that UID appears in `review_admins`. Do not give `anon` or ordinary `authenticated` users write access to this table.

The admin page authenticates with Supabase Auth and checks that the signed-in user is listed in `review_admins`. The database independently enforces the same membership check through RLS, so changing the page code cannot grant moderation rights.

## 4. Test locally before deployment

A browser cannot load the JavaScript modules correctly from a `file://` URL. Run a small local web server instead:

1. Open PowerShell in the project folder.
2. Run `py -m http.server 8000` and leave that window open.
3. Visit `http://localhost:8000/` for the public site and `http://localhost:8000/admin.html` for the admin page.
4. On the public page, submit a review while signed out. It should report that the review is awaiting approval. In Supabase **Table Editor → reviews**, confirm its status is `pending`; it must not appear in the public reviews list.
5. Sign in as Oksana at `/admin.html`, approve that review, and reload the public page. It should now appear. Also test rejecting a different pending review, viewing each status tab, deleting a test review, and signing out.
6. Test as a signed-out visitor and, if available, a separate ordinary Supabase user that is not in `review_admins`. The admin dashboard must not give that user moderation access. Do not grant the test user admin membership.
7. Switch the public site between Turkish and Ukrainian. Turkish is the default; no Russian translation is included.
8. Stop the local server with Ctrl+C when finished.

For a direct database audit after applying the migration, run this in SQL Editor and confirm there are only the expected policies for these two tables:

```sql
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('reviews', 'review_admins')
order by tablename, policyname;
```

The key behavior to verify is: an anonymous visitor can insert a pending review, cannot select pending/rejected rows, and cannot update or delete rows; a signed-in non-admin still cannot moderate; the admin UID can moderate.

## 5. Deploy later

Keep these changes local until you are ready to deploy. When you explicitly approve deployment, publish the project files through the branch/folder already configured for GitHub Pages. For a project Pages URL such as `https://OWNER.github.io/REPOSITORY/`, the admin page will be at `https://OWNER.github.io/REPOSITORY/admin.html`. The relative links in the pages work under that repository path.

## What the spam protection does

The form checks name, rating, and review text lengths, includes a hidden honeypot, and applies a short per-browser cooldown. A database trigger also rejects an identical name and review text submitted within five minutes. These are basic protections, not IP-based rate limiting; stronger bot protection would need a server-side endpoint such as a Supabase Edge Function. Admin authentication and moderation do not require that extra server because Supabase Auth and the RLS policies enforce them.