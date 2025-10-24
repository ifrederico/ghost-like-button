# Ghost Like Button

Self-hosted likes for Ghost members, backed by SQLite and delivered as a Node service.

---

## Deployment

### Prerequisites

- Docker + Docker Compose.
- A running Ghost stack (the like service will join its Docker network).
- Ghost Admin → Settings → Membership → “Enable members” turned on (needed for member JWTs).

### Prepare the workspace

```bash
docker network ls | grep ghost          # note the network name, e.g. ghost_ghost_network
mkdir ghost-like-button && cd ghost-like-button
mkdir -p data
cp .env.example .env # adjust values before running compose 
```

### Compose file

Save this as `compose.yml` and swap the placeholders for your setup:

```yaml
services:
  ghost-like-button:
    image: ifrederico/ghost-like-button:latest              # published Docker Hub image
    environment:
      GHOST_URL: https://yourdomain.com                     # Ghost frontend URL
      NODE_ENV: production
    volumes:
      - ./data:/data                                        # persists ghost-like-button.db
    ports:
      - "8787:8787"
    networks:
      ghost_ghost_network: {}                               # replace with your Ghost network name
    restart: unless-stopped
    mem_limit: 128m
    healthcheck:
      test: ["CMD-SHELL", "curl -fsS http://localhost:8787/health > /dev/null"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

networks:
  ghost_ghost_network:
    external: true                                          # must already exist
```

### Launch

```bash
docker compose up -d
docker compose exec ghost-like-button curl -fsS http://localhost:8787/health
```

This command runs inside the container and hits `http://localhost:8787/health`. It returns JSON when accessed via tools like `curl`. Browser visits intentionally show a Ghost-style 404 to keep the endpoint quiet from casual probing.

The SQLite database lives in `./data/ghost-like-button.db`. Back it up like any other file.

### Quick test with plain Docker

```bash
mkdir -p data
docker run --rm \
  -p 8787:8787 \
  -e GHOST_URL=https://example.com \
  -v "$(pwd)/data:/data" \
  ifrederico/ghost-like-button:1.0.0
```

Hit `http://localhost:8787/health` from another terminal while the container runs. Use `Ctrl+C` to stop it when you’re done.

---

## Theme Integration

Add the custom element to your post template (`post.hbs`, `index.hbs`, etc.):

```handlebars
<like-button api="/ghost-like-button" url="{{url absolute="true"}}"></like-button>
<script defer src="{{asset "js/ghost-like-button.js"}}"></script>
```

Drop this minimal loader into `assets/js/ghost-like-button.js` (or bundle it with your theme):

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

Configure your reverse proxy so `/ghost-like-button/*` routes to the container. Example Caddy block:

```caddyfile
yourdomain.com {
    @like path /ghost-like-button*
    handle @like {
        uri strip_prefix /ghost-like-button
        reverse_proxy ghost-like-button:8787
    }
}
```

Need a full theme workflow (assets, CSS, Caddy examples)? See `theme-integration/README.md`.

---

## Configuration

| Variable    | Required | Default | Purpose                               |
|-------------|----------|---------|---------------------------------------|
| `GHOST_URL` | Yes      | -       | Allowed origin + member JWT audience. |
| `PORT`      | No       | `8787`  | Internal HTTP port.                   |
| `NODE_ENV`  | No       | `production` | Standard Node environment flag. |

---

## API Reference

| Method & Path                     | Description                         |
|-----------------------------------|-------------------------------------|
| `GET /health`                     | Basic health probe.                 |
| `GET /get-likes?url=<post-url>`   | Returns total likes (text body).    |
| `POST /update-likes?url=<post-url>` | Toggles like/unlike for the member. |

`GET` responses include the `X-Has-Liked` header (`1` or `0`) when a member JWT is present.

---

## Maintenance (optional)

Useful commands when you need them:

```bash
docker compose logs ghost-like-button
sqlite3 data/ghost-like-button.db ".tables"
sqlite3 data/ghost-like-button.db "PRAGMA wal_checkpoint(TRUNCATE);"  # compacts WAL, optional
docker compose pull && docker compose up -d                           # upgrade to new image
```

---

## Support & License

- Issues: open a ticket on your GitHub repository.
- Discussions: chat with the community where you host the project.
- License: MIT — fork it, remix it, share it.