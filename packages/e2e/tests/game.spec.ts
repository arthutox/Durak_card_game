import { expect, test } from './table.js';

test('players take seats and the host can remove one', async ({ table }) => {
  const ann = await table.joinPhone('Ann');
  const bob = await table.joinPhone('Bob');

  await expect(table.board.getByText('Players 2/6')).toBeVisible();

  await table.board.getByRole('button', { name: 'Remove Bob' }).click();

  // Bob's phone drops back to the join form, the board forgets him.
  await expect(bob.page.getByRole('button', { name: 'Take a seat' })).toBeVisible();
  await expect(table.board.getByText('Players 1/6')).toBeVisible();
  await expect(ann.page.getByText('Bob')).toHaveCount(0);
});

test('a game with a turn timer: hands are dealt, the clock runs, an attack reaches the board', async ({
  table,
}) => {
  const phones = [await table.joinPhone('Ann'), await table.joinPhone('Bob')];

  await table.board.getByRole('button', { name: '30 s' }).click();
  await table.board.getByRole('button', { name: 'Start game' }).click();

  // Every phone holds six cards; the board shows both seats with six cards each.
  for (const { page } of phones) {
    await expect(page.locator('.hand-card')).toHaveCount(6);
  }
  await expect(table.board.locator('.seat-cards', { hasText: '6 cards' })).toHaveCount(2);

  // The turn clock is on the board and says who it is waiting for.
  await expect(table.board.getByRole('timer')).toBeVisible();
  await expect(table.board.getByText(/on the clock/)).toBeVisible();
  await expect(table.board.getByText('The table is empty')).toBeVisible();

  // The main attacker is whoever the phone tells to attack.
  let attacker = phones[0]!;
  await expect(async () => {
    for (const phone of phones) {
      if (await phone.page.getByText('Your attack').isVisible()) {
        attacker = phone;
        return;
      }
    }
    throw new Error('no phone is asked to attack yet');
  }).toPass();

  // One tap plays a card: it leaves the hand and lands on the table, on the board too.
  await attacker.page.locator('.hand-card.is-playable').first().click();

  await expect(attacker.page.locator('.hand-card')).toHaveCount(5);
  await expect(table.board.locator('.pair')).toHaveCount(1);
  await expect(table.board.locator('.seat-cards', { hasText: '5 cards' })).toHaveCount(1);
  await expect(table.board.getByText('is defending')).toBeVisible();
});
