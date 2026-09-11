console.log("ChessAnalysis loaded");

/* =========================================================
   ELEMENT REFERENCES
========================================================= */

const board = document.getElementById("board");
const arrowCanvas = document.getElementById("arrow-canvas");
const moveHistory = document.getElementById("move-history");
const openingName = document.getElementById("opening-name");

// Separate Captures References
const whiteCapturesBox = document.getElementById("white-captures");
const blackCapturesBox = document.getElementById("black-captures");

const whiteStatus = document.getElementById("white-status");
const blackStatus = document.getElementById("black-status");
const bestMoveText = document.getElementById("best-move");
const evaluationText = document.getElementById("evaluation");
const mateText = document.getElementById("mate");
const aiOpening = document.getElementById("ai-opening");

// Controls & Navigation
const firstBtn = document.getElementById("first");
const prevBtn = document.getElementById("previous");
const nextBtn = document.getElementById("next");
const lastBtn = document.getElementById("last");

// Modals & Options
const optionsBtn = document.getElementById("options-button");
const optionsOverlay = document.getElementById("options-overlay");
const closeOptions = document.getElementById("close-options");
const flipBtn = document.getElementById("flip");
const coordsBtn = document.getElementById("coordinates-option");
const bestMovePrefSelect = document.getElementById("best-move-preference");

const aiBtn = document.getElementById("ai-button");
const aiOverlay = document.getElementById("ai-overlay");
const closeAi = document.getElementById("close-ai");
const bestMoveModal = document.getElementById("best-move-modal");
const bestMoveCopy = document.getElementById("best-move-copy");
const openingCopy = document.getElementById("opening-copy");

const checkmateOverlay = document.getElementById("checkmate-overlay");
const winnerText = document.getElementById("winner-text");
const winnerMessage = document.getElementById("winner-message");
const closeCheckmate = document.getElementById("close-checkmate");
const newGameButton = document.getElementById("new-game");

/* =========================================================
   CHESS.JS VALIDATION
========================================================= */

if (typeof Chess === "undefined") {
    alert("Chess.js missing");
    throw new Error("Chess.js missing");
}

const chess = new Chess();

/* =========================================================
   STATE MANAGEMENT
========================================================= */

let flipped = false;
let selectedSquare = null;
let showCoordinates = true;
let showBestMoveFor = "both"; // 'both', 'w', 'b', 'none'

let positionHistory = [chess.fen()];
let historyIndex = 0;
let movesList = [];
let activeAbortController = null;

/* Common Openings Dictionary */
const openingsMap = {
    "e4": "King's Pawn Game",
    "e4 e5": "Open Game",
    "e4 e5 Nf3 Nc6 Bb5": "Ruy Lopez",
    "e4 e5 Nf3 Nc6 Bc4": "Italian Game",
    "e4 c5": "Sicilian Defense",
    "e4 e6": "French Defense",
    "e4 c6": "Caro-Kann Defense",
    "d4": "Queen's Pawn Game",
    "d4 d5": "Closed Game",
    "d4 d5 c4": "Queen's Gambit",
    "d4 Nf6": "Indian Defense",
    "c4": "English Opening",
    "Nf3": "Réti Opening"
};

/* =========================================================
   SVG ARROW INDICATOR (SLEEK & THIN)
========================================================= */

function getSquareCenter(squareName) {
    const file = squareName[0];
    const rank = parseInt(squareName[1]);
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    let colIndex = files.indexOf(file);
    let rowIndex = 8 - rank;

    if (flipped) {
        colIndex = 7 - colIndex;
        rowIndex = 7 - rowIndex;
    }

    // Coordinates in percentage
    const x = (colIndex + 0.5) * 12.5;
    const y = (rowIndex + 0.5) * 12.5;

    return { x, y };
}

function clearArrows() {
    if (arrowCanvas) {
        arrowCanvas.innerHTML = "";
    }
}

function drawBestMoveArrow(fromSquare, toSquare) {
    clearArrows();
    if (!fromSquare || !toSquare || !arrowCanvas) return;

    const start = getSquareCenter(fromSquare);
    const end = getSquareCenter(toSquare);

    const ns = "http://www.w3.org/2000/svg";

    // Compact, subtle arrow head definition
    const defs = document.createElementNS(ns, "defs");
    defs.innerHTML = `
        <marker id="arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse">
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f6b21a"/>
        </marker>
    `;
    arrowCanvas.appendChild(defs);

    // Sleek thin stroke line
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", `${start.x}%`);
    line.setAttribute("y1", `${start.y}%`);
    line.setAttribute("x2", `${end.x}%`);
    line.setAttribute("y2", `${end.y}%`);
    line.setAttribute("stroke", "#f6b21a");
    line.setAttribute("stroke-width", "1.2%");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.9");
    line.setAttribute("marker-end", "url(#arrowhead)");

    arrowCanvas.appendChild(line);
}

/* =========================================================
   BOARD & PIECE RENDERING
========================================================= */

function createPieceImage(piece, squareName) {
    const img = document.createElement("img");
    const pieceCode = piece.color + piece.type.toUpperCase();
    img.src = `https://chessboardjs.com/img/chesspieces/wikipedia/${pieceCode}.png`;
    img.alt = pieceCode;
    img.className = "piece";
    img.draggable = true;

    img.addEventListener("dragstart", (e) => {
        if (historyIndex !== positionHistory.length - 1) return;
        if (piece.color !== chess.turn()) {
            e.preventDefault();
            return;
        }
        e.dataTransfer.setData("text/plain", squareName);
        img.classList.add("dragging");
    });

    img.addEventListener("dragend", () => {
        img.classList.remove("dragging");
    });

    return img;
}

function getSquareElement(squareName) {
    return board.querySelector(`[data-square="${squareName}"]`);
}

function createBoard() {
    board.innerHTML = "";
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const fileOrder = flipped ? [...files].reverse() : files;
    const rowOrder = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const square = document.createElement("div");
            const row = rowOrder[r];
            const col = fileOrder[c];
            const squareName = col + row;

            square.classList.add("square");
            square.classList.add((r + c) % 2 === 0 ? "light" : "dark");
            square.dataset.square = squareName;

            if (showCoordinates) {
                if (c === 0) {
                    const rank = document.createElement("span");
                    rank.className = "coordinate rank";
                    rank.textContent = row;
                    square.appendChild(rank);
                }
                if (r === 7) {
                    const file = document.createElement("span");
                    file.className = "coordinate file";
                    file.textContent = col;
                    square.appendChild(file);
                }
            }

            square.addEventListener("click", () => handleSquareClick(squareName));
            square.addEventListener("dragover", (e) => e.preventDefault());
            square.addEventListener("drop", (e) => {
                e.preventDefault();
                const fromSquare = e.dataTransfer.getData("text/plain");
                if (fromSquare) executeMove(fromSquare, squareName);
            });

            board.appendChild(square);
        }
    }

    renderPieces();
}

function renderPieces() {
    document.querySelectorAll(".square").forEach(sq => {
        const pieceImg = sq.querySelector(".piece");
        if (pieceImg) pieceImg.remove();
    });

    const currentBoard = chess.board();
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = currentBoard[r][c];
            if (piece) {
                const squareName = files[c] + (8 - r);
                const squareEl = getSquareElement(squareName);
                if (squareEl) {
                    squareEl.appendChild(createPieceImage(piece, squareName));
                }
            }
        }
    }
}

/* =========================================================
   MOVE HANDLING & HIGHLIGHTS
========================================================= */

function clearHighlights() {
    document.querySelectorAll(".square").forEach(sq => {
        sq.classList.remove("selected", "legal", "capture-legal");
    });
}

function handleSquareClick(squareName) {
    if (historyIndex !== positionHistory.length - 1) return;

    const pieceOnSquare = chess.get(squareName);

    if (selectedSquare) {
        if (selectedSquare === squareName) {
            selectedSquare = null;
            clearHighlights();
            return;
        }

        const moveExecuted = executeMove(selectedSquare, squareName);
        if (moveExecuted) {
            selectedSquare = null;
            clearHighlights();
            return;
        }
    }

    if (pieceOnSquare && pieceOnSquare.color === chess.turn()) {
        selectedSquare = squareName;
        clearHighlights();

        const squareEl = getSquareElement(squareName);
        if (squareEl) squareEl.classList.add("selected");

        const legalMoves = chess.moves({ square: squareName, verbose: true });
        legalMoves.forEach(move => {
            const targetEl = getSquareElement(move.to);
            if (targetEl) {
                targetEl.classList.add(move.captured ? "capture-legal" : "legal");
            }
        });
    } else {
        selectedSquare = null;
        clearHighlights();
    }
}

function executeMove(from, to) {
    const move = chess.move({
        from: from,
        to: to,
        promotion: "q"
    });

    if (move === null) return false;

    positionHistory = positionHistory.slice(0, historyIndex + 1);
    movesList = movesList.slice(0, historyIndex);

    positionHistory.push(chess.fen());
    movesList.push(move.san);
    historyIndex++;

    updateGameUI();
    return true;
}

/* =========================================================
   UI & GAME STATE UPDATES
========================================================= */

function updateGameUI() {
    renderPieces();
    clearHighlights();
    clearArrows();
    updateTurnStatus();
    updateMoveHistoryDisplay();
    updateCapturedPieces();
    detectOpening();
    fetchAIAnalysis();
    checkGameOver();
}

function updateTurnStatus() {
    const isWhiteTurn = chess.turn() === "w";
    whiteStatus.textContent = isWhiteTurn ? "White: To move" : "White: Waiting";
    whiteStatus.className = `player-status ${isWhiteTurn ? "active" : ""}`;

    blackStatus.textContent = !isWhiteTurn ? "Black: To move" : "Black: Waiting";
    blackStatus.className = `player-status ${!isWhiteTurn ? "active" : ""}`;
}

function updateMoveHistoryDisplay() {
    if (movesList.length === 0) {
        moveHistory.textContent = "No moves yet";
        return;
    }

    let html = "";
    for (let i = 0; i < movesList.length; i += 2) {
        const moveNumber = Math.floor(i / 2) + 1;
        const whiteMove = movesList[i];
        const blackMove = movesList[i + 1] ? movesList[i + 1] : "";

        const whiteIndex = i + 1;
        const blackIndex = i + 2;

        const whiteActive = historyIndex === whiteIndex ? "active-move" : "";
        const blackActive = historyIndex === blackIndex ? "active-move" : "";

        html += `<span class="move-number">${moveNumber}.</span> `;
        html += `<span class="history-item ${whiteActive}" onclick="jumpToHistory(${whiteIndex})">${whiteMove}</span> `;
        if (blackMove) {
            html += `<span class="history-item ${blackActive}" onclick="jumpToHistory(${blackIndex})">${blackMove}</span> `;
        }
    }

    moveHistory.innerHTML = html;
    moveHistory.scrollTop = moveHistory.scrollHeight;
}

function jumpToHistory(index) {
    if (index >= 0 && index < positionHistory.length) {
        historyIndex = index;
        chess.load(positionHistory[historyIndex]);
        renderPieces();
        clearHighlights();
        clearArrows();
        updateTurnStatus();
        updateMoveHistoryDisplay();
        fetchAIAnalysis();
    }
}

/* =========================================================
   SEPARATE CAPTURED PIECES TRACKING
========================================================= */

function updateCapturedPieces() {
    const startingCounts = { p: 8, n: 2, b: 2, r: 2, q: 1, P: 8, N: 2, B: 2, R: 2, Q: 1 };
    const currentCounts = { p: 0, n: 0, b: 0, r: 0, q: 0, P: 0, N: 0, B: 0, R: 0, Q: 0 };
    const pieceSymbols = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕" };

    chess.board().forEach(row => {
        row.forEach(p => {
            if (p) {
                const key = p.color === "w" ? p.type.toUpperCase() : p.type;
                currentCounts[key]++;
            }
        });
    });

    // White Captures = Missing Black Pieces (lowercase keys: p, n, b, r, q)
    const blackPieceKeys = ["p", "n", "b", "r", "q"];
    let whiteCapturesHtml = "";
    blackPieceKeys.forEach(p => {
        const missing = startingCounts[p] - currentCounts[p];
        if (missing > 0) {
            whiteCapturesHtml += pieceSymbols[p].repeat(missing) + " ";
        }
    });

    // Black Captures = Missing White Pieces (uppercase keys: P, N, B, R, Q)
    const whitePieceKeys = ["P", "N", "B", "R", "Q"];
    let blackCapturesHtml = "";
    whitePieceKeys.forEach(p => {
        const missing = startingCounts[p] - currentCounts[p];
        if (missing > 0) {
            blackCapturesHtml += pieceSymbols[p].repeat(missing) + " ";
        }
    });

    if (whiteCapturesBox) whiteCapturesBox.textContent = whiteCapturesHtml.trim() || "None";
    if (blackCapturesBox) blackCapturesBox.textContent = blackCapturesHtml.trim() || "None";
}

function detectOpening() {
    const moveStr = movesList.slice(0, historyIndex).join(" ");
    let name = "Starting Position";

    for (const [sequence, opName] of Object.entries(openingsMap)) {
        if (moveStr.startsWith(sequence)) {
            name = opName;
        }
    }

    openingName.textContent = name;
    aiOpening.textContent = name;
    openingCopy.textContent = name;
}

/* =========================================================
   AI ANALYSIS WITH PLAYER PREFERENCE FILTER
========================================================= */

async function fetchAIAnalysis() {
    if (activeAbortController) {
        activeAbortController.abort();
    }

    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    bestMoveText.textContent = "Analyzing...";
    evaluationText.textContent = "--";
    mateText.textContent = "None";
    clearArrows();

    // Check Player Preference Filter
    const currentTurn = chess.turn(); // 'w' or 'b'
    const shouldDisplayBestMove = 
        showBestMoveFor === "both" || 
        (showBestMoveFor === "w" && currentTurn === "w") || 
        (showBestMoveFor === "b" && currentTurn === "b");

    if (!shouldDisplayBestMove) {
        bestMoveText.textContent = "Disabled for " + (currentTurn === "w" ? "White" : "Black");
        bestMoveModal.textContent = "Disabled";
        bestMoveCopy.textContent = "Disabled";
    }

    try {
        const fen = chess.fen();
        const response = await fetch(`https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(fen)}`, { signal });

        if (!response.ok) throw new Error("No evaluation available");

        const data = await response.json();

        if (data.pvs && data.pvs[0]) {
            const topPv = data.pvs[0];
            const uciMove = topPv.moves ? topPv.moves.split(" ")[0] : "";

            if (uciMove && uciMove.length >= 4) {
                const fromSq = uciMove.substring(0, 2);
                const toSq = uciMove.substring(2, 4);

                // Display move and draw arrow only if allowed by user filter
                if (shouldDisplayBestMove) {
                    drawBestMoveArrow(fromSq, toSq);
                    bestMoveText.textContent = uciMove;
                    bestMoveModal.textContent = uciMove;
                    bestMoveCopy.textContent = uciMove;
                }
            }

            if (topPv.cp !== undefined) {
                const evalScore = (topPv.cp / 100).toFixed(1);
                const formattedEval = evalScore > 0 ? `+${evalScore}` : `${evalScore}`;
                evaluationText.textContent = formattedEval;
            } else if (topPv.mate !== undefined) {
                evaluationText.textContent = `#${topPv.mate}`;
                mateText.textContent = `Mate in ${Math.abs(topPv.mate)}`;
            }
        }
    } catch (err) {
        if (err.name !== "AbortError") {
            if (shouldDisplayBestMove) {
                bestMoveText.textContent = "N/A";
                bestMoveModal.textContent = "N/A";
                bestMoveCopy.textContent = "N/A";
            }
            evaluationText.textContent = "0.0";
            clearArrows();
        }
    }
}

/* =========================================================
   CHECKMATE & GAME OVER MODAL
========================================================= */

function checkGameOver() {
    if (chess.in_checkmate()) {
        const winner = chess.turn() === "w" ? "Black" : "White";
        winnerText.textContent = `${winner} wins!`;
        winnerMessage.textContent = "Checkmate! Excellent game.";
        checkmateOverlay.classList.add("show");
    } else if (chess.in_draw()) {
        winnerText.textContent = "Draw!";
        winnerMessage.textContent = chess.in_stalemate() ? "Stalemate!" : "Game drawn.";
        checkmateOverlay.classList.add("show");
    }
}

/* =========================================================
   NAVIGATION CONTROLS & KEYBOARD LISTENERS
========================================================= */

firstBtn.addEventListener("click", () => jumpToHistory(0));
prevBtn.addEventListener("click", () => jumpToHistory(historyIndex - 1));
nextBtn.addEventListener("click", () => jumpToHistory(historyIndex + 1));
lastBtn.addEventListener("click", () => jumpToHistory(positionHistory.length - 1));

document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") jumpToHistory(historyIndex - 1);
    if (e.key === "ArrowRight") jumpToHistory(historyIndex + 1);
});

/* =========================================================
   MODALS & SETTINGS LISTENERS
========================================================= */

optionsBtn.addEventListener("click", () => optionsOverlay.classList.add("show"));
closeOptions.addEventListener("click", () => optionsOverlay.classList.remove("show"));

aiBtn.addEventListener("click", () => aiOverlay.classList.add("show"));
closeAi.addEventListener("click", () => aiOverlay.classList.remove("show"));

// Player Preference Selector Change Event
bestMovePrefSelect.addEventListener("change", (e) => {
    showBestMoveFor = e.target.value;
    fetchAIAnalysis();
});

flipBtn.addEventListener("click", () => {
    flipped = !flipped;
    createBoard();
    fetchAIAnalysis();
    optionsOverlay.classList.remove("show");
});

coordsBtn.addEventListener("click", () => {
    showCoordinates = !showCoordinates;
    createBoard();
    optionsOverlay.classList.remove("show");
});

closeCheckmate.addEventListener("click", () => checkmateOverlay.classList.remove("show"));

newGameButton.addEventListener("click", () => {
    chess.reset();
    positionHistory = [chess.fen()];
    movesList = [];
    historyIndex = 0;
    selectedSquare = null;
    checkmateOverlay.classList.remove("show");
    updateGameUI();
});

/* =========================================================
   INITIALIZATION
========================================================= */

createBoard();
updateGameUI();
