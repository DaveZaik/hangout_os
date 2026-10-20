# Hangout OS Project Status

## RUN
Node: v24.13.1
Scripts: npm run dev (node --watch dev-server.js)
Env vars: MONGODB_URI, SESSION_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL (see .env.local)
Index.html loads: seed.js, app.js (both inline scripts; js/api.js exists but not loaded)

## FILE TREE
app.js: 298 lines, 46,653 bytes
style.css: 191 lines, 17,121 bytes
seed.js: 15 lines, 2,502 bytes
api/[...slug].js: 131 lines, 9,252 bytes
dev-server.js: 30 lines, 2,054 bytes
js/api.js: 222 lines, 10,540 bytes (NOT LOADED by index.html)
scripts/add-njeri.js: 47 lines, 1,289 bytes
scripts/fix-roster.js: 20 lines, 1,750 bytes
No files >600 lines. No functions >60 lines.

## ARCHITECTURE
Monolithic app.js handles all UI, state, and routing. api/[...slug].js is Express API handler. seed.js provides starter data for both client demo mode and server DB seeding. js/api.js is an extracted ES module but not wired into index.html yet. No module splitting completed. Load order: seed.js → app.js.

## FEATURE CHECKLIST
login ring: WORKING (app.js ring(), auto-rotation with pause/resume, spin/bob animations)
profile photo crop: NOT STARTED (no crop UI; uploads go through shrink() which downscale only)
taskbar avatar: WORKING (app.js bar(), shows current user avatar)
wallpaper (presets/uploads/permanent): WORKING (app.js theme(), retroWallpaper(), drawPixelScene(); persists to DB)
dark/light mode + Dark Reader lock: NOT STARTED (no dark mode or Dark Reader integration)
windows (min/max/close): WORKING (app.js win(), shut(), minimize(), restore(), toggleMax())
sounds: WORKING (app.js sfx, userJingle, Web Audio API oscillators)
chibi character: WORKING (app.js initChar(), startCharAnim(), chibi())
Neighbors: WORKING (app.js neighbors(), neighborDetail())
chat (group+private): WORKING (app.js chat(), DM threads via dm: prefix)
ideas/votes: WORKING (app.js board(), vote toggle)
comments: WORKING (app.js hangout() comments, API routes)
admin panel: WORKING (app.js admin(), user management)
uploads (R2/Cloudinary/demo): WORKING (app.js up(), R2 presigned URLs via api/[...slug].js; demo fallback via shrink())
demo-mode fallback: WORKING (app.js api() falls back to mock() localStorage on server failure)

## API TABLE
GET /api/users: public, returns all users (pub() masks password hash)
POST /api/login: public, {id, password} → {token, me}
POST /api/upload-url: auth required, {contentType, size, type} → {presignedPutUrl, publicUrl}
GET /api/data: auth required, returns {me, users, hangouts, notes, comments, messages}
PUT /api/me: auth required, {name, wallpaper, accent, avatar, ambient, volume, clicks, password} → {}
POST /api/notes: auth required, {kind, text} → {}
POST /api/notes/:id/vote: auth required, → {}
POST /api/comments: auth required, {hangout, text} → {}
DELETE /api/comments/:id: auth required, own comment or admin → {}
GET /api/messages/:thread: auth required, thread validation (all, dm:uid1:uid2, or admin) → messages
POST /api/messages/:thread: auth required, {text} → {}
POST /api/hangouts: ADMIN ONLY, {title, date, place, who, emoji, story, media} → {id}
PUT /api/hangouts/:id: ADMIN ONLY, updates hangout → {}
DELETE /api/hangouts/:id: ADMIN ONLY → {}
DELETE /api/notes/:id: ADMIN ONLY → {}
POST /api/users: ADMIN ONLY, {name, password, avatar} → {}
PUT /api/users/:id: ADMIN ONLY, {password} → {}
DELETE /api/users/:id: ADMIN ONLY (cannot delete self) → {}

MISSING PERMISSION CHECKS: None visible. All admin routes check me.a before operations. DM threads validate participants.

## DATABASE
Collections: users (11 docs), hangouts (3 docs), notes (5 docs), comments (3 docs), messages (10 docs)
Fields (users): _id, name, hash (scrypt), admin, avatar, wallpaper, accent, ambient, volume, clicks
Fields (hangouts): _id, title, date, place, who, emoji, story, media [{url, video, caption, e}]
Fields (notes): _id, kind, text, votes [], by
Fields (comments): _id, hangout, user, text, at
Fields (messages): _id, thread, from, text, at
Indexes: None explicitly defined (relying on _id indexes)
Biggest doc size: wallpaper data URI ~166KB, avatar data URI ~27KB
Images stored as data URIs in user docs: YES (avatar, wallpaper fields)
GET /api/data payload size: ~50-200KB depending on media count (users + hangouts + messages)

## HEALTH
node --check: All JS files pass syntax check
npm ls --depth=0: @aws-sdk/client-s3@3.1152.0, @aws-sdk/s3-request-presigner@3.1152.0, express@5.3.0, mongodb@7.7.0
npm audit: 0 vulnerabilities
Headless load: Not tested (requires running server and jsdom)

## DEAD CODE
js/api.js: 222 lines, never loaded by index.html (partial refactor artifact)
scripts/fix-roster.js: 20 lines, no evidence of being used
README.md, package.json: References nelly2 slug which is not in seed.js roster (current roster has 11 members, nelly2 missing)
CSS classes: 129 classes defined, all appear used in app.js HTML generation
Leftover refs: None found for Cloudinary, jingle upload, avatar builder (all removed)

## RISKS
Security:
- SESSION_SECRET in .env.local is 'anylongrandomtexthere123' (weak default)
- No rate limiting on API routes
- No input sanitization beyond length slicing (XSS risk from esc() use but appears thorough)
- CORS: Not configured (dev-server.js assumes same-origin)
- Secrets: .env.local gitignored correctly
- Admin token signature uses HMAC-SHA256 with 30-day expiry (reasonable)

Performance:
- Data URIs up to 400KB stored in user docs (MongoDB document size risk)
- Chat polling every 6 seconds via setInterval (no WebSocket)
- Character animation via setTimeout chain (not requestAnimationFrame)
- Window close animation uses setTimeout but cleans up DOM
- No debouncing on resize (200ms timeout is adequate)

Mobile:
- Mobile breakpoint at 700px works
- Character disabled on mobile (<700px)
- Maximize button hidden on mobile
- Touch swipe for page navigation implemented

## TOP 10 FIXES (ordered by value/effort)
1. Wire js/api.js into index.html and refactor app.js into ES modules (value: maintainability, effort: high)
2. Replace chat polling with WebSocket or Server-Sent Events (value: real-time, effort: medium)
3. Store media in R2 instead of data URIs for user avatars/wallpapers (value: DB size, effort: medium)
4. Add rate limiting to API routes (value: security, effort: low)
5. Use requestAnimationFrame for character animation instead of setTimeout (value: performance, effort: low)
6. Add input validation beyond length (e.g., whitelist emoji patterns) (value: security, effort: low)
7. Change default SESSION_SECRET to strong random value (value: security, effort: trivial)
8. Remove dead js/api.js file if not using module refactor (value: cleanup, effort: trivial)
9. Update README.md/package.json to remove nelly2 references (value: accuracy, effort: trivial)
10. Add proper CORS configuration if deploying to different domain (value: security, effort: low)
