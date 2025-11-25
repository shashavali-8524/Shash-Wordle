// Load words from words.txt dynamically
let WORDLE_SOLUTIONS = [];
let allowedWords = new Set();

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

async function loadWords() {
  const res = await fetch("words.txt");
  const text = await res.text();
  const words = text
    .split(/\r?\n/)
    .map(w => w.trim().toUpperCase())
    .filter(w => w.length === WORD_LENGTH);

  allowedWords = new Set(words);
  WORDLE_SOLUTIONS = words.slice(0, 200);
}

// Elements
const backBtn = document.getElementById("backBtn"),
boardEl = document.getElementById("board"),
keyboardEl = document.getElementById("keyboard"),
statusEl = document.getElementById("gameStatus"),
popup = document.getElementById("resultPopup"),
btnContinue = document.getElementById("btnContinue"),
playerInput = document.getElementById("playerName"),
playerLabel = document.getElementById("playerLabel"),
btnDaily = document.getElementById("btnDaily"),
btnCreate = document.getElementById("btnCreate"),
btnGen = document.getElementById("btnGen"),
linkBox = document.getElementById("linkBox"),
genStatus = document.getElementById("genStatus"),
copyLink = document.getElementById("copyLink"),
secretInput = document.getElementById("secretInput"),
challengeText = document.getElementById("challengeText"),
popTitle = document.getElementById("popTitle"),
popMeta = document.getElementById("popMeta"),
btnClose = document.getElementById("btnClose"),
btnShare = document.getElementById("btnShare"),
themeToggle = document.getElementById("themeToggle");

// Screens
const screens = {
  name: document.getElementById("screen-name"),
  mode: document.getElementById("screen-mode"),
  create: document.getElementById("screen-create"),
  game: document.getElementById("screen-game")
};

// State
let playerName = "";
let creatorName = "";
let secretWord = "";
let isDaily = false;          // ✅ add kiya
let currentRow = 0;
let guesses = [];
let feedbackHistory = [];
let isAnimating = false;

// Screen controls
function showScreen(s) {
  Object.values(screens).forEach(x => x.classList.remove("active"));
  screens[s].classList.add("active");
  backBtn.classList.toggle("hidden", s === "name");
}

// ---- Back Button ----
backBtn.onclick = () => {
  if (screens.game.classList.contains("active")) {
    showScreen("mode");
  } else if (screens.mode.classList.contains("active")) {
    showScreen("name");
  } else if (screens.create.classList.contains("active")) {
    showScreen("mode");
  }
};

// Load page
window.onload = async () => {
  await loadWords();

  const token = new URLSearchParams(location.search).get("c");

  if (token) {
    // challenge link se aaye ho
    try {
      const d = JSON.parse(atob(token));
      secretWord = d.w.toUpperCase();
      creatorName = d.by;
      isDaily = false;
    } catch(e) {
      console.error("Invalid token", e);
    }
    // name screen pe hi rahenge, pehle naam dalna hai
    showScreen("name");
    return;
  }

  // normal flow
  showScreen("name");
};

// Continue name
btnContinue.onclick = () => {
  const name = playerInput.value.trim();
  if (!name) return;
  playerName = name;
  playerLabel.textContent = name;

  const token = new URLSearchParams(location.search).get("c");

  if (token) {
    // ✅ challenge link → direct game start
    try {
      const d = JSON.parse(atob(token));
      secretWord = d.w.toUpperCase();
      creatorName = d.by;
      isDaily = false;
    } catch(e) {
      console.error("Invalid token on continue", e);
    }
    startGame();
    return;
  }

  // normal case → go to mode screen
  showScreen("mode");
};

// Mode selection
btnDaily.onclick = () => {
  isDaily = true;
  creatorName = "Daily";
  secretWord = WORDLE_SOLUTIONS[(Date.now() / 86400000 | 0) % WORDLE_SOLUTIONS.length] || "APPLE";
  startGame();
};

btnCreate.onclick = () => showScreen("create");

// Generate challenge link
btnGen.onclick = () => {
  const w = secretInput.value.trim().toUpperCase();
  if (!allowedWords.has(w)) return showError("Invalid Word!");

  creatorName = playerName || "Someone";
  secretWord = w;

  const token = btoa(JSON.stringify({ w, by: creatorName }));
  const url = `${location.origin}${location.pathname}?c=${token}`;

  linkBox.textContent = url;
  linkBox.classList.remove("hidden");
  copyLink.classList.remove("hidden");

  genStatus.textContent = "Link Generated!";
  genStatus.style.color = "#16a34a";
};

copyLink.onclick = async () => {
  await navigator.clipboard.writeText(linkBox.textContent.trim());
  copyLink.textContent = "Copied!";
  setTimeout(() => copyLink.textContent = "Copy Link", 1500);
};

// Start game
function startGame() {
  showScreen("game");
  statusEl.textContent = "";
  currentRow = 0;
  guesses = [];
  feedbackHistory = [];

  buildBoard();
  buildKeyboard();

  challengeText.textContent = isDaily
    ? "Daily Challenge"
    : `${creatorName} challenged you`;
}

// Build board
function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement("div");
    row.className = "row";
    for (let i = 0; i < WORD_LENGTH; i++) {
      row.appendChild(Object.assign(document.createElement("div"), { className: "cell" }));
    }
    boardEl.appendChild(row);
  }
}

// Build keyboard
const kRows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
function buildKeyboard() {
  keyboardEl.innerHTML = "";
  kRows.forEach(rs => {
    const row = document.createElement("div");
    row.className = "kb-row";
    rs.split("").forEach(L => {
      const key = document.createElement("div");
      key.className = "key";
      key.dataset.letter = L;
      key.textContent = L;
      key.onclick = () => addLetter(L);
      row.appendChild(key);
    });
    keyboardEl.appendChild(row);
  });
  addKey("⌫", removeLetter);
  addKey("ENTER", submitGuess);
}

function addKey(label, fn) {
  const k = document.createElement("div");
  k.className = "key big";
  k.textContent = label;
  k.onclick = fn;
  keyboardEl.lastChild.appendChild(k);
}

// Input
document.addEventListener("keydown", e => {
  if (isAnimating || !screens.game.classList.contains("active")) return;
  if (/^[a-z]$/i.test(e.key)) addLetter(e.key.toUpperCase());
  if (e.key === "Backspace") removeLetter();
  if (e.key === "Enter") submitGuess();
});

function addLetter(l) {
  if (!guesses[currentRow]) guesses[currentRow] = "";
  if (guesses[currentRow].length < WORD_LENGTH) {
    guesses[currentRow] += l;
    updateRow();
  }
}

function removeLetter() {
  guesses[currentRow] = guesses[currentRow]?.slice(0, -1) || "";
  updateRow();
}

function updateRow() {
  const cells = boardEl.children[currentRow].children;
  const g = guesses[currentRow] || "";
  [...cells].forEach((c, i) => c.textContent = g[i] || "");
}

// Submit guess
function submitGuess() {
  const g = guesses[currentRow]?.toUpperCase();
  if (!g || g.length < WORD_LENGTH)
    return showError("Not enough letters");
  if (!allowedWords.has(g))
    return showError("Not in word list");

  const fb = getFeedback(g);
  feedbackHistory.push(fb);
  reveal(g, fb);
}

function getFeedback(g) {
  const fb = Array(WORD_LENGTH).fill("absent");
  const sec = [...secretWord];

  g.split("").forEach((ch, i) => { if (ch === sec[i]) { fb[i] = "correct"; sec[i] = null; } });
  g.split("").forEach((ch, i) => {
    const idx = sec.indexOf(ch);
    if (fb[i] !== "correct" && idx > -1) { fb[i] = "present"; sec[idx] = null; }
  });

  return fb;
}

// Reveal tiles
function reveal(g, fb) {
  const cells = boardEl.children[currentRow].children;
  isAnimating = true;

  g.split("").forEach((ch, i) => {
    setTimeout(() => {
      cells[i].classList.add("flip");
      setTimeout(() => {
        cells[i].classList.remove("flip");
        cells[i].classList.add(fb[i]);
        updateKeyboard(ch, fb[i]);
      }, 160);

      if (i === WORD_LENGTH - 1) {
        setTimeout(() => {
          isAnimating = false;

          if (g === secretWord) return gameOver(true);
          currentRow++;
          if (currentRow === MAX_GUESSES) return gameOver(false);

        }, 350);
      }

    }, i * 260);
  });
}

function updateKeyboard(L, state) {
  const k = keyboardEl.querySelector(`[data-letter="${L}"]`);
  if (!k) return;
  k.classList.add(state);
}

// Game over popup
function gameOver(win) {
  popup.dataset.score = win ? `${currentRow + 1}/6` : `X/6`;
  popTitle.textContent = win ? `🎉 Win!` : `❌ ${secretWord}`;
  popMeta.textContent = `Player: ${playerName}`;
  popup.classList.add("active");
}

btnClose.onclick = () => popup.classList.remove("active");

btnShare.onclick = () => {
  const txt = `Shash Wordle ${popup.dataset.score}\n\n` +
    feedbackHistory.map(r => r.map(c =>
      c === "correct" ? "🟩" : c === "present" ? "🟨" : "⬛"
    ).join("")).join("\n");

  navigator.clipboard.writeText(txt);
  alert("Copied!");
};

// Theme
if (themeToggle) {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") document.body.classList.add("dark");
  themeToggle.onclick = () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  };
}

// Error
function showError(msg) {
  statusEl.textContent = msg;
  setTimeout(() => statusEl.textContent = "", 900);
}
