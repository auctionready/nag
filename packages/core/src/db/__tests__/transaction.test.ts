import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { withTransaction } from "../transaction";
import type { AnyDb } from "../index";

const makeDb = (): AnyDb => {
  const sqlite = new Database(":memory:");
  return drizzle(sqlite) as unknown as AnyDb;
};

describe("withTransaction", () => {
  it("serializes concurrent transactions in submission order", async () => {
    const db = makeDb();
    const order: number[] = [];

    const txns = Array.from({ length: 50 }, (_, i) =>
      withTransaction(db, async () => {
        order.push(i);
        await db.run(sql`SELECT 1`);
        return i;
      }),
    );

    const results = await Promise.all(txns);
    expect(results).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect(order).toEqual(Array.from({ length: 50 }, (_, i) => i));
  });

  it("does not break the chain when a transaction throws", async () => {
    const db = makeDb();

    const failing = withTransaction(db, async () => {
      throw new Error("boom");
    });
    await expect(failing).rejects.toThrow("boom");

    const result = await withTransaction(db, async () => {
      await db.run(sql`SELECT 1`);
      return "ok";
    });
    expect(result).toBe("ok");
  });

  it("rolls back on error so the connection is not left in a transaction", async () => {
    const db = makeDb();
    await db.run(sql`CREATE TABLE t (id INTEGER PRIMARY KEY)`);

    await expect(
      withTransaction(db, async () => {
        await db.run(sql`INSERT INTO t (id) VALUES (1)`);
        throw new Error("rollback me");
      }),
    ).rejects.toThrow("rollback me");

    await withTransaction(db, async () => {
      await db.run(sql`INSERT INTO t (id) VALUES (2)`);
    });

    const rows = (await db.all(sql`SELECT id FROM t ORDER BY id`)) as {
      id: number;
    }[];
    expect(rows.map((r) => r.id)).toEqual([2]);
  });

  it("prevents the 'transaction within a transaction' error under concurrency", async () => {
    const db = makeDb();
    await db.run(sql`CREATE TABLE counter (n INTEGER)`);
    await db.run(sql`INSERT INTO counter (n) VALUES (0)`);

    await Promise.all(
      Array.from({ length: 20 }, () =>
        withTransaction(db, async () => {
          await db.run(sql`UPDATE counter SET n = n + 1`);
        }),
      ),
    );

    const [row] = (await db.all(sql`SELECT n FROM counter`)) as { n: number }[];
    expect(row.n).toBe(20);
  });
});
