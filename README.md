# Ghost Like Button

Self-hosted likes for Ghost members, backed by SQLite and delivered as a Node service.

---

## 🚀 Quick Install

### One-line install
```bash
curl -s https://raw.githubusercontent.com/ifrederico/ghost-like-button/master/install.sh | bash
```

### Or clone and install
```bash
git clone https://github.com/ifrederico/ghost-like-button.git
cd ghost-like-button
bash install.sh
```

The installer will:
- Prompt for your Ghost URL
- Auto-detect your Ghost Docker network
- Create necessary directories with correct permissions
- Start the service

---

## 📋 Requirements

- Docker + Docker Compose
- A running Ghost instance (the like service joins its Docker network)
- Ghost members enabled (Settings → Membership)

---

## Theme Integration

Add the like button to your Ghost theme:

### 1. Add to your post template

In `post.hbs` or `index.hbs`:

```handlebars
<like-button api="/ghost-like-button" url="{{url absolute="true"}}"></like-button>
<script defer src="{{asset "js/ghost-like-button.js"}}"></script>
```

### 2. Create the web component

Create `assets/js/ghost-like-button.js`:

```javascript
customElements.define('like-button', class extends HTMLElement {
  async connectedCallback() {
    const base = this.getAttribute('api') ?? '/ghost-like-button';
    const target = encodeURIComponent(this.getAttribute('url'));
    const btn = Object.assign(document.createElement('button'), { textContent: '❤ 0' });
    btn.addEventListener('click', () => this.toggle(`${base}/update-likes?url=${target}`, btn));
    this.append(btn);
    this.refresh(`${base}/get-likes?url=${target}`, btn);
  }

  async refresh(endpoint, btn) {
    const res = await fetch(endpoint, { credentials: 'include' });
    if (res.ok) btn.textContent = `❤ ${await res.text()}`;
  }

  async toggle(endpoint, btn) {
    const res = await fetch(endpoint, { method: 'POST', credentials: 'include' });
    if (res.ok) btn.textContent = `❤ ${await res.text()}`;
  }
});
```

### 3. Configure reverse proxy

Add to your Caddy configuration (see `Caddyfile.example` for full examples):

```caddyfile
yourdomain.com {
    # Your existing Ghost config...

    handle_path /ghost-like-button/* {
        reverse_proxy ghost-like-button:8787
    }

    # Your Ghost service
    reverse_proxy ghost:2368
}
```

---

## 🔧 Configuration

| Variable    | Required | Default | Purpose                               |
|-------------|----------|---------|---------------------------------------|
| `GHOST_URL` | Yes      | -       | Allowed origin + member JWT audience. |
| `PORT`      | No       | `8787`  | Internal HTTP port.                   |
| `NODE_ENV`  | No       | `production` | Standard Node environment flag. |

Edit `.env` to change these values.

---

## 📡 API Reference

| Method & Path                     | Description                         |
|-----------------------------------|-------------------------------------|
| `GET /health`                     | Basic health probe.                 |
| `GET /get-likes?url=<post-url>`   | Returns total likes (text body).    |
| `POST /update-likes?url=<post-url>` | Toggles like/unlike for the member. |

`GET` responses include the `X-Has-Liked` header (`1` or `0`) when a member JWT is present.

---

## 🔄 Updates

```bash
cd ghost-like-button
git pull
docker compose pull
docker compose up -d
```

Your database in `./data/` is preserved across updates.

---

## 🛠️ Maintenance

```bash
# View logs
docker compose logs ghost-like-button

# Check database
sqlite3 data/ghost-like-button.db ".tables"

# Compact database (optional)
sqlite3 data/ghost-like-button.db "PRAGMA wal_checkpoint(TRUNCATE);"

# Restart service
docker compose restart ghost-like-button
```

---

## 💾 Backup

Your SQLite database is stored in `./data/ghost-like-button.db`. Back it up like any other file:

```bash
cp data/ghost-like-button.db data/ghost-like-button.db.backup
```

---

## 🔒 Security

- Rate limiting: 90 requests/minute per IP
- CORS restricted to your Ghost domain
- JWT validation (trusted internal network)
- No personal data stored except email for deduplication

---

## 📝 License

MIT License - See LICENSE file

---

## 💬 Support

Open an issue on GitHub if you need help with setup.