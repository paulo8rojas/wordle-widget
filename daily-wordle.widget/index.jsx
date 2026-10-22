// Daily Wordle for Übersicht
// Fetches today's puzzle from NYT and lets you play it on your desktop.

export const command = `curl -s --max-time 10 "https://www.nytimes.com/svc/wordle/v2/$(date +%Y-%m-%d).json"`;
export const refreshFrequency = 1000 * 60 * 30; // re-check every 30 min (rolls over at midnight)

const STORE = "wordle-widget-v1";
const ROWS = 6;
const COLS = 5;

const loadGuesses = (date) => {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && s.date === date) return s.guesses;
  } catch (e) {}
  return [];
};

const saveGuesses = (date, guesses) => {
  try {
    localStorage.setItem(STORE, JSON.stringify({ date, guesses }));
  } catch (e) {}
};

const evaluate = (guess, solution) => {
  const result = Array(COLS).fill("absent");
  const remaining = {};
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === solution[i]) result[i] = "correct";
    else remaining[solution[i]] = (remaining[solution[i]] || 0) + 1;
  }
  for (let i = 0; i < COLS; i++) {
    if (result[i] === "correct") continue;
    if (remaining[guess[i]] > 0) {
      result[i] = "present";
      remaining[guess[i]]--;
    }
  }
  return result;
};

export const initialState = {
  solution: null,
  date: null,
  puzzleNo: null,
  guesses: [],
  current: "",
  message: "Loading…",
};

export const updateState = (event, prev) => {
  switch (event.type) {
    case "UB/COMMAND_RAN": {
      if (event.error) return { ...prev, message: "Fetch failed" };
      try {
        const data = JSON.parse(event.output);
        const date = data.print_date;
        const solution = data.solution.toUpperCase();
        if (prev.date === date && prev.solution === solution) return prev;
        return {
          solution,
          date,
          puzzleNo: data.days_since_launch,
          guesses: loadGuesses(date),
          current: "",
          message: "",
        };
      } catch (e) {
        return { ...prev, message: "Couldn't parse puzzle" };
      }
    }

    case "KEY": {
      if (!prev.solution) return prev;
      const won = prev.guesses.includes(prev.solution);
      if (won || prev.guesses.length >= ROWS) return prev;

      const k = event.key;
      if (k === "ENTER") {
        if (prev.current.length < COLS)
          return { ...prev, message: "Not enough letters" };
        const guesses = [...prev.guesses, prev.current];
        saveGuesses(prev.date, guesses);
        return { ...prev, guesses, current: "", message: "" };
      }
      if (k === "DEL")
        return { ...prev, current: prev.current.slice(0, -1), message: "" };
      if (prev.current.length < COLS)
        return { ...prev, current: prev.current + k, message: "" };
      return prev;
    }

    default:
      return prev;
  }
};

export const className = `
  top: 40px;
  right: 40px;
  width: 330px;
  padding: 16px;
  box-sizing: border-box;
  background: rgba(18, 18, 19, 0.88);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-family: -apple-system, "Helvetica Neue", sans-serif;
  user-select: none;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .title { font-size: 20px; font-weight: 800; letter-spacing: 0.08em; }
  .sub { font-size: 11px; opacity: 0.55; }

  .board { display: grid; grid-template-rows: repeat(6, 1fr); gap: 5px; margin: 0 auto 10px; width: 250px; }
  .row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; }
  .tile {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; font-weight: 700;
    border: 2px solid #3a3a3c;
    box-sizing: border-box;
  }
  .tile.filled { border-color: #6b6b6e; }
  .tile.correct { background: #538d4e; border-color: #538d4e; }
  .tile.present { background: #b59f3b; border-color: #b59f3b; }
  .tile.absent  { background: #3a3a3c; border-color: #3a3a3c; }

  .msg { height: 18px; text-align: center; font-size: 12px; font-weight: 600; margin-bottom: 6px; }

  .kb { display: flex; flex-direction: column; gap: 6px; width: 100%; }
  .kbrow { display: flex; gap: 5px; width: 100%; }
  .spacer { flex: 0.5; }
  .key {
    flex: 1;
    min-width: 0;
    height: 46px;
    display: flex; align-items: center; justify-content: center;
    background: #818384; border-radius: 5px;
    font-size: 13px; font-weight: 700; cursor: pointer;
  }
  .key:hover { filter: brightness(1.15); }
  .key:active { transform: scale(0.95); }
  .key.wide { flex: 1.5; font-size: 11px; }
  .key.correct { background: #538d4e; }
  .key.present { background: #b59f3b; }
  .key.absent  { background: #3a3a3c; opacity: 0.7; }
`;

const KB_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

// Route physical keyboard presses into the widget's state.
// Re-binds on every render so the handler always uses the latest dispatch.
const bindKeys = (dispatch) => {
  window.__wordleDispatch = dispatch;
  if (window.__wordleKeyHandler)
    window.removeEventListener("keydown", window.__wordleKeyHandler);

  window.__wordleKeyHandler = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave shortcuts alone
    let key = null;
    if (e.key === "Enter") key = "ENTER";
    else if (e.key === "Backspace") key = "DEL";
    else if (/^[a-zA-Z]$/.test(e.key)) key = e.key.toUpperCase();
    if (!key) return;
    e.preventDefault();
    window.__wordleDispatch({ type: "KEY", key });
  };
  window.addEventListener("keydown", window.__wordleKeyHandler);
};

export const render = (state, dispatch) => {
  bindKeys(dispatch);
  const { solution, guesses, current, message, puzzleNo, date } = state;

  const won = solution && guesses.includes(solution);
  const lost = solution && !won && guesses.length >= ROWS;

  // Best known status for each letter (for keyboard coloring)
  const letterStatus = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  if (solution) {
    guesses.forEach((g) => {
      evaluate(g, solution).forEach((s, i) => {
        const l = g[i];
        if (!letterStatus[l] || rank[s] > rank[letterStatus[l]])
          letterStatus[l] = s;
      });
    });
  }

  const press = (key) => () => dispatch({ type: "KEY", key });

  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const tiles = [];
    const submitted = r < guesses.length;
    const isCurrent = r === guesses.length && !won && !lost;
    const word = submitted ? guesses[r] : isCurrent ? current : "";
    const statuses = submitted ? evaluate(word, solution) : null;
    for (let c = 0; c < COLS; c++) {
      const letter = word[c] || "";
      const cls = submitted
        ? `tile ${statuses[c]}`
        : `tile ${letter ? "filled" : ""}`;
      tiles.push(
        <div key={c} className={cls}>
          {letter}
        </div>
      );
    }
    rows.push(
      <div key={r} className="row">
        {tiles}
      </div>
    );
  }

  let status = message;
  if (won)
    status = ["Genius!", "Magnificent!", "Impressive!", "Splendid!", "Great!", "Phew!"][
      guesses.length - 1
    ];
  if (lost) status = `The word was ${solution}`;

  return (
    <div>
      <div className="header">
        <div className="title">WORDLE</div>
        <div className="sub">{puzzleNo ? `#${puzzleNo} · ${date}` : ""}</div>
      </div>

      <div className="board">{rows}</div>
      <div className="msg">{status}</div>

      <div className="kb">
        {KB_ROWS.map((row, i) => (
          <div key={row} className="kbrow">
            {i === 2 && (
              <div className="key wide" onClick={press("ENTER")}>
                ENTER
              </div>
            )}
            {row.split("").map((l) => (
              <div
                key={l}
                className={`key ${letterStatus[l] || ""}`}
                onClick={press(l)}
              >
                {l}
              </div>
            ))}
            {i === 2 && (
              <div className="key wide" onClick={press("DEL")}>
                ⌫
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};