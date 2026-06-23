export const BOARD_SIZE = 15;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type Board = number[][];
export type Move = { row: number; col: number };
export type OmokDifficulty = 'easy' | 'medium' | 'hard' | 'nightmare';

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

export function isValidMove(board: Board, row: number, col: number) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE && board[row][col] === EMPTY;
}

export function checkWin(board: Board, row: number, col: number, player: number) {
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;

  for (const [dr, dc] of directions) {
    let count = 1;

    for (let step = 1; step < 5; step += 1) {
      const nextRow = row + dr * step;
      const nextCol = col + dc * step;
      if (
        nextRow < 0 ||
        nextRow >= BOARD_SIZE ||
        nextCol < 0 ||
        nextCol >= BOARD_SIZE ||
        board[nextRow][nextCol] !== player
      ) {
        break;
      }
      count += 1;
    }

    for (let step = 1; step < 5; step += 1) {
      const nextRow = row - dr * step;
      const nextCol = col - dc * step;
      if (
        nextRow < 0 ||
        nextRow >= BOARD_SIZE ||
        nextCol < 0 ||
        nextCol >= BOARD_SIZE ||
        board[nextRow][nextCol] !== player
      ) {
        break;
      }
      count += 1;
    }

    if (count >= 5) return true;
  }

  return false;
}

function hasAnyStone(board: Board) {
  return board.some((row) => row.some((cell) => cell !== EMPTY));
}

export function getCandidateMoves(board: Board): [number, number][] {
  if (!hasAnyStone(board)) {
    const center = Math.floor(BOARD_SIZE / 2);
    return [[center, center]];
  }

  const moves = new Set<string>();

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col] === EMPTY) continue;

      for (let dr = -2; dr <= 2; dr += 1) {
        for (let dc = -2; dc <= 2; dc += 1) {
          const nextRow = row + dr;
          const nextCol = col + dc;
          if (!isValidMove(board, nextRow, nextCol)) continue;
          moves.add(`${nextRow},${nextCol}`);
        }
      }
    }
  }

  return [...moves].map((key) => key.split(',').map(Number) as [number, number]);
}

function findWinningMove(board: Board, player: number): [number, number] | null {
  for (const [row, col] of getCandidateMoves(board)) {
    board[row][col] = player;
    const won = checkWin(board, row, col, player);
    board[row][col] = EMPTY;
    if (won) return [row, col];
  }
  return null;
}

function analyzeLine(board: Board, row: number, col: number, dr: number, dc: number, player: number) {
  let stones = 1;
  let openEnds = 0;

  for (let step = 1; step < 5; step += 1) {
    const nextRow = row + dr * step;
    const nextCol = col + dc * step;
    if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) break;
    if (board[nextRow][nextCol] === player) {
      stones += 1;
      continue;
    }
    if (board[nextRow][nextCol] === EMPTY) openEnds += 1;
    break;
  }

  for (let step = 1; step < 5; step += 1) {
    const nextRow = row - dr * step;
    const nextCol = col - dc * step;
    if (nextRow < 0 || nextRow >= BOARD_SIZE || nextCol < 0 || nextCol >= BOARD_SIZE) break;
    if (board[nextRow][nextCol] === player) {
      stones += 1;
      continue;
    }
    if (board[nextRow][nextCol] === EMPTY) openEnds += 1;
    break;
  }

  return { stones, openEnds };
}

function scoreLinePattern(stones: number, openEnds: number) {
  if (stones >= 5) return 1000000;
  if (stones === 4 && openEnds === 2) return 280000;
  if (stones === 4 && openEnds === 1) return 42000;
  if (stones === 3 && openEnds === 2) return 9000;
  if (stones === 3 && openEnds === 1) return 900;
  if (stones === 2 && openEnds === 2) return 140;
  if (stones === 2 && openEnds === 1) return 24;
  return stones * 3;
}

function measureLine(board: Board, row: number, col: number, dr: number, dc: number, player: number) {
  let count = 1;
  let openEnds = 0;

  let nextRow = row + dr;
  let nextCol = col + dc;
  while (
    nextRow >= 0 &&
    nextRow < BOARD_SIZE &&
    nextCol >= 0 &&
    nextCol < BOARD_SIZE &&
    board[nextRow][nextCol] === player
  ) {
    count += 1;
    nextRow += dr;
    nextCol += dc;
  }
  if (
    nextRow >= 0 &&
    nextRow < BOARD_SIZE &&
    nextCol >= 0 &&
    nextCol < BOARD_SIZE &&
    board[nextRow][nextCol] === EMPTY
  ) {
    openEnds += 1;
  }

  nextRow = row - dr;
  nextCol = col - dc;
  while (
    nextRow >= 0 &&
    nextRow < BOARD_SIZE &&
    nextCol >= 0 &&
    nextCol < BOARD_SIZE &&
    board[nextRow][nextCol] === player
  ) {
    count += 1;
    nextRow -= dr;
    nextCol -= dc;
  }
  if (
    nextRow >= 0 &&
    nextRow < BOARD_SIZE &&
    nextCol >= 0 &&
    nextCol < BOARD_SIZE &&
    board[nextRow][nextCol] === EMPTY
  ) {
    openEnds += 1;
  }

  return { count, openEnds };
}

function moveThreatScore(board: Board, row: number, col: number, player: number) {
  if (!isValidMove(board, row, col)) return 0;

  board[row][col] = player;

  if (checkWin(board, row, col, player)) {
    board[row][col] = EMPTY;
    return 10000000;
  }

  let score = 0;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;

  for (const [dr, dc] of directions) {
    const { count, openEnds } = measureLine(board, row, col, dr, dc, player);
    score += scoreLinePattern(count, openEnds);
  }

  board[row][col] = EMPTY;
  return score;
}

function findBestThreatMove(board: Board, player: number, minScore = 42000): [number, number] | null {
  let bestMove: [number, number] | null = null;
  let bestScore = minScore - 1;

  for (const [row, col] of getCandidateMoves(board)) {
    const score = moveThreatScore(board, row, col, player);
    if (score > bestScore) {
      bestScore = score;
      bestMove = [row, col];
    }
  }

  return bestMove;
}

function countCriticalThreats(board: Board, player: number, minScore = 42000) {
  let count = 0;
  for (const [row, col] of getCandidateMoves(board)) {
    if (moveThreatScore(board, row, col, player) >= minScore) count += 1;
  }
  return count;
}

type RankedMove = { row: number; col: number; score: number };

function rankCandidateMoves(board: Board, aiColor: number, playerColor: number, limit = 14): RankedMove[] {
  return getCandidateMoves(board)
    .map(([row, col]) => ({
      row,
      col,
      score:
        moveThreatScore(board, row, col, aiColor) +
        moveThreatScore(board, row, col, playerColor) * 1.05 +
        evaluateMove(board, row, col, aiColor) +
        evaluateMove(board, row, col, playerColor) * 0.95,
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function evaluateBoard(board: Board, aiColor: number, playerColor: number) {
  const moves = getCandidateMoves(board);
  let aiScore = 0;
  let playerScore = 0;

  for (const [row, col] of moves) {
    aiScore += moveThreatScore(board, row, col, aiColor);
    playerScore += moveThreatScore(board, row, col, playerColor);
  }

  return aiScore - playerScore * 1.12;
}

function alphaBeta(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  aiColor: number,
  playerColor: number,
  rankedMoves?: RankedMove[],
): number {
  if (maximizing) {
    const playerWin = findWinningMove(board, playerColor);
    if (playerWin) return -9000000 + depth;
  } else {
    const aiWin = findWinningMove(board, aiColor);
    if (aiWin) return 9000000 - depth;
  }

  if (depth === 0) return evaluateBoard(board, aiColor, playerColor);

  const moves =
    rankedMoves ??
    rankCandidateMoves(
      board,
      maximizing ? aiColor : playerColor,
      maximizing ? playerColor : aiColor,
      depth >= 3 ? 10 : 14,
    );

  if (moves.length === 0) return evaluateBoard(board, aiColor, playerColor);

  if (maximizing) {
    let value = -Infinity;
    for (const move of moves) {
      board[move.row][move.col] = aiColor;
      const nextMoves = rankCandidateMoves(board, aiColor, playerColor, 10);
      const score = alphaBeta(board, depth - 1, alpha, beta, false, aiColor, playerColor, nextMoves);
      board[move.row][move.col] = EMPTY;
      value = Math.max(value, score);
      alpha = Math.max(alpha, value);
      if (beta <= alpha) break;
    }
    return value;
  }

  let value = Infinity;
  for (const move of moves) {
    board[move.row][move.col] = playerColor;
    const nextMoves = rankCandidateMoves(board, aiColor, playerColor, 10);
    const score = alphaBeta(board, depth - 1, alpha, beta, true, aiColor, playerColor, nextMoves);
    board[move.row][move.col] = EMPTY;
    value = Math.min(value, score);
    beta = Math.min(beta, value);
    if (beta <= alpha) break;
  }
  return value;
}

function getNightmareMove(board: Board, aiColor: number, playerColor: number): [number, number] {
  const blockWin = findWinningMove(board, playerColor);
  if (blockWin) return blockWin;

  const winMove = findWinningMove(board, aiColor);
  if (winMove) return winMove;

  const blockOpenFour = findBestThreatMove(board, playerColor, 280000);
  if (blockOpenFour) return blockOpenFour;

  const createOpenFour = findBestThreatMove(board, aiColor, 280000);
  if (createOpenFour) return createOpenFour;

  const blockFour = findBestThreatMove(board, playerColor, 42000);
  if (blockFour && countCriticalThreats(board, playerColor, 42000) >= 1) return blockFour;

  const createFour = findBestThreatMove(board, aiColor, 42000);
  if (createFour) return createFour;

  const blockOpenThree =
    countCriticalThreats(board, playerColor, 9000) >= 2
      ? findBestThreatMove(board, playerColor, 9000)
      : null;
  if (blockOpenThree) return blockOpenThree;

  const candidates = rankCandidateMoves(board, aiColor, playerColor, 12);
  let bestMove: [number, number] = [candidates[0].row, candidates[0].col];
  let bestScore = -Infinity;

  for (const move of candidates) {
    board[move.row][move.col] = aiColor;
    const nextMoves = rankCandidateMoves(board, aiColor, playerColor, 10);
    const score = alphaBeta(board, 4, -Infinity, Infinity, false, aiColor, playerColor, nextMoves);
    board[move.row][move.col] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMove = [move.row, move.col];
    }
  }

  return bestMove;
}

function evaluateMove(board: Board, row: number, col: number, player: number) {
  if (!isValidMove(board, row, col)) return -Infinity;

  board[row][col] = player;

  if (checkWin(board, row, col, player)) {
    board[row][col] = EMPTY;
    return 1000000;
  }

  let score = 0;
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;

  for (const [dr, dc] of directions) {
    const { stones, openEnds } = analyzeLine(board, row, col, dr, dc, player);
    score += scoreLinePattern(stones, openEnds);
  }

  board[row][col] = EMPTY;
  return score;
}

function pickRandomMove(moves: [number, number][]) {
  return moves[Math.floor(Math.random() * moves.length)];
}

function pickBestMove(
  board: Board,
  aiColor: number,
  playerColor: number,
  { noise = 0, topN = 1 }: { noise?: number; topN?: number },
): [number, number] {
  const blockMove = findWinningMove(board, playerColor);
  if (blockMove) return blockMove;

  const winMove = findWinningMove(board, aiColor);
  if (winMove) return winMove;

  const candidates = getCandidateMoves(board);
  const scored = candidates
    .map(([row, col]) => {
      const attack = evaluateMove(board, row, col, aiColor);
      const defense = evaluateMove(board, row, col, playerColor) * 0.92;
      return { row, col, score: attack + defense + Math.random() * noise };
    })
    .sort((left, right) => right.score - left.score);

  const slice = scored.slice(0, Math.max(1, topN));
  const picked = slice[Math.floor(Math.random() * slice.length)];
  return [picked.row, picked.col];
}

function getEasyMove(board: Board, aiColor: number, playerColor: number): [number, number] {
  const candidates = getCandidateMoves(board);
  const blockMove = findWinningMove(board, playerColor);
  if (blockMove && Math.random() < 0.75) return blockMove;

  const winMove = findWinningMove(board, aiColor);
  if (winMove && Math.random() < 0.85) return winMove;

  return pickRandomMove(candidates);
}

function getMediumMove(board: Board, aiColor: number, playerColor: number) {
  return pickBestMove(board, aiColor, playerColor, { noise: 40, topN: 3 });
}

function getHardMove(board: Board, aiColor: number, playerColor: number) {
  return pickBestMove(board, aiColor, playerColor, { noise: 0, topN: 1 });
}

export function getAiMove(
  board: Board,
  difficulty: OmokDifficulty,
  aiColor = WHITE,
  playerColor = BLACK,
): [number, number] {
  if (difficulty === 'easy') return getEasyMove(board, aiColor, playerColor);
  if (difficulty === 'medium') return getMediumMove(board, aiColor, playerColor);
  if (difficulty === 'hard') return getHardMove(board, aiColor, playerColor);
  if (difficulty === 'nightmare') return getNightmareMove(board, aiColor, playerColor);
  return getHardMove(board, aiColor, playerColor);
}

export function placeStone(board: Board, row: number, col: number, player: number) {
  if (!isValidMove(board, row, col)) return false;
  board[row][col] = player;
  return true;
}
