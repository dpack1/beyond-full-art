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

export const LIVE_CHARACTER_SHEET_TABS_FIXTURE = `
  <button id="appearance-toggle" type="button">Appearance</button>
  <div class="ct-character-sheet ct-character-sheet--dark-mode" data-theme="dark" id="sheet">
    <div class="ddbc-tab-list">
      <div class="ddbc-tab-list__nav" id="sheet-nav">
        <div class="ddbc-tab-list__nav-item">Actions</div>
        <div class="ddbc-tab-list__nav-item">Spells</div>
        <div class="ddbc-tab-list__nav-item">Inventory</div>
        <div class="ddbc-tab-list__nav-item">Features &amp; Traits</div>
        <div class="ddbc-tab-list__nav-item">Background</div>
        <div class="ddbc-tab-list__nav-item">Notes</div>
        <div class="ddbc-tab-list__nav-item ddbc-tab-list__nav-item--is-active">Extras</div>
      </div>
      <div class="ddbc-tab-list__content" style="height: 320px; overflow: hidden;">
        <div class="ddbc-tab-options__content" data-testid="sheet-scroller" style="height: 100%; overflow: auto;">
          <div class="ct-character-sheet-panel" data-testid="native-character-panel">
            <div class="ct-extras-filter__interactions">
              <div class="ct-extras-filter__box">
                <div class="ct-extras-filter__primary">
                  <div class="ct-extras-filter__primary-group ct-extras-filter__primary-group--first">
                    <div class="ct-extras-filter__icon"></div>
                  </div>
                  <div class="ct-extras-filter__field">
                    <input class="ct-extras-filter__input" type="search" placeholder="Search Names, Types, or Tags">
                  </div>
                </div>
              </div>
              <div class="ct-extras-filter__advanced">
                <svg class="ddbc-svg ddbc-filter-svg" viewBox="0 0 29 31.43435" aria-hidden="true"></svg>
              </div>
              <div class="ct-extras-filter__callout">
                <button class="ct-theme-button ct-theme-button--outline ct-button" type="button">Manage Extras</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const nav = document.getElementById('sheet-nav');
    nav.addEventListener('pointerdown', (event) => {
      const item = event.target.closest('.ddbc-tab-list__nav-item');
      if (!item) return;
      nav.dataset.sheetPointerdowns = String(
        Number(nav.dataset.sheetPointerdowns || '0') + 1,
      );
      const label = (item.textContent || '').trim().toLowerCase();
      const known = [
        'actions',
        'spells',
        'inventory',
        'features & traits',
        'background',
        'notes',
        'extras',
      ];
      if (!known.includes(label)) {
        const scroller = document.querySelector('[data-testid="sheet-scroller"]');
        if (scroller) {
          scroller.innerHTML = '<div data-testid="native-character-panel">Reset by the sheet.</div>';
        }
        return;
      }
      for (const child of nav.children) {
        child.classList.remove('ddbc-tab-list__nav-item--is-active');
      }
      item.classList.add('ddbc-tab-list__nav-item--is-active');
    });
    document.getElementById('appearance-toggle').addEventListener('click', () => {
      const sheet = document.getElementById('sheet');
      const dark = sheet.classList.toggle('ct-character-sheet--dark-mode');
      sheet.dataset.theme = dark ? 'dark' : 'light';
    });
  </script>
`;
