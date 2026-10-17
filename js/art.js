/* ============================================================
   SUPER MARIO · HTML5 — pixel art & rendering library
   All artwork is drawn from code at the original 256×240 scale.
   ============================================================ */

(function () {
  "use strict";

  const TILE = 16;

  /* ============================================================
     Small utility helpers
     ============================================================ */

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function context2d(w, h) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    return { canvas: c, ctx };
  }

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  function measureRows(rows, name) {
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (rows.some((row) => row.length !== width)) {
      console.warn("[Art] inconsistent sprite rows:", name, rows.map((r) => r.length));
    }
    return width;
  }

  function drawPixelMap(ctx, rows, palette, x, y) {
    for (let row = 0; row < rows.length; row++) {
      const line = rows[row];
      for (let col = 0; col < line.length; col++) {
        const ch = line[col];
        if (ch === "." || ch === " ") continue;
        const color = palette[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect((x | 0) + col, (y | 0) + row, 1, 1);
      }
    }
  }

  function pixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    const rr = r * r;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, rr - dy * dy)));
      ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  function pixelRing(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    let prev = -1;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)));
      if (prev !== dx) {
        ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
        prev = dx;
      }
    }
  }

  function pixelArch(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    const radius = w / 2;
    for (let row = 0; row < h; row++) {
      if (row < radius) {
        const dx = Math.round(Math.sqrt(Math.max(0, radius * radius - (radius - row) * (radius - row))));
        ctx.fillRect(x + radius - dx, y + row, dx * 2, 1);
      } else {
        ctx.fillRect(x, y + row, w, 1);
      }
    }
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ============================================================
     Bitmap font (5×7)
     ============================================================ */

  const FONT_DATA = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "01110", "00001", "00001", "10001", "01110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    0: ["01110", "10011", "10101", "10101", "10101", "11001", "01110"],
    1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    ".": ["00000", "00000", "00000", "00000", "00000", "00000", "00100"],
    ",": ["00000", "00000", "00000", "00000", "00000", "00100", "01000"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    "'": ["00100", "00100", "00000", "00000", "00000", "00000", "00000"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "×": ["00000", "10001", "01010", "00100", "01010", "10001", "00000"],
    "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
    "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
    "©": ["01110", "10001", "10111", "10101", "10111", "10001", "01110"],
    "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
    ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
    "↓": ["00100", "00100", "00100", "00100", "11111", "01110", "00100"],
    "→": ["00000", "00100", "00010", "11111", "00010", "00100", "00000"],
  };

  const FONT = {};
  for (const ch in FONT_DATA) {
    FONT[ch] = FONT_DATA[ch].map((row) => row.split("").map((v) => v === "1"));
  }

  function textWidth(text, scale, spacing) {
    const s = spacing == null ? 1 : spacing;
    const sc = scale || 1;
    return text.length > 0 ? (text.length * (5 + s) - s) * sc : 0;
  }

  function drawText(ctx, text, x, y, options) {
    const opts = options || {};
    const scale = opts.scale || 1;
    const color = opts.color || "#ffffff";
    const shadow = opts.shadow;
    const spacing = opts.spacing == null ? 1 : opts.spacing;
    const align = opts.align || "left";
    const upper = String(text).toUpperCase();
    const total = textWidth(upper, scale, spacing);
    let drawX = Math.round(x);
    if (align === "center") drawX -= Math.floor(total / 2);
    if (align === "right") drawX -= total;
    drawX = Math.round(drawX);
    const drawY = Math.round(y);

    function paint(offsetX, offsetY, fill) {
      let cx = drawX + offsetX;
      for (const ch of upper) {
        const glyph = FONT[ch];
        if (glyph) {
          ctx.fillStyle = fill;
          for (let row = 0; row < 7; row++) {
            for (let col = 0; col < 5; col++) {
              if (glyph[row][col]) {
                ctx.fillRect(cx + col * scale, drawY + offsetY + row * scale, scale, scale);
              }
            }
          }
        }
        cx += (5 + spacing) * scale;
      }
    }

    if (shadow) {
      const so = opts.shadowOffset == null ? 1 : opts.shadowOffset;
      paint(so * scale, so * scale, shadow);
      if (opts.outline) {
        paint(-scale, 0, shadow);
        paint(scale, 0, shadow);
        paint(0, -scale, shadow);
        paint(0, scale, shadow);
      }
    }
    paint(0, 0, color);
    return total;
  }

  /* ============================================================
     Mario sprite maps
     ============================================================ */

  const SMALL_TOP = [
    "......rrrr......",
    "....rrrrrrrrr...",
    "....rrrrrrrrrr..",
    "...hhhsskksss...",
    "...hhssssksss...",
    "...hhsshhhhss...",
    "....ssssssss....",
    ".....rrrrrr.....",
    "....rrrrrrrr....",
    "...rrrrrrrrrr...",
    "..ssrbbbbbbrss..",
    "..ssbbybbybbss..",
    "...bbbbbbbbbb...",
  ];

  const SMALL_LEGS = {
    stand: [
      "...bbb....bbb...",
      "..nnnn....nnnn..",
      ".nnnnn....nnnnn.",
    ],
    walk1: [
      "..bbbb...bbbb...",
      ".nnnnn...nnnn...",
      ".nnnn....nnnnn..",
    ],
    walk2: [
      "...bbbb..bbbb...",
      "..nnnnn..nnnnn..",
      ".nnnnn....nnnn..",
    ],
    jump: [
      "....bbbbbbbb....",
      "...nnnn..nnnn...",
      "..nnnnn..nnnnn..",
    ],
    skid: [
      "..bbbbb...bbbb..",
      ".nnnnnn...nnnnn.",
      "nnnnn......nnnnn",
    ],
  };

  const SMALL_MAPS = {
    stand: SMALL_TOP.concat(SMALL_LEGS.stand),
    walk1: SMALL_TOP.concat(SMALL_LEGS.walk1),
    walk2: SMALL_TOP.concat(SMALL_LEGS.walk2),
    jump: SMALL_TOP.concat(SMALL_LEGS.jump),
    skid: SMALL_TOP.concat(SMALL_LEGS.skid),
    dead: [
      "..ss..rrrr..ss..",
      "..ss.rrrrrr.ss..",
      "..ssrrrrrrrrss..",
      "...hhsssssssh...",
      "...hhskksksss...",
      "...hhsshhhhss...",
      "....ssssssss....",
      ".....rrrrrr.....",
      "....rrrrrrrr....",
      "...rrrrrrrrrr...",
      "..ssbbbbbbbbrss.",
      "..ssbbybbybbss..",
      "...bbbbbbbbbb...",
      "..bbbb....bbbb..",
      ".nnnnn....nnnnn.",
      ".nnnnn....nnnnn.",
    ],
  };

  const BIG_TOP = [
    "......rrrr......",
    "....rrrrrrrrr...",
    "...rrrrrrrrrrr..",
    "..rrrrrrrrrrrr..",
    "..hhhhssssssss..",
    "..hhhssskkssss..",
    "..hhsssssksss...",
    "..hhsshhhhssss..",
    "...hsssssssss...",
    "....ssssssss....",
    ".....ssssss.....",
    "....rrrrrrrr....",
    "...rrrrrrrrrr...",
    "..rrrrrrrrrrrr..",
    "..ssrrrrrrrrss..",
  ];

  const BIG_TORSO = [
    ".ssrbbbbbbbbrss.",
    ".ssrbbybbybbrss.",
    ".ssrbbbbbbbbrss.",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
    "..bbbbbbbbbbbb..",
  ];

  const BIG_LEGS = {
    stand: [
      "..bbbbb..bbbbb..",
      "..bbbbb..bbbbb..",
      "..bbbbb..bbbbb..",
      "..nnnnn..nnnnn..",
      ".nnnnnn..nnnnnn.",
      ".nnnnnn..nnnnnn.",
    ],
    walk1: [
      "..bbbbb...bbbb..",
      ".bbbbbb...bbbbb.",
      ".bbbbb.....bbbb.",
      "nnnnn......nnnnn",
      "nnnnn......nnnnn",
      ".nnn........nnn.",
    ],
    walk2: [
      "....bbbbbbbb....",
      "....bbbbbbbb....",
      "...bbbb..bbbb...",
      "..nnnnn..nnnnn..",
      ".nnnnnn..nnnnnn.",
      ".nnnn......nnnn.",
    ],
    jump: [
      "...bbbbbbbbbb...",
      "..bbbbb..bbbbb..",
      "..bbbb....bbbb..",
      ".nnnnn....nnnnn.",
      "nnnnn......nnnnn",
      "................",
    ],
    skid: [
      "..bbbbbb..bbbbb.",
      ".bbbbbb....bbbb.",
      "nnnnnn......nnnn",
      "nnnn.........nnn",
      "................",
      "................",
    ],
  };

  const BIG_MAPS = {
    stand: BIG_TOP.concat(BIG_TORSO, BIG_LEGS.stand),
    walk1: BIG_TOP.concat(BIG_TORSO, BIG_LEGS.walk1),
    walk2: BIG_TOP.concat(BIG_TORSO, BIG_LEGS.walk2),
    jump: BIG_TOP.concat(BIG_TORSO, BIG_LEGS.jump),
    skid: BIG_TOP.concat(BIG_TORSO, BIG_LEGS.skid),
  };

  // Validate once, but do not let a stray warning stop the game.
  Object.keys(SMALL_MAPS).forEach((key) => measureRows(SMALL_MAPS[key], "small/" + key));
  Object.keys(BIG_MAPS).forEach((key) => measureRows(BIG_MAPS[key], "big/" + key));

  const MARIO_PALETTES = {
    normal: {
      r: "#e52521",
      R: "#a01018",
      h: "#5d2b0e",
      s: "#ffb27a",
      k: "#1a0b06",
      b: "#2a43d8",
      B: "#172a9c",
      y: "#ffd447",
      n: "#5d2b0e",
      w: "#ffffff",
    },
    fire: {
      r: "#fff6df",
      R: "#d8c8a8",
      h: "#5d2b0e",
      s: "#ffb27a",
      k: "#1a0b06",
      b: "#e52521",
      B: "#a01018",
      y: "#ffd447",
      n: "#5d2b0e",
      w: "#ffffff",
    },
    starA: {
      r: "#e52521",
      R: "#a01018",
      h: "#5d2b0e",
      s: "#ffe08d",
      k: "#1a0b06",
      b: "#ffd447",
      B: "#cf8b00",
      y: "#ffffff",
      n: "#7d3d00",
      w: "#ffffff",
    },
    starB: {
      r: "#52d16a",
      R: "#1e7b32",
      h: "#153d16",
      s: "#c7ffb0",
      k: "#081807",
      b: "#1aa6a6",
      B: "#0a5d70",
      y: "#fff1a8",
      n: "#153d16",
      w: "#ffffff",
    },
    starC: {
      r: "#5fa8ff",
      R: "#2156b8",
      h: "#1d2447",
      s: "#d6ecff",
      k: "#061024",
      b: "#ff7ad9",
      B: "#9a2b87",
      y: "#ffffff",
      n: "#1d2447",
      w: "#ffffff",
    },
  };

  const GOOMBA_PALETTES = {
    normal: {
      b: "#a85b2a",
      B: "#71340f",
      d: "#4b240c",
      w: "#fff8e0",
      k: "#1a0b06",
      t: "#f5d7a1",
    },
  };

  const GOOMBA_A = [
    ".....bbbbbb.....",
    "...bbbbbbbbbb...",
    "..bbbbbbbbbbbb..",
    ".bbbbbbbbbbbbbb.",
    ".bbbbbbbbbbbbbb.",
    "bbbbbbbbbbbbbbbb",
    "bbbwwkbbbbkwwbbb",
    "bbwwwwkbbkwwwwbb",
    "bbbwwkbbbbkwwbbb",
    "bbbbbbbbbbbbbbbb",
    ".bbbbbbbbbbbbbb.",
    "..bbbbbbbbbbbb..",
    "...dddddddddd...",
    "..dddddddddddd..",
    ".ddddd....ddddd.",
    ".dddd......dddd.",
  ];

  const GOOMBA_B = GOOMBA_A.slice(0, 14).concat([
    "..ddddd....dddd.",
    ".dddd......dddd.",
  ]);

  const GOOMBA_SQUASH = [
    "................",
    "................",
    "................",
    "................",
    "..bbbbbbbbbbbb..",
    ".bbbbbbbbbbbbbb.",
    "bbwwkbbbbbbkwwbb",
    "bbbbbbbbbbbbbbbb",
    ".dddddddddddddd.",
    "..dddd....dddd..",
  ];

  measureRows(GOOMBA_A, "goombaA");
  measureRows(GOOMBA_B, "goombaB");

  const MUSHROOM_MAP = [
    "....rrrrrrrr....",
    "..rrrrrrrrrrrr..",
    ".rrwwrrrrrrwwrr.",
    ".rwwwwrrrrwwwwr.",
    "rrwwwwrrrrwwwwrr",
    "rrwwwwrrrrwwwwrr",
    ".rwwwwrrrrwwwwr.",
    ".rrwwrrrrrrwwrr.",
    "..rrrrrrrrrrrr..",
    "...ssssssssss...",
    "...skssssssks...",
    "...skssssssks...",
    "...ssssssssss...",
    "...ssssssssss...",
    "....ssssssss....",
    "................",
  ];

  const FLOWER_MAP_A = [
    ".....kkkkkk.....",
    "...kkyyoyykk....",
    "..kyyooooooyk...",
    ".kyooowwoooyyk..",
    ".kyoowwwwoooyk..",
    "..kyoowwoooyk...",
    "...kyyoooyyk....",
    "....kkyyykk.....",
    ".....kgggk......",
    "....kgkkgk......",
    "...kgkkkkgk.....",
    "...kg.kk.gk.....",
    "....k.gg.k......",
    "......gg........",
    ".....kggk.......",
    "................",
  ];

  const FLOWER_PALETTES = [
    { k: "#5a2b05", y: "#ffb000", o: "#ff6b35", w: "#ffe66d", g: "#2e9a3a" },
    { k: "#5a2b05", y: "#ff8a00", o: "#e83b2d", w: "#fff6b0", g: "#2e9a3a" },
    { k: "#5a2b05", y: "#ffd23f", o: "#ff8a00", w: "#fffbe0", g: "#2e9a3a" },
    { k: "#5a2b05", y: "#ffb000", o: "#d92b5a", w: "#ffe66d", g: "#2e9a3a" },
  ];

  const STAR_MAP = [
    ".......kk.......",
    "......kyyk......",
    "......kyyk......",
    ".....kyyyyk.....",
    "kkkkkkyyyykkkkkk",
    ".kyyyyyyyyyyyyk.",
    "..kyyyyyyyyyyk..",
    "...kyyyyyyyyk...",
    "....kyyyyyyk....",
    "...kyyyyyyyyk...",
    "...kyyykkyyyk...",
    "..kyyyk..kyyyk..",
    "..kyyk....kyyk..",
    ".kkkk......kkkk.",
    "................",
    "................",
  ];

  /* ============================================================
     Theme palettes
     ============================================================ */

  const THEMES = {
    overworld: {
      sky: "#5c94fc",
      skyTop: "#4c84ef",
      ground: "#c85410",
      groundDark: "#7a2d06",
      groundLight: "#ec8637",
      groundHi: "#ffc37a",
      brick: "#c85410",
      brickDark: "#7a2d06",
      brickLight: "#ed8a40",
      brickHi: "#ffbd75",
      qBase: "#f8b000",
      qDark: "#7b3c00",
      qLight: "#ffe064",
      qShine: "#fff8c8",
      used: "#b87838",
      usedDark: "#5f340c",
      usedLight: "#e8b070",
      hard: "#a86424",
      hardDark: "#5f340c",
      hardLight: "#e0a060",
      pipe: "#17a834",
      pipeDark: "#065018",
      pipeLight: "#86e85c",
      pipeShine: "#d0ff9c",
      cloud: "#ffffff",
      cloudShade: "#b9d8ff",
      hill: "#2fa532",
      hillDark: "#0e6b20",
      hillLight: "#7fde5c",
      bush: "#3cbb3c",
      bushDark: "#126a22",
      bushLight: "#9aee6c",
      stone: "#d8b26a",
      castle: "#c05010",
      castleDark: "#6d2605",
      castleLight: "#ed8d41",
      flag: "#f6f6ec",
      flagDark: "#c5d6e8",
      pole: "#0e8a2c",
      poleLight: "#8ef070",
      outline: "#121018",
    },
    underground: {
      sky: "#070812",
      skyTop: "#03040a",
      ground: "#1e4bb8",
      groundDark: "#081535",
      groundLight: "#4d85f4",
      groundHi: "#9ec6ff",
      brick: "#2153c6",
      brickDark: "#081535",
      brickLight: "#5689f2",
      brickHi: "#9fc6ff",
      qBase: "#e8a500",
      qDark: "#5b2b00",
      qLight: "#ffdc52",
      qShine: "#fff3b2",
      used: "#6d5b55",
      usedDark: "#28201e",
      usedLight: "#aa9181",
      hard: "#315b9e",
      hardDark: "#0a1a3c",
      hardLight: "#7194d2",
      pipe: "#16a85c",
      pipeDark: "#044b2a",
      pipeLight: "#7ceaa2",
      pipeShine: "#d3ffdf",
      cloud: "#8fc8ff",
      cloudShade: "#3f62a4",
      hill: "#15476b",
      hillDark: "#051d31",
      hillLight: "#1f6a8f",
      bush: "#155a52",
      bushDark: "#042d28",
      bushLight: "#2f8a72",
      stone: "#c8a65c",
      castle: "#3b5b9a",
      castleDark: "#0e1d3b",
      castleLight: "#7094ce",
      flag: "#dceaff",
      flagDark: "#89a4c8",
      pole: "#128a5a",
      poleLight: "#72f0a8",
      outline: "#05050b",
    },
    night: {
      sky: "#0c1834",
      skyTop: "#071024",
      ground: "#4c5885",
      groundDark: "#141936",
      groundLight: "#7a8bc4",
      groundHi: "#b8c6f2",
      brick: "#b45a2a",
      brickDark: "#4c1e0d",
      brickLight: "#e28a52",
      brickHi: "#ffbd85",
      qBase: "#e8a500",
      qDark: "#5b2b00",
      qLight: "#ffdc52",
      qShine: "#fff3b2",
      used: "#655b82",
      usedDark: "#222038",
      usedLight: "#aca0c6",
      hard: "#59638c",
      hardDark: "#171c33",
      hardLight: "#9aa8d0",
      pipe: "#169a88",
      pipeDark: "#044a46",
      pipeLight: "#75e8c8",
      pipeShine: "#d0fff4",
      cloud: "#c8d6ff",
      cloudShade: "#5066a0",
      hill: "#243765",
      hillDark: "#0a1430",
      hillLight: "#3c568a",
      bush: "#1e5c58",
      bushDark: "#062b2b",
      bushLight: "#3f8f7d",
      stone: "#c8b280",
      castle: "#596d9a",
      castleDark: "#151f38",
      castleLight: "#9cb4e2",
      flag: "#f8f2d8",
      flagDark: "#b8aa86",
      pole: "#69b8dc",
      poleLight: "#d8f8ff",
      outline: "#090b16",
    },
  };

  /* ============================================================
     Tile artwork
     ============================================================ */

  const tileCache = {};

  function addPockMarks(ctx, palette, variant, count) {
    const rand = mulberry32(19 + variant * 71);
    for (let i = 0; i < count; i++) {
      const x = Math.floor(rand() * 13) + 1;
      const y = Math.floor(rand() * 12) + 2;
      ctx.fillStyle = rand() > 0.5 ? palette.groundDark : palette.groundHi;
      ctx.fillRect(x, y, rand() > 0.6 ? 2 : 1, 1);
    }
  }

  function buildGroundTile(palette, variant) {
    const { ctx, canvas } = context2d(16, 16);
    px(ctx, 0, 0, 16, 16, palette.ground);
    px(ctx, 0, 0, 16, 1, palette.groundHi);
    px(ctx, 0, 1, 16, 1, palette.groundLight);
    px(ctx, 0, 7, 16, 1, palette.groundDark);
    px(ctx, 0, 15, 16, 1, palette.groundDark);

    if (variant === 0) {
      px(ctx, 7, 1, 1, 6, palette.groundDark);
      px(ctx, 3, 8, 1, 7, palette.groundDark);
      px(ctx, 1, 2, 5, 1, palette.groundHi);
      px(ctx, 9, 8, 6, 1, palette.groundHi);
    } else if (variant === 1) {
      px(ctx, 11, 1, 1, 6, palette.groundDark);
      px(ctx, 7, 8, 1, 7, palette.groundDark);
      px(ctx, 2, 2, 4, 1, palette.groundHi);
      px(ctx, 8, 9, 3, 1, palette.groundHi);
      px(ctx, 1, 12, 5, 1, palette.groundDark);
    } else {
      px(ctx, 5, 1, 1, 6, palette.groundDark);
      px(ctx, 12, 8, 1, 7, palette.groundDark);
      px(ctx, 6, 2, 4, 1, palette.groundHi);
      px(ctx, 2, 9, 4, 1, palette.groundHi);
      px(ctx, 8, 12, 2, 1, palette.groundDark);
    }

    addPockMarks(ctx, palette, variant, 5);

    return canvas;
  }

  function buildBrickTile(palette) {
    const { ctx, canvas } = context2d(16, 16);
    px(ctx, 0, 0, 16, 16, palette.brickDark);
    px(ctx, 1, 1, 14, 14, palette.brick);
    px(ctx, 1, 1, 14, 1, palette.brickHi);
    px(ctx, 1, 2, 1, 12, palette.brickLight);
    px(ctx, 1, 6, 14, 1, palette.brickDark);
    px(ctx, 1, 11, 14, 1, palette.brickDark);
    px(ctx, 4, 2, 1, 4, palette.brickDark);
    px(ctx, 11, 2, 1, 4, palette.brickDark);
    px(ctx, 8, 7, 1, 4, palette.brickDark);
    px(ctx, 3, 12, 1, 3, palette.brickDark);
    px(ctx, 12, 12, 1, 3, palette.brickDark);
    px(ctx, 5, 2, 3, 1, palette.brickHi);
    px(ctx, 9, 7, 3, 1, palette.brickHi);
    px(ctx, 2, 12, 2, 1, palette.brickLight);
    px(ctx, 13, 7, 2, 1, palette.brickLight);
    px(ctx, 0, 15, 16, 1, palette.brickDark);
    return canvas;
  }

  function buildHardTile(palette) {
    const { ctx, canvas } = context2d(16, 16);
    px(ctx, 0, 0, 16, 16, palette.hardDark);
    px(ctx, 1, 1, 14, 14, palette.hard);
    px(ctx, 1, 1, 14, 1, palette.hardLight);
    px(ctx, 1, 2, 1, 13, palette.hardLight);
    px(ctx, 2, 2, 12, 12, palette.hard);
    px(ctx, 4, 4, 8, 8, palette.hardDark);
    px(ctx, 5, 5, 6, 6, palette.hard);
    px(ctx, 2, 2, 4, 1, palette.hardLight);
    px(ctx, 13, 5, 1, 7, palette.hardDark);
    px(ctx, 5, 13, 7, 1, palette.hardDark);
    px(ctx, 0, 15, 16, 1, palette.hardDark);
    return canvas;
  }

  function buildUsedTile(palette) {
    const { ctx, canvas } = context2d(16, 16);
    px(ctx, 0, 0, 16, 16, palette.usedDark);
    px(ctx, 1, 1, 14, 14, palette.used);
    px(ctx, 1, 1, 14, 1, palette.usedLight);
    px(ctx, 1, 2, 1, 12, palette.usedLight);
    px(ctx, 2, 13, 12, 1, palette.usedDark);
    px(ctx, 13, 2, 1, 12, palette.usedDark);
    px(ctx, 3, 3, 2, 2, palette.usedDark);
    px(ctx, 11, 3, 2, 2, palette.usedDark);
    px(ctx, 3, 11, 2, 2, palette.usedDark);
    px(ctx, 11, 11, 2, 2, palette.usedDark);
    return canvas;
  }

  function buildQuestionTile(palette, frame) {
    const { ctx, canvas } = context2d(16, 16);
    const glow = frame === 1 || frame === 3;
    px(ctx, 0, 0, 16, 16, palette.qDark);
    px(ctx, 1, 1, 14, 14, glow ? palette.qLight : palette.qBase);
    px(ctx, 1, 1, 14, 1, palette.qShine);
    px(ctx, 1, 2, 1, 12, palette.qLight);
    px(ctx, 2, 14, 12, 1, palette.qDark);
    px(ctx, 13, 2, 1, 12, palette.qDark);

    // corner rivets
    px(ctx, 3, 3, 2, 2, palette.qDark);
    px(ctx, 11, 3, 2, 2, palette.qDark);
    px(ctx, 3, 11, 2, 2, palette.qDark);
    px(ctx, 11, 11, 2, 2, palette.qDark);

    // question mark glyph
    const qm = [
      ".111.",
      "1...1",
      "....1",
      "...1.",
      "..1..",
      ".....",
      "..1..",
    ];
    const glyphColor = glow ? palette.qDark : "#7a3800";
    ctx.fillStyle = glyphColor;
    for (let r = 0; r < qm.length; r++) {
      for (let c = 0; c < 5; c++) {
        if (qm[r][c] === "1") ctx.fillRect(6 + c, 5 + r, 1, 1);
      }
    }
    if (frame === 0) {
      px(ctx, 2, 2, 3, 1, palette.qShine);
      px(ctx, 10, 10, 3, 1, palette.qShine);
    }
    return canvas;
  }

  function buildPipeVertical(palette, side, part) {
    const { ctx, canvas } = context2d(16, 16);
    if (part === "top") {
      // Rounded lip
      px(ctx, side === "left" ? 0 : 0, 0, 16, 16, "rgba(0,0,0,0)");
      if (side === "left") {
        px(ctx, 0, 0, 16, 6, palette.pipeDark);
        px(ctx, 1, 1, 15, 4, palette.pipe);
        px(ctx, 2, 1, 12, 1, palette.pipeShine);
        px(ctx, 3, 2, 10, 1, palette.pipeLight);
        px(ctx, 2, 6, 14, 10, palette.pipeDark);
        px(ctx, 3, 6, 13, 9, palette.pipe);
        px(ctx, 4, 7, 2, 8, palette.pipeLight);
        px(ctx, 5, 7, 1, 8, palette.pipeShine);
        px(ctx, 0, 4, 2, 2, palette.pipeDark);
      } else {
        px(ctx, 0, 0, 16, 6, palette.pipeDark);
        px(ctx, 0, 1, 15, 4, palette.pipe);
        px(ctx, 8, 1, 6, 1, palette.pipeShine);
        px(ctx, 3, 2, 10, 1, palette.pipeLight);
        px(ctx, 0, 6, 14, 10, palette.pipeDark);
        px(ctx, 0, 6, 13, 9, palette.pipe);
        px(ctx, 7, 7, 3, 8, palette.pipeDark);
        px(ctx, 11, 7, 1, 8, palette.pipeLight);
        px(ctx, 14, 4, 2, 2, palette.pipeDark);
      }
    } else {
      if (side === "left") {
        px(ctx, 0, 0, 16, 16, palette.pipeDark);
        px(ctx, 3, 0, 13, 16, palette.pipe);
        px(ctx, 3, 0, 2, 16, palette.pipeLight);
        px(ctx, 5, 0, 1, 16, palette.pipeShine);
        px(ctx, 13, 0, 2, 16, palette.pipeDark);
        px(ctx, 15, 0, 1, 16, "rgba(0,0,0,0)");
      } else {
        px(ctx, 0, 0, 16, 16, palette.pipeDark);
        px(ctx, 0, 0, 12, 16, palette.pipe);
        px(ctx, 0, 0, 2, 16, palette.pipeDark);
        px(ctx, 10, 0, 2, 16, palette.pipeDark);
        px(ctx, 8, 0, 1, 16, palette.pipeLight);
        px(ctx, 12, 0, 3, 16, palette.pipeDark);
        px(ctx, 15, 0, 1, 16, "rgba(0,0,0,0)");
      }
    }
    return canvas;
  }

  function buildTiles() {
    for (const themeName in THEMES) {
      const palette = THEMES[themeName];
      const set = {
        ground: [],
        brick: buildBrickTile(palette),
        hard: buildHardTile(palette),
        used: buildUsedTile(palette),
        question: [],
        pipeTopLeft: buildPipeVertical(palette, "left", "top"),
        pipeTopRight: buildPipeVertical(palette, "right", "top"),
        pipeBodyLeft: buildPipeVertical(palette, "left", "body"),
        pipeBodyRight: buildPipeVertical(palette, "right", "body"),
      };
      for (let v = 0; v < 3; v++) set.ground.push(buildGroundTile(palette, v));
      const order = [0, 0, 1, 2, 2, 1, 0, 0];
      for (let f = 0; f < 4; f++) set.question.push(buildQuestionTile(palette, f));
      set.questionOrder = order;
      tileCache[themeName] = set;
    }
  }

  /* ============================================================
     Terrain & world decoration
     ============================================================ */

  function drawCloud(ctx, x, y, scale, palette, time) {
    const s = scale || 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(s, s);

    const bob = Math.sin((time || 0) * 0.00035 + x * 0.013) > 0.8 ? 1 : 0;
    // soft navy outline / bottom shade
    pixelCircle(ctx, 9, 8 + bob, 5, palette.cloudShade);
    pixelCircle(ctx, 17, 6 + bob, 7, palette.cloudShade);
    pixelCircle(ctx, 25, 9 + bob, 4, palette.cloudShade);
    px(ctx, 5, 8 + bob, 22, 6, palette.cloudShade);

    // white body
    px(ctx, 5, 6 + bob, 21, 6, palette.cloud);
    px(ctx, 7, 4 + bob, 17, 8, palette.cloud);
    pixelCircle(ctx, 10, 7 + bob, 4, palette.cloud);
    pixelCircle(ctx, 17, 5 + bob, 6, palette.cloud);
    pixelCircle(ctx, 24, 8 + bob, 3, palette.cloud);

    // cheek highlights
    px(ctx, 7, 4 + bob, 4, 1, "#ffffff");
    px(ctx, 14, 2 + bob, 5, 1, "#ffffff");
    ctx.restore();
  }

  function drawBush(ctx, x, groundY, scale, palette) {
    const s = scale || 1;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(groundY));
    ctx.scale(s, s);
    const baseY = 0;
    px(ctx, 2, -6, 29, 6, palette.bushDark);
    pixelCircle(ctx, 8, -7, 5, palette.bushDark);
    pixelCircle(ctx, 16, -9, 7, palette.bushDark);
    pixelCircle(ctx, 24, -7, 4, palette.bushDark);

    px(ctx, 3, -6, 26, 5, palette.bush);
    pixelCircle(ctx, 8, -8, 4, palette.bush);
    pixelCircle(ctx, 16, -10, 6, palette.bush);
    pixelCircle(ctx, 24, -8, 3, palette.bush);
    px(ctx, 7, -12, 4, 2, palette.bushLight);
    px(ctx, 14, -14, 5, 2, palette.bushLight);
    px(ctx, 5, -7, 2, 1, palette.bushLight);
    ctx.fillStyle = palette.bushDark;
    ctx.fillRect(0, baseY - 1, 31, 1);
    ctx.restore();
  }

  function drawHill(ctx, x, groundY, scale, palette) {
    const s = scale || 1;
    const height = 43 * s;
    const width = 80 * s;
    const centerX = x + width / 2;
    const top = groundY - height;
    const rowStep = Math.max(2, Math.round(3 * s));
    const radius = width / 2;

    // A stepped, rounded mound. The ellipse profile gives the classic rolling
    // SMB silhouette without any anti-aliased vector edges.
    const halfAt = (t) => radius * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));

    for (let row = 0; row < height; row += rowStep) {
      const t = row / height;
      const half = halfAt(t);
      const yy = Math.round(top + row);
      ctx.fillStyle = palette.hillDark;
      ctx.fillRect(Math.round(centerX - half), yy, Math.max(2, Math.round(half * 2)), rowStep);
    }

    for (let row = rowStep; row < height; row += rowStep) {
      const t = row / height;
      const half = Math.max(1, halfAt(t) - 3 * s);
      const yy = Math.round(top + row);
      ctx.fillStyle = palette.hill;
      ctx.fillRect(Math.round(centerX - half), yy, Math.max(2, Math.round(half * 2)), rowStep);
    }

    // A soft sunlit edge on the left, as in the original overworld hills.
    for (let row = Math.round(8 * s); row < height - rowStep; row += rowStep * 2) {
      const t = Math.max(0, (row - 3 * s) / height);
      const half = Math.max(1, halfAt(t) - 5 * s);
      ctx.fillStyle = palette.hillLight;
      ctx.fillRect(Math.round(centerX - half + 1), Math.round(top + row), Math.max(1, Math.round(2 * s)), rowStep);
    }

    // Round dark spots tucked into the side of the hill.
    const spots = [
      [0.34, 0.61, 3, 4],
      [0.68, 0.72, 2, 3],
      [0.48, 0.83, 2, 2],
      [0.76, 0.52, 1, 2],
    ];
    ctx.fillStyle = palette.hillDark;
    for (const [fx, fy, sw, sh] of spots) {
      ctx.fillRect(
        Math.round(x + width * fx),
        Math.round(top + height * fy),
        Math.max(2, Math.round(sw * s)),
        Math.max(2, Math.round(sh * s))
      );
    }

    // Base shadow
    ctx.fillStyle = palette.hillDark;
    ctx.fillRect(Math.round(x + 5 * s), groundY - Math.max(2, 2 * s), Math.round(width - 10 * s), Math.max(2, 2 * s));
  }

  function drawUndergroundBackground(ctx, cameraX, time) {
    ctx.fillStyle = "#05060d";
    ctx.fillRect(0, 0, 256, 240);

    // Faint masonry wall
    const off = -((cameraX * 0.22) % 64);
    ctx.save();
    ctx.globalAlpha = 0.9;
    for (let row = 0; row < 8; row++) {
      for (let col = -2; col < 6; col++) {
        const bx = Math.round(off + col * 64 + (row % 2 ? 32 : 0));
        const by = row * 30 - 6;
        ctx.fillStyle = "#0b0f23";
        ctx.fillRect(bx + 1, by + 1, 62, 28);
        ctx.fillStyle = "#151c3b";
        ctx.fillRect(bx + 1, by + 1, 62, 1);
        ctx.fillRect(bx + 1, by + 1, 1, 28);
        ctx.fillStyle = "#080b17";
        ctx.fillRect(bx, by + 29, 64, 1);
        ctx.fillRect(bx + 63, by, 1, 30);
        if ((row * 5 + col) % 7 === 0) {
          ctx.fillStyle = "#1c274a";
          ctx.fillRect(bx + 14, by + 9, 18, 1);
          ctx.fillRect(bx + 14, by + 11, 9, 1);
        }
      }
    }

    // Dripping stalactites near the top
    ctx.fillStyle = "#0a0d1c";
    for (let i = 0; i < 8; i++) {
      const sx = ((i * 47 - cameraX * 0.5) % 300) + 16;
      const h = 8 + ((i * 7) % 13);
      for (let row = 0; row < h; row += 2) {
        ctx.fillRect(Math.round(sx + row / 2), 16 + row, Math.max(1, 6 - Math.floor(row / 3)), 2);
      }
    }
    ctx.restore();

    // Mysterious glow patches
    const glow = 0.035 + Math.sin(time * 0.0012) * 0.012;
    const grd = ctx.createRadialGradient(210, 130, 0, 210, 130, 100);
    grd.addColorStop(0, "rgba(53, 117, 255, " + glow + ")");
    grd.addColorStop(1, "rgba(53, 117, 255, 0)");
    ctx.fillStyle = grd;
    ctx.fillRect(100, 20, 156, 220);
  }

  const STAR_FIELD = (() => {
    const rand = mulberry32(1985);
    const stars = [];
    for (let i = 0; i < 52; i++) {
      stars.push({
        x: rand() * 512,
        y: 18 + rand() * 140,
        size: rand() > 0.84 ? 2 : 1,
        phase: rand() * Math.PI * 2,
        speed: 0.4 + rand() * 1.4,
        layer: 0.07 + rand() * 0.16,
      });
    }
    return stars;
  })();

  function drawNightSky(ctx, cameraX, time) {
    const grd = ctx.createLinearGradient(0, 0, 0, 240);
    grd.addColorStop(0, "#081126");
    grd.addColorStop(0.55, "#132448");
    grd.addColorStop(1, "#2e3d67");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 240);

    // Twinkling stars, slow parallax.
    for (const star of STAR_FIELD) {
      let x = (star.x - cameraX * star.layer) % 512;
      if (x < -8) x += 512;
      if (x > 264) continue;
      const tw = 0.55 + 0.45 * Math.sin(time * 0.002 * star.speed + star.phase);
      ctx.globalAlpha = tw;
      ctx.fillStyle = star.size > 1 ? "#fff3b8" : "#dce8ff";
      ctx.fillRect(Math.round(x), Math.round(star.y), star.size, star.size);
      if (star.size > 1) {
        ctx.globalAlpha = tw * 0.55;
        ctx.fillRect(Math.round(x) - 1, Math.round(star.y) + 1, 1, 1);
        ctx.fillRect(Math.round(x) + 2, Math.round(star.y) + 1, 1, 1);
      }
    }
    ctx.globalAlpha = 1;

    // Pixel moon, kept just below the HUD line.
    const mx = 204 - ((cameraX * 0.025) % 24);
    const my = 62;
    ctx.globalAlpha = 0.18;
    pixelCircle(ctx, Math.round(mx), my, 19, "#cfe2ff");
    ctx.globalAlpha = 1;
    pixelCircle(ctx, Math.round(mx), my, 14, "#fff0bd");
    pixelCircle(ctx, Math.round(mx) + 2, my - 1, 12, "#f7e7ac");
    ctx.fillStyle = "#e7d295";
    pixelCircle(ctx, Math.round(mx) - 4, my - 4, 3, "#e7d295");
    pixelCircle(ctx, Math.round(mx) + 5, my + 5, 2, "#e7d295");
    pixelCircle(ctx, Math.round(mx) - 1, my + 7, 1, "#e7d295");

    // Distant mountains
    ctx.fillStyle = "#1a2949";
    for (let i = -1; i < 4; i++) {
      const bx = i * 150 - ((cameraX * 0.12) % 150);
      for (let row = 0; row < 74; row += 4) {
        const half = (row / 74) * 95 + 6;
        ctx.fillRect(Math.round(bx + 70 - half), 214 - row, Math.round(half * 2), 4);
      }
    }

    // Low mist
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = "#9db5ea";
    ctx.fillRect(0, 175, 256, 26);
    ctx.globalAlpha = 1;
  }

  function drawBackground(ctx, level, cameraX, time) {
    const theme = level.theme || "overworld";
    const palette = THEMES[theme];

    if (theme === "underground") {
      drawUndergroundBackground(ctx, cameraX, time);
    } else if (theme === "night") {
      drawNightSky(ctx, cameraX, time);
    } else {
      const grd = ctx.createLinearGradient(0, 0, 0, 240);
      grd.addColorStop(0, palette.skyTop);
      grd.addColorStop(0.6, palette.sky);
      grd.addColorStop(1, "#8bb8ff");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 256, 240);
    }

    const decors = level.decor || { clouds: [], hills: [], bushes: [], stars: [] };
    const cloudParallax = 0.36;
    const hillParallax = 0.58;
    const bushParallax = 0.86;

    // Hills are drawn behind clouds and bushes.
    for (const hill of decors.hills || []) {
      const screenX = hill.x * TILE - cameraX * hillParallax;
      if (screenX < -160 || screenX > 360) continue;
      drawHill(ctx, screenX, 208, hill.scale || 1, palette);
    }

    for (const cloud of decors.clouds || []) {
      const screenX = cloud.x * TILE - cameraX * cloudParallax;
      if (screenX < -90 || screenX > 330) continue;
      drawCloud(ctx, screenX, cloud.y, cloud.scale || 1, palette, time);
    }

    for (const bush of decors.bushes || []) {
      const screenX = bush.x * TILE - cameraX * bushParallax;
      if (screenX < -90 || screenX > 330) continue;
      drawBush(ctx, screenX, 209, bush.scale || 1, palette);
    }
  }

  /* ============================================================
     Level furniture
     ============================================================ */

  function castleCanvas(theme) {
    const palette = THEMES[theme] || THEMES.overworld;
    const { ctx, canvas } = context2d(80, 88);
    const base = 88;
    const wall = palette.castle;
    const dark = palette.castleDark;
    const light = palette.castleLight;

    function brickWall(x, y, w, h) {
      px(ctx, x, y, w, h, wall);
      px(ctx, x, y, w, 2, light);
      px(ctx, x, y + h - 2, w, 2, dark);
      px(ctx, x, y, 2, h, light);
      px(ctx, x + w - 2, y, 2, h, dark);
      for (let yy = y + 7; yy < y + h - 3; yy += 8) {
        px(ctx, x + 2, yy, w - 4, 1, dark);
        for (let xx = x + (yy % 16 === 7 ? 9 : 4); xx < x + w - 3; xx += 12) {
          px(ctx, xx, yy - 6, 1, 6, dark);
        }
      }
      for (let yy = y + 4; yy < y + h - 3; yy += 8) {
        for (let xx = x + 4; xx < x + w - 3; xx += 12) {
          px(ctx, xx, yy, 3, 1, light);
        }
      }
    }

    // Main side towers
    brickWall(0, base - 54, 20, 54);
    brickWall(60, base - 54, 20, 54);

    // Central keep
    brickWall(19, base - 80, 42, 80);

    // Battlements on side towers
    for (let i = 0; i < 2; i++) {
      px(ctx, i * 12, base - 62, 8, 8, wall);
      px(ctx, i * 12, base - 62, 8, 2, light);
      px(ctx, i * 12, base - 56, 8, 2, dark);
    }
    for (let i = 0; i < 2; i++) {
      px(ctx, 60 + i * 12, base - 62, 8, 8, wall);
      px(ctx, 60 + i * 12, base - 62, 8, 2, light);
      px(ctx, 60 + i * 12, base - 56, 8, 2, dark);
    }

    // Battlements on keep
    for (let i = 0; i < 4; i++) {
      px(ctx, 19 + i * 12, base - 88, 8, 9, wall);
      px(ctx, 19 + i * 12, base - 88, 8, 2, light);
      px(ctx, 19 + i * 12, base - 81, 8, 2, dark);
    }
    // Battlements should not exceed image top; keep flag pole starts at 8.
    // draw a slim upper wall / tower top
    px(ctx, 30, base - 92, 20, 10, wall);
    px(ctx, 30, base - 92, 20, 2, light);
    px(ctx, 30, base - 84, 20, 2, dark);
    for (let i = 0; i < 2; i++) {
      px(ctx, 31 + i * 11, base - 96, 7, 6, wall);
      px(ctx, 31 + i * 11, base - 96, 7, 2, light);
    }

    // Windows
    function windowAt(x, y) {
      px(ctx, x - 1, y - 1, 8, 10, dark);
      px(ctx, x, y, 6, 8, "#18121c");
      px(ctx, x, y, 1, 3, "#7588a8");
      px(ctx, x + 5, y + 4, 1, 4, "#7588a8");
    }
    windowAt(25, base - 53);
    windowAt(49, base - 53);
    windowAt(37, base - 76);

    // Arched door
    px(ctx, 30, base - 34, 20, 34, dark);
    pixelArch(ctx, 32, base - 31, 16, 31, "#140d15");
    px(ctx, 32, base - 31, 2, 28, "#2a1a20");
    px(ctx, 46, base - 31, 2, 28, "#0a070b");
    // little inner door highlight
    px(ctx, 36, base - 20, 6, 20, "#1d1118");
    // step
    px(ctx, 28, base - 4, 24, 4, dark);

    // Horizontal trim
    px(ctx, 0, base - 53, 20, 2, dark);
    px(ctx, 60, base - 53, 20, 2, dark);
    px(ctx, 19, base - 35, 42, 2, dark);

    return { canvas, base };
  }

  const castleCache = {};

  function drawCastle(ctx, theme, x, groundY, flagProgress) {
    const key = theme || "overworld";
    if (!castleCache[key]) castleCache[key] = castleCanvas(key);
    const { canvas } = castleCache[key];
    const drawX = Math.round(x);
    const drawY = Math.round(groundY - 88);
    ctx.drawImage(canvas, drawX, drawY);

    // Small flag on the keep, animated up during the clear sequence.
    const topY = drawY + 0;
    const poleX = drawX + 39;
    const pal = THEMES[key] || THEMES.overworld;
    px(ctx, poleX, topY - 4, 2, 30, pal.outline);
    px(ctx, poleX, topY - 4, 1, 29, pal.poleLight);
    const rise = Math.max(0, Math.min(1, flagProgress || 0));
    const flagY = topY + 4 - rise * 14;
    const flag = [
      [0, 2, 1],
      [0, 3, 2],
      [0, 4, 3],
      [0, 5, 4],
      [0, 6, 4],
      [0, 7, 3],
      [0, 8, 2],
      [0, 9, 1],
    ];
    for (const [ox, oy, w] of flag) {
      ctx.fillStyle = pal.flag;
      ctx.fillRect(poleX + 2 + ox, flagY + oy, w, 1);
    }
    ctx.fillStyle = pal.flagDark;
    ctx.fillRect(poleX + 2, flagY + 2, 1, 7);
  }

  function drawFlagpole(ctx, flagpole, flagY, theme) {
    const palette = THEMES[theme] || THEMES.overworld;
    const x = Math.round(flagpole.poleX != null ? flagpole.poleX : flagpole.x);
    const groundY = flagpole.groundY;
    const topY = groundY - 144;

    // Shadowy pole backing
    px(ctx, x - 1, topY, 4, 144, palette.outline);
    px(ctx, x, topY + 2, 2, 142, palette.pole);
    px(ctx, x, topY + 2, 1, 142, palette.poleLight);

    // Flagpole ball
    px(ctx, x - 5, topY - 7, 12, 10, palette.outline);
    px(ctx, x - 4, topY - 6, 10, 8, palette.pole);
    px(ctx, x - 2, topY - 5, 5, 3, palette.poleLight);
    px(ctx, x + 2, topY - 3, 2, 2, "#ffffff");

    // Base block
    px(ctx, x - 8, groundY - 16, 18, 16, palette.outline);
    px(ctx, x - 7, groundY - 15, 16, 15, palette.stone);
    px(ctx, x - 7, groundY - 15, 16, 2, "#f4e2a4");
    px(ctx, x - 7, groundY - 4, 16, 3, "#70552a");
    px(ctx, x - 3, groundY - 10, 8, 5, "#fff0b0");

    // Flag: pixel triangular pennant
    const fy = Math.round(flagY);
    for (let row = 0; row < 13; row++) {
      const edge = row < 6 ? row + 1 : 13 - row;
      const w = 2 + edge * 3;
      px(ctx, x - 2 - w, fy + row, w, 1, row < 9 ? palette.flag : palette.flagDark);
    }
    // Emblem
    px(ctx, x - 13, fy + 4, 5, 5, palette.outline);
    px(ctx, x - 12, fy + 5, 3, 3, palette.pole);
    px(ctx, x - 12, fy + 6, 1, 1, palette.poleLight);
  }

  /* ============================================================
     Character rendering
     ============================================================ */

  function drawMario(ctx, data) {
    const power = data.power == null ? 0 : data.power;
    const pose = data.pose || "stand";
    const big = power > 0;
    const maps = big ? BIG_MAPS : SMALL_MAPS;
    const map = maps[pose] || maps.stand;
    let palette = MARIO_PALETTES.normal;

    if (data.star) {
      const cycle = Math.floor((data.starTime || 0) / 3) % 3;
      palette = MARIO_PALETTES[cycle === 0 ? "starA" : cycle === 1 ? "starB" : "starC"];
    } else if (power === 2) {
      palette = MARIO_PALETTES.fire;
    }

    const drawW = 16;
    const spriteX = Math.round(data.x - 2);
    const spriteY = Math.round(data.y);
    const flip = data.facing < 0;

    ctx.save();
    if (flip) {
      ctx.translate(spriteX + drawW, spriteY);
      ctx.scale(-1, 1);
      drawPixelMap(ctx, map, palette, 0, 0);
    } else {
      drawPixelMap(ctx, map, palette, spriteX, spriteY);
    }
    ctx.restore();
  }

  function drawGoomba(ctx, x, y, frame, squashed) {
    const map = squashed ? GOOMBA_SQUASH : frame ? GOOMBA_B : GOOMBA_A;
    const pal = GOOMBA_PALETTES.normal;
    ctx.save();
    if (squashed) {
      ctx.translate(0, 1);
    }
    drawPixelMap(ctx, map, pal, Math.round(x), Math.round(y));
    ctx.restore();
  }

  function drawKoopa(ctx, x, y, frame, state, facing) {
    const pxX = Math.round(x);
    const pxY = Math.round(y);
    const pal = {
      g: "#36b84a",
      G: "#0d5420",
      l: "#9bf06e",
      y: "#ffd66b",
      Y: "#a96918",
      w: "#fffbe8",
      k: "#10240f",
    };
    ctx.save();
    if (state === "shell" || state === "shellMove") {
      const roll = state === "shellMove" ? Math.floor(frame / 2) % 2 : 0;
      ctx.translate(pxX + (facing < 0 ? 16 : 0), pxY - 2);
      ctx.scale(facing < 0 ? -1 : 1, 1);
      drawKoopaShell(ctx, pal, roll);
      ctx.restore();
      return;
    }

    ctx.translate(facing < 0 ? pxX + 16 : pxX, pxY);
    ctx.scale(facing < 0 ? -1 : 1, 1);

    const step = frame % 2;
    // Feet
    const footOffset = step ? 1 : 0;
    px(ctx, 3 + footOffset, 19, 4, 4, pal.Y);
    px(ctx, 4 + footOffset, 19, 3, 3, pal.y);
    px(ctx, 9 - footOffset, 19, 4, 4, pal.Y);
    px(ctx, 9 - footOffset, 19, 3, 3, pal.y);

    // tail
    px(ctx, 0, 13, 3, 3, pal.G);
    px(ctx, 0, 14, 2, 2, pal.g);

    // Shell silhouette
    const shellRows = [
      [6, 9], [4, 12], [2, 14], [1, 15], [1, 16], [0, 16], [0, 16],
      [0, 16], [0, 16], [0, 16], [1, 15], [1, 15], [2, 13], [4, 10],
    ];
    for (let i = 0; i < shellRows.length; i++) {
      const [sx, w] = shellRows[i];
      px(ctx, sx, 7 + i, w, 1, pal.G);
    }
    for (let i = 2; i < shellRows.length - 2; i++) {
      const [sx, w] = shellRows[i];
      px(ctx, sx + 1, 7 + i, Math.max(1, w - 2), 1, pal.g);
    }
    // Rim
    px(ctx, 2, 18, 13, 2, pal.y);
    px(ctx, 3, 19, 11, 1, pal.Y);
    // Shell pattern
    px(ctx, 4, 11, 4, 3, pal.G);
    px(ctx, 5, 12, 2, 1, pal.l);
    px(ctx, 9, 9, 4, 2, pal.G);
    px(ctx, 10, 10, 2, 1, pal.l);
    px(ctx, 7, 15, 5, 3, pal.G);
    px(ctx, 8, 16, 3, 1, pal.l);
    px(ctx, 4, 16, 2, 2, pal.G);

    // Neck & head
    px(ctx, 9, 5, 6, 7, pal.G);
    px(ctx, 10, 4, 6, 7, pal.G);
    px(ctx, 10, 3, 5, 2, pal.G);
    px(ctx, 11, 4, 4, 5, pal.g);
    px(ctx, 11, 3, 3, 1, pal.l);
    // face
    px(ctx, 12, 5, 4, 4, pal.g);
    px(ctx, 12, 6, 2, 3, pal.w);
    px(ctx, 13, 6, 1, 2, pal.k);
    px(ctx, 15, 6, 1, 1, pal.k);
    px(ctx, 11, 9, 4, 2, pal.y);
    px(ctx, 12, 9, 2, 1, pal.Y);
    // eye pupil
    px(ctx, 12, 11, 4, 2, pal.g);
    ctx.restore();
  }

  function drawKoopaShell(ctx, pal, roll) {
    const shellRows = [
      [5, 6], [3, 10], [2, 12], [1, 14], [0, 16], [0, 16], [0, 16],
      [0, 16], [0, 16], [0, 16], [0, 16], [1, 14], [2, 12], [3, 9],
      [5, 6],
    ];
    for (let i = 0; i < shellRows.length; i++) {
      const [sx, w] = shellRows[i];
      px(ctx, sx, 1 + i, w, 1, pal.G);
    }
    for (let i = 2; i < shellRows.length - 2; i++) {
      const [sx, w] = shellRows[i];
      px(ctx, sx + 1, 1 + i, Math.max(1, w - 2), 1, pal.g);
    }

    // A yellow banded rim and dark shell plates make the sphere read as a shell.
    px(ctx, 1, 9, 2, 4, pal.y);
    px(ctx, 13, 9, 2, 4, pal.y);
    px(ctx, 2, 12, 12, 2, pal.y);
    px(ctx, 3, 13, 10, 1, pal.Y);
    px(ctx, 3, 4, 10, 7, pal.G);
    px(ctx, 4, 5, 8, 5, pal.g);
    px(ctx, 5, 6, 5, 2, pal.l);
    px(ctx, 4, 9, 3, 2, pal.l);
    px(ctx, 9, 4, 2, 2, pal.G);
    px(ctx, 6 + roll, 8, 3, 1, pal.G);
    px(ctx, 8 + roll, 10, 2, 1, pal.G);
  }

  function drawMushroom(ctx, x, y, oneUp) {
    const pal = oneUp
      ? { r: "#3fc65a", w: "#f8ffe8", s: "#fff2cc", k: "#153d16" }
      : { r: "#e33a2f", w: "#fff8ec", s: "#fff1cf", k: "#3d1208" };
    const xx = Math.round(x);
    const yy = Math.round(y);
    px(ctx, xx + 4, yy, 8, 1, pal.k);
    px(ctx, xx + 2, yy + 1, 12, 1, pal.r);
    px(ctx, xx + 1, yy + 2, 14, 5, pal.r);
    px(ctx, xx + 2, yy + 2, 3, 3, pal.w);
    px(ctx, xx + 10, yy + 2, 3, 3, pal.w);
    px(ctx, xx + 6, yy + 1, 2, 1, pal.w);
    px(ctx, xx + 1, yy + 6, 14, 3, pal.k);
    px(ctx, xx + 2, yy + 6, 12, 3, pal.s);
    px(ctx, xx + 3, yy + 9, 3, 5, pal.k);
    px(ctx, xx + 10, yy + 9, 3, 5, pal.k);
    px(ctx, xx + 4, yy + 10, 8, 5, pal.s);
    px(ctx, xx + 5, yy + 10, 1, 2, pal.k);
    px(ctx, xx + 10, yy + 10, 1, 2, pal.k);
    px(ctx, xx + 4, yy + 14, 8, 1, "#e0cba3");
  }

  function drawFireFlower(ctx, x, y, time) {
    const frame = Math.floor((time || 0) / 110) % FLOWER_PALETTES.length;
    drawPixelMap(ctx, FLOWER_MAP_A, FLOWER_PALETTES[frame], Math.round(x), Math.round(y));
    // gentle glow / sparkle
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin((time || 0) * 0.006);
    px(ctx, Math.round(x) + 13, Math.round(y) + 3, 1, 3, "#fff2a8");
    px(ctx, Math.round(x) + 12, Math.round(y) + 4, 3, 1, "#fff2a8");
    ctx.globalAlpha = 1;
  }

  function drawStarItem(ctx, x, y, time) {
    const pal = {
      k: "#6b4a00",
      y: Math.floor((time || 0) / 90) % 2 === 0 ? "#ffe447" : "#fff5b0",
    };
    drawPixelMap(ctx, STAR_MAP, pal, Math.round(x), Math.round(y));
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin((time || 0) * 0.007);
    px(ctx, Math.round(x) + 7, Math.round(y) + 5, 2, 2, "#ffffff");
    ctx.globalAlpha = 1;
  }

  function drawCoin(ctx, x, y, frame, scale) {
    const s = scale || 1;
    const xx = Math.round(x);
    const yy = Math.round(y);
    const widths = [10, 7, 3, 1, 3, 7];
    const w = widths[Math.floor(frame) % widths.length] * s;
    const cx = xx + 8 * s;
    const h = 14 * s;
    const top = yy + 1 * s;

    ctx.fillStyle = "#5b3200";
    ctx.fillRect(cx - Math.ceil(w / 2) - s, top, w + 2 * s, h);
    ctx.fillStyle = "#c68900";
    ctx.fillRect(cx - Math.floor(w / 2), top, w, h);
    if (w > 2 * s) {
      ctx.fillStyle = "#ffd83e";
      ctx.fillRect(cx - Math.floor(w / 2), top + s, Math.max(s, w - 2 * s), h - 2 * s);
      ctx.fillStyle = "#fff3a0";
      ctx.fillRect(cx - Math.floor(w / 2) + s, top + 2 * s, Math.max(s, Math.floor(w / 3)), h - 4 * s);
      ctx.fillStyle = "#9c5b00";
      ctx.fillRect(cx - Math.floor(w / 2) + Math.max(s, w - 3 * s), top + 3 * s, s, h - 6 * s);
    } else {
      ctx.fillStyle = "#ffd83e";
      ctx.fillRect(cx, top + s, Math.max(1, w), h - 2 * s);
    }
    ctx.fillStyle = "#fff3a0";
    ctx.fillRect(cx - s, top + 2 * s, s, 2 * s);
  }

  function drawFireball(ctx, x, y, frame, facing) {
    const xx = Math.round(x);
    const yy = Math.round(y);
    const t = Math.floor(frame) % 4;
    const palettes = [
      ["#ff5a00", "#ffcf3a", "#fff8d0"],
      ["#ff8a00", "#ffe05a", "#fffbe0"],
      ["#ff5a00", "#ffb12e", "#fff0a0"],
      ["#ff8a00", "#ffcf3a", "#fff8d0"],
    ];
    const p = palettes[t];
    pixelCircle(ctx, xx + 4, yy + 4, 4, p[0]);
    pixelCircle(ctx, xx + 4, yy + 4, 3, p[1]);
    px(ctx, xx + 2, yy + 2, 3, 3, p[2]);
    px(ctx, xx + (facing < 0 ? 7 : 0), yy + 3, 2, 2, p[0]);
    ctx.globalAlpha = 0.25;
    pixelCircle(ctx, xx + 4, yy + 4, 6, p[0]);
    ctx.globalAlpha = 1;
  }

  /* ============================================================
     Public API
     ============================================================ */

  const Art = {
    TILE,
    THEMES,
    drawText,
    textWidth,
    drawBackground,
    drawMario,
    drawGoomba,
    drawKoopa,
    drawMushroom,
    drawFireFlower,
    drawStarItem,
    drawCoin,
    drawFireball,
    drawCastle,
    drawFlagpole,
    drawCloud,
    drawBush,
    drawHill,

    init() {
      buildTiles();
      return this;
    },

    getTile(theme, type, tx, ty, time) {
      const set = tileCache[theme] || tileCache.overworld;
      let key = type;
      if (type === "ground") {
        return set.ground[(Math.abs(tx * 3 + ty * 5) | 0) % set.ground.length];
      }
      if (type === "question") {
        const frame = type === "question" ? set.questionOrder[Math.floor((time || 0) / 130) % set.questionOrder.length] : 0;
        return set.question[frame];
      }
      if (type === "pipeTopLeft") return set.pipeTopLeft;
      if (type === "pipeTopRight") return set.pipeTopRight;
      if (type === "pipeBodyLeft") return set.pipeBodyLeft;
      if (type === "pipeBodyRight") return set.pipeBodyRight;
      return set[key] || set.brick;
    },

    drawTileAt(ctx, theme, type, sx, sy, time, bump) {
      const img = this.getTile(theme, type, sx >> 4, sy >> 4, time);
      ctx.drawImage(img, Math.round(sx), Math.round(sy + (bump || 0)));
    },
  };

  window.Art = Art;
})();
