// server.js
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import Database from "better-sqlite3";

const PORT = Number(process.env.PORT || 8787);
const GHOST_URL = process.env.GHOST_URL;          // e.g. https://fred.pt

if (!GHOST_URL) {
  console.error("ERROR: GHOST_URL environment variable is required");
  process.exit(1);
}

const db = new Database("/data/applause.db", { fileMustExist: false });
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS applause_counts (
    url_hash BLOB PRIMARY KEY,
    url TEXT NOT NULL,
    clap_count INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS applause_actor_claps (
    url_hash BLOB NOT NULL,
    actor_type TEXT NOT NULL,    -- 'member'
    actor TEXT NOT NULL,         -- member email (sub)
    claps INTEGER NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (url_hash, actor_type, actor)
  );
`);

const getCount = db.prepare("SELECT clap_count FROM applause_counts WHERE url_hash = ?");
const upsertCount = db.prepare(`
  INSERT INTO applause_counts (url_hash, url, clap_count, updated_at)
  VALUES (?, ?, 1, CURRENT_TIMESTAMP)
  ON CONFLICT(url_hash) DO UPDATE SET
    clap_count = clap_count + 1,
    updated_at = CURRENT_TIMESTAMP
`);
const decrementCount = db.prepare(`
  UPDATE applause_counts 
  SET clap_count = MAX(0, clap_count - 1),
      updated_at = CURRENT_TIMESTAMP
  WHERE url_hash = ?
`);
const getMember = db.prepare("SELECT claps FROM applause_actor_claps WHERE url_hash=? AND actor_type='member' AND actor=?");
const insertMember = db.prepare(`
  INSERT INTO applause_actor_claps (url_hash, actor_type, actor, claps, updated_at)
  VALUES (?, 'member', ?, 1, CURRENT_TIMESTAMP)
`);
const deleteMember = db.prepare(`
  DELETE FROM applause_actor_claps 
  WHERE url_hash=? AND actor_type='member' AND actor=?
`);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(express.text({ type: "*/*", limit: "64b" }));

app.use(rateLimit({ 
  windowMs: 60_000, 
  max: 90, 
  standardHeaders: true, 
  legacyHeaders: false
}));

// CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", GHOST_URL);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "X-Has-Clapped");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const normUrl = (raw) => {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase();
    if (!u.pathname) u.pathname = "/";
    return u.href;
  } catch { return null; }
};
const md5buf = (s) => Buffer.from(crypto.createHash("md5").update(s, "utf8").digest("hex"), "hex");

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (err) {
    return null;
  }
}

async function verifyGhostToken(bearer) {
  if (!bearer?.startsWith("Bearer ")) return null;
  const token = bearer.slice(7);
  
  try {
    const payload = decodeJWT(token);
    if (!payload) return null;
    
    const expectedAudience = new URL("/members/api", GHOST_URL).href;
    const expectedIssuer = new URL("/members/api", GHOST_URL).href;
    
    if (payload.aud !== expectedAudience) return null;
    if (payload.iss !== expectedIssuer) return null;
    
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    
    return typeof payload.sub === "string" ? payload.sub.toLowerCase() : null;
  } catch (err) {
    return null;
  }
}

// Root route - serve Ghost-like 404
app.get("/", (req, res) => {
  const ghostUrl = GHOST_URL;
  res.status(404).type('text/html').send(`
    <!DOCTYPE html>
    <html class="no-js" lang="en">
    <head>
    <meta charset="UTF-8">

    <title>404 — Page not found</title>

    <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1, maximum-scale=1">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">

    <style>
    /*! normalize.css v3.0.3 | MIT License | github.com/necolas/normalize.css */
    html, body {
      margin: 0;
      padding: 0;
      height: 100%;
      font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Oxygen,Ubuntu,Cantarell,Fira Sans,Droid Sans,Helvetica Neue,sans-serif;
      font-size: 62.5%;
      line-height: 1.65;
      letter-spacing: .2px;
      color: #343f44;
      overflow: hidden;
    }

    main, section, div, h1, h2, a {
        box-sizing: border-box;
    }

    a {
        text-decoration: none;
        background-color: transparent;
        color: #5ba4e5;
        transition: background .3s, color .3s;
    }

    a:hover {
        text-decoration: underline;
    }

    .gh-app, .gh-viewport, .gh-view, .error-content, .error-details, .error-message {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .gh-app, .gh-viewport {
        height: 100%;
        overflow: hidden;
    }

    .gh-view {
        flex-grow: 1;
    }

    .error-content {
        flex-grow: 1;
        padding: 8vw;
    }

    .error-details {
        flex-direction: row;
        margin-bottom: 4rem;
    }

    .error-message {
        margin: 15px;
    }

    .error-code {
        margin: 0;
        color: #c5d2d9;
        font-size: 10vw;
        font-weight: 600;
        line-height: .9em;
        letter-spacing: -.4vw;
    }

    .error-description {
        margin: 0;
        padding: 0;
        color: #54666d;
        font-size: 2.3rem;
        font-weight: 300;
        line-height: 1.3em;
    }

    .error-link {
        font-size: 1.4rem;
        line-height: 1;
        margin: 8px 0;
    }
    </style>
    </head>
    <body>
        <main role="main" id="main">
          <div class="gh-app">
              <div class="gh-viewport">
                  <div class="gh-view">
                    <section class="error-content error-404 js-error-container">
                      <section class="error-details">
                        <section class="error-message">
                          <h1 class="error-code">404</h1>
                          <h2 class="error-description">Page not found</h2>
                          <a class="error-link" href="${ghostUrl}">Go to the front page →</a>
                        </section>
                      </section>
                    </section>

                  </div>
              </div>
          </div>
        </main>
    </body>
    </html>
  `);
});

// GET: total count + whether THIS member has clapped
app.get("/get-claps", async (req, res) => {
  const raw = req.query.url || req.get("referer");
  const url = normUrl(raw || "");
  if (!url) return res.type("text/plain").send("0");

  const h = md5buf(url);
  const row = getCount.get(h);
  const count = row ? row.clap_count : 0;

  const memberId = await verifyGhostToken(req.headers.authorization || "");
  let has = 0;
  if (memberId) {
    const m = getMember.get(h, memberId);
    has = m ? 1 : 0;
  }
  res.setHeader("X-Has-Clapped", has ? "1" : "0");
  return res.type("text/plain").send(String(count));
});

// POST: toggle like/unlike
app.post("/update-claps", async (req, res) => {
  const raw = req.query.url || req.get("referer");
  const url = normUrl(raw || "");
  if (!url) return res.type("text/plain").send("0");

  const memberId = await verifyGhostToken(req.headers.authorization || "");
  if (!memberId) return res.sendStatus(401);

  const h = md5buf(url);
  const tx = db.transaction(() => {
    const already = getMember.get(h, memberId);
    let hasClapped;
    
    if (!already) {
      // Like: member hasn't clapped yet
      insertMember.run(h, memberId);
      upsertCount.run(h, url);
      hasClapped = 1;
    } else {
      // Unlike: member has already clapped, remove it
      deleteMember.run(h, memberId);
      decrementCount.run(h);
      hasClapped = 0;
    }
    
    const c = getCount.get(h);
    return { total: c ? c.clap_count : 0, hasClapped };
  });

  const result = tx();
  res.setHeader("X-Has-Clapped", String(result.hasClapped));
  return res.type("text/plain").send(String(result.total));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).send("Internal Server Error");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("applause API listening on :" + PORT);
  console.log("GHOST_URL:", GHOST_URL);
});