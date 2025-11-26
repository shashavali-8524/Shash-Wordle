// Load words from words.txt dynamically
let WORDLE_SOLUTIONS = [];
let allowedWords = new Set();

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

async function loadWords() {
  try {
    const res = await fetch("words.txt");
    const text = await res.text();
    const words = text
      .split(/\r?\n/)
      .map(w => w.trim().toUpperCase())
      .filter(w => w.length === WORD_LENGTH);

    allowedWords = new Set(words);
    WORDLE_SOLUTIONS = words.slice(0, 200);
  } catch (e) {
    console.error("Error loading words:", e);
  }
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
  btnRandom = document.getElementById("btnRandom"),
  btnCreateRandom = document.getElementById("btnCreateRandom"),
  linkBox = document.getElementById("linkBox"),
  genStatus = document.getElementById("genStatus"),
  copyLink = document.getElementById("copyLink"),
  secretInput = document.getElementById("secretInput"),
  challengeText = document.getElementById("challengeText"),
  popTitle = document.getElementById("popTitle"),
  popMeta = document.getElementById("popMeta"),
  btnClose = document.getElementById("btnClose"),
  btnShare = document.getElementById("btnShare"),
  btnMenu = document.getElementById("btnMenu"),
  btnGameShare = document.getElementById("btnGameShare"),
  playerDisplay = document.getElementById("playerDisplay"),
  playerDisplayName = document.getElementById("playerDisplayName"),
  themeToggle = document.getElementById("themeToggle"),
  themePopup = document.getElementById("themePopup"),
  btnCloseTheme = document.getElementById("btnCloseTheme"),
  prevAvatarBtn = document.getElementById("prevAvatar"),
  nextAvatarBtn = document.getElementById("nextAvatar"),
  currentAvatarEl = document.getElementById("currentAvatar");

// Screens
const screens = {
  name: document.getElementById("screen-name"),
  mode: document.getElementById("screen-mode"),
  create: document.getElementById("screen-create"),
  game: document.getElementById("screen-game")
};

// State
let playerName = "";
let playerAvatar = "🦊"; // Default
let avatarIndex = 0;
let creatorName = "";
let secretWord = "";
let creationSecret = "";
let isDaily = false;
let currentRow = 0;
let guesses = [];
let feedbackHistory = [];
let isAnimating = false;

const AVATARS = ["🦊", "🐼", "🐸", "🐯", "🦁", "🐮", "🐷", "🦄", "💀", "👽", "🤖", "🎃"];

// Screen controls
function showScreen(s) {
  Object.values(screens).forEach(x => x.classList.remove("active"));
  screens[s].classList.add("active");
  backBtn.classList.toggle("hidden", s === "name");

  // Show player name in top right if not on name screen
  if (s !== "name" && playerName) {
    playerDisplay.classList.remove("hidden");
    playerDisplayName.textContent = `${playerAvatar} ${playerName}`;
  } else {
    playerDisplay.classList.add("hidden");
  }
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
  loadTheme(); // Load saved theme

  // Load saved name & avatar
  const savedName = localStorage.getItem("playerName");
  const savedAvatar = localStorage.getItem("playerAvatar");

  if (savedAvatar) {
    playerAvatar = savedAvatar;
    avatarIndex = AVATARS.indexOf(savedAvatar);
    if (avatarIndex === -1) avatarIndex = 0;
  }
  updateAvatarDisplay();

  if (savedName) {
    playerName = savedName;
    playerInput.value = savedName;
    playerLabel.textContent = `${playerAvatar} ${savedName}`;
  }

  const token = new URLSearchParams(location.search).get("c");

  if (token) {
    try {
      const d = JSON.parse(atob(token));
      secretWord = d.w.toUpperCase();
      creatorName = d.by;
      isDaily = false;
    } catch (e) {
      console.error("Invalid token", e);
    }
    showScreen("name");
    if (savedName) btnContinue.click(); // Auto-continue if name saved
    return;
  }

  if (savedName) {
    showScreen("mode");
  } else {
    showScreen("name");
  }
};

// ---- Avatar Carousel ----
function updateAvatarDisplay() {
  playerAvatar = AVATARS[avatarIndex];
  currentAvatarEl.textContent = playerAvatar;
  localStorage.setItem("playerAvatar", playerAvatar);
}

prevAvatarBtn.onclick = () => {
  avatarIndex = (avatarIndex - 1 + AVATARS.length) % AVATARS.length;
  updateAvatarDisplay();
};

nextAvatarBtn.onclick = () => {
  avatarIndex = (avatarIndex + 1) % AVATARS.length;
  updateAvatarDisplay();
};

// Edit Name
playerDisplay.onclick = () => {
  showScreen("name");
};

// Continue name
btnContinue.onclick = () => {
  const name = playerInput.value.trim();
  if (!name) return;
  playerName = name;
  localStorage.setItem("playerName", name); // Save name
  playerLabel.textContent = `${playerAvatar} ${name}`;

  const token = new URLSearchParams(location.search).get("c");

  if (token) {
    try {
      const d = JSON.parse(atob(token));
      secretWord = d.w.toUpperCase();
      creatorName = d.by;
      isDaily = false;
    } catch (e) {
      console.error("Invalid token on continue", e);
    }
    startGame();
    return;
  }

  showScreen("mode");
};

// ---- Daily Mode ----
btnDaily.onclick = () => {
  isDaily = true;
  creatorName = "Daily";
  const dayIndex = (Date.now() / 86400000 | 0);
  secretWord = WORDLE_SOLUTIONS[dayIndex % WORDLE_SOLUTIONS.length] || "APPLE";

  // Check local storage for today's game
  const savedGame = JSON.parse(localStorage.getItem(`daily_${dayIndex}`));

  startGame();

  if (savedGame) {
    savedGame.guesses.forEach(g => {
      guesses[currentRow] = g;
      const fb = getFeedback(g);
      feedbackHistory.push(fb);
      // Fast reveal (no animation)
      const cells = boardEl.children[currentRow].children;
      [...cells].forEach((c, i) => {
        c.textContent = g[i];
        c.classList.add(fb[i]);
        updateKeyboard(g[i], fb[i]);
      });
      currentRow++;
    });

    if (savedGame.status === 'won') {
      gameOver(true, true); // true=win, true=silent
    } else if (savedGame.status === 'lost') {
      gameOver(false, true);
    }
  }
};

// ---- Create Mode ----
btnCreate.onclick = () => {
  showScreen("create");
  secretInput.value = "";
  secretInput.disabled = false;
  creationSecret = "";
  linkBox.classList.add("hidden");
  copyLink.classList.add("hidden");
  genStatus.textContent = "";
};

// ---- Random Mode ----
btnRandom.onclick = () => {
  const arr = Array.from(allowedWords);
  if (arr.length === 0) return showError("Word list not loaded");

  secretWord = arr[Math.floor(Math.random() * arr.length)];
  creatorName = "Random Word";
  isDaily = false;

  startGame();
};

// ---- Create Random ----
btnCreateRandom.onclick = () => {
  const arr = Array.from(allowedWords);
  if (arr.length === 0) return showError("Word list not loaded");
  creationSecret = arr[Math.floor(Math.random() * arr.length)];
  secretInput.value = "?????";
  secretInput.disabled = true;
};

// ---- Generate challenge link ----
btnGen.onclick = () => {
  let w;
  if (secretInput.disabled) {
    w = creationSecret;
  } else {
    w = secretInput.value.trim().toUpperCase();
  }

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
  btnGameShare.classList.add("hidden");
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
function buildKeyboard() {
  keyboardEl.innerHTML = "";

  // Row 1
  const row1 = document.createElement("div");
  row1.className = "kb-row";
  "QWERTYUIOP".split("").forEach(L => {
    const key = document.createElement("div");
    key.className = "key";
    key.dataset.letter = L;
    key.textContent = L;
    key.onclick = () => addLetter(L);
    row1.appendChild(key);
  });
  keyboardEl.appendChild(row1);

  // Row 2
  const row2 = document.createElement("div");
  row2.className = "kb-row";
  "ASDFGHJKL".split("").forEach(L => {
    const key = document.createElement("div");
    key.className = "key";
    key.dataset.letter = L;
    key.textContent = L;
    key.onclick = () => addLetter(L);
    row2.appendChild(key);
  });
  keyboardEl.appendChild(row2);

  // Row 3
  const row3 = document.createElement("div");
  row3.className = "kb-row";

  // BACKSPACE
  const backKey = document.createElement("div");
  backKey.className = "key big";
  backKey.textContent = "⌫";
  backKey.onclick = removeLetter;
  row3.appendChild(backKey);

  // Letters Z to M
  "ZXCVBNM".split("").forEach(L => {
    const key = document.createElement("div");
    key.className = "key";
    key.dataset.letter = L;
    key.textContent = L;
    key.onclick = () => addLetter(L);
    row3.appendChild(key);
  });

  // ENTER
  const enterKey = document.createElement("div");
  enterKey.className = "key big";
  enterKey.textContent = "ENTER";
  enterKey.onclick = submitGuess;
  row3.appendChild(enterKey);

  keyboardEl.appendChild(row3);
}

// Input
document.addEventListener("keydown", e => {
  if (isAnimating || !screens.game.classList.contains("active")) return;
  if (/^[a-z]$/i.test(e.key)) addLetter(e.key.toUpperCase());
  if (e.key === "Backspace") removeLetter();
  if (e.key === "Enter") submitGuess();
});

// Prevent native keyboard on mobile
document.addEventListener("focusin", (e) => {
  if (screens.game.classList.contains("active")) {
    e.target.blur();
  }
});

// Prevent zoom on double tap for mobile


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

  // Save daily progress
  if (isDaily) {
    const dayIndex = (Date.now() / 86400000 | 0);
    const saved = JSON.parse(localStorage.getItem(`daily_${dayIndex}`)) || { guesses: [], status: 'playing' };
    saved.guesses.push(g);
    localStorage.setItem(`daily_${dayIndex}`, JSON.stringify(saved));
  }

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

          if (g === secretWord) {
            boardEl.children[currentRow].classList.add("win");
            if (isDaily) saveDailyStatus('won');
            return gameOver(true);
          }
          currentRow++;
          if (currentRow === MAX_GUESSES) {
            if (isDaily) saveDailyStatus('lost');
            return gameOver(false);
          }

        }, 350);
      }

    }, i * 260);
  });
}

function updateKeyboard(letter, state) {
  const key = keyboardEl.querySelector(`[data-letter="${letter}"]`);
  if (!key) return;

  // priority: correct > present > absent
  const priority = { correct: 3, present: 2, absent: 1 };
  const current = key.dataset.state || "";

  // Don't downgrade (example: correct should never turn yellow/grey)
  if (current && priority[current] > priority[state]) return;

  // remove old classes
  key.classList.remove("correct", "present", "absent");

  // add new class
  key.classList.add(state);

  // store new state
  key.dataset.state = state;
}

function saveDailyStatus(status) {
  const dayIndex = (Date.now() / 86400000 | 0);
  const saved = JSON.parse(localStorage.getItem(`daily_${dayIndex}`)) || { guesses: [] };
  saved.status = status;
  localStorage.setItem(`daily_${dayIndex}`, JSON.stringify(saved));
}

// Game over popup
function gameOver(win, silent = false) {
  popup.dataset.score = win ? `${currentRow + (silent ? 0 : 1)}/6` : `X/6`;
  popTitle.textContent = win ? `🎉 Win!` : `❌ ${secretWord}`;
  popMeta.textContent = `Player: ${playerName}`;

  if (!silent) {
    setTimeout(() => popup.classList.add("active"), 500);
  } else {
    popup.classList.add("active");
  }

  btnGameShare.classList.remove("hidden");
}

btnGameShare.onclick = () => popup.classList.add("active");
btnMenu.onclick = () => {
  popup.classList.remove("active");
  showScreen("mode");
};

btnClose.onclick = () => popup.classList.remove("active");

btnShare.onclick = () => {
  const txt = `Shash Wordle ${popup.dataset.score}\n\n` +
    feedbackHistory.map(r => r.map(c =>
      c === "correct" ? "🟩" : c === "present" ? "🟨" : "⬛"
    ).join("")).join("\n");

  navigator.clipboard.writeText(txt);
  alert("Copied!");
};

// Error
function showError(msg) {
  statusEl.textContent = msg;
  setTimeout(() => statusEl.textContent = "", 900);
}

// ================= THEME HANDLING =================
themeToggle.onclick = () => {
  themePopup.classList.add("active");
};

btnCloseTheme.onclick = () => {
  themePopup.classList.remove("active");
};

// Global function for onclick in HTML
window.setTheme = (themeName) => {
  document.body.className = ""; // Reset classes
  document.body.removeAttribute("data-theme");

  if (themeName === "default") {
    document.body.classList.add("dark"); // Default is dark violet
  } else if (themeName === "dark") {
    document.body.setAttribute("data-theme", "dark");
  } else {
    document.body.setAttribute("data-theme", themeName);
  }

  localStorage.setItem("theme", themeName);
  themePopup.classList.remove("active");
};

function loadTheme() {
  const saved = localStorage.getItem("theme") || "default";
  setTheme(saved);
}
