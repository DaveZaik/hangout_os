# Where your images go

| Folder / file | What it is |
|---|---|
| `img/users/<slug>.png` | Profile photo for the login bubbles. Slugs: david, shelly, nelly, beckham, ted, claire, violet, nelly2, sharon, michael, mercy. Square, 256x256+. Missing file = shows their initial. |
| `img/wallpapers/*.jpg` | Extra desktop wallpapers. Register each in `ASSETS.wallpapers` at the top of `app.js`, e.g. `sunset:'url(img/wallpapers/sunset.jpg)'` — it then shows up in everyone's Profile → Desktop. |
| `img/icon-192.png`, `img/icon-512.png` | App icon (used when installed to a phone home screen / wrapped as an app). |

# Environment Variables

Add these to `.env.local` (never commit this file):

```
MONGODB_URI=mongodb://127.0.0.1:27017
SESSION_SECRET=anylongrandomtexthere123
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_URL=https://your-custom-domain.com
```

## Cloudflare R2 Setup

1. Create an R2 bucket in your Cloudflare dashboard
2. Set up a custom domain for public access (optional but recommended)
3. Create an API token with R2 read/write permissions
4. Configure CORS on your R2 bucket:

```json
{
  "AllowedOrigins": ["https://your-app-domain.com"],
  "AllowedMethods": ["PUT", "GET", "HEAD"],
  "AllowedHeaders": ["Content-Type"],
  "ExposeHeaders": ["ETag"],
  "MaxAgeSeconds": 3600
}
```

To configure CORS via Cloudflare dashboard:
- Go to R2 → Your Bucket → Settings → CORS Policy
- Add the above configuration

Without R2 configured, the app falls back to demo mode (data URLs for small files).
