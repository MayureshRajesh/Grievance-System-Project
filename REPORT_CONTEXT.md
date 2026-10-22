# Project Context: Campus Grievance Redressal System (for DBMS course review report)

> Instructions for the AI reading this: use this context to help write a review/report for a **Database Systems** course. Facts below are taken from the project's source code. Items marked **(verify)** are not visible in the code; the real schema, constraints, indexes and RLS policies were dumped from Supabase and are included at the bottom of this file (section 'Schema dump'), so treat that dump as the source of truth over any assumption. Focus the report on database design, data modelling, queries, integrity, security, consistency and cloud storage.

---

## 1. What the project is

A web application for a university campus (VIT) where students lodge grievances (complaints) about campus facilities, and staff track and resolve them.

- **Students** file grievances with a title, category, location, description, privacy setting and an optional image/PDF attachment, then follow progress and chat with staff.
- **Department admins** see grievances for their department (category), change status, reply publicly and write private internal notes.
- **Supervisors** (chief admins) see all departments, can filter by category/status, and can "ping" (escalate) a grievance to department admins.

## 2. Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7, React Router 7, lucide-react icons |
| Database | **Supabase (managed PostgreSQL)** accessed with `@supabase/supabase-js` |
| Authentication | Supabase Auth (email + password) |
| Backend API | Node.js + Express 5 (`server.js`), deployed as a **Vercel serverless function** (`api/[...path].js`) |
| File storage | **Supabase Storage** bucket `grievance-images` **and** **AWS S3** bucket (redundant copies) |
| Cloud services | AWS S3 (presigned uploads, tag-based lifecycle rule to Glacier Instant Retrieval), AWS SNS (email notifications), AWS CloudWatch (custom metrics + live dashboard), AWS CloudTrail (audit logging of AWS API activity), AWS Comprehend (sentiment-based priority; implemented but paid, so optional) |
| Hosting | Vercel (frontend static build + `/api/*` serverless routes, SPA rewrites in `vercel.json`) |

## 3. Database: tables and columns (as used in code)

The database is PostgreSQL hosted by Supabase. Five relations exist in `public` (plus `auth.users`): `grievances`, `comments`, `internal_notes`, `profiles`.

### 3.1 `grievances` (core entity)
Columns written/read by the app:

| Column | Meaning | Notes from code |
|---|---|---|
| `id` | Primary key | `uuid`, default `gen_random_uuid()` |
| `user_id` | The student who filed it | FK `grievances_user_id_fkey` → `auth.users(id)` |
| `user_email` | Student email | **Denormalized** copy (also derivable from auth.users) |
| `title` | Short title | Required (validated in frontend) |
| `subject` | Optional alias of title | Accepted by API only |
| `category` | Department | Values: `electrical`, `plumbing`, `furniture`, `cleanliness`, `wifi_network`, `other` |
| `location` | Campus location | Values such as `academic_block_1..4`, `library`, `admin_block`, `north_square`, `gazebo`, `a_block_hostel`, `b_block_hostel`, `c_block_hostel`, `d1_block_hostel`, `d2_block_hostel`, `e_block_hostel`, `sports_ground` |
| `description` | Full text | Required |
| `privacy` | Visibility | `public`, `private`, `anonymous` |
| `status` | Workflow state | `pending` → `in_review` → `in_progress` → `resolved` / `closed` |
| `progress` | 0-100 percentage | **Derived from status** in app code: pending 0, in_review 30, in_progress 65, resolved/closed 100 |
| `priority` | `NORMAL` / `HIGH` | DB default `'NORMAL'`. Set by backend using AWS Comprehend sentiment (HIGH if negative confidence > 0.80). Backend retries the insert without this column if it does not exist (schema-evolution fallback) |
| `image_url` | Public URL of attachment in **Supabase Storage** | |
| `s3_image_url` | URL of the same attachment in **AWS S3** | Added with `ALTER TABLE grievances ADD COLUMN s3_image_url text;` |
| `is_pinged` | boolean, default `false` | Exists in the DB but is **not used by the app** (pings are detected through `internal_notes` text, see 3.3) |
| `resolved_at` | When the grievance was marked resolved/closed | `timestamptz`, nullable. Added with `ALTER TABLE grievances ADD COLUMN resolved_at timestamptz;`. Set by the admin dashboard on resolve/close, cleared on reopen. Used to compute resolution time |
| `created_at` | Creation timestamp | `timestamptz`, default `now()`; used for ordering (newest first) |
| `updated_at` | Last change | **Set by the client** (`new Date().toISOString()`), not by a DB trigger |

### 3.2 `comments` (public conversation thread per grievance)
Columns: `id` (uuid), `grievance_id` (uuid, FK → grievances.id **ON DELETE CASCADE**), `user_id` (uuid, FK → auth.users.id), `user_email`, `user_role` (`student` / `admin` / `supervisor`), `message`, `created_at`, `is_anonymous` (boolean, default false; present in DB but not referenced by the app code).
Read with `WHERE grievance_id = ? ORDER BY created_at ASC`.

### 3.3 `internal_notes` (staff-only private notes per grievance)
Columns: `id` (bigint), `grievance_id` (**`text`, no foreign key**, even though it holds a grievances.id uuid), `sender_email`, `message`, `created_at`.
Only fetched when the user role is admin or supervisor.
**Escalation "pings"** are stored as rows whose `message` starts with the text `[PING]`; dashboards find pinged grievances with `SELECT grievance_id FROM internal_notes WHERE message LIKE '[PING]%'`.

### 3.4 `profiles` (role lookup used by RLS)
Columns: `id` (uuid, PK and FK → auth.users.id, 1-to-1), `email`, `role`, `full_name`, `created_at`. Constraint `profiles_role_check`: `role IN ('student','admin')` (there is **no `supervisor` value**). The frontend does not read this table; it exists so RLS policies can check `profiles.role = 'admin'` inside the database.

### 3.5 `auth.users` (managed by Supabase Auth)
Stores accounts. On sign-up, `role` and `full_name` are stored in user metadata (`raw_user_meta_data`).

### 3.6 Relationships (ER summary)
- `auth.users` 1 ── 1 `profiles`
- `auth.users` 1 ── N `grievances` (a student files many grievances)
- `grievances` 1 ── N `comments` (enforced FK, ON DELETE CASCADE)
- `auth.users` 1 ── N `comments` (FK)
- `grievances` 1 ── N `internal_notes` (**logical only**, no FK because `grievance_id` is text)

## 4. Roles and access control

- Role is **derived from the email address in application code** (`AuthContext.jsx`):
  - `supervisor1@vit.ac.in`, `chiefadmin@vit.ac.in` → **supervisor**
  - any other `@vit.ac.in` → **admin**
  - everything else (e.g. `@vitstudent.ac.in`) → **student**
- The frontend routes users to Student / Admin / Supervisor dashboards based on this role (`ProtectedRoute.jsx`).
- Database-level enforcement uses Supabase **Row Level Security (RLS)** policies (actual policies from `pg_policies`):
  - `profiles`: SELECT only own row (`id = auth.uid()`).
  - `grievances`: INSERT only with `auth.uid() = user_id` (two equivalent policies); SELECT: one policy allows own rows or admins, but **another policy "Enable read access for all users" has `USING (true)` for authenticated users, and since policies are OR-ed, any logged-in user can read every grievance, including `private` and `anonymous` ones**; UPDATE allowed for admins (via `profiles.role='admin'`) and for the email `supervisor@vit.ac.in`.
  - `comments`: SELECT for all authenticated (`true`); INSERT only as yourself.
  - `internal_notes`: SELECT and INSERT allowed for **all authenticated users** (`true`), so students could read staff-only notes by querying the API directly; privacy of these notes is enforced only in the UI.
  - Mismatch: the app's supervisor accounts are `supervisor1@vit.ac.in` / `chiefadmin@vit.ac.in` (`AuthContext.jsx`), but the RLS update policy names `supervisor@vit.ac.in`, and `profiles.role` cannot be `supervisor`.
  The backend forwards the user's JWT (`Authorization: Bearer <token>`) so inserts made through the API run under the user's identity and RLS still applies.

## 5. Key queries (translated to SQL)

```sql
-- Student dashboard: own grievances
SELECT * FROM grievances WHERE user_id = :uid ORDER BY created_at DESC;

-- Admin dashboard: one department, optional status filter
SELECT * FROM grievances
WHERE category ILIKE :dept            -- wifi uses: category ILIKE 'wifi_network' OR category ILIKE 'wifi/network'
  AND (:status IS NULL OR status = :status)
ORDER BY created_at DESC;

-- Supervisor dashboard: all departments, optional category + status filters (same shape as above)

-- Escalated (pinged) grievances
SELECT grievance_id FROM internal_notes WHERE message LIKE '[PING]%';

-- Status change by admin
UPDATE grievances SET status = :s, progress = :p, updated_at = now(),
       resolved_at = CASE WHEN :s IN ('resolved','closed') THEN now() ELSE NULL END
WHERE id = :id;

-- Aggregates behind the CloudWatch dashboard (computed in the backend with the service role key)
SELECT category, COUNT(*) FROM grievances GROUP BY category;
SELECT location, COUNT(*) FROM grievances GROUP BY location;
SELECT status,   COUNT(*) FROM grievances GROUP BY status;
SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, updated_at) - created_at)) / 3600) AS avg_resolution_hours
FROM grievances WHERE status IN ('resolved','closed');

-- Conversation thread
SELECT * FROM comments WHERE grievance_id = :gid ORDER BY created_at ASC;
INSERT INTO comments (grievance_id, user_id, user_email, user_role, message) VALUES (...);

-- New grievance (via backend, with computed priority)
INSERT INTO grievances (title, category, location, description, privacy, user_id, user_email,
                        image_url, s3_image_url, status, progress, priority) VALUES (...) RETURNING *;
```

## 6. Data flow of submitting a grievance

1. Student fills the form; frontend validates required fields, file type (image or PDF) and size (≤ 2 MB).
2. **Redundant file storage, in parallel:**
   - Upload to Supabase Storage bucket `grievance-images` at `public/<user_id>-<timestamp>.<ext>` → public URL.
   - Ask backend `POST /api/presigned-url` for an S3 presigned PUT URL (expires in 1 hour, key `uploads/<timestamp>-<filename>`), then the browser uploads directly to S3.
   - **Both uploads must succeed.** If S3 fails after Supabase succeeded, the Supabase file is deleted (compensating action), and the submission is blocked so no row exists with only one copy.
3. Frontend sends the record to `POST /api/grievances`. The backend runs AWS Comprehend sentiment on the description to set `priority`, then inserts into `grievances` using the user's JWT.
4. **Fallback:** if the backend is unreachable, the frontend inserts directly into Supabase (without the computed priority).
5. Backend `POST /api/notify-new` publishes an AWS SNS message announcing the new grievance. Status changes call `POST /api/notify-status`.
6. **Storage cost optimisation on resolve:** when an admin sets status to `resolved` or `closed`, the dashboard sends the grievance's `s3_image_url` to `POST /api/notify-status`. The backend derives the S3 object key from the URL and calls `PutObjectTagging` with `status=resolved` (reopening a grievance sets `status=active`). Tagging is best-effort: a failure is logged and never blocks the status update or SNS notification. An S3 **lifecycle rule** (`archive-resolved-attachments`, filter: tag `status=resolved`, prefix `uploads/`) transitions tagged objects to **S3 Glacier Instant Retrieval**. Lifecycle rules run asynchronously about once a day (midnight UTC). The IAM user needs `s3:PutObjectTagging` on `uploads/*`.
7. **Metrics publishing:** after every new grievance and every status change, the backend (`metricsService.js`) reads all grievances with the Supabase **service role key** (needed because RLS would hide rows from the anon key), computes the aggregates in memory and calls CloudWatch `PutMetricData` in namespace `GrievanceSystem`: `GrievanceCount` with a `Category`, `Location` or `Status` dimension, plus `TotalGrievances` and `AverageResolutionHours`. Legacy `wifi/network` is folded into `wifi_network`. Publishing is best-effort (errors are logged, never block the request) and awaited before responding because Vercel can freeze a serverless function after the response. `POST /api/metrics/publish` publishes a snapshot on demand.
8. **CloudWatch dashboard:** `npm run metrics:dashboard` (`scripts/setup-cloudwatch-dashboard.js`) publishes a snapshot and creates the dashboard `Grievance-System` via `PutDashboard`: single-value widgets (total grievances, average resolution hours), a status pie chart, bar charts by category and by location, and time-series widgets (status over time, resolution-time trend). Charts use `SEARCH` expressions so new categories/locations appear automatically; the dashboard auto-refreshes (e.g. every 10 s) for live demo display. IAM needs `cloudwatch:PutMetricData` and `cloudwatch:PutDashboard`.

### 6.1 Audit logging with AWS CloudTrail (configured in AWS, no application code)

- **Event history** (always on, free, 90 days): management events such as creating the S3 lifecycle rule (`PutBucketLifecycleConfiguration`), IAM policies (`PutUserPolicy`), the CloudWatch dashboard (`PutDashboard`), and console sign-ins (`ConsoleLogin`).
- **Trail `grievance-audit-trail`** (region `ap-south-1`, multi-region), with these settings:
  - Delivers logs to a **separate** S3 bucket, never the attachments bucket, to avoid a logging feedback loop.
  - Log file validation is enabled, so CloudTrail writes SHA-256 hash digest files and tampering with the audit log can be detected.
  - SSE-KMS is off (S3 default encryption still applies) and SNS delivery is off.
  - Streams to the CloudWatch Logs group `aws-cloudtrail-logs-grievance-audit-trail` through an auto-created IAM role.
- **Events captured:**
  - Management events, both Read and Write, with KMS and RDS Data API events excluded.
  - **S3 data events** limited by an advanced event selector to `resources.ARN` starting with `arn:aws:s3:::<bucket>/uploads/`, which is only grievance attachments.
  - The S3 events are `PutObject` (a student uploads an attachment through the presigned URL; `sourceIPAddress` is the student's browser), `PutObjectTagging` (an admin resolves the grievance and the object is tagged for Glacier) and `GetObject` (an attachment is viewed).
  - Insights and network activity events are off because they are paid.
- **Querying** in CloudWatch Logs Insights:
  ```
  fields eventTime, eventName, sourceIPAddress, userIdentity.userName, requestParameters.key
  | filter eventSource = "s3.amazonaws.com" and eventName in ["PutObject", "PutObjectTagging"]
  | sort eventTime desc
  ```
- **Cost:** the first trail's management events are free. S3 data events cost about $0.10 per 100k. Log storage is minimal and falls within the CloudWatch Logs free tier.

## 7. DBMS concepts demonstrated (talking points for the report)

- **Relational modelling** of a real workflow: entities (users, grievances, comments, notes), 1-to-many relationships, foreign keys.
- **Managed PostgreSQL** (Supabase) with an auto-generated REST layer (PostgREST) used from the client.
- **Row Level Security** as database-enforced authorization, with JWT identity passed from the API, plus a critical analysis of how overlapping permissive policies are OR-ed and can silently widen access.
- **Integrity constraints:** PRIMARY KEY, FOREIGN KEY with `ON DELETE CASCADE` (comments), CHECK (`profiles_role_check`), NOT NULL, and DEFAULTs (`status`, `privacy`, `priority`, `progress`, `created_at`).
- **Workflow / state modelling** with a `status` attribute and derived `progress`.
- **Schema evolution:** adding `priority` and `s3_image_url` with `ALTER TABLE`, and backend code tolerant of a missing column.
- **Storing files outside the database:** DB stores only URLs (pointers); binary objects live in object storage (Supabase Storage + S3). This is the standard pattern instead of BLOBs.
- **Redundancy and replication across providers:** the same object stored in two independent stores, with both URLs recorded.
- **Consistency without distributed transactions:** the two uploads and the DB insert cannot be one ACID transaction, so the app uses an "all-or-nothing with compensation" approach (saga-style compensating delete). Remaining gap: an orphaned S3 object can remain if Supabase fails and S3 succeeds.
- **Data lifecycle management / cost optimisation (hot vs cold storage):** active grievances' attachments stay in S3 Standard; resolved ones are archived automatically via a tag-driven lifecycle rule. Lifecycle rules are time/tag based, not event based, so the application bridges the event ("grievance resolved") to the rule by setting an object tag. Glacier Instant Retrieval (about 68% cheaper storage than Standard, millisecond reads) was chosen over Glacier Flexible/Deep Archive so attachments still render in the grievance detail view without a restore job. Trade-offs: 90-day minimum storage duration, 128 KB minimum billable object size, per-GB retrieval fee. Only the S3 copy is tiered; the Supabase copy is unaffected.
- **Analytical aggregation and observability:** the OLTP data in PostgreSQL is rolled up with `GROUP BY`-style aggregates (count per category/location/status, `AVG` of resolution time) and exported as time-series metrics to CloudWatch, separating operational queries from monitoring/analytics. Resolution time is derived from two timestamps (`created_at`, `resolved_at`), which is why `resolved_at` was added instead of inferring it from the mutable `updated_at`.
- **Snapshot vs event metrics:** metrics are republished as full snapshots (idempotent, self-correcting) rather than incrementing counters, so counts cannot drift when statuses change or rows are reopened. Trade-off: each event rescans the table, which is fine at campus scale but would need a materialised view or incremental counters for large volumes.
- **Auditing and accountability:** an append-only, tamper-evident log (CloudTrail with log file validation) of who did what, when and from where. It plays the same role for cloud resources that a database audit log or WAL plays for data. It also gives each attachment a chain of custody: uploaded by whom and from which IP, archived when, viewed by whom.
- **Separation of audit data from operational data:** audit records live in a different bucket and log group from the data they describe, so they can't be overwritten through the application's own access path.
- **Denormalization trade-off:** `user_email` and `user_role` copied into rows for fast display without joins.
- **Filtering, ordering and pattern matching:** `ILIKE`, `LIKE 'prefix%'`, `ORDER BY created_at DESC`.

## 8. Honest weaknesses and improvement ideas (good for the "critical review" section)

1. **Category values are inconsistent** (`wifi_network` vs `wifi/network`, hence `ILIKE` and `OR`). Fix: a `CHECK` constraint, a PostgreSQL `ENUM`, or a `categories` lookup table with a foreign key.
2. **Roles are duplicated:** the UI derives role from the email domain in code, while RLS uses a separate `profiles` table whose CHECK excludes `supervisor`. The two can disagree. Fix: one source of truth (`profiles.role` including `supervisor`) used by both the app and RLS.
3. **Pings encoded inside message text** (`LIKE '[PING]%'`). A `grievances.is_pinged` boolean already exists in the schema but is unused, so there are two competing representations. Fix: use `is_pinged`, or a separate `escalations` table (who, when, grievance).
4. **`progress` duplicates information in `status`** (redundant, can become inconsistent). Fix: compute in a view or a generated column, or a `CASE` expression.
5. **`updated_at` is set by the client.** Fix: a `BEFORE UPDATE` trigger setting `updated_at = now()`.
6. **No audit history** of status changes in the database. CloudTrail only audits AWS API calls (S3 uploads, tagging, configuration). It cannot see Supabase/PostgreSQL row changes such as status updates, comments or notes. Fix: a `grievance_status_history` table filled by an `AFTER UPDATE` trigger (or Supabase/pgAudit logging).
7. **`internal_notes` stores `sender_email` but not `sender_id`, and `grievance_id` is `text` with no foreign key.** Fix: `uuid` type, FK to `grievances(id)` (with ON DELETE CASCADE like `comments`), and a `sender_id` FK.
7b. **Over-permissive RLS** (see section 4): `USING (true)` read policies expose private grievances and internal notes to every authenticated user. Fix: drop them and restrict by owner / role.
7c. **Unused columns** `comments.is_anonymous` and `grievances.is_pinged` suggest schema drift between the DB and the code.
8. **Indexes:** the dump shows **only primary-key indexes** exist (no index on `grievances.user_id`, `category`/`status`, `comments.grievance_id`, `internal_notes.grievance_id`), so every dashboard query does a sequential scan as data grows. Suggested `grievances(user_id, created_at DESC)`, `grievances(category, status, created_at DESC)`, `comments(grievance_id, created_at)`, `internal_notes(grievance_id)`.
9. **Fallback direct insert bypasses priority computation**, but the DB default `'NORMAL'` already keeps those rows valid (good use of column defaults).
10. **Tagging endpoint is unauthenticated and client-driven:** `/api/notify-status` trusts the `s3ImageUrl` sent by the browser, so anyone could tag arbitrary `uploads/*` objects. Fix: verify the JWT/role server-side and look up `s3_image_url` from the database by `grievanceId` instead of accepting it from the client. Also, archived objects are not restored if a grievance is reopened (tag returns to `active`, but the storage class stays Glacier IR).
11. **Metrics rescan the whole `grievances` table on every event** (O(n) per write) and rely on the service role key, which bypasses RLS and must stay server-only. Fix: incremental counters, a materialised view / `GROUP BY` view refreshed periodically, or a scheduled job (EventBridge) instead of per-event publishing. `POST /api/metrics/publish` is also unauthenticated. The direct-to-Supabase fallback insert (backend down) does not publish metrics, and `resolved_at` is null for grievances resolved before the column was added (the code falls back to `updated_at`).
12. **Notification fan-out:** status emails go to every SNS topic subscriber rather than to the specific student; a per-user email service (e.g. AWS SES) would fix it.

## 9. Possible future work (AWS, free tier friendly)

(S3 lifecycle archiving of resolved attachments and the CloudWatch metrics dashboard are already implemented, see section 6 steps 6-8; CloudTrail auditing is also configured, see 6.1.)

Step Functions grievance workflow, EventBridge Scheduler for SLA escalation of long-pending grievances, CloudWatch alarms (e.g. SNS alert when pending grievances or average resolution time exceed a threshold), DynamoDB or Postgres audit trail, CloudFront with a private bucket and signed URLs, and infrastructure-as-code with AWS CDK.

---

### Schema dump to attach (run in Supabase SQL editor and paste the output with this context)

```sql
-- Columns and types
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;

-- Constraints (PK, FK, CHECK, UNIQUE)
SELECT conrelid::regclass AS table_name, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE connamespace = 'public'::regnamespace;

-- Indexes
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public';

-- Row Level Security policies
SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'public';
```

-- Outputs of the 4 sql queries:

1. 
| table_name     | column_name  | data_type                | is_nullable | column_default    |
| -------------- | ------------ | ------------------------ | ----------- | ----------------- |
| comments       | id           | uuid                     | NO          | gen_random_uuid() |
| comments       | grievance_id | uuid                     | NO          | null              |
| comments       | user_id      | uuid                     | NO          | null              |
| comments       | user_email   | text                     | NO          | null              |
| comments       | user_role    | text                     | NO          | null              |
| comments       | message      | text                     | NO          | null              |
| comments       | created_at   | timestamp with time zone | YES         | now()             |
| comments       | is_anonymous | boolean                  | YES         | false             |
| grievances     | id           | uuid                     | NO          | gen_random_uuid() |
| grievances     | user_id      | uuid                     | NO          | null              |
| grievances     | user_email   | text                     | NO          | null              |
| grievances     | title        | text                     | NO          | null              |
| grievances     | category     | text                     | NO          | null              |
| grievances     | location     | text                     | YES         | null              |
| grievances     | description  | text                     | NO          | null              |
| grievances     | privacy      | text                     | NO          | 'private'::text   |
| grievances     | status       | text                     | NO          | 'pending'::text   |
| grievances     | progress     | integer                  | YES         | 0                 |
| grievances     | created_at   | timestamp with time zone | YES         | now()             |
| grievances     | updated_at   | timestamp with time zone | YES         | now()             |
| grievances     | image_url    | text                     | YES         | null              |
| grievances     | is_pinged    | boolean                  | YES         | false             |
| grievances     | priority     | text                     | YES         | 'NORMAL'::text    |
| grievances     | s3_image_url | text                     | YES         | null              |
| internal_notes | id           | bigint                   | NO          | null              |
| internal_notes | created_at   | timestamp with time zone | NO          | now()             |
| internal_notes | grievance_id | text                     | YES         | null              |
| internal_notes | sender_email | text                     | YES         | null              |
| internal_notes | message      | text                     | YES         | null              |
| profiles       | id           | uuid                     | NO          | null              |
| profiles       | email        | text                     | NO          | null              |
| profiles       | role         | text                     | NO          | null              |
| profiles       | full_name    | text                     | YES         | null              |
| profiles       | created_at   | timestamp with time zone | YES         | now()             |

2.
| table_name     | conname                    | definition                                                             |
| -------------- | -------------------------- | ---------------------------------------------------------------------- |
| comments       | comments_grievance_id_fkey | FOREIGN KEY (grievance_id) REFERENCES grievances(id) ON DELETE CASCADE |
| comments       | comments_pkey              | PRIMARY KEY (id)                                                       |
| comments       | comments_user_id_fkey      | FOREIGN KEY (user_id) REFERENCES auth.users(id)                        |
| grievances     | grievances_pkey            | PRIMARY KEY (id)                                                       |
| grievances     | grievances_user_id_fkey    | FOREIGN KEY (user_id) REFERENCES auth.users(id)                        |
| internal_notes | internal_notes_pkey        | PRIMARY KEY (id)                                                       |
| profiles       | profiles_id_fkey           | FOREIGN KEY (id) REFERENCES auth.users(id)                             |
| profiles       | profiles_pkey              | PRIMARY KEY (id)                                                       |
| profiles       | profiles_role_check        | CHECK ((role = ANY (ARRAY['student'::text, 'admin'::text])))           |

3.
| tablename      | indexname           | indexdef                                                                          |
| -------------- | ------------------- | --------------------------------------------------------------------------------- |
| profiles       | profiles_pkey       | CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id)             |
| grievances     | grievances_pkey     | CREATE UNIQUE INDEX grievances_pkey ON public.grievances USING btree (id)         |
| comments       | comments_pkey       | CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id)             |
| internal_notes | internal_notes_pkey | CREATE UNIQUE INDEX internal_notes_pkey ON public.internal_notes USING btree (id) |

4.
| tablename      | policyname                                         | cmd    | roles           | qual                                                                                                                                                                               | with_check                              |
| -------------- | -------------------------------------------------- | ------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| profiles       | Users can read own profile                         | SELECT | {public}        | (id = ( SELECT auth.uid() AS uid))                                                                                                                                                 | null                                    |
| grievances     | Admins update all                                  | UPDATE | {authenticated} | (EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))                                              | null                                    |
| grievances     | Authenticated read grievances                      | SELECT | {authenticated} | ((user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1<br>   FROM profiles<br>  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) | null                                    |
| grievances     | Enable insert for authenticated users only         | INSERT | {authenticated} | null                                                                                                                                                                               | (auth.uid() = user_id)                  |
| grievances     | Enable read access for all users                   | SELECT | {authenticated} | true                                                                                                                                                                               | null                                    |
| grievances     | Students insert own                                | INSERT | {authenticated} | null                                                                                                                                                                               | (( SELECT auth.uid() AS uid) = user_id) |
| grievances     | Supervisor can update grievances                   | UPDATE | {authenticated} | ((auth.jwt() ->> 'email'::text) = 'supervisor@vit.ac.in'::text)                                                                                                                    | null                                    |
| comments       | Insert comments                                    | INSERT | {authenticated} | null                                                                                                                                                                               | (( SELECT auth.uid() AS uid) = user_id) |
| comments       | Read comments                                      | SELECT | {authenticated} | true                                                                                                                                                                               | null                                    |
| internal_notes | Allow authenticated users to insert internal notes | INSERT | {authenticated} | null                                                                                                                                                                               | true                                    |
| internal_notes | Allow authenticated users to read internal notes   | SELECT | {authenticated} | true                                                                                                                                                                               | null                                    |