import { expect, test } from "@playwright/test";

// Web smoke test (v4). Runs against `vite` + the API in dev mode with DEV_BYPASS_AUTH=1 and a
// throwaway database (see playwright.config.ts). It walks the daily loop's write path once:
// capture → inbox → note, and checks every main screen renders without an error boundary.

const SCREENS = [
  ["/today", /\w/], // greeting varies with the time of day
  ["/calendar", /\d{4}|Week planner/],
  ["/inbox", /Inbox|to sort/],
  ["/review/week", /Weekly Control Room/],
  ["/cycle", /Cycle/],
  ["/notes", /Notes/],
  ["/applications", /Applications/],
  ["/japanese", /Japanese/],
  ["/settings", /Settings/],
] as const;

test("main screens render", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const [path, heading] of SCREENS) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
  }
  expect(errors).toEqual([]);
});

test("capture lands in the inbox and becomes a note", async ({ page }) => {
  const text = `Smoke ${Date.now()}`;
  await page.goto("/inbox");
  await page.keyboard.press("c");
  await page.getByLabel("What's on your mind?").fill(text);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(text)).toBeVisible();

  await page.getByRole("button", { name: `Make a note: ${text}` }).click();
  await expect(page.getByText(text)).toHaveCount(0);
  await page.goto("/notes");
  await page.getByLabel("Search notes").fill(text.split(" ")[0] ?? text);
  // The hit shows the text twice (title + snippet); match the result link itself.
  await expect(page.getByRole("list", { name: "Search results" }).getByRole("link", { name: new RegExp(text) })).toBeVisible();
});

test("a new note autosaves its title", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  const title = page.getByRole("textbox", { name: "Title" }); // the note <article> is labelled "Title" too
  await title.fill("Raft notes");
  await expect(page.getByRole("status").filter({ hasText: "Not saved yet" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: /^Saved$/ })).toBeVisible({ timeout: 5000 });
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Raft notes");
});

test("an edit survives a reload inside the autosave delay", async ({ page }) => {
  await page.goto("/notes");
  await page.getByRole("button", { name: "New note" }).first().click();
  const title = page.getByRole("textbox", { name: "Title" });
  await expect(title).toHaveValue("Untitled note");
  await title.fill("Quick reload");
  await page.reload(); // before the 800 ms debounce: the pagehide keepalive save sends it
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Quick reload");
});
