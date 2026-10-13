export const CHARACTER_SHEET_TABS_FIXTURE = `
  <div class="ct-character-sheet-shell">
    <header class="ct-character-header">
      <div class="ct-character-header__portrait" aria-hidden="true"></div>
      <div class="ct-character-header__identity">
        <p class="ct-character-header__eyebrow">Character</p>
        <h1 class="ct-character-header__name">Matilda Greywolf</h1>
        <p class="ct-character-header__meta">High Elf · Wizard 7 · Hermit</p>
      </div>
    </header>
    <nav aria-label="Character sheet sections">
      <ul class="ct-character-sheet-tabs">
        <li class="ct-character-sheet-tab-item">
          <button class="ct-character-sheet-tab" type="button">Actions</button>
        </li>
        <li class="ct-character-sheet-tab-item">
          <button class="ct-character-sheet-tab" type="button">Inventory</button>
        </li>
        <li class="ct-character-sheet-tab-item">
          <button class="ct-character-sheet-tab" type="button">Extras</button>
        </li>
        <li class="ct-character-sheet-tab-item">
          <button class="ct-character-sheet-tab" type="button">Notes</button>
        </li>
      </ul>
    </nav>
    <section class="ct-character-sheet-content">
      <div class="ct-character-sheet-panel" data-testid="native-character-panel">
        <h2>Actions</h2>
        <p>Native character sheet content</p>
      </div>
    </section>
  </div>
`;

export const CURRENT_CHARACTER_SHEET_TABS_FIXTURE = `
  <div class="ct-character-sheet">
    <div class="ct-character-sheet-tabs">
      <div class="ct-character-sheet-tab">ACTIONS</div>
      <div class="ct-character-sheet-tab">SPELLS</div>
      <div class="ct-character-sheet-tab">INVENTORY</div>
      <div class="ct-character-sheet-tab">FEATURES & TRAITS</div>
      <div class="ct-character-sheet-tab">BACKGROUND</div>
      <div class="ct-character-sheet-tab">NOTES</div>
      <div class="ct-character-sheet-tab-option">
        <span class="ct-character-sheet-tab">EXTRAS</span>
      </div>
    </div>
    <section class="ct-character-sheet-content">
      <div class="ct-character-sheet-panel" data-testid="native-character-panel">
        Native character sheet content
      </div>
    </section>
  </div>
`;
