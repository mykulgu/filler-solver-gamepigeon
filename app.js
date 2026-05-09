"use strict";

const ROWS = 7;
const COLS = 8;
const CELL_COUNT = ROWS * COLS;
const YOU = 0;
const OPP = 1;
const EMPTY = -1;
const BLANK = "";
const CALC_CURRENT = "current";

const COLORS = [
  { id: "R", name: "Red", hex: "#e7465b", text: "#171717" },
  { id: "G", name: "Green", hex: "#a8d65d", text: "#171717" },
  { id: "Y", name: "Yellow", hex: "#ffe45c", text: "#171717" },
  { id: "B", name: "Blue", hex: "#58a9e6", text: "#171717" },
  { id: "P", name: "Purple", hex: "#8067b7", text: "#ffffff" },
  { id: "K", name: "Black", hex: "#3f4244", text: "#ffffff" },
];

const SCREENSHOT_COLORS = [
  { id: "R", rgb: [231, 70, 91] },
  { id: "G", rgb: [168, 214, 93] },
  { id: "Y", rgb: [255, 228, 92] },
  { id: "B", rgb: [88, 169, 230] },
  { id: "P", rgb: [128, 103, 183] },
  { id: "K", rgb: [63, 66, 68] },
];

const COLOR_BY_ID = Object.create(null);
const COLOR_INDEX = Object.create(null);
for (let i = 0; i < COLORS.length; i += 1) {
  COLOR_BY_ID[COLORS[i].id] = COLORS[i];
  COLOR_INDEX[COLORS[i].id] = i;
}

const WORD_TO_COLOR = {
  BLACK: "K",
  RED: "R",
  GREEN: "G",
  YELLOW: "Y",
  BLUE: "B",
  PURPLE: "P",
};

const DEFAULT_GRID_TEXT = [
  "K R G P Y P K P",
  "B G K R G K G R",
  "Y R Y G P R K B",
  "P K B K B Y G K",
  "G B P B G K R G",
  "R Y G Y B R Y P",
  "K G P K P G P B",
].join("\n");

function idx(row, col) {
  return row * COLS + col;
}

const ADJ = [];
for (let cell = 0; cell < CELL_COUNT; cell += 1) {
  const row = Math.floor(cell / COLS);
  const col = cell % COLS;
  const neighbors = [];
  if (row > 0) neighbors.push(idx(row - 1, col));
  if (row < ROWS - 1) neighbors.push(idx(row + 1, col));
  if (col > 0) neighbors.push(idx(row, col - 1));
  if (col < COLS - 1) neighbors.push(idx(row, col + 1));
  ADJ.push(neighbors);
}

function isColorId(value) {
  return Object.prototype.hasOwnProperty.call(COLOR_INDEX, value);
}

function colorIndexName(colorIndex) {
  return COLORS[colorIndex] ? COLORS[colorIndex].name : "Unset";
}

function playerLabel(player) {
  return player === YOU ? "You" : "Opponent";
}

function parseGrid(text) {
  const raw = String(text || "").trim().toUpperCase();
  if (!raw) throw new Error("Expected 56 cells.");

  const tokens = [];
  const bad = [];
  const parts = raw.split(/[^A-Z]+/).filter(Boolean);
  for (const part of parts) {
    if (Object.prototype.hasOwnProperty.call(WORD_TO_COLOR, part)) {
      tokens.push(WORD_TO_COLOR[part]);
    } else if (/^[RGYBPK]+$/.test(part)) {
      for (let i = 0; i < part.length; i += 1) tokens.push(part.charAt(i));
    } else {
      bad.push(part);
    }
  }

  if (bad.length) {
    throw new Error("Unknown color token: " + bad.slice(0, 4).join(", "));
  }
  if (tokens.length !== CELL_COUNT) {
    throw new Error("Expected 56 cells, got " + tokens.length + ".");
  }
  return tokens;
}

function gridToText(grid) {
  const rows = [];
  for (let r = 0; r < ROWS; r += 1) {
    rows.push(grid.slice(r * COLS, (r + 1) * COLS).join(" "));
  }
  return rows.join("\n");
}

function makeBlankGrid() {
  return new Array(CELL_COUNT).fill(BLANK);
}

function isCompleteGrid(grid) {
  return Array.isArray(grid) && grid.length === CELL_COUNT && grid.every(isColorId);
}

function filledCellCount(grid) {
  let total = 0;
  for (let i = 0; i < grid.length; i += 1) {
    if (isColorId(grid[i])) total += 1;
  }
  return total;
}

function stateFromGrid(grid) {
  return isCompleteGrid(grid) ? initialState(grid) : makeSetupState();
}

function makeSetupState() {
  return {
    owner: new Array(CELL_COUNT).fill(EMPTY),
    youColor: null,
    oppColor: null,
    turn: YOU,
    ready: false,
  };
}

function cloneState(state) {
  return {
    owner: state.owner.slice(),
    youColor: state.youColor,
    oppColor: state.oppColor,
    turn: state.turn,
    ready: state.ready,
  };
}

function countOwner(owner, player) {
  let total = 0;
  for (let i = 0; i < owner.length; i += 1) {
    if (owner[i] === player) total += 1;
  }
  return total;
}

function floodFromCell(owner, grid, startCell, player, colorIndex, blockedPlayer) {
  const colorId = COLORS[colorIndex].id;
  const nextOwner = owner.slice();
  const queue = [];
  let head = 0;

  if (grid[startCell] !== colorId || nextOwner[startCell] === blockedPlayer) return nextOwner;
  nextOwner[startCell] = player;
  queue.push(startCell);

  while (head < queue.length) {
    const cell = queue[head];
    head += 1;
    for (const neighbor of ADJ[cell]) {
      if (nextOwner[neighbor] !== blockedPlayer && nextOwner[neighbor] !== player && grid[neighbor] === colorId) {
        nextOwner[neighbor] = player;
        queue.push(neighbor);
      }
    }
  }

  return nextOwner;
}

function expandArea(owner, grid, player, colorIndex, blockedPlayer) {
  const colorId = COLORS[colorIndex].id;
  const nextOwner = owner.slice();
  const queue = [];
  let head = 0;

  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (nextOwner[i] === player) queue.push(i);
  }

  while (head < queue.length) {
    const cell = queue[head];
    head += 1;
    for (const neighbor of ADJ[cell]) {
      if (nextOwner[neighbor] !== blockedPlayer && nextOwner[neighbor] !== player && grid[neighbor] === colorId) {
        nextOwner[neighbor] = player;
        queue.push(neighbor);
      }
    }
  }

  return nextOwner;
}

function initialState(grid) {
  if (!isCompleteGrid(grid)) return makeSetupState();
  const owner = new Array(CELL_COUNT).fill(EMPTY);
  const youStart = idx(ROWS - 1, 0);
  const oppStart = idx(0, COLS - 1);
  const youColor = COLOR_INDEX[grid[youStart]];
  const oppColor = COLOR_INDEX[grid[oppStart]];
  const afterYou = floodFromCell(owner, grid, youStart, YOU, youColor, OPP);
  const afterOpp = floodFromCell(afterYou, grid, oppStart, OPP, oppColor, YOU);
  return { owner: afterOpp, youColor, oppColor, turn: YOU, ready: true };
}

function stateWithTurn(state, player) {
  const next = cloneState(state);
  if (next.ready && (player === YOU || player === OPP)) next.turn = player;
  return next;
}

function legalMoves(youColor, oppColor) {
  if (typeof youColor !== "number" || typeof oppColor !== "number") return [];
  const moves = [];
  for (let i = 0; i < COLORS.length; i += 1) {
    if (i !== youColor && i !== oppColor) moves.push(i);
  }
  return moves;
}

function applyMove(state, moveColor, grid) {
  if (!state.ready || legalMoves(state.youColor, state.oppColor).indexOf(moveColor) === -1) return state;

  if (state.turn === YOU) {
    return {
      owner: expandArea(state.owner, grid, YOU, moveColor, OPP),
      youColor: moveColor,
      oppColor: state.oppColor,
      turn: OPP,
      ready: true,
    };
  }

  return {
    owner: expandArea(state.owner, grid, OPP, moveColor, YOU),
    youColor: state.youColor,
    oppColor: moveColor,
    turn: YOU,
    ready: true,
  };
}

function terminal(state) {
  return state.ready && state.owner.every((owner) => owner !== EMPTY);
}

function scoreForYou(state) {
  return countOwner(state.owner, YOU) - countOwner(state.owner, OPP);
}

function visibleCellColorId(grid, state, cellIndex, editMode) {
  if (editMode || !state.ready) return grid[cellIndex];
  if (state.owner[cellIndex] === YOU) return COLORS[state.youColor].id;
  if (state.owner[cellIndex] === OPP) return COLORS[state.oppColor].id;
  return grid[cellIndex];
}

function displayColorForCell(colorId) {
  return COLOR_BY_ID[colorId] || { name: "Blank", hex: "#ffffff", text: "#171717" };
}

function frontierSize(owner, player, blockedPlayer) {
  const seen = new Array(CELL_COUNT).fill(false);
  let total = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (owner[i] !== player) continue;
    for (const neighbor of ADJ[i]) {
      if (owner[neighbor] !== player && owner[neighbor] !== blockedPlayer && !seen[neighbor]) {
        seen[neighbor] = true;
        total += 1;
      }
    }
  }
  return total;
}

function heuristic(state) {
  const material = scoreForYou(state) * 100;
  const mobility = frontierSize(state.owner, YOU, OPP) - frontierSize(state.owner, OPP, YOU);
  return material + mobility * 8;
}

function nowMs() {
  return window.performance && typeof window.performance.now === "function" ? window.performance.now() : Date.now();
}

function keyOf(state, depth) {
  return state.turn + "|" + state.youColor + "|" + state.oppColor + "|" + depth + "|" + state.owner.join("");
}

function solvePosition(root, grid, options) {
  if (!root.ready || !isCompleteGrid(grid)) {
    return { rows: [], best: null, nodes: 0, timedOut: false, elapsed: 0, exact: false, calcTurn: root.turn };
  }

  const started = nowMs();
  const maxDepth = options.exact ? 999 : Math.max(1, Number(options.depth) || 1);
  const timeLimitMs = Math.max(100, Number(options.timeLimitMs) || 1000);
  const table = new Map();
  let nodes = 0;
  let timedOut = false;

  function orderedMoves(state) {
    const moves = legalMoves(state.youColor, state.oppColor);
    const scored = moves.map((move) => {
      const next = applyMove(state, move, grid);
      const before = state.turn === YOU ? countOwner(state.owner, YOU) : countOwner(state.owner, OPP);
      const after = state.turn === YOU ? countOwner(next.owner, YOU) : countOwner(next.owner, OPP);
      const playerSign = state.turn === YOU ? 1 : -1;
      return { move, orderScore: (after - before) * 1000 + heuristic(next) * playerSign };
    });
    scored.sort((a, b) => b.orderScore - a.orderScore);
    return scored.map((item) => item.move);
  }

  function minimax(state, depth, alpha, beta) {
    nodes += 1;
    if (nodes % 1024 === 0 && nowMs() - started > timeLimitMs) {
      timedOut = true;
      return heuristic(state);
    }
    if (terminal(state)) return scoreForYou(state) * 10000;
    if (depth <= 0) return heuristic(state);

    const key = keyOf(state, depth);
    if (table.has(key)) return table.get(key);

    const moves = orderedMoves(state);
    let best = state.turn === YOU ? -Infinity : Infinity;
    for (const move of moves) {
      const value = minimax(applyMove(state, move, grid), depth - 1, alpha, beta);
      if (state.turn === YOU) {
        if (value > best) best = value;
        if (value > alpha) alpha = value;
      } else {
        if (value < best) best = value;
        if (value < beta) beta = value;
      }
      if (beta <= alpha || timedOut) break;
    }

    if (!timedOut) table.set(key, best);
    return best;
  }

  const rows = [];
  for (const move of orderedMoves(root)) {
    if (nowMs() - started > timeLimitMs) {
      timedOut = true;
      break;
    }
    const before = root.turn === YOU ? countOwner(root.owner, YOU) : countOwner(root.owner, OPP);
    const next = applyMove(root, move, grid);
    const after = root.turn === YOU ? countOwner(next.owner, YOU) : countOwner(next.owner, OPP);
    const value = minimax(next, maxDepth - 1, -Infinity, Infinity);
    rows.push({
      move,
      value,
      immediateGain: after - before,
      projectedMargin: Math.round(value / 10000),
      player: root.turn,
    });
    if (timedOut) break;
  }

  rows.sort((a, b) => (root.turn === YOU ? b.value - a.value : a.value - b.value));

  return {
    rows,
    best: rows.length ? rows[0] : null,
    nodes,
    timedOut,
    elapsed: Math.round(nowMs() - started),
    exact: Boolean(options.exact) && !timedOut,
    calcTurn: root.turn,
  };
}

function makeRandomGrid() {
  const randomGrid = makeBlankGrid();
  const fixedColors = new Map([
    [idx(ROWS - 1, 0), "K"],
    [idx(0, COLS - 1), "P"],
  ]);

  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    const row = Math.floor(cell / COLS);
    const col = cell % COLS;
    const blocked = new Set();
    if (row > 0 && randomGrid[idx(row - 1, col)]) blocked.add(randomGrid[idx(row - 1, col)]);
    if (col > 0 && randomGrid[idx(row, col - 1)]) blocked.add(randomGrid[idx(row, col - 1)]);
    if (row < ROWS - 1 && fixedColors.has(idx(row + 1, col))) blocked.add(fixedColors.get(idx(row + 1, col)));
    if (col < COLS - 1 && fixedColors.has(idx(row, col + 1))) blocked.add(fixedColors.get(idx(row, col + 1)));

    if (fixedColors.has(cell)) {
      const fixed = fixedColors.get(cell);
      if (blocked.has(fixed)) return makeRandomGrid();
      randomGrid[cell] = fixed;
    } else {
      const choices = COLORS.filter((color) => !blocked.has(color.id));
      randomGrid[cell] = choices[Math.floor(Math.random() * choices.length)].id;
    }
  }

  return randomGrid;
}

function hasTouchingSameColors(testGrid) {
  for (let cell = 0; cell < CELL_COUNT; cell += 1) {
    if (!isColorId(testGrid[cell])) continue;
    for (const neighbor of ADJ[cell]) {
      if (neighbor > cell && testGrid[cell] === testGrid[neighbor]) return true;
    }
  }
  return false;
}

function colorDistanceSq(rgb, target) {
  const dr = rgb[0] - target[0];
  const dg = rgb[1] - target[1];
  const db = rgb[2] - target[2];
  return dr * dr + dg * dg + db * db;
}

function nearestScreenshotColor(r, g, b, includeBlack) {
  let best = null;
  for (const color of SCREENSHOT_COLORS) {
    if (!includeBlack && color.id === "K") continue;
    const distance = colorDistanceSq([r, g, b], color.rgb);
    if (!best || distance < best.distance) best = { id: color.id, distance };
  }
  return best;
}

function isBoardColorPixel(r, g, b) {
  const nearest = nearestScreenshotColor(r, g, b, false);
  return nearest && nearest.distance < 14000;
}

function collectSegments(counts, threshold, maxGap) {
  const segments = [];
  let start = -1;
  let lastGood = -1;
  let gap = 0;

  for (let i = 0; i < counts.length; i += 1) {
    if (counts[i] >= threshold) {
      if (start < 0) start = i;
      lastGood = i;
      gap = 0;
    } else if (start >= 0) {
      gap += 1;
      if (gap > maxGap) {
        segments.push({ start, end: lastGood });
        start = -1;
        lastGood = -1;
        gap = 0;
      }
    }
  }

  if (start >= 0) segments.push({ start, end: lastGood });
  return segments;
}

function chooseDenseSegment(segments, counts, minSize) {
  let best = null;
  for (const segment of segments) {
    const size = segment.end - segment.start + 1;
    if (size < minSize) continue;
    let total = 0;
    for (let i = segment.start; i <= segment.end; i += 1) total += counts[i];
    const score = total * Math.sqrt(size);
    if (!best || score > best.score) best = { ...segment, score };
  }
  return best;
}

function normalizeBoardBounds(bounds, imageWidth, imageHeight) {
  const targetRatio = COLS / ROWS;
  let x = bounds.x;
  let y = bounds.y;
  let width = bounds.width;
  let height = bounds.height;
  const ratio = width / height;

  if (ratio > targetRatio * 1.04) {
    const nextWidth = height * targetRatio;
    x += (width - nextWidth) / 2;
    width = nextWidth;
  } else if (ratio < targetRatio * 0.96) {
    const nextHeight = width / targetRatio;
    y += (height - nextHeight) / 2;
    height = nextHeight;
  }

  const pad = Math.min(width / COLS, height / ROWS) * 0.015;
  x = Math.max(0, x - pad);
  y = Math.max(0, y - pad);
  width = Math.min(imageWidth - x, width + pad * 2);
  height = Math.min(imageHeight - y, height + pad * 2);

  return { x, y, width, height };
}

function detectBoardBounds(imageData, width, height) {
  const data = imageData.data;
  const step = Math.max(1, Math.floor(Math.max(width, height) / 850));
  const sampleWidth = Math.ceil(width / step);
  const sampleHeight = Math.ceil(height / step);
  const rowCounts = new Array(sampleHeight).fill(0);

  for (let sy = 0; sy < sampleHeight; sy += 1) {
    const y = Math.min(height - 1, sy * step);
    for (let sx = 0; sx < sampleWidth; sx += 1) {
      const x = Math.min(width - 1, sx * step);
      const offset = (y * width + x) * 4;
      if (isBoardColorPixel(data[offset], data[offset + 1], data[offset + 2])) rowCounts[sy] += 1;
    }
  }

  const maxRow = Math.max(...rowCounts);
  if (maxRow < sampleWidth * 0.16) return null;
  const ySegments = collectSegments(rowCounts, Math.max(8, maxRow * 0.32), Math.max(2, Math.round(8 / step)));
  const ySegment = chooseDenseSegment(ySegments, rowCounts, Math.max(20, sampleHeight * 0.18));
  if (!ySegment) return null;

  const colCounts = new Array(sampleWidth).fill(0);
  for (let sy = ySegment.start; sy <= ySegment.end; sy += 1) {
    const y = Math.min(height - 1, sy * step);
    for (let sx = 0; sx < sampleWidth; sx += 1) {
      const x = Math.min(width - 1, sx * step);
      const offset = (y * width + x) * 4;
      if (isBoardColorPixel(data[offset], data[offset + 1], data[offset + 2])) colCounts[sx] += 1;
    }
  }

  const maxCol = Math.max(...colCounts);
  if (maxCol < (ySegment.end - ySegment.start + 1) * 0.16) return null;
  const xSegments = collectSegments(colCounts, Math.max(8, maxCol * 0.24), Math.max(2, Math.round(8 / step)));
  const xSegment = chooseDenseSegment(xSegments, colCounts, Math.max(20, sampleWidth * 0.18));
  if (!xSegment) return null;

  const rawBounds = {
    x: Math.max(0, (xSegment.start - 1) * step),
    y: Math.max(0, (ySegment.start - 1) * step),
    width: Math.min(width, (xSegment.end + 2) * step) - Math.max(0, (xSegment.start - 1) * step),
    height: Math.min(height, (ySegment.end + 2) * step) - Math.max(0, (ySegment.start - 1) * step),
  };

  const normalized = normalizeBoardBounds(rawBounds, width, height);
  if (normalized.width < 120 || normalized.height < 100) return null;
  return normalized;
}

function classifyScreenshotCell(imageData, width, bounds, row, col) {
  const data = imageData.data;
  const cellWidth = bounds.width / COLS;
  const cellHeight = bounds.height / ROWS;
  const xStart = Math.max(0, Math.floor(bounds.x + (col + 0.28) * cellWidth));
  const xEnd = Math.min(width - 1, Math.ceil(bounds.x + (col + 0.72) * cellWidth));
  const imageHeight = Math.floor(data.length / 4 / width);
  const yStart = Math.max(0, Math.floor(bounds.y + (row + 0.28) * cellHeight));
  const yEnd = Math.min(imageHeight - 1, Math.ceil(bounds.y + (row + 0.72) * cellHeight));
  const step = Math.max(1, Math.floor(Math.min(cellWidth, cellHeight) / 18));
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let y = yStart; y <= yEnd; y += step) {
    for (let x = xStart; x <= xEnd; x += step) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] < 20) continue;
      r += data[offset];
      g += data[offset + 1];
      b += data[offset + 2];
      count += 1;
    }
  }

  if (!count) return BLANK;
  const nearest = nearestScreenshotColor(Math.round(r / count), Math.round(g / count), Math.round(b / count), true);
  return nearest ? nearest.id : BLANK;
}

function imageFileToElement(file) {
  if (window.createImageBitmap) return window.createImageBitmap(file);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

async function gridFromScreenshotFile(file) {
  const image = await imageFileToElement(file);
  const sourceWidth = image.width || image.naturalWidth;
  const sourceHeight = image.height || image.naturalHeight;
  const maxDimension = 1800;
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = detectBoardBounds(imageData, canvas.width, canvas.height);
  if (!bounds) throw new Error("Could not find an 8x7 board in that screenshot.");

  const nextGrid = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      nextGrid.push(classifyScreenshotCell(imageData, canvas.width, bounds, row, col));
    }
  }

  if (!isCompleteGrid(nextGrid)) throw new Error("The screenshot board was found, but some cells could not be read.");
  return nextGrid;
}

function screenshotDetectorSelfTest() {
  if (typeof document === "undefined") return true;

  const canvas = document.createElement("canvas");
  const testGrid = parseGrid(DEFAULT_GRID_TEXT);
  const cellSize = 72;
  const boardX = 84;
  const boardY = 62;
  canvas.width = 860;
  canvas.height = 740;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#e5e5e1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const colorById = Object.create(null);
  for (const color of SCREENSHOT_COLORS) colorById[color.id] = color.rgb;

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const rgb = colorById[testGrid[idx(row, col)]];
      ctx.fillStyle = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      ctx.fillRect(boardX + col * cellSize, boardY + row * cellSize, cellSize, cellSize);
    }
  }

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = detectBoardBounds(imageData, canvas.width, canvas.height);
  if (!bounds) return false;

  const detected = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      detected.push(classifyScreenshotCell(imageData, canvas.width, bounds, row, col));
    }
  }
  return detected.join("") === testGrid.join("");
}

function runSelfTests() {
  const results = [];
  function assert(name, condition) {
    results.push({ name, pass: Boolean(condition) });
  }

  try {
    const parsed = parseGrid(DEFAULT_GRID_TEXT);
    const start = initialState(parsed);
    assert("default grid has 56 cells", parsed.length === 56);
    assert("you start black", COLORS[start.youColor].id === "K");
    assert("opponent starts purple", COLORS[start.oppColor].id === "P");
    assert("opening excludes black and purple", legalMoves(start.youColor, start.oppColor).map((m) => COLORS[m].id).join("") === "RGYB");
    assert("red opening captures one adjacent cell", countOwner(applyMove(start, COLOR_INDEX.R, parsed).owner, YOU) === 2);
    assert("solver ranks legal moves", solvePosition(start, parsed, { depth: 1, timeLimitMs: 1000 }).rows.length === 4);
    assert("blank grid starts in setup", !stateFromGrid(makeBlankGrid()).ready);
    assert("random grid has no touching same colors", !hasTouchingSameColors(makeRandomGrid()));
    assert("screenshot classifier recognizes red", nearestScreenshotColor(231, 70, 91, true).id === "R");
    assert("screenshot classifier recognizes black", nearestScreenshotColor(63, 66, 68, true).id === "K");
    assert("screenshot detector reads a board image", screenshotDetectorSelfTest());
  } catch (error) {
    results.push({ name: "self-test exception", pass: false, detail: String(error) });
  }

  return results;
}

const els = {
  board: document.getElementById("board"),
  palette: document.getElementById("palette"),
  turnLabel: document.getElementById("turnLabel"),
  youScore: document.getElementById("youScore"),
  oppScore: document.getElementById("oppScore"),
  openScore: document.getElementById("openScore"),
  youColorDot: document.getElementById("youColorDot"),
  oppColorDot: document.getElementById("oppColorDot"),
  youColorName: document.getElementById("youColorName"),
  oppColorName: document.getElementById("oppColorName"),
  undoBtn: document.getElementById("undoBtn"),
  resetBtn: document.getElementById("resetBtn"),
  blankBoardTopBtn: document.getElementById("blankBoardTopBtn"),
  analyzeTopBtn: document.getElementById("analyzeTopBtn"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  playBestBtn: document.getElementById("playBestBtn"),
  autoOpponentBtn: document.getElementById("autoOpponentBtn"),
  solverTarget: document.getElementById("solverTarget"),
  depthInput: document.getElementById("depthInput"),
  timeInput: document.getElementById("timeInput"),
  exactInput: document.getElementById("exactInput"),
  autoOpponentInput: document.getElementById("autoOpponentInput"),
  analysisMeta: document.getElementById("analysisMeta"),
  analysisTable: document.getElementById("analysisTable"),
  parseMessage: document.getElementById("parseMessage"),
  screenshotInput: document.getElementById("screenshotInput"),
  uploadScreenshotBtn: document.getElementById("uploadScreenshotBtn"),
  blankBoardBtn: document.getElementById("blankBoardBtn"),
  exampleBoardBtn: document.getElementById("exampleBoardBtn"),
  randomBoardBtn: document.getElementById("randomBoardBtn"),
  moveLog: document.getElementById("moveLog"),
  engineStatus: document.getElementById("engineStatus"),
};

let grid = makeBlankGrid();
let game = makeSetupState();
let history = [];
let moveLog = [];
let solveResult = null;

function solverPlayerFromChoice(choice) {
  if (choice === "you") return YOU;
  if (choice === "opponent") return OPP;
  return game.turn;
}

function setParseMessage(message, isError) {
  els.parseMessage.textContent = message || "";
  els.parseMessage.classList.toggle("error", Boolean(isError));
}

function pushHistory() {
  history.push({
    game: cloneState(game),
    moveLog: moveLog.slice(),
  });
}

function setGrid(nextGrid, message) {
  grid = nextGrid.slice();
  game = stateFromGrid(grid);
  history = [];
  moveLog = [];
  solveResult = null;
  setParseMessage(message || "", false);
  render();
}

function renderBoard() {
  const editable = !moveLog.length;
  const setupView = !moveLog.length;
  const cells = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const rawId = grid[i] || BLANK;
    const shownId = visibleCellColorId(grid, game, i, setupView);
    const color = displayColorForCell(shownId);
    const owner = setupView ? EMPTY : game.owner[i];
    const ownerName = owner === YOU ? "you" : owner === OPP ? "opponent" : "open";
    const inputValue = editable ? rawId : shownId;
    const row = Math.floor(i / COLS) + 1;
    const col = (i % COLS) + 1;
    cells.push(
      `<input class="cell" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="1" value="${inputValue}" ${editable ? "" : "readonly"} data-index="${i}" data-owner="${ownerName}" style="background:${color.hex}; color:${color.text}" aria-label="Row ${row}, column ${col}, ${color.name}, ${ownerName}" title="R, G, P, Y, K, or B" />`,
    );
  }
  els.board.innerHTML = cells.join("");
}

function renderPalette() {
  const legal = game.ready && !terminal(game) ? legalMoves(game.youColor, game.oppColor) : [];
  els.palette.innerHTML = COLORS.map((color, index) => {
    const enabled = legal.indexOf(index) !== -1;
    const title = enabled ? `Play ${color.name}` : `${color.name} unavailable`;
    return `<button class="swatch-button" type="button" data-color="${index}" ${enabled ? "" : "disabled"} title="${title}" aria-label="${title}">
      <span class="swatch" style="background:${color.hex}"></span>
      <span>${color.name}</span>
    </button>`;
  }).join("");
}

function renderScores() {
  const you = countOwner(game.owner, YOU);
  const opp = countOwner(game.owner, OPP);
  const open = CELL_COUNT - you - opp;
  const done = terminal(game);

  els.youScore.textContent = String(you);
  els.oppScore.textContent = String(opp);
  els.openScore.textContent = String(open);
  els.turnLabel.textContent = !game.ready
    ? `Setup ${filledCellCount(grid)}/56`
    : done
      ? (you === opp ? "Draw" : you > opp ? "You win" : "Opponent wins")
      : playerLabel(game.turn) + " move";

  const youColor = COLORS[game.youColor] || { hex: "#ffffff" };
  const oppColor = COLORS[game.oppColor] || { hex: "#ffffff" };
  els.youColorDot.style.background = youColor.hex;
  els.oppColorDot.style.background = oppColor.hex;
  els.youColorName.textContent = game.ready ? "You: " + colorIndexName(game.youColor) : "You: not set";
  els.oppColorName.textContent = game.ready ? "Opponent: " + colorIndexName(game.oppColor) : "Opponent: not set";
  els.undoBtn.disabled = history.length === 0;
  els.resetBtn.disabled = !filledCellCount(grid);
  els.analyzeBtn.disabled = !game.ready;
  els.analyzeTopBtn.disabled = !game.ready;
  els.playBestBtn.disabled = !game.ready || terminal(game);
  els.autoOpponentBtn.disabled = !game.ready || terminal(game);
}

function renderAnalysis() {
  if (!solveResult) {
    els.analysisMeta.textContent = "No analysis yet.";
    els.analysisTable.innerHTML = "";
    return;
  }

  if (!solveResult.rows.length) {
    els.analysisMeta.textContent = "No legal moves.";
    els.analysisTable.innerHTML = "";
    return;
  }

  const mode = solveResult.exact ? "Exact" : solveResult.timedOut ? "Timed partial" : "Depth-limited";
  els.analysisMeta.textContent =
    `${mode} for ${playerLabel(solveResult.calcTurn)} | ${solveResult.nodes.toLocaleString()} nodes | ${solveResult.elapsed} ms`;

  const rows = solveResult.rows.map((row, index) => {
    const color = COLORS[row.move];
    const scoreLabel = solveResult.exact
      ? `${row.projectedMargin > 0 ? "+" : ""}${row.projectedMargin}`
      : String(Math.round(row.value));
    return `<tr class="${index === 0 ? "best-row" : ""}">
      <td>${index + 1}</td>
      <td><span class="mini-color" style="--mini-color:${color.hex}">${color.name}</span></td>
      <td>+${row.immediateGain}</td>
      <td>${scoreLabel}</td>
      <td><button class="tiny-button" type="button" data-analysis-move="${row.move}" data-analysis-player="${solveResult.calcTurn}">Play</button></td>
    </tr>`;
  }).join("");

  els.analysisTable.innerHTML = `<table>
    <thead>
      <tr><th>Rank</th><th>Move</th><th>Gain</th><th>Score</th><th></th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderMoveLog() {
  if (!moveLog.length) {
    els.moveLog.innerHTML = game.ready ? "<li>Start position.</li>" : "<li>Board setup.</li>";
    return;
  }

  els.moveLog.innerHTML = moveLog.map((entry) => {
    const color = COLORS[entry.color];
    return `<li>${playerLabel(entry.player)} chose <strong>${color.name}</strong>, gained ${entry.gain}. Score ${entry.you}-${entry.opp}.</li>`;
  }).join("");
}

function render() {
  renderScores();
  renderBoard();
  renderPalette();
  renderAnalysis();
  renderMoveLog();
}

function applyMoveForPlayer(moveColor, player) {
  if (!game.ready || terminal(game)) return;
  const root = stateWithTurn(game, player);
  if (legalMoves(root.youColor, root.oppColor).indexOf(moveColor) === -1) return;

  const before = player === YOU ? countOwner(root.owner, YOU) : countOwner(root.owner, OPP);
  pushHistory();
  game = applyMove(root, moveColor, grid);
  const after = player === YOU ? countOwner(game.owner, YOU) : countOwner(game.owner, OPP);
  moveLog.push({
    player,
    color: moveColor,
    gain: after - before,
    you: countOwner(game.owner, YOU),
    opp: countOwner(game.owner, OPP),
  });
  solveResult = null;
  render();

  if (els.autoOpponentInput.checked && game.turn === OPP && !terminal(game)) {
    window.setTimeout(playOpponentMove, 120);
  }
}

function analyze() {
  if (!game.ready) return;
  const player = solverPlayerFromChoice(els.solverTarget.value);
  const root = stateWithTurn(game, player);
  solveResult = solvePosition(root, grid, {
    exact: els.exactInput.checked,
    depth: Number(els.depthInput.value),
    timeLimitMs: Number(els.timeInput.value),
  });
  renderAnalysis();
}

function playBest() {
  if (!game.ready || terminal(game)) return;
  const player = solverPlayerFromChoice(els.solverTarget.value);
  if (!solveResult || solveResult.calcTurn !== player) analyze();
  if (solveResult && solveResult.best) applyMoveForPlayer(solveResult.best.move, solveResult.calcTurn);
}

function playOpponentMove() {
  if (!game.ready || terminal(game)) return;
  const root = stateWithTurn(game, OPP);
  const result = solvePosition(root, grid, {
    exact: false,
    depth: Math.min(8, Math.max(1, Number(els.depthInput.value) || 6)),
    timeLimitMs: Math.min(1800, Math.max(250, Number(els.timeInput.value) || 1000)),
  });
  if (result.best) applyMoveForPlayer(result.best.move, OPP);
}

function focusCell(index) {
  if (index < 0 || index >= CELL_COUNT) return;
  window.setTimeout(() => {
    const el = els.board.querySelector(`[data-index="${index}"]`);
    if (el) {
      el.focus();
      if (typeof el.select === "function") el.select();
    }
  }, 0);
}

function updateGridCell(index, colorId, focusIndex) {
  const nextGrid = grid.slice();
  nextGrid[index] = colorId;
  grid = nextGrid;
  game = stateFromGrid(grid);
  history = [];
  moveLog = [];
  solveResult = null;
  setParseMessage("", false);
  render();
  focusCell(focusIndex);
}

function blankPreviousCell(index) {
  const target = index > 0 ? index - 1 : 0;
  updateGridCell(target, BLANK, target);
}

function isBoardTypingEnabled() {
  return !moveLog.length;
}

function blankBoard() {
  setGrid(makeBlankGrid(), "Blank board ready.");
  focusCell(0);
}

els.palette.addEventListener("click", (event) => {
  const button = event.target.closest("[data-color]");
  if (!button || button.disabled) return;
  applyMoveForPlayer(Number(button.dataset.color), game.turn);
});

els.board.addEventListener("click", (event) => {
  const cell = event.target.closest("[data-index]");
  if (!cell || !isBoardTypingEnabled()) return;
  if (typeof cell.select === "function") cell.select();
});

els.board.addEventListener("keydown", (event) => {
  const cell = event.target.closest("[data-index]");
  if (!cell || !isBoardTypingEnabled()) return;

  const index = Number(cell.dataset.index);
  const key = String(event.key || "");
  const colorId = key.toUpperCase();

  if (isColorId(colorId)) {
    event.preventDefault();
    updateGridCell(index, colorId, Math.min(index + 1, CELL_COUNT - 1));
  } else if (key === "Backspace") {
    event.preventDefault();
    blankPreviousCell(index);
  } else if (key === "Delete") {
    event.preventDefault();
    updateGridCell(index, BLANK, index);
  } else if (key === "ArrowRight") {
    event.preventDefault();
    focusCell(Math.min(index + 1, CELL_COUNT - 1));
  } else if (key === "ArrowLeft") {
    event.preventDefault();
    focusCell(Math.max(index - 1, 0));
  } else if (key.length === 1) {
    event.preventDefault();
  }
});

els.board.addEventListener("input", (event) => {
  const cell = event.target.closest("[data-index]");
  if (!cell || !isBoardTypingEnabled()) return;
  const value = String(cell.value || "").toUpperCase();
  const colorId = value.charAt(value.length - 1);
  if (isColorId(colorId)) {
    updateGridCell(Number(cell.dataset.index), colorId, Math.min(Number(cell.dataset.index) + 1, CELL_COUNT - 1));
  } else {
    cell.value = grid[Number(cell.dataset.index)] || BLANK;
  }
});

els.analysisTable.addEventListener("click", (event) => {
  const button = event.target.closest("[data-analysis-move]");
  if (!button) return;
  applyMoveForPlayer(Number(button.dataset.analysisMove), Number(button.dataset.analysisPlayer));
});

els.undoBtn.addEventListener("click", () => {
  const previous = history.pop();
  if (!previous) return;
  game = previous.game;
  moveLog = previous.moveLog;
  solveResult = null;
  render();
});

els.resetBtn.addEventListener("click", () => {
  game = stateFromGrid(grid);
  history = [];
  moveLog = [];
  solveResult = null;
  render();
});

els.analyzeBtn.addEventListener("click", analyze);
els.analyzeTopBtn.addEventListener("click", analyze);
els.playBestBtn.addEventListener("click", playBest);
els.autoOpponentBtn.addEventListener("click", playOpponentMove);

els.uploadScreenshotBtn.addEventListener("click", () => {
  els.screenshotInput.click();
});

els.screenshotInput.addEventListener("change", async () => {
  const file = els.screenshotInput.files && els.screenshotInput.files[0];
  if (!file) return;

  try {
    setParseMessage("Reading screenshot...", false);
    const nextGrid = await gridFromScreenshotFile(file);
    setGrid(nextGrid, "Screenshot loaded.");
    focusCell(0);
  } catch (error) {
    setParseMessage(error.message || String(error), true);
  } finally {
    els.screenshotInput.value = "";
  }
});

els.blankBoardBtn.addEventListener("click", blankBoard);
els.blankBoardTopBtn.addEventListener("click", blankBoard);

els.exampleBoardBtn.addEventListener("click", () => {
  setGrid(parseGrid(DEFAULT_GRID_TEXT), "Example loaded.");
  focusCell(0);
});

els.randomBoardBtn.addEventListener("click", () => {
  setGrid(makeRandomGrid(), "Random board loaded.");
});

els.exactInput.addEventListener("change", () => {
  els.depthInput.disabled = els.exactInput.checked;
  solveResult = null;
  renderAnalysis();
});

els.solverTarget.addEventListener("change", () => {
  solveResult = null;
  renderAnalysis();
});

const tests = runSelfTests();
const passed = tests.filter((test) => test.pass).length;
els.engineStatus.textContent = `Engine ${passed}/${tests.length}`;
if (passed !== tests.length) {
  console.error("Filler self-tests failed " + JSON.stringify(tests.filter((test) => !test.pass)));
}
render();
