import { uuidv7 } from "uuidv7";

/**
 * Generates a fresh UUIDv7 string. Used as the default for caller-minted
 * primary keys (habit, check_in) and other identifiers where the
 * timestamp prefix gives us cheap monotonic ordering and locality in the
 * SQLite B-tree.
 */
export const seqUuid = (): string => uuidv7();
