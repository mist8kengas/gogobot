import { type Column, GameState, SlotState, type Board } from "./c4types";
import { checkColumn } from "./checkColumn";

export const columnFullMessage = "This column is full.";

export function makeMove(
  board: Board,
  column: Column,
):
  | {
      error: string;
    }
  | Board {
  const availableSlot = checkColumn(board, column);

  if ("error" in availableSlot) {
    return availableSlot;
  }

  const { columnIndex, slotIndex } = availableSlot;

  return {
    ...board,
    gameState:
      board.gameState === GameState.RedTurn
        ? GameState.YellowTurn
        : GameState.RedTurn,
    slots: board.slots.map((column, i) => {
      if (i !== columnIndex) {
        return column;
      }

      return column.map((slot, j) => {
        if (j !== slotIndex) {
          return slot;
        }

        return {
          ...slot,
          state:
            board.gameState === GameState.RedTurn
              ? SlotState.Red
              : SlotState.Yellow,
        };
      });
    }),
  };
}