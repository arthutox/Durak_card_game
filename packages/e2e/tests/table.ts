import { test as base, devices, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** One phone: its own browser context, so its own localStorage and session. */
export interface Phone {
  readonly name: string;
  readonly page: Page;
}

interface Table {
  /** The laptop screen. */
  readonly board: Page;
  /** Opens /play in a fresh phone-sized context and takes a seat. */
  joinPhone: (name: string) => Promise<Phone>;
}

/**
 * The server keeps a single room for its whole life, so every test starts from
 * an empty lobby: after the test the fixture ends a running game and removes
 * every seat through the board, like a host would.
 */
export const test = base.extend<{ table: Table }>({
  table: async ({ browser, page: board }, use) => {
    await board.goto('/board');
    await expect(board.getByText('Online', { exact: true })).toBeVisible();

    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    const joinPhone = async (name: string): Promise<Phone> => {
      const context = await browser.newContext({ ...devices['Pixel 7'] });
      contexts.push(context);
      const page = await context.newPage();
      await page.goto('/play');
      await page.getByPlaceholder('What should we call you?').fill(name);
      await page.getByRole('button', { name: 'Take a seat' }).click();
      await expect(board.getByRole('listitem').filter({ hasText: name })).toBeVisible();
      return { name, page };
    };

    await use({ board, joinPhone });

    const endGame = board.getByRole('button', { name: 'End game' });
    if (await endGame.isVisible()) {
      await endGame.click();
      await board.getByRole('button', { name: 'Really end the game?' }).click();
    }
    const remove = board.getByRole('button', { name: /^Remove / });
    const seats = await remove.count();
    for (let left = seats; left > 0; left--) {
      await remove.first().click();
      await expect(remove).toHaveCount(left - 1);
    }
    await Promise.all(contexts.map((context) => context.close()));
  },
});

export { expect };
