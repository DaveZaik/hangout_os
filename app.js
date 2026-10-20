/* ---- config: Cloudflare R2 (S3-compatible) handles photo/video storage; MongoDB stores everything else ---- */
const ASSETS = {
  wallpapers: {/* name:'url(img/wallpapers/name.jpg)' — see img/README.md */},
};
const ACC = ["#e07a5f", "#6a8caf", "#8e7dbe", "#5f9e6e", "#d4a017", "#c95d8a"],
  EMO = [
    "😎",
    "🙂",
    "🤠",
    "🦊",
    "🐱",
    "🐸",
    "👾",
    "🌸",
    "🔥",
    "🎧",
    "⚡",
    "🍕",
  ],
  NC = ["#ffe58f", "#ffc4b0", "#c5e8c0", "#bfe0ff"];
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const av = (a, n) =>
    /^(https?:|data:|img\/)/.test(a || "")
      ? `<img src="${esc(a)}" alt="${esc((n || "?")[0])}" onerror="this.outerHTML='<b>'+this.alt+'</b>'">`
      : esc(a || (n || "🙂")[0]),
  hue = (s) => ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) * 7) % 360;
let tok = localStorage.tok,
  D = {},
  page = 0,
  L = [],
  G = {},
  LOCAL = false;
/* ---- data layer: talks to /api (MongoDB). If no server is reachable it falls back to a localStorage demo so the app always works. ---- */
async function api(m, p, b) {
  if (!LOCAL) {
    const r = await fetch("/api/" + p, {
        method: m,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + (tok || ""),
        },
        body: b ? JSON.stringify(b) : undefined,
      }).catch(() => null),
      j = r && (await r.json().catch(() => null));
    if (j) {
      if (r.status === 401 && p !== "login") {
        logout();
        throw new Error("auth");
      }
      if (!r.ok) throw new Error(j.e || "Error");
      return j;
    }
    LOCAL = true;
    document.body.classList.add("local");
  }
  return mock(m, p, b);
}
const MK = "hos_db";
function mdb() {
  let d = JSON.parse(localStorage[MK] || "null");
  if (!d) {
    d = {
      users: SEED.users.map((u, i) => ({
        ...u,
        id: "u" + i,
        pw: u.name.toLowerCase(),
      })),
      hangouts: SEED.hangouts.map((h, i) => ({ ...h, _id: "h" + i })),
      notes: SEED.notes.map((n, i) => ({
        ...n,
        _id: "n" + i,
        votes: [],
        by: "",
      })),
      comments: [],
      messages: [],
    };
    localStorage[MK] = JSON.stringify(d);
  }
  return d;
}
async function mock(m, p, b = {}) {
  const d = mdb(),
    [x, i, sub] = p.split("/"),
    k = m + " " + x + (sub ? "/" + sub : ""),
    rid = () => Math.random().toString(36).slice(2, 10),
    ok = (v) => {
      localStorage[MK] = JSON.stringify(d);
      return v;
    },
    pub = (u) => ({
      id: u.id,
      name: u.name,
      avatar: u.avatar,
      wallpaper: u.wallpaper,
      accent: u.accent,
      admin: !!u.admin,
      ambient: u.ambient,
      volume: u.volume,
      clicks: u.clicks,
    }),
    me =
      (tok || "").startsWith("local:") &&
      d.users.find((u) => u.id === tok.slice(6));
  if (k === "GET users") return d.users.map(pub);
  if (k === "POST login") {
    const u = d.users.find((u) => u.id === b.id);
    if (!u || u.pw !== String(b.password || ""))
      throw new Error("Wrong password");
    return { token: "local:" + u.id, me: pub(u) };
  }
  if (!me) {
    logout();
    throw new Error("auth");
  }
  if (k === "GET data")
    return {
      me: pub(me),
      users: d.users.map(pub),
      hangouts: [...d.hangouts].sort((a, b) =>
        (b.date || "").localeCompare(a.date || ""),
      ),
      notes: d.notes,
      comments: d.comments,
      messages: d.messages,
    };
  if (k === "PUT me") {
    for (const f of ["name", "wallpaper", "accent", "avatar"])
      if (typeof b[f] === "string" && b[f]) me[f] = b[f];
    if (typeof b.ambient === "number") me.ambient = b.ambient;
    if (typeof b.volume === "number")
      me.volume = Math.max(0, Math.min(100, b.volume));
    if (typeof b.clicks === "number") me.clicks = b.clicks;
    if (b.password) me.pw = b.password;
    return ok({});
  }
  if (k === "POST notes") {
    d.notes.push({
      _id: rid(),
      kind: b.kind === "place" ? "📍 Place" : "🎯 Activity",
      text: b.text,
      votes: [me.id],
      by: me.id,
    });
    return ok({});
  }
  if (k === "POST notes/vote") {
    const n = d.notes.find((n) => n._id === i);
    n.votes = n.votes.includes(me.id)
      ? n.votes.filter((v) => v !== me.id)
      : [...n.votes, me.id];
    return ok({});
  }
  if (k === "POST comments") {
    d.comments.push({
      _id: rid(),
      hangout: b.hangout,
      user: me.id,
      text: b.text,
      at: Date.now(),
    });
    return ok({});
  }
  if (k === "DELETE comments") {
    const c = d.comments.find((c) => c._id === i);
    if (c && (me.admin || c.user === me.id))
      d.comments = d.comments.filter((c) => c._id !== i);
    return ok({});
  }
  const isDm = i.startsWith("dm:"),
    participants = isDm ? i.slice(3).split(":") : [];
  if (
    isDm &&
    (participants.length !== 2 ||
      participants[0] >= participants[1] ||
      !participants.includes(me.id) ||
      participants.some((id) => !d.users.some((u) => u.id === id)))
  )
    throw new Error("not a participant");
  const thread = i === "all" ? "all" : isDm ? i : me.admin ? i : me.id;
  if (k === "GET messages")
    return d.messages.filter((x) => x.thread === thread);
  if (k === "POST messages") {
    d.messages.push({
      _id: rid(),
      thread,
      from: me.id,
      text: b.text,
      at: Date.now(),
    });
    return ok({});
  }
  if (!me.admin) throw new Error("admin only");
  if (k === "POST hangouts") {
    const _id = rid();
    d.hangouts.push({ _id, ...b });
    return ok({ id: _id });
  }
  if (k === "PUT hangouts") {
    Object.assign(
      d.hangouts.find((h) => h._id === i),
      b,
    );
    return ok({});
  }
  if (k === "DELETE hangouts") {
    d.hangouts = d.hangouts.filter((h) => h._id !== i);
    return ok({});
  }
  if (k === "DELETE notes") {
    d.notes = d.notes.filter((n) => n._id !== i);
    return ok({});
  }
  if (k === "POST users") {
    d.users.push({
      id: rid(),
      name: b.name,
      avatar: b.avatar || "🙂",
      wallpaper: "peach",
      accent: "#e07a5f",
      pw: b.password || b.name.toLowerCase(),
      ambient: 0,
      volume: 50,
      clicks: 0,
    });
    return ok({});
  }
  if (k === "PUT users") {
    d.users.find((u) => u.id === i).pw = b.password;
    return ok({});
  }
  if (k === "DELETE users") {
    d.users = d.users.filter((u) => u.id !== i || i === me.id);
    return ok({});
  }
  throw new Error("not found");
}
const shrink = (f, max) =>
  new Promise((res, rej) => {
    const i = new Image(),
      u = URL.createObjectURL(f);
    i.onload = () => {
      const k = Math.min(1, max / Math.max(i.width, i.height)),
        c = document.createElement("canvas");
      c.width = Math.round(i.width * k);
      c.height = Math.round(i.height * k);
      c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u);
      let q = 0.8,
        o;
      do {
        o = c.toDataURL(max <= 256 ? "image/png" : "image/jpeg", q);
        q -= 0.15;
      } while (o.length > 350000 && q > 0.2);
      res(o);
    };
    i.onerror = () => rej(new Error("Could not read that image"));
    i.src = u;
  });
const Bayer = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const ditherPixel = (ctx, w, h, imgData) => {
  const d = imgData.data;
  let minR = 255,
    minG = 255,
    minB = 255,
    maxR = 0,
    maxG = 0,
    maxB = 0;
  for (let i = 0; i < d.length; i += 4) {
    minR = Math.min(minR, d[i]);
    minG = Math.min(minG, d[i + 1]);
    minB = Math.min(minB, d[i + 2]);
    maxR = Math.max(maxR, d[i]);
    maxG = Math.max(maxG, d[i + 1]);
    maxB = Math.max(maxB, d[i + 2]);
  }
  const rangeR = maxR - minR || 1,
    rangeG = maxG - minG || 1,
    rangeB = maxB - minB || 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const m = Bayer[y % 4][x % 4] / 16 - 0.5;
      const r = (d[i] - minR) / rangeR,
        g = (d[i + 1] - minG) / rangeG,
        b = (d[i + 2] - minB) / rangeB;
      const gammaLift = (v) =>
        Math.pow(Math.min(1, Math.max(0, v + 0.05)), 0.8) * 255;
      d[i] = Math.min(
        255,
        Math.max(0, Math.round((gammaLift(r) + m * 255) / 64) * 64),
      );
      d[i + 1] = Math.min(
        255,
        Math.max(0, Math.round((gammaLift(g) + m * 255) / 64) * 64),
      );
      d[i + 2] = Math.min(
        255,
        Math.max(0, Math.round((gammaLift(b) + m * 255) / 64) * 64),
      );
    }
};
const retroWallpaper = (f) =>
  new Promise((res, rej) => {
    const i = new Image(),
      u = URL.createObjectURL(f);
    i.onload = () => {
      const sw = 240,
        sh = Math.round((i.height * sw) / i.width),
        c = document.createElement("canvas");
      c.width = sw;
      c.height = sh;
      const ctx = c.getContext("2d");
      ctx.drawImage(i, 0, 0, sw, sh);
      URL.revokeObjectURL(u);
      const imgData = ctx.getImageData(0, 0, sw, sh);
      ditherPixel(ctx, sw, sh, imgData);
      ctx.putImageData(imgData, 0, 0);
      res(c.toDataURL("image/png"));
    };
    i.onerror = () => rej(new Error("Could not read that image"));
    i.src = u;
  });
const drawPixelScene = (name) => {
  const c = document.createElement("canvas");
  c.width = 160;
  c.height = 90;
  const ctx = c.getContext("2d");
  const sky =
    name === "peach"
      ? ["#e3c2b3", "#d4b0a0", "#c59d8d"]
      : name === "dusk"
        ? ["#355c7d", "#4a5b6d", "#6c5b7b", "#c06c84"]
        : name === "lilac"
          ? ["#cdb4db", "#c4a8d8", "#bb9cd5", "#a2d2ff"]
          : name === "moss"
            ? ["#b7c9a8", "#9fbc94", "#87b280", "#4f7942"]
            : name === "ember"
              ? ["#ffb26b", "#ff8a50", "#e4572e", "#5b2a3f"]
              : ["#1b1f3b", "#252a4d", "#3b2f63", "#7a4f8f"];
  const bands = name === "dusk" || name === "ember" || name === "night" ? 4 : 3;
  const bandH = 50 / bands;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = sky[i];
    ctx.fillRect(0, i * bandH, 160, bandH + 1);
  }
  if (name === "peach" || name === "lilac" || name === "moss") {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(120, 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (name === "dusk" || name === "night") {
    ctx.fillStyle = "#ffe58f";
    ctx.beginPath();
    ctx.arc(120, 25, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (name === "night") {
    ctx.fillStyle = "#fff";
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 160,
        y = Math.random() * 40;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (name === "ember") {
    ctx.fillStyle = "#ff6b35";
    ctx.beginPath();
    ctx.arc(120, 18, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  const mountain = [
    [0, 50],
    [20, 40],
    [40, 45],
    [60, 35],
    [80, 42],
    [100, 38],
    [120, 44],
    [140, 36],
    [160, 45],
    [160, 90],
    [0, 90],
  ];
  ctx.fillStyle =
    name === "peach"
      ? "#8b7355"
      : name === "dusk"
        ? "#2a3a4a"
        : name === "lilac"
          ? "#8b7ba8"
          : name === "moss"
            ? "#3d5a2e"
            : name === "ember"
              ? "#3a1f2f"
              : "#151030";
  ctx.beginPath();
  ctx.moveTo(0, 90);
  mountain.forEach((p) => ctx.lineTo(p[0], p[1]));
  ctx.lineTo(160, 90);
  ctx.fill();
  return c.toDataURL("image/png");
};
const WP = {
  peach: drawPixelScene("peach"),
  dusk: drawPixelScene("dusk"),
  lilac: drawPixelScene("lilac"),
  moss: drawPixelScene("moss"),
  ember: drawPixelScene("ember"),
  night: drawPixelScene("night"),
};
Object.assign(WP, ASSETS.wallpapers);
async function up(f, max = 1280, uploadType = "avatar") {
  try {
    const r = await fetch("/api/upload-url", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer " + tok,
      },
      body: JSON.stringify({
        contentType: f.type,
        size: f.size,
        type: uploadType,
      }),
    });
    if (!r.ok) throw new Error("R2 not configured or upload denied");
    const { presignedPutUrl, publicUrl } = await r.json();
    const u = await fetch(presignedPutUrl, {
      method: "PUT",
      headers: { "Content-Type": f.type },
      body: f,
    });
    if (!u.ok) throw new Error("Upload to R2 failed");
    return {
      url: publicUrl,
      video: f.type.startsWith("video") ? 1 : 0,
      caption: f.name.replace(/\.\w+$/, ""),
    };
  } catch (e) {
    if (f.type.startsWith("image"))
      return {
        url: await shrink(f, max),
        video: 0,
        caption: f.name.replace(/\.\w+$/, ""),
      };
    if (f.size > 1.5e6)
      throw new Error(
        "File too big for demo mode — set up R2 environment variables.",
      );
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () =>
        res({
          url: r.result,
          video: f.type.startsWith("video") ? 1 : 0,
          caption: f.name.replace(/\.\w+$/, ""),
        });
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }
}
const logout = () => {
  stopCharAnim();
  localStorage.removeItem("tok");
  location.reload();
};
const load = async () => {
  D = await api("GET", "data");
};

/* ---- pixel art icons ---- */
const art = (rows, pal) =>
  `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges">${rows.map((r, y) => [...r].map((c, x) => (pal[c] ? `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[c]}"/>` : "")).join("")).join("")}</svg>`;
const CHIBI = {
  david: {
    hair: "#33231d",
    skin: "#d49470",
    shirt: "#3f6f89",
    detail: "#efcf7e",
    hairStyle: "short",
    accessory: "glasses",
  },
  shelly: {
    hair: "#59392d",
    skin: "#bd8062",
    shirt: "#bd625b",
    detail: "#f2c66d",
    hairStyle: "long",
    accessory: "flower",
  },
  nelly: {
    hair: "#241b1a",
    skin: "#9c644a",
    shirt: "#d989a4",
    detail: "#f2d281",
    hairStyle: "coils",
    accessory: "bow",
  },
  beckham: {
    hair: "#34251f",
    skin: "#e0ae8e",
    shirt: "#4f8a70",
    detail: "#f0d178",
    hairStyle: "short",
  },
  ted: {
    hair: "#765039",
    skin: "#e5b99c",
    shirt: "#658bb3",
    detail: "#f2c66d",
    hairStyle: "short",
    accessory: "glasses",
  },
  claire: {
    hair: "#745032",
    skin: "#f0c7a8",
    shirt: "#b989ca",
    detail: "#f2d281",
    hairStyle: "long",
    accessory: "clip",
  },
  violet: {
    hair: "#33222a",
    skin: "#dca184",
    shirt: "#7565a5",
    detail: "#f4c86f",
    hairStyle: "long",
    accessory: "bow",
  },
  sharon: {
    hair: "#35231c",
    skin: "#a86c50",
    shirt: "#c57c52",
    detail: "#f2d281",
    hairStyle: "braids",
    accessory: "clip",
  },
  michael: {
    hair: "#30221d",
    skin: "#b97b5b",
    shirt: "#56829b",
    detail: "#f0cd77",
    hairStyle: "short",
    accessory: "glasses",
  },
  mercy: {
    hair: "#211918",
    skin: "#955d47",
    shirt: "#c26c83",
    detail: "#f2d281",
    hairStyle: "braids",
    accessory: "flower",
  },
  njeri: {
    hair: "#241b1a",
    skin: "#8f5943",
    shirt: "#6b8a68",
    detail: "#f2d281",
    hairStyle: "coils",
    accessory: "bow",
  },
};
function chibi(user) {
  const name = user.name || "Neighbor",
    slug = name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    hash = [...slug].reduce((n, c) => n + c.charCodeAt(0), 0),
    skinTones = ["#f0c7a8", "#dca184", "#bd8062", "#a86c50", "#955d47"];
  const c = CHIBI[slug] || {
    hair: `hsl(${hue(name)} 30% 24%)`,
    skin: skinTones[hash % skinTones.length],
    shirt: `hsl(${(hue(name) + 155) % 360} 42% 48%)`,
    detail: "#f0cd77",
    hairStyle: ["short", "long", "coils", "braids"][hash % 4],
    accessory: ["clip", "glasses", "bow"][hash % 3],
  };
  const hair = {
    short: "M14 29V19l6-7 9-3h10l9 6 4 9-3 8-5-3v-7l-8 3H25v-3l-6 8z",
    long: "M14 29V18l7-7h22l8 8v31h-8V29H21v21h-7V29z",
    coils:
      "M14 29V18l5-2v-5h7V8h7v3h6V8h7v5h5v7l3 4-4 7-5-3v-6l-7 3H25v-3l-6 8z",
    braids:
      "M14 29V18l7-7h22l8 8v8l-5 3v-7l-7 2H25v-3l-6 8z M15 31h5v15h-5z M44 30h5v16h-5z",
  }[c.hairStyle];
  const accessory =
    c.accessory === "glasses"
      ? '<g fill="none" stroke="#30221e" stroke-width="2"><rect x="20" y="26" width="10" height="8" rx="2"/><rect x="34" y="26" width="10" height="8" rx="2"/><path d="M30 29h4"/></g>'
      : c.accessory === "bow"
        ? `<path d="M39 11l-5-5v8l5 3 5-3V6z" fill="${c.detail}" stroke="#30221e" stroke-width="1.5"/>`
        : c.accessory === "flower"
          ? `<g fill="${c.detail}" stroke="#30221e" stroke-width="1"><circle cx="43" cy="13" r="3"/><circle cx="39" cy="15" r="3"/><circle cx="45" cy="18" r="3"/><circle cx="49" cy="15" r="3"/><circle cx="44" cy="15" r="2" fill="#fff0ad"/></g>`
          : `<path d="M41 12l3-4 3 4-3 4z" fill="${c.detail}" stroke="#30221e" stroke-width="1.5"/>`;
  return `<svg viewBox="0 0 64 72" role="img" aria-label="${esc(name)} chibi" shape-rendering="crispEdges"><ellipse cx="32" cy="67" rx="17" ry="3" fill="#241a18" opacity=".22"/><path d="M23 53h8v10h-8zM34 53h8v10h-8z" fill="#40302b"/><path d="M20 62h12v5H18v-2zM34 62h12v5H34z" fill="#30221e"/><path d="M20 42h24l5 13-9 4H24l-9-4z" fill="${c.shirt}" stroke="#30221e" stroke-width="2"/><path d="M20 45l-6 9 5 3 7-8M44 45l6 9-5 3-7-8" fill="${c.skin}" stroke="#30221e" stroke-width="2"/><path d="M28 38h8v8h-8z" fill="${c.skin}"/><path d="M17 20q0-10 15-10t15 10v16q0 10-15 10T17 36z" fill="${c.skin}" stroke="#30221e" stroke-width="2"/>${`<path d="${hair}" fill="${c.hair}" stroke="#30221e" stroke-width="2" stroke-linejoin="round"/>`}<path d="M24 34v3M40 34v3" stroke="#30221e" stroke-width="2" stroke-linecap="square"/><path d="M28 40q4 4 8 0" fill="none" stroke="#9e514b" stroke-width="1.5"/><path d="M21 38h3M40 38h3" stroke="#e88c83" stroke-width="2" stroke-linecap="square"/>${accessory}<path d="M32 47v6" stroke="${c.detail}" stroke-width="2"/></svg>`;
}
const FOLDER = [
  ".kkkkkk.........",
  "kaaaaaak........",
  "kaaaaaakkkkkkkk.",
  "kabbbbbbbbbbbbak",
  "kabbbbbbbbbbbbak",
  "kabbbbbbbbbbbbak",
  "kabbbbbbbbbbbbak",
  "kabbbbbbbbbbbbak",
  "kabbbbbbbbbbbbak",
  "kaaaaaaaaaaaaaak",
  "kkkkkkkkkkkkkkkk",
];
const BOARD = [
  "kkkkkkkkkkkkkk",
  "kaaaaaaaaaaaak",
  "kayyyaaappppak",
  "kayyyaaappppak",
  "kayyyaaappppak",
  "kaaaaaaaaaaaak",
  "kagggggaaabbak",
  "kagggggaaabbak",
  "kagggggaaabbak",
  "kaaaaaaaaaaaak",
  "kkkkkkkkkkkkkk",
];
const CHAT = [
  "..kkkkkkkkkk..",
  ".kaaaaaaaaaak.",
  "kaaaaaaaaaaaak",
  "kaakaakaakaaak",
  "kaaaaaaaaaaaak",
  ".kaaaaaaaaaak.",
  "..kkkkkaakkk..",
  ".....kaak.....",
  "......kk......",
];
const NEIGHBOR = [
  "kkkkkkkkkkkkkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkaaaawwkaaakkk",
  "kkkkkkkkkkkkkk",
];
const K = "#241a18",
  SYS = {
    pics: {
      l: "Pictures",
      img: art(FOLDER, { k: K, a: "#4aa3e8", b: "#9bd8ff" }),
      open: () => folder(0),
    },
    vids: {
      l: "Videos",
      img: art(FOLDER, { k: K, a: "#ee7b4d", b: "#ffc4a3" }),
      open: () => folder(1),
    },
    board: {
      l: "Ideas",
      img: art(BOARD, {
        k: K,
        a: "#d8a56a",
        y: "#ffe58f",
        p: "#ffb3a0",
        g: "#b8e3a8",
        b: "#a8d4ff",
      }),
      open: () => board(),
    },
    chat: {
      l: "Chat",
      img: art(CHAT, { k: K, a: "#fff" }),
      open: () => chat(),
    },
    neighbors: {
      l: "Neighbors",
      img: art(NEIGHBOR, { k: K, a: "#6a8caf", w: "#fff" }),
      open: () => neighbors(),
    },
    get me() {
      return {
        l: "Profile",
        img: `<div class="tl" style="background:#fff">${av(D.me.avatar, D.me.name)}</div>`,
        open: () => profile(),
      };
    },
  };
const thumb = (h) => {
  const m = h.media.find((m) => m.url && !m.video);
  return m
    ? `<img src="${esc(m.url)}">`
    : `<div class="tl" style="background:hsl(${hue(h.title)} 55% 62%)">${esc(h.emoji)}</div>`;
};
const info = (id) =>
  id[0] === "s"
    ? SYS[id.slice(2)]
    : ((h) => h && { l: h.title, img: thumb(h), open: () => hangout(h._id) })(
        D.hangouts.find((x) => x._id === id.slice(2)),
      );

/* ---- procedural scatter + automatic pages ---- */
function grid() {
  const W = innerWidth,
    Hh = innerHeight,
    m = W < 700,
    top = m ? 72 : 80,
    bot = 66,
    cs = m ? 106 : 132,
    cols = Math.max(2, (W / cs) | 0),
    rows = Math.max(2, ((Hh - top - bot) / cs) | 0);
  G = {
    cs,
    cols,
    rows,
    cap: Math.max(3, Math.min(m ? 9 : 12, Math.floor(cols * rows * 0.7))),
    ox: (W - cols * cs) / 2,
    oy: top + (Hh - top - bot - rows * cs) / 2,
  };
  G.key = [cols, rows, G.cap].join();
}
function put(id) {
  let p = L.find((p) => p.n.length < G.cap);
  if (!p) L.push((p = { n: [] }));
  const u = new Set(p.n.map((n) => n.c));
  let c;
  do c = (Math.random() * G.cols * G.rows) | 0;
  while (u.has(c));
  p.n.push({
    id,
    c,
    x: G.ox + (c % G.cols) * G.cs + Math.random() * (G.cs - 96),
    y: G.oy + Math.floor(c / G.cols) * G.cs + Math.random() * (G.cs - 100),
    r: Math.random() * 6 - 3,
  });
}
function sync() {
  const want = [
    ...Object.keys(SYS).map((k) => "s:" + k),
    ...D.hangouts.map((h) => "h:" + h._id),
  ];
  L.forEach((p) => (p.n = p.n.filter((n) => want.includes(n.id))));
  const have = L.flatMap((p) => p.n.map((n) => n.id));
  want.filter((i) => !have.includes(i)).forEach(put);
  L = L.filter((p) => p.n.length);
  page = Math.min(page, L.length - 1);
}
function draw() {
  const box = $("#icons");
  box.innerHTML = "";
  L[page].n.forEach((n, i) => {
    const f = info(n.id);
    if (!f) return;
    const e = document.createElement("div");
    e.className = "ic";
    e.style.cssText = `left:${n.x}px;top:${n.y}px;transform:rotate(${n.r}deg);animation-delay:${i * 45}ms`;
    e.innerHTML = `<div class="im">${f.img}</div><span>${esc(f.l)}</span>`;
    e.onclick = () => {
      resumeAudio();
      sfx.click();
      f.open();
    };
    box.appendChild(e);
  });
  $("#pg").textContent = `${page + 1}/${L.length}`;
}
const go = (d) => {
  page = (page + d + L.length) % L.length;
  draw();
  sfx.page();
};
const pageOf = (id) => {
  const i = L.findIndex((p) => p.n.some((n) => n.id === "h:" + id));
  if (i >= 0) {
    page = i;
    draw();
  }
};

/* ---- windows ---- */
const W = {};
let z = 10;
const MAX_ICON = [
  "kkkkkkk",
  "kakkkkk",
  "kakkkkk",
  "kakkkkk",
  "kakkkkk",
  "kakkkkk",
  "kkkkkkk",
];
const REST_ICON = [
  "kkkkkkk",
  "kakkkkk",
  "kabbbbb",
  "kabbbbb",
  "kabbbbb",
  "kakkkkk",
  "kkkkkkk",
];
const MIN_ICON = [
  "kkkkkkk",
  "k..kkkk",
  "k..kkkk",
  "k..kkkk",
  "k..kkkk",
  "k..kkkk",
  "kkkkkkk",
];
const MAX_BTN = art(MAX_ICON, { k: "transparent", a: "#fff" }),
  REST_BTN = art(REST_ICON, { k: "transparent", a: "#fff", b: "#fff" }),
  MIN_BTN = art(MIN_ICON, { k: "transparent", a: "#fff" });
function win(id, title, fn, keep) {
  let w = W[id];
  if (!w) {
    w = W[id] = document.createElement("div");
    w.className = "win" + (id === "chat" ? " chat-window" : "");
    w.innerHTML =
      '<div class="tb"><b></b><button class="min-btn"></button><button class="max-btn"></button><i></i></div><div class="bd"></div>';
    const o = (Object.keys(W).length % 5) * 28;
    w.querySelector("b").textContent = title;
    $("#wins").appendChild(w);
    if (innerWidth < 700) {
      w.style.left = "8px";
      w.style.top = "64px";
      w.style.right = "8px";
      w.style.bottom = "66px";
      w.style.width = "auto";
      w.style.height = "auto";
      w._max = true;
      w.querySelector(".max-btn").style.display = "none";
    } else {
      w.style.left = Math.max(8, innerWidth / 2 - 280 + o - 40) + "px";
      w.style.top = 90 + o + "px";
      w._max = false;
    }
    w.querySelector("i").onclick = () => shut(id);
    w.onpointerdown = () => (w.style.zIndex = ++z);
    const minBtn = w.querySelector(".min-btn");
    minBtn.innerHTML = MIN_BTN;
    minBtn.onclick = (e) => {
      e.stopPropagation();
      minimize(id);
    };
    const maxBtn = w.querySelector(".max-btn");
    maxBtn.innerHTML = MAX_BTN;
    maxBtn.onclick = (e) => {
      e.stopPropagation();
      toggleMax(id);
    };
    const t = w.querySelector(".tb");
    t.onpointerdown = (e) => {
      if (e.target.tagName === "I" || e.target.tagName === "BUTTON") return;
      if (innerWidth < 700) return;
      const ox = e.clientX - w.offsetLeft,
        oy = e.clientY - w.offsetTop;
      t.setPointerCapture(e.pointerId);
      t.onpointermove = (e) => {
        w.style.left = e.clientX - ox + "px";
        w.style.top = Math.max(0, e.clientY - oy) + "px";
      };
      t.onpointerup = () => (t.onpointermove = null);
    };
    t.ondblclick = (e) => {
      if (
        innerWidth < 700 ||
        e.target.tagName === "I" ||
        e.target.tagName === "BUTTON"
      )
        return;
      toggleMax(id);
    };
  }
  w._f = fn;
  w._k = keep;
  w.style.zIndex = ++z;
  fn(w.querySelector(".bd"));
  sfx.open();
}
const shut = (id) => {
  const w = W[id];
  if (w) {
    w.style.animation = "winClose .2s forwards";
    sfx.close();
    setTimeout(() => {
      w.remove();
      delete W[id];
    }, 200);
  }
};
const minimize = (id) => {
  const w = W[id];
  if (!w) return;
  w._preL = w.style.left;
  w._preT = w.style.top;
  w._preW = w.style.width;
  w._preH = w.style.height;
  w.style.left = "-9999px";
  w.style.top = "-9999px";
  w._min = true;
  w.querySelector(".min-btn").innerHTML = MAX_BTN;
  w.querySelector(".min-btn").onclick = (e) => {
    e.stopPropagation();
    restore(id);
  };
};
const restore = (id) => {
  const w = W[id];
  if (!w) return;
  if (w._min) {
    w.style.left = w._preL;
    w.style.top = w._preT;
    w.style.width = w._preW;
    w.style.height = w._preH;
    w._min = false;
    w.querySelector(".min-btn").innerHTML = MIN_BTN;
    w.querySelector(".min-btn").onclick = (e) => {
      e.stopPropagation();
      minimize(id);
    };
  } else if (w._max) {
    w.style.left = w._preL;
    w.style.top = w._preT;
    w.style.width = w._preW;
    w.style.height = w._preH;
    w.style.animation = "winZoomOut .2s forwards";
    w._max = false;
    w.querySelector(".max-btn").innerHTML = MAX_BTN;
    sfx.restore();
  }
};
const toggleMax = (id) => {
  const w = W[id];
  if (!w) return;
  if (w._max) {
    restore(id);
  } else {
    w._preL = w.style.left;
    w._preT = w.style.top;
    w._preW = w.style.width;
    w._preH = w.style.height;
    const top = $("#pills").offsetHeight + 8,
      bottom = $("#bar").offsetHeight;
    w.style.left = "8px";
    w.style.top = top + "px";
    w.style.width = "calc(100% - 16px)";
    w.style.height = "calc(100% - " + top + "px - " + bottom + "px)";
    w.style.animation = "winZoomIn .2s forwards";
    w._max = true;
    w.querySelector(".max-btn").innerHTML = REST_BTN;
    sfx.max();
  }
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const topId = Object.keys(W).reduce(
      (a, k) => (!a || W[k].style.zIndex > W[a].style.zIndex ? k : a),
      null,
    );
    if (topId) {
      const w = W[topId];
      if (w._max || w._min) restore(topId);
      else shut(topId);
    }
  }
});
const refresh = () =>
  Object.values(W).forEach((w) => {
    if (!w._k) w._f(w.querySelector(".bd"));
  });
async function reload() {
  await load();
  sync();
  draw();
  refresh();
  theme();
}
const act = async (f) => {
  try {
    await f();
    await reload();
  } catch (e) {
    sfx.error();
    alert(e.message);
  }
};

/* ---- viewers ---- */
const tile = (h, i, cap) => {
  const m = h.media[i];
  return `<div class="tile" data-h="${h._id}" data-i="${i}" style="background:hsl(${hue(h.title) + i * 30} 55% 62%)">${m.url ? (m.video ? `<video src="${esc(m.url)}#t=0.1" preload="metadata" muted></video><span class="pl">▶</span>` : `<img loading="lazy" src="${esc(m.url)}">`) : esc(m.e || "🖼️")}<div class="cp">${esc(cap ?? m.caption)}</div></div>`;
};
const wire = (bd) =>
  bd.querySelectorAll(".tile").forEach(
    (t) =>
      (t.onclick = () =>
        view(
          D.hangouts.find((x) => x._id === t.dataset.h),
          +t.dataset.i,
        )),
  );
function view(h, i) {
  const m = h.media[i],
    v = $("#vw");
  v.innerHTML = `<div class="vc">${m.url ? (m.video ? `<video src="${esc(m.url)}" controls autoplay playsinline></video>` : `<img src="${esc(m.url)}">`) : `<div class="big" style="background:hsl(${hue(h.title) + i * 30} 55% 62%)">${esc(m.e || "🖼️")}</div>`}</div>
 <div>${esc(m.caption || "")} — ${esc(h.title)}</div><div><button class="btn" id="v1">Open hangout</button> ${D.me.admin ? '<button class="btn" id="v2">Remove</button> ' : ""}<button class="btn p" id="v3">Close</button></div>`;
  v.style.display = "flex";
  const close = () => {
    v.style.display = "none";
    v.innerHTML = "";
  };
  v.onclick = (e) => {
    if (e.target === v) close();
  };
  $("#v3").onclick = close;
  $("#v1").onclick = () => {
    close();
    hangout(h._id);
  };
  if (D.me.admin)
    $("#v2").onclick = () => {
      if (confirm("Remove this item?")) {
        close();
        act(() =>
          api("PUT", "hangouts/" + h._id, {
            ...h,
            media: h.media.filter((_, j) => j !== i),
          }),
        );
      }
    };
}

/* ---- apps ---- */
function hangout(id) {
  win(
    "h" + id,
    (D.hangouts.find((x) => x._id === id) || {}).title || "",
    (bd) => {
      const h = D.hangouts.find((x) => x._id === id);
      if (!h) return shut("h" + id);
      const cs = (D.comments || [])
          .filter((c) => c.hangout === id)
          .sort((a, b) => a.at - b.at),
        un = (u) => D.users.find((x) => x.id === u) || { name: "?" };
      bd.innerHTML = `<div style="font-size:34px">${esc(h.emoji)}</div><div class="meta">${esc(h.date)}${h.place ? " · 📍 " + esc(h.place) : ""}${h.who ? " · " + esc(h.who) : ""}</div><p class="story">${esc(h.story)}</p>
 <h4>GALLERY (${h.media.length})</h4><div class="grid">${h.media.map((_, i) => tile(h, i)).join("") || "<i>Nothing here yet.</i>"}</div>
 <h4>COMMENTS (${cs.length})</h4>${cs.map((c) => `<div class="cm"><div class="av sm">${av(un(c.user).avatar, un(c.user).name)}</div><div style="flex:1"><b>${esc(un(c.user).name)}</b> <small>${new Date(c.at).toLocaleDateString()}</small><div>${esc(c.text)}</div></div>${c.user === D.me.id || D.me.admin ? `<span class="x" data-cd="${c._id}">✕</span>` : ""}</div>`).join("")}
 <div class="row" style="margin-top:10px"><input id="ci" placeholder="What did you think of this one?"><button class="btn p" id="cp">Post</button></div>
 ${D.me.admin ? `<p style="margin-top:14px"><button class="btn" id="he">Edit</button> <label class="btn p">+ Upload<input hidden type="file" multiple accept="image/*,video/*"></label> <button class="btn" id="hd">Delete</button></p>` : ""}`;
      wire(bd);
      const post = () => {
        const t = bd.querySelector("#ci").value.trim();
        if (t)
          act(async () => {
            await api("POST", "comments", { hangout: id, text: t });
            sfx.comment();
          });
      };
      bd.querySelector("#cp").onclick = post;
      bd.querySelector("#ci").onkeydown = (e) => {
        if (e.key === "Enter") post();
      };
      bd.querySelectorAll("[data-cd]").forEach(
        (x) =>
          (x.onclick = () =>
            act(() => api("DELETE", "comments/" + x.dataset.cd))),
      );
      if (!D.me.admin) return;
      bd.querySelector("#he").onclick = () => form(h);
      bd.querySelector("#hd").onclick = () => {
        if (confirm("Delete this hangout?"))
          act(() => api("DELETE", "hangouts/" + id));
      };
      bd.querySelector("input[type=file]").onchange = (e) =>
        act(async () => {
          const media = [...h.media];
          for (const f of e.target.files)
            media.push(await up(f, 1280, "hangout"));
          await api("PUT", "hangouts/" + id, { ...h, media });
          sfx.upload();
        });
    },
  );
}
function folder(v) {
  win("f" + v, v ? "Videos" : "Pictures", (bd) => {
    const a = D.hangouts
      .flatMap((h) => h.media.map((m, i) => ({ h, i, m })))
      .filter((x) => !!x.m.video === !!v);
    bd.innerHTML = `<div class="meta">${a.length} item${a.length == 1 ? "" : "s"} from all hangouts</div><div class="grid" style="margin-top:10px">${a.map((x) => tile(x.h, x.i, x.h.title)).join("")}</div>`;
    wire(bd);
  });
}
function board() {
  win("board", "Ideas", (bd) => {
    const by = (id) => (D.users.find((u) => u.id === id) || {}).name || "";
    bd.innerHTML = `<div class="row"><select id="bk" style="width:auto;margin:0"><option value="place">📍 Place</option><option value="act">🎯 Activity</option></select><input id="bn" placeholder="Pitch a place or hangout idea…"><button class="btn p" id="ba">Pin</button></div>
 <div class="notes">${[...D.notes]
   .sort((a, b) => b.votes.length - a.votes.length)
   .map(
     (n, i) =>
       `<div class="note" style="background:${NC[i % 4]};--r:${((i % 3) - 1) * 1.5}deg"><small>${esc(n.kind)} ${by(n.by) ? "· " + esc(by(n.by)) : ""}</small><div>${esc(n.text)}</div><button class="btn" data-v="${n._id}">▲ ${n.votes.length}${n.votes.includes(D.me.id) ? " ✓" : ""}</button>${D.me.admin ? `<b data-d="${n._id}">✕</b>` : ""}</div>`,
   )
   .join("")}</div>`;
    const add = () => {
      const t = bd.querySelector("#bn").value.trim();
      if (t)
        act(() =>
          api("POST", "notes", {
            kind: bd.querySelector("#bk").value,
            text: t,
          }),
        );
    };
    bd.querySelector("#ba").onclick = add;
    bd.querySelector("#bn").onkeydown = (e) => {
      if (e.key === "Enter") add();
    };
    bd.querySelectorAll("[data-v]").forEach(
      (b) =>
        (b.onclick = () =>
          act(async () => {
            await api("POST", "notes/" + b.dataset.v + "/vote");
            sfx.vote();
          })),
    );
    bd.querySelectorAll("[data-d]").forEach(
      (b) =>
        (b.onclick = () => act(() => api("DELETE", "notes/" + b.dataset.d))),
    );
  });
}
function neighbors() {
  win("neighbors", "Neighbors", (bd) => {
    const others = D.users.filter((u) => u.id !== D.me.id);
    bd.innerHTML = `<div class="meta">${others.length} neighbor${others.length == 1 ? "" : "s"}</div><div class="grid">${others
      .map((u) => {
        const wp = WP[u.wallpaper] || u.wallpaper;
        return `<div class="nb-card" data-uid="${u.id}" style="background:${u.accent}22"><div class="nb-thumb" style="background:${wp.startsWith("url") ? wp : `url(${wp})`} center/cover"></div><div class="nb-name">${esc(u.name)}</div></div>`;
      })
      .join("")}</div>`;
    bd.querySelectorAll(".nb-card").forEach(
      (c) => (c.onclick = () => neighborDetail(c.dataset.uid)),
    );
  });
}
function neighborDetail(uid) {
  const u = D.users.find((x) => x.id === uid);
  if (!u) return;
  const comments = (D.comments || []).filter((c) => c.user === uid).length;
  const pinned = (D.notes || []).filter((n) => n.by === uid).length;
  const wp = WP[u.wallpaper] || u.wallpaper;
  const isMobile = innerWidth < 700;
  const id = "nb-" + uid;
  const loadChar = (el) => {
    el.innerHTML = chibi(u);
  };
  if (isMobile) {
    const ov = document.createElement("div");
    ov.className = "nb-overlay";
    ov.id = id;
    ov.innerHTML = `<div class="nb-room"><div class="nb-curtain-left"></div><div class="nb-curtain-right"></div><div class="nb-content"><div class="nb-laptop"><div class="nb-screen" style="background:${wp.startsWith("url") ? wp : `url(${wp})`} center/cover;filter:brightness(0.9) saturate(0.8)"></div></div><div class="nb-character" id="nb-char-${id}"></div><div class="nb-plaque"><div class="nb-name-lg">${esc(u.name)}</div><div class="nb-stats">${comments} comments · ${pinned} ideas</div></div><button class="btn p nb-back">Back</button></div></div>`;
    document.body.appendChild(ov);
    loadChar(ov.querySelector(`#nb-char-${id}`));
    ov.querySelector(".nb-back").onclick = () => ov.remove();
  } else {
    win(
      id,
      u.name,
      (bd) => {
        bd.innerHTML = `<div class="nb-room"><div class="nb-curtain-left"></div><div class="nb-curtain-right"></div><div class="nb-content"><div class="nb-laptop"><div class="nb-screen" style="background:${wp.startsWith("url") ? wp : `url(${wp})`} center/cover;filter:brightness(0.9) saturate(0.8)"></div></div><div class="nb-character" id="nb-char-${id}"></div><div class="nb-plaque"><div class="nb-name-lg">${esc(u.name)}</div><div class="nb-stats">${comments} comments · ${pinned} ideas</div></div><button class="btn p nb-back">Back</button></div></div>`;
        loadChar(bd.querySelector(`#nb-char-${id}`));
        bd.querySelector(".nb-back").onclick = () => shut(id);
      },
      1,
    );
  }
}
/* ---- audio system ---- */
let audioCtx,
  ambientOsc,
  ambientGain,
  soundsEnabled = true;
const vol = () => (D.me?.volume || 50) / 100;
const beep = (freq = 440, type = "square", dur = 0.05, g = 0.15) => {
  if (!soundsEnabled || !audioCtx) return;
  const o = audioCtx.createOscillator(),
    gn = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gn.gain.setValueAtTime(g * vol(), audioCtx.currentTime);
  gn.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(gn);
  gn.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
};
const sfx = {
  open: () => beep(523, "triangle", 0.08, 0.2),
  close: () => beep(392, "triangle", 0.1, 0.18),
  max: () => beep(659, "square", 0.06, 0.12),
  restore: () => beep(587, "square", 0.06, 0.12),
  click: () => beep(880, "square", 0.03, 0.08),
  page: () => beep(440, "sine", 0.05, 0.1),
  msgSent: () => beep(784, "triangle", 0.07, 0.15),
  msgRecv: () => beep(698, "sine", 0.08, 0.12),
  vote: () => beep(523, "square", 0.05, 0.1),
  comment: () => beep(587, "triangle", 0.06, 0.12),
  upload: () => beep(659, "square", 0.1, 0.15),
  error: () => {
    if (!soundsEnabled || !audioCtx) return;
    const o = audioCtx.createOscillator(),
      gn = audioCtx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, audioCtx.currentTime);
    o.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.15);
    gn.gain.setValueAtTime(0.2 * vol(), audioCtx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    o.connect(gn);
    gn.connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.2);
  },
};
const userJingle = (uid) => {
  if (!audioCtx) return;
  const h = [...uid].reduce((a, c) => a + c.charCodeAt(0), 0);
  const types = ["square", "triangle", "sine"];
  const type = types[h % 3];
  const base = 220 + (h % 4) * 110;
  const notes = [base, base * 1.25, base * 1.5, base * 2, base * 1.25];
  const count = 4 + (h % 2);
  const dur = 0.1;
  let t = audioCtx.currentTime;
  for (let i = 0; i < count; i++) {
    const o = audioCtx.createOscillator(),
      gn = audioCtx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(notes[h % notes.length], t);
    gn.gain.setValueAtTime(0.2 * vol(), t);
    gn.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(gn);
    gn.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + dur);
    t += dur + 0.05;
  }
};
function startAmbient() {
  if (!D.me?.ambient || ambientOsc) return;
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  ambientOsc = audioCtx.createOscillator();
  ambientGain = audioCtx.createGain();
  ambientOsc.type = "sine";
  ambientOsc.frequency.setValueAtTime(110, audioCtx.currentTime);
  ambientGain.gain.setValueAtTime(0, vol() / 3);
  ambientOsc.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientOsc.start();
}
function stopAmbient() {
  if (ambientOsc) {
    ambientOsc.stop();
    ambientOsc = null;
  }
}
const resumeAudio = () => {
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  else if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
};

function openCropper(file, onDone) {
  const isMobile = innerWidth < 700;
  const size = 300;
  const radius = 140;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let img = new Image();
  let imgW, imgH;
  let minScale, maxScale;

  const ov = document.createElement("div");
  ov.className = "crop-overlay";
  ov.innerHTML = `
    <div class="crop-modal">
      <div class="crop-header">
        <span>Crop your photo</span>
        <button class="crop-btn" id="crop-x">✕</button>
      </div>
      <div class="crop-canvas-wrap">
        <canvas id="crop-canvas" width="${size}" height="${size}"></canvas>
        <div class="crop-mask"></div>
        <div class="crop-ring"></div>
      </div>
      <div class="crop-controls">
        <input type="range" id="crop-zoom" min="0.5" max="3" step="0.05" value="1">
        <div class="crop-btns">
          <button class="btn" id="crop-reset">Reset</button>
          <button class="btn p" id="crop-save">Save</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(ov);

  const canvas = ov.querySelector("#crop-canvas");
  const ctx = canvas.getContext("2d");
  const zoomSlider = ov.querySelector("#crop-zoom");
  const mask = ov.querySelector(".crop-mask");

  img.onload = () => {
    imgW = img.width;
    imgH = img.height;
    const coverScale = Math.max(size / imgW, size / imgH);
    minScale = coverScale * 0.3;
    maxScale = coverScale * 5;
    scale = coverScale;
    zoomSlider.min = minScale;
    zoomSlider.max = maxScale;
    zoomSlider.value = scale;
    offsetX = (size - imgW * scale) / 2;
    offsetY = (size - imgH * scale) / 2;
    draw();
  };
  img.src = URL.createObjectURL(file);

  function draw() {
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function constrain() {
    const c = size / 2;
    const maxX = c - radius;
    const minX = c + radius - imgW * scale;
    const maxY = c - radius;
    const minY = c + radius - imgH * scale;
    offsetX = Math.max(minX, Math.min(maxX, offsetX));
    offsetY = Math.max(minY, Math.min(maxY, offsetY));
  }

  function handlePointerDown(e) {
    e.preventDefault();
    const startX = e.clientX - offsetX;
    const startY = e.clientY - offsetY;
    function handleMove(ev) {
      offsetX = ev.clientX - startX;
      offsetY = ev.clientY - startY;
      constrain();
      draw();
    }
    function handleUp() {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
    }
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.style.touchAction = "none";

  function setScale(s) {
    const c = size / 2;
    const px = (c - offsetX) / scale;
    const py = (c - offsetY) / scale;
    scale = s;
    offsetX = c - px * scale;
    offsetY = c - py * scale;
  }

  zoomSlider.oninput = () => {
    setScale(parseFloat(zoomSlider.value));
    constrain();
    draw();
  };

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.03 : 0.03;
    const s = Math.max(minScale, Math.min(maxScale, scale + delta));
    zoomSlider.value = s;
    setScale(s);
    constrain();
    draw();
  });

  ov.querySelector("#crop-reset").onclick = () => {
    scale = minScale;
    zoomSlider.value = scale;
    offsetX = (size - imgW * scale) / 2;
    offsetY = (size - imgH * scale) / 2;
    draw();
  };

  ov.querySelector("#crop-x").onclick = () => {
    URL.revokeObjectURL(img.src);
    ov.remove();
  };

  ov.querySelector("#crop-save").onclick = () => {
    const outCanvas = document.createElement("canvas");
    outCanvas.width = 256;
    outCanvas.height = 256;
    const outCtx = outCanvas.getContext("2d");
    outCtx.fillStyle = "#fff";
    outCtx.fillRect(0, 0, 256, 256);
    outCtx.beginPath();
    outCtx.arc(128, 128, 128, 0, Math.PI * 2);
    outCtx.clip();
    const scaleFactor = 256 / size;
    outCtx.translate(128, 128);
    outCtx.scale(scaleFactor, scaleFactor);
    outCtx.translate(-size / 2, -size / 2);
    outCtx.translate(offsetX, offsetY);
    outCtx.scale(scale, scale);
    outCtx.drawImage(img, 0, 0);
    let quality = 0.85;
    let dataUrl = outCanvas.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 100000 && quality > 0.5) {
      quality -= 0.05;
      dataUrl = outCanvas.toDataURL("image/jpeg", quality);
    }
    URL.revokeObjectURL(img.src);
    ov.remove();
    onDone(dataUrl);
  };
}

/* Profile = list of sections. To add a new editable thing later, push another {t,html,bind} here. */
const PROFILE = [
  {
    t: "Account",
    html: (m) =>
      `<input id="pn" placeholder="Display name" value="${esc(m.name)}"><input id="pp" type="password" placeholder="New password (blank = keep)"><button class="btn p" id="ps">Save</button>`,
    bind: (bd, pref) =>
      (bd.querySelector("#ps").onclick = () => {
        const p = { name: bd.querySelector("#pn").value.trim() },
          w = bd.querySelector("#pp").value;
        if (w) p.password = w;
        pref(p);
      }),
  },
  {
    t: "Profile icon",
    html: () =>
      `${EMO.map((e) => `<span class="sw" data-e="${e}" style="display:inline-flex;align-items:center;justify-content:center;font-size:26px;background:#fff">${e}</span>`).join("")}<br><label class="btn">Upload photo<input hidden id="au" type="file" accept="image/*"></label>`,
    bind: (bd, pref) => {
      bd.querySelectorAll("[data-e]").forEach(
        (s) => (s.onclick = () => pref({ avatar: s.dataset.e })),
      );
      bd.querySelector("#au").onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        openCropper(file, async (dataUrl) => {
          await act(async () => {
            await api("PUT", "me", { avatar: dataUrl });
          });
        });
      };
    },
  },
  {
    t: "Desktop",
    html: (m) =>
      `${Object.keys(WP)
        .map(
          (k) =>
            `<span class="sw ${m.wallpaper === k ? "on" : ""}" data-w="${k}" style="background:${WP[k]}"></span>`,
        )
        .join(
          "",
        )}<br><label class="btn">Upload wallpaper<input hidden id="wu" type="file" accept="image/*"></label><div style="margin-top:10px">${ACC.map((c) => `<span class="sw ${m.accent === c ? "on" : ""}" data-c="${c}" style="background:${c}"></span>`).join("")}</div>`,
    bind: (bd, pref) => {
      bd.querySelectorAll("[data-w]").forEach(
        (s) => (s.onclick = () => pref({ wallpaper: s.dataset.w })),
      );
      bd.querySelectorAll("[data-c]").forEach(
        (s) => (s.onclick = () => pref({ accent: s.dataset.c })),
      );
      bd.querySelector("#wu").onchange = (e) =>
        act(async () => {
          const f = e.target.files[0];
          const url = await retroWallpaper(f);
          await api("PUT", "me", { wallpaper: url });
        });
    },
  },
  {
    t: "Sounds",
    html: (
      m,
    ) => `<h5>Sound effects</h5><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="se" ${soundsEnabled ? "checked" : ""}> Enable sound effects</label>
  <div style="margin-top:8px"><label>Volume: <input type="range" id="vl" min="0" max="100" value="${m.volume || 50}"></label></div>
  <h5 style="margin-top:15px">Ambient music</h5><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="am" ${m.ambient ? "checked" : ""}> Enable ambient music</label>
  <h5 style="margin-top:15px">Click sounds</h5><label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" id="cs" ${m.clicks ? "checked" : ""}> Enable click sounds</label>`,
    bind: (bd, pref) => {
      bd.querySelector("#se").onchange = (e) => {
        soundsEnabled = e.target.checked;
        pref({ clicks: e.target.checked ? 1 : 0 });
      };
      bd.querySelector("#vl").oninput = (e) =>
        pref({ volume: +e.target.value });
      bd.querySelector("#am").onchange = (e) => {
        pref({ ambient: e.target.checked ? 1 : 0 });
        if (e.target.checked) startAmbient();
        else stopAmbient();
      };
      bd.querySelector("#cs").onchange = (e) =>
        pref({ clicks: e.target.checked ? 1 : 0 });
    },
  },
];
function profile() {
  win("me", "Profile", (bd) => {
    const pref = (p) => act(() => api("PUT", "me", p));
    bd.innerHTML = PROFILE.map(
      (s) => `<h4>${s.t.toUpperCase()}</h4>${s.html(D.me)}`,
    ).join("");
    PROFILE.forEach((s) => s.bind(bd, pref));
  });
}
function chat() {
  const adm = D.me.admin,
    boss = D.users.find((u) => u.admin) || { name: "admin" },
    dmThread = (a, b) => "dm:" + [String(a), String(b)].sort().join(":");
  win(
    "chat",
    "Chat",
    (bd) => {
      let th = "all",
        firstPaint = true;
      const seen = new Set();
      const opts = [
        ["all", "📢 Everyone (group chat)"],
        ...D.users
          .filter((u) => u.id !== D.me.id)
          .map((u) => [
            u.admin ? (adm ? u.id : D.me.id) : dmThread(D.me.id, u.id),
            "🔒 Private with " + u.name,
          ]),
      ];
      bd.innerHTML = `<div class="chat-head"><div><strong>HANGOUT CHAT</strong><div class="meta" id="cn"></div></div><select id="ct" aria-label="Choose chat">${opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("")}</select></div><div class="cl" id="cl" role="log" aria-live="polite"></div><div class="chat-emoji" aria-label="Quick emoji">${["🙂", "❤️", "😂", "🎉", "👀", "👍"].map((e) => `<button type="button" class="emoji-btn" data-e="${e}" aria-label="Insert ${e}">${e}</button>`).join("")}</div><div class="chat-compose"><textarea id="cx" rows="1" maxlength="2000" placeholder="Write a message…" aria-label="Write a message"></textarea><button class="send-btn" id="cb" type="button" title="Send message" aria-label="Send message">${art(["......k.", ".....kkk", "k....kkk", "kk.kkkkk", "kkkkkkk.", "kk.kkkkk", "k....kkk"], { k: K })}</button></div><div class="chat-error" id="chat-error" role="status"></div><div class="chat-foot">Enter to send · Shift+Enter for a new line</div>`;
      const note = () =>
        (bd.querySelector("#cn").textContent =
          th === "all"
            ? "Messages are visible to everyone."
            : "Only you and the selected person can see this conversation.");
      const paint = async () => {
        if (!W.chat) return;
        const requested = th,
          cl = bd.querySelector("#cl"),
          end = cl.scrollTop + cl.clientHeight >= cl.scrollHeight - 30,
          ms = await api("GET", "messages/" + requested);
        if (!W.chat || requested !== th) return;
        cl.innerHTML =
          ms
            .map((m) => {
              const user = D.users.find((u) => u.id === m.from) || {
                  name: "Neighbor",
                  avatar: "🙂",
                },
                own = m.from === D.me.id,
                at = new Date(m.at);
              return `<div class="msg-row ${own ? "me" : ""}"><div class="av chat-avatar" aria-hidden="true">${av(user.avatar, user.name)}</div><article class="msg"><div class="msg-meta"><b>${esc(user.name)}</b><time>${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div><div class="msg-text">${esc(m.text)}</div></article></div>`;
            })
            .join("") ||
          '<div class="chat-empty"><span>✦</span><b>No messages yet</b><small>Start the conversation.</small></div>';
        if (end) cl.scrollTop = cl.scrollHeight;
        if (!firstPaint)
          for (const m of ms)
            if (!seen.has(m._id) && m.from !== D.me.id) sfx.msgRecv();
        firstPaint = false;
        ms.forEach((m) => seen.add(m._id));
      };
      const send = async () => {
        const input = bd.querySelector("#cx"),
          button = bd.querySelector("#cb"),
          error = bd.querySelector("#chat-error"),
          text = input.value.trim();
        if (!text || button.disabled) return;
        button.disabled = true;
        error.textContent = "";
        try {
          await api("POST", "messages/" + th, { text });
          if (input.value.trim() === text) input.value = "";
          sfx.msgSent();
          await paint();
        } catch (e) {
          error.textContent = e.message;
        } finally {
          button.disabled = false;
          input.focus();
        }
      };
      const input = bd.querySelector("#cx");
      bd.querySelector("#cb").onclick = send;
      input.onkeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      };
      bd.querySelectorAll("[data-e]").forEach(
        (button) =>
          (button.onclick = () => {
            const start = input.selectionStart,
              end = input.selectionEnd;
            input.setRangeText(button.dataset.e, start, end, "end");
            input.focus();
          }),
      );
      bd.querySelector("#ct").onchange = (e) => {
        th = e.target.value;
        firstPaint = true;
        seen.clear();
        note();
        paint();
      };
      note();
      paint();
      const t = setInterval(
        () => (W.chat ? paint().catch(() => {}) : clearInterval(t)),
        6000,
      );
    },
    1,
  );
}
function admin() {
  win("admin", "Admin", (bd) => {
    bd.innerHTML = `<button class="btn p" id="hn">+ New hangout</button><h4>MEMBERS (${D.users.length})</h4>${D.users.map((u) => `<div class="row"><div class="av">${av(u.avatar, u.name)}</div><b style="flex:1">${esc(u.name)}</b>${u.id === D.me.id ? "" : `<button class="btn" data-r="${u.id}">Reset pw</button><button class="btn" data-x="${u.id}">Remove</button>`}</div>`).join("")}
 <h4>ADD MEMBER</h4><input id="un" placeholder="Name"><input id="up" placeholder="Password (blank = their name in lowercase)"><input id="ua" placeholder="Avatar emoji (optional)" maxlength="4"><button class="btn p" id="uc">Create member</button>`;
    bd.querySelector("#hn").onclick = () => form();
    bd.querySelectorAll("[data-x]").forEach(
      (b) =>
        (b.onclick = () =>
          confirm("Remove this member?") &&
          act(() => api("DELETE", "users/" + b.dataset.x))),
    );
    bd.querySelectorAll("[data-r]").forEach(
      (b) =>
        (b.onclick = () => {
          const u = D.users.find((x) => x.id === b.dataset.r);
          confirm(`Reset ${u.name}'s password to "${u.name.toLowerCase()}"?`) &&
            act(() =>
              api("PUT", "users/" + u.id, { password: u.name.toLowerCase() }),
            );
        }),
    );
    bd.querySelector("#uc").onclick = () =>
      act(async () => {
        const n = bd.querySelector("#un").value.trim();
        if (!n) throw new Error("Name required");
        await api("POST", "users", {
          name: n,
          password: bd.querySelector("#up").value,
          avatar: bd.querySelector("#ua").value.trim(),
        });
      });
  });
}
function form(h) {
  const id = "form" + (h ? h._id : "");
  win(
    id,
    h ? "Edit hangout" : "New hangout",
    (bd) => {
      bd.innerHTML = `<input id="ft" placeholder="Name (e.g. Karaoke Night)" value="${esc(h?.title)}"><input id="fd" type="date" value="${esc(h?.date)}"><input id="fp" placeholder="Place" value="${esc(h?.place)}"><input id="fw" placeholder="Who came" value="${esc(h?.who)}"><input id="fe" placeholder="Emoji" maxlength="4" value="${esc(h?.emoji)}"><textarea id="fs" rows="5" placeholder="What happened?">${esc(h?.story)}</textarea>
 <div class="meta">Photos & videos</div><input id="ff" type="file" multiple accept="image/*,video/*"><p id="fst"></p><button class="btn p" id="fsv">Save</button>`;
      bd.querySelector("#fsv").onclick = async (e) => {
        const v = (s) => bd.querySelector(s).value,
          st = bd.querySelector("#fst");
        if (!v("#ft").trim()) {
          st.textContent = "Give it a name";
          return;
        }
        e.target.disabled = true;
        try {
          const media = [...(h?.media || [])],
            fl = [...bd.querySelector("#ff").files];
          for (let i = 0; i < fl.length; i++) {
            st.textContent = `Uploading ${i + 1}/${fl.length}…`;
            media.push(await up(fl[i], 1280, "hangout"));
          }
          const body = {
              title: v("#ft"),
              date: v("#fd"),
              place: v("#fp"),
              who: v("#fw"),
              emoji: v("#fe") || "🖼️",
              story: v("#fs"),
              media,
            },
            r = h
              ? await api("PUT", "hangouts/" + h._id, body)
              : await api("POST", "hangouts", body);
          shut(id);
          await reload();
          const nid = h ? h._id : r.id;
          pageOf(nid);
          hangout(nid);
        } catch (x) {
          st.textContent = x.message;
          e.target.disabled = false;
        }
      };
    },
    1,
  );
}

/* ---- shell ---- */
function theme() {
  const m = D.me;
  document.documentElement.style.setProperty("--ac", m.accent);
  const wp = WP[m.wallpaper] || `url("${m.wallpaper}")`;
  $("#desk").style.setProperty("--wp", wp);
  bar();
}
function bar() {
  $("#me").innerHTML = av(D.me.avatar, D.me.name);
  $("#mn").textContent = D.me.name;
}
let charTimer,
  charEl,
  reducedMotion = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
function initChar() {
  charEl = document.createElement("div");
  charEl.className = "char";
  charEl.setAttribute("aria-label", D.me.name + " chibi companion");
  charEl.innerHTML = chibi(D.me);
  charEl.style.left = "20%";
  charEl.style.top = "60%";
  charEl.onclick = () => {
    if (!reducedMotion) {
      charEl.style.animation = "charJump .3s ease-out";
      setTimeout(() => (charEl.style.animation = ""), 300);
    }
  };
  $("#desk").appendChild(charEl);
  startCharAnim();
}
function startCharAnim() {
  if (reducedMotion || !charEl) return;
  const anims = ["idle", "walk", "wave", "hop", "nap"];
  const doAnim = () => {
    if (document.hidden || !charEl) return;
    const anim = anims[(Math.random() * anims.length) | 0];
    charEl.className = "char char-" + anim;
    if (anim === "walk") {
      const x = 10 + Math.random() * 80,
        y = 40 + Math.random() * 40;
      charEl.style.transform =
        x < parseFloat(charEl.style.left) ? "scaleX(-1)" : "scaleX(1)";
      charEl.style.left = x + "%";
      charEl.style.top = y + "%";
    }
    if (anim === "nap") {
      charEl.innerHTML +=
        '<span class="z">z</span><span class="z" style="animation-delay:.2s">z</span><span class="z" style="animation-delay:.4s">z</span>';
    } else {
      charEl.querySelectorAll(".z").forEach((z) => z.remove());
    }
    charTimer = setTimeout(doAnim, 4000 + Math.random() * 4000);
  };
  doAnim();
}
function stopCharAnim() {
  clearTimeout(charTimer);
  if (charEl) charEl.querySelectorAll(".z").forEach((z) => z.remove());
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopCharAnim();
  else if (charEl) startCharAnim();
});
function start() {
  $("#login").hidden = true;
  $("#desk").hidden = false;
  theme();
  const P = [
    [
      "home",
      () => {
        Object.keys(W).forEach(shut);
        page = 0;
        draw();
      },
    ],
    ["pictures", () => folder(0)],
    ["videos", () => folder(1)],
    ["ideas", board],
    ["chat", chat],
    ["neighbors", neighbors],
    ["profile", profile],
  ];
  if (D.me.admin) P.push(["admin", admin]);
  const pillIcons = {
    home: "⌂",
    pictures: SYS.pics.img,
    videos: SYS.vids.img,
    ideas: SYS.board.img,
    chat: SYS.chat.img,
    neighbors: SYS.neighbors.img,
    profile: SYS.me.img,
    admin: "⚙",
  };
  $("#pills").innerHTML = "";
  P.forEach(([n, f]) => {
    const b = document.createElement("button");
    b.className = "pill";
    b.innerHTML = `<span class="pill-ico" aria-hidden="true">${pillIcons[n]}</span><span>${esc(n)}</span>`;
    b.setAttribute("aria-label", n);
    b.onclick = () => {
      resumeAudio();
      f();
    };
    $("#pills").appendChild(b);
  });
  $("#me").onclick = profile;
  $("#pv").onclick = () => go(-1);
  $("#nx").onclick = () => go(1);
  $("#lo").onclick = logout;
  grid();
  L = [];
  sync();
  draw();
  initChar();
  let tx;
  $("#desk").ontouchstart = (e) =>
    (tx = e.target.closest(".win,.pill") ? null : e.touches[0].clientX);
  $("#desk").ontouchend = (e) => {
    if (tx == null) return;
    const d = e.changedTouches[0].clientX - tx;
    if (Math.abs(d) > 70) go(d < 0 ? 1 : -1);
  };
  let t;
  onresize = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const k = G.key;
      grid();
      if (G.key !== k) {
        L = [];
        sync();
        page = 0;
      }
      draw();
    }, 200);
  };
  const clk = () =>
    ($("#clk").textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }));
  clk();
  setInterval(clk, 30000);
}
function ring(us) {
  const n = us.length,
    step = 360 / n,
    R = Math.max(230, n * 21),
    box = $("#ring"),
    wrap = $("#rw"),
    pwf = $("#pwf");
  let ang = 0,
    sel = null,
    drag = null,
    idle = true,
    pauseTimer;
  box.innerHTML = us
    .map(
      (u, i) =>
        `<div class="rb" data-i="${i}" style="--a:${i * step}deg;--r:${R}px"><div class="bub-wrap" style="animation-delay:${i * 0.3}s"><div class="bub">${av(u.avatar, u.name)}</div></div><div class="rn">${esc(u.name)}</div></div>`,
    )
    .join("");
  const items = [...box.children],
    rel = (i) => {
      const a = (((i * step + ang) % 360) + 360) % 360;
      return a > 180 ? a - 360 : a;
    },
    front = () => ((Math.round(-ang / step) % n) + n) % n;
  const paint = () => {
    box.style.transform = `translateZ(${-R}px) rotateY(${ang}deg)`;
    items.forEach((e, i) => {
      const r = rel(i);
      e.style.opacity = 0.3 + 0.7 * Math.max(0, Math.cos((r * Math.PI) / 180));
      e.classList.toggle("on", Math.abs(r) < step / 2);
    });
  };
  const snap = (t) => {
    box.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)";
    ang = t;
    paint();
    setTimeout(() => (box.style.transition = ""), 650);
  };
  const unpick = () => {
    sel = null;
    pwf.hidden = true;
    clearTimeout(pauseTimer);
    setTimeout(() => (idle = true), 2500);
  };
  const pick = (i) => {
    sel = us[i];
    $("#who").textContent = sel.name;
    pwf.hidden = false;
    $("#err").textContent = "";
    $("#pw").value = "";
    $("#pw").focus();
    resumeAudio();
    idle = false;
    clearTimeout(pauseTimer);
  };
  wrap.onpointerdown = (e) => {
    idle = false;
    clearTimeout(pauseTimer);
    drag = { x: e.clientX, a: ang, m: 0, t: e.target.closest(".rb") };
    wrap.setPointerCapture(e.pointerId);
    box.style.transition = "";
  };
  wrap.onpointermove = (e) => {
    if (!drag) return;
    drag.m = Math.max(drag.m, Math.abs(e.clientX - drag.x));
    if (drag.m > 6) {
      ang = drag.a + (e.clientX - drag.x) * 0.35;
      paint();
    }
  };
  wrap.onpointerup = () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.m <= 6 && d.t) {
      const i = +d.t.dataset.i;
      if (i === front()) pick(i);
      else {
        unpick();
        snap(ang - rel(i));
        idle = false;
        setTimeout(() => (idle = true), 2500);
      }
    } else {
      const f = front();
      snap(-f * step + Math.round((ang + f * step) / 360) * 360);
      if (sel && us[front()] !== sel) unpick();
      idle = false;
      setTimeout(() => (idle = true), 2500);
    }
  };
  const turn = (d) => {
    idle = false;
    clearTimeout(pauseTimer);
    unpick();
    resumeAudio();
    snap(Math.round(ang / step) * step + d * -step);
    setTimeout(() => (idle = true), 2500);
  };
  $("#lp").onclick = () => turn(-1);
  $("#rp").onclick = () => turn(1);
  onkeydown = (e) => {
    if (!$("#login").hidden && document.activeElement.tagName !== "INPUT") {
      if (e.key === "ArrowLeft") turn(-1);
      if (e.key === "ArrowRight") turn(1);
      if (e.key === "Enter") pick(front());
    }
  };
  pwf.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const r = await api("POST", "login", {
        id: sel.id,
        password: $("#pw").value,
      });
      tok = r.token;
      localStorage.tok = tok;
      resumeAudio();
      await load();
      start();
      userJingle(D.me.id);
      startAmbient();
    } catch (x) {
      $("#err").textContent = x.message;
    }
  };
  (function spin() {
    if (idle && !sel && !$("#login").hidden) {
      ang -= 0.12;
      paint();
    }
    requestAnimationFrame(spin);
  })();
  paint();
}
async function boot() {
  if (tok) {
    try {
      await load();
      return start();
    } catch {}
  }
  let us;
  try {
    us = await api("GET", "users");
  } catch (e) {
    $("#rw").textContent = "Could not reach the server: " + e.message;
    return;
  }
  ring(us);
}
boot();
