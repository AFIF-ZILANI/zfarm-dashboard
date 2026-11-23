import { expect, test } from "bun:test";
import { createSendOnce } from "./send-once";

const deferred = () => {
  let resolve!: (v: number) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<number>((a, b) => ((resolve = a), (reject = b)));
  return { promise, resolve, reject };
};

test("a repeat while the first is in flight, or just after it, shares its result", async () => {
  let now = 0;
  let sent = 0;
  const once = createSendOnce(() => now);
  const d = deferred();
  const send = () => (sent++, d.promise);
  const a = once("sale", send);
  now = 60_000; // however slow the request is
  const b = once("sale", send);
  d.resolve(7);
  expect(await Promise.all([a, b])).toEqual([7, 7]);
  // The gap the duplicate sale came through: answered, button live again, page not yet changed.
  now += 100;
  expect(await once("sale", send)).toBe(7);
  expect(sent).toBe(1);
});

test("a later identical one, and a different one, are sent", async () => {
  let now = 0;
  let sent = 0;
  const once = createSendOnce(() => now);
  const send = async () => ++sent;
  await once("a", send);
  await once("b", send);
  now += 1001;
  await once("b", send);
  expect(sent).toBe(3);
});

test("a failure can be retried at once", async () => {
  let sent = 0;
  const once = createSendOnce(() => 0);
  await once("a", async () => Promise.reject(new Error("offline"))).catch(() => {});
  expect(await once("a", async () => ++sent)).toBe(1);
});
