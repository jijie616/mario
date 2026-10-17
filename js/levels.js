/* ============================================================
   SUPER MARIO - HTML5 - hand-built World 1 levels
   Coordinates are in tiles. Rows 13-14 are the standard floor.
   ============================================================ */

(function () {
  "use strict";

  const Q = (x, y, item) => ({ x, y, type: "question", item: item || "coin" });
  const B = (x, y) => ({ x, y, type: "brick" });
  const H = (x, y) => ({ x, y, type: "hard" });

  function brickRow(x, y, length) {
    const out = [];
    for (let i = 0; i < length; i++) out.push(B(x + i, y));
    return out;
  }

  function hardRow(x, y, length) {
    const out = [];
    for (let i = 0; i < length; i++) out.push(H(x + i, y));
    return out;
  }

  function coinLine(x, y, length) {
    const out = [];
    for (let i = 0; i < length; i++) out.push([x + i, y]);
    return out;
  }

  // Builds an ascending staircase: first column is 1 tile tall, last is `count` tall.
  function stair(x, highest, count) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const height = Math.min(count, i + 1);
      for (let row = 0; row < height; row++) {
        out.push(H(x + i, 12 - row));
      }
    }
    return out;
  }

  const levelOne = {
    id: "1-1",
    name: "MUSHROOM PLAINS",
    theme: "overworld",
    bgm: "overworld",
    width: 216,
    time: 400,
    start: { x: 2.5, y: 13 },
    ground: [
      [0, 68],
      [71, 85],
      [89, 152],
      [156, 215],
    ],
    blocks: [
      Q(16, 9, "coin"),

      B(20, 5),
      Q(21, 5, "coin"),
      B(22, 5),
      Q(23, 5, "coin"),
      B(24, 5),
      Q(22, 9, "power"),

      B(32, 5),
      Q(33, 5, "coin"),
      B(34, 5),

      B(53, 9),
      Q(54, 9, "coin"),
      B(55, 9),

      B(74, 9),
      Q(75, 9, "coin"),
      B(76, 9),

      B(78, 5),
      Q(79, 5, "power"),
      B(80, 5),
      Q(81, 5, "coin"),
      B(82, 5),

      Q(92, 9, "coin"),
      B(93, 9),
      Q(94, 9, "coin"),

      ...stair(112, 4, 4),
      Q(116, 7, "coin"),

      B(129, 5),
      Q(130, 5, "coin"),
      B(131, 5),
      Q(134, 9, "power"),
      Q(136, 5, "star"),

      Q(142, 9, "coin"),
      B(143, 9),
      B(144, 9),

      Q(160, 9, "1up"),
      B(162, 9),
      Q(163, 9, "coin"),

      ...stair(181, 4, 4),
      H(185, 9),
      H(185, 10),
      H(185, 11),
      H(185, 12),
      H(186, 9),
      H(186, 10),
      H(186, 11),
      H(186, 12),
    ],
    pipes: [
      { x: 28, top: 11, height: 2 },
      { x: 38, top: 10, height: 3 },
      { x: 46, top: 9, height: 4 },
      { x: 57, top: 9, height: 4 },
      { x: 100, top: 10, height: 3 },
      { x: 124, top: 10, height: 3 },
      { x: 168, top: 11, height: 2 },
    ],
    coins: [
      ...coinLine(32, 8, 3),
      ...coinLine(65, 8, 2),
      ...coinLine(86, 7, 3),
      ...coinLine(92, 7, 3),
      ...coinLine(116, 7, 2),
      ...coinLine(134, 7, 3),
      ...coinLine(142, 7, 3),
      ...coinLine(155, 7, 1),
      ...coinLine(183, 7, 4),
      ...coinLine(193, 7, 2),
    ],
    enemies: [
      { type: "goomba", x: 22, y: 13 },
      { type: "goomba", x: 34, y: 13 },
      { type: "goomba", x: 41, y: 13 },
      { type: "goomba", x: 53, y: 13 },
      { type: "goomba", x: 72, y: 13 },
      { type: "goomba", x: 82, y: 13 },
      { type: "koopa", x: 107, y: 13 },
      { type: "goomba", x: 117, y: 13 },
      { type: "goomba", x: 128, y: 13 },
      { type: "koopa", x: 138, y: 13 },
      { type: "goomba", x: 147, y: 13 },
      { type: "goomba", x: 149, y: 13 },
      { type: "goomba", x: 160, y: 13 },
      { type: "goomba", x: 173, y: 13 },
      { type: "koopa", x: 178, y: 13 },
    ],
    decor: {
      clouds: [
        { x: -4, y: 40, scale: 1 },
        { x: 9, y: 64, scale: 1.35 },
        { x: 24, y: 34, scale: 0.9 },
        { x: 40, y: 58, scale: 1.2 },
        { x: 58, y: 38, scale: 1 },
        { x: 76, y: 70, scale: 0.8 },
        { x: 87, y: 42, scale: 1.3 },
        { x: 106, y: 62, scale: 1 },
        { x: 121, y: 30, scale: 1.1 },
        { x: 138, y: 52, scale: 1.25 },
        { x: 157, y: 36, scale: 0.9 },
        { x: 172, y: 66, scale: 1.2 },
        { x: 193, y: 44, scale: 1 },
        { x: 208, y: 62, scale: 1.4 },
      ],
      hills: [
        { x: -1, scale: 1 },
        { x: 13, scale: 2 },
        { x: 42, scale: 1 },
        { x: 54, scale: 2 },
        { x: 89, scale: 1 },
        { x: 107, scale: 2 },
        { x: 139, scale: 1 },
        { x: 163, scale: 2 },
        { x: 195, scale: 1 },
      ],
      bushes: [
        { x: 6, scale: 1 },
        { x: 21, scale: 1.35 },
        { x: 35, scale: 1 },
        { x: 50, scale: 1.25 },
        { x: 66, scale: 0.9 },
        { x: 78, scale: 1.4 },
        { x: 96, scale: 1 },
        { x: 113, scale: 1.3 },
        { x: 132, scale: 1 },
        { x: 147, scale: 1.2 },
        { x: 163, scale: 1 },
        { x: 178, scale: 1.35 },
        { x: 194, scale: 1 },
        { x: 205, scale: 1.25 },
      ],
    },
    end: { type: "flag", x: 196, castleX: 203 },
  };

  const levelTwo = {
    id: "1-2",
    name: "UNDERGROUND",
    theme: "underground",
    bgm: "underground",
    width: 176,
    time: 400,
    ceiling: 1,
    start: { x: 2.5, y: 13 },
    ground: [
      [0, 39],
      [42, 72],
      [76, 110],
      [114, 175],
    ],
    blocks: [
      Q(10, 9, "power"),
      B(11, 9),
      Q(12, 9, "coin"),
      ...brickRow(18, 5, 4),
      Q(20, 5, "coin"),

      ...brickRow(44, 3, 3),
      ...brickRow(45, 2, 2),

      Q(53, 8, "coin"),
      B(54, 8),
      Q(55, 8, "power"),
      B(56, 8),

      ...hardRow(60, 9, 4),
      Q(62, 6, "coin"),

      ...brickRow(81, 8, 5),
      Q(83, 8, "coin"),
      Q(85, 8, "star"),
      ...brickRow(88, 8, 2),

      ...hardRow(96, 10, 4),
      Q(98, 7, "coin"),

      Q(102, 9, "coin"),
      B(106, 9),
      Q(107, 9, "coin"),

      ...brickRow(117, 8, 4),
      Q(119, 8, "power"),
      ...brickRow(122, 8, 2),
      ...brickRow(124, 5, 3),

      Q(133, 9, "coin"),
      B(134, 9),
      Q(135, 9, "coin"),

      ...stair(138, 3, 3),
      ...brickRow(144, 4, 4),
      Q(146, 4, "coin"),
    ],
    pipes: [
      { x: 30, top: 11, height: 2 },
      { x: 49, top: 9, height: 4 },
      { x: 67, top: 11, height: 2 },
      { x: 104, top: 10, height: 3 },
    ],
    coins: [
      ...coinLine(5, 9, 4),
      ...coinLine(13, 7, 4),
      ...coinLine(22, 7, 3),
      ...coinLine(40, 7, 2),
      ...coinLine(46, 6, 3),
      ...coinLine(58, 7, 2),
      ...coinLine(73, 8, 3),
      ...coinLine(76, 6, 2),
      ...coinLine(91, 6, 3),
      ...coinLine(96, 8, 3),
      ...coinLine(111, 7, 3),
      ...coinLine(120, 6, 3),
      ...coinLine(128, 7, 3),
      ...coinLine(141, 7, 4),
      ...coinLine(152, 6, 3),
    ],
    enemies: [
      { type: "goomba", x: 14, y: 13 },
      { type: "koopa", x: 24, y: 13 },
      { type: "goomba", x: 33, y: 13 },
      { type: "goomba", x: 45, y: 13 },
      { type: "goomba", x: 63, y: 9 },
      { type: "koopa", x: 70, y: 13 },
      { type: "goomba", x: 79, y: 13 },
      { type: "koopa", x: 90, y: 13 },
      { type: "goomba", x: 99, y: 10 },
      { type: "goomba", x: 108, y: 13 },
      { type: "koopa", x: 116, y: 13 },
      { type: "goomba", x: 127, y: 13 },
      { type: "koopa", x: 132, y: 13 },
      { type: "goomba", x: 143, y: 13 },
      { type: "goomba", x: 149, y: 13 },
    ],
    decor: { clouds: [], hills: [], bushes: [] },
    end: { type: "pipe", x: 158, top: 10, height: 3, hint: true },
  };

  const levelThree = {
    id: "1-3",
    name: "STARLIGHT HEIGHTS",
    theme: "night",
    bgm: "night",
    width: 196,
    time: 400,
    start: { x: 2.5, y: 13 },
    ground: [
      [0, 24],
      [74, 82],
      [108, 120],
      [149, 195],
    ],
    blocks: [
      Q(8, 9, "power"),
      B(9, 9),
      Q(10, 9, "coin"),

      ...hardRow(27, 10, 4),
      Q(29, 6, "coin"),

      ...hardRow(34, 9, 5),
      Q(36, 5, "star"),

      ...hardRow(42, 10, 5),

      ...hardRow(50, 9, 5),
      Q(52, 5, "coin"),

      ...hardRow(58, 11, 5),
      ...hardRow(66, 9, 5),
      Q(67, 5, "power"),

      ...hardRow(85, 11, 4),
      Q(86, 7, "coin"),

      ...hardRow(92, 9, 6),
      ...brickRow(94, 5, 3),
      Q(95, 5, "coin"),

      ...hardRow(101, 11, 5),
      Q(102, 7, "coin"),

      ...hardRow(124, 11, 5),
      Q(125, 7, "power"),

      ...hardRow(132, 9, 5),
      ...brickRow(133, 5, 3),
      Q(134, 5, "coin"),

      ...hardRow(141, 11, 5),

      Q(155, 9, "coin"),
      B(156, 9),
      Q(157, 9, "coin"),
      ...brickRow(160, 5, 4),
      Q(161, 5, "coin"),
    ],
    pipes: [
      { x: 20, top: 11, height: 2 },
      { x: 112, top: 11, height: 2 },
    ],
    coins: [
      ...coinLine(12, 8, 4),
      ...coinLine(25, 7, 2),
      ...coinLine(31, 7, 3),
      ...coinLine(39, 7, 3),
      ...coinLine(47, 7, 3),
      ...coinLine(55, 6, 3),
      ...coinLine(63, 7, 3),
      ...coinLine(71, 7, 3),
      ...coinLine(79, 9, 3),
      ...coinLine(89, 7, 3),
      ...coinLine(98, 6, 3),
      ...coinLine(106, 7, 3),
      ...coinLine(122, 7, 2),
      ...coinLine(129, 7, 3),
      ...coinLine(137, 6, 3),
      ...coinLine(145, 8, 3),
      ...coinLine(151, 7, 3),
      ...coinLine(164, 7, 4),
    ],
    enemies: [
      { type: "goomba", x: 14, y: 13 },
      { type: "goomba", x: 18, y: 13 },
      { type: "goomba", x: 28, y: 10 },
      { type: "koopa", x: 36, y: 9 },
      { type: "goomba", x: 44, y: 10 },
      { type: "goomba", x: 51, y: 9 },
      { type: "koopa", x: 59, y: 11 },
      { type: "goomba", x: 67, y: 9 },
      { type: "goomba", x: 78, y: 13 },
      { type: "goomba", x: 80, y: 13 },
      { type: "goomba", x: 86, y: 11 },
      { type: "koopa", x: 95, y: 9 },
      { type: "goomba", x: 116, y: 13 },
      { type: "goomba", x: 125, y: 11 },
      { type: "goomba", x: 134, y: 9 },
      { type: "koopa", x: 143, y: 11 },
      { type: "goomba", x: 156, y: 13 },
      { type: "goomba", x: 160, y: 13 },
      { type: "koopa", x: 164, y: 13 },
    ],
    decor: {
      clouds: [
        { x: 2, y: 72, scale: 1.1 },
        { x: 25, y: 54, scale: 0.85 },
        { x: 49, y: 78, scale: 1.2 },
        { x: 73, y: 46, scale: 1 },
        { x: 101, y: 70, scale: 0.9 },
        { x: 128, y: 50, scale: 1.3 },
        { x: 154, y: 74, scale: 1 },
        { x: 181, y: 54, scale: 1.15 },
      ],
      hills: [],
      bushes: [
        { x: 5, scale: 1.2 },
        { x: 16, scale: 1.0 },
        { x: 76, scale: 1.1 },
        { x: 112, scale: 1.3 },
        { x: 117, scale: 0.9 },
        { x: 152, scale: 1.2 },
        { x: 165, scale: 1.0 },
        { x: 184, scale: 1.3 },
      ],
    },
    end: { type: "flag", x: 170, castleX: 178 },
  };

  window.LEVELS = [levelOne, levelTwo, levelThree];
})();

