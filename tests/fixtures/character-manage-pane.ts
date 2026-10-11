export const CHARACTER_MANAGE_PANE_FIXTURE = `
  <div class="ct-sidebar__portal">
    <div data-testid="character-manage-pane" theme="DARK">
      <div>
        <img
          class="ddbc-character-avatar__portrait styles_avatar__t7tEz"
          alt="Character portrait"
          src="https://www.dndbeyond.com/avatars/58196/625/1581111423-169418374.jpeg?width=150&height=150&fit=crop&quality=95&auto=webp">
        <h1>Zurelda</h1>
        <div class="ddbc-collapsible ddbc-collapsible--opened">
          <div class="ddbc-collapsible__content">
            <div class="ct-decoration-manager">
              <div class="ct-decoration-manager__custom">
                <h2 class="ct-sidebar__subheading">Current Custom Portrait</h2>
                <div class="ct-decoration-manager__custom-content">
                  <div class="ct-decoration-manager__custom-preview">
                    <img
                      class="ddbc-character-avatar__portrait"
                      alt="Character portrait"
                      src="https://www.dndbeyond.com/avatars/58196/625/1581111423-169418374.jpeg?width=150&height=150&fit=crop&quality=95&auto=webp">
                  </div>
                </div>
              </div>
              <div class="ct-decoration-manager__upload">
                <div class="ct-decoration-manager__upload-heading">
                  <h2 class="ct-sidebar__subheading">Upload Portrait</h2>
                  <div class="ct-decoration-manager__upload-heading-rules">
                    Recommended Size: 150 x 150 Pixels, Maximum File Size: 3MB
                  </div>
                </div>
                <form class="ct-decoration-manager__upload-form">
                  <div class="ct-decoration-manager__upload-file">
                    <input class="ct-decoration-manager__upload-file-input" type="file">
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

export const CURRENT_INFORMATION_SIDEBAR_FIXTURE = `
  <div class="ct-sidebar__portal">
    <aside aria-label="Information Sidebar">
      <div>
        <h1>Matilda Greywolf</h1>
        <div
          class="ddbc-character-avatar__portrait ddbc-character-avatar__portrait--none"
          style="background-image: url(&quot;https://www.dndbeyond.com/Content/Skins/Waterdeep/images/characters/default-avatar-builder.png&quot;); width: 44px; height: 44px;">
        </div>
        <div
          class="ddbc-character-avatar__portrait styles_avatar__t7tEz ddbc-character-avatar__portrait--none"
          style="background-image: url(&quot;https://www.dndbeyond.com/avatars/58196/625/1581111423-169418374.jpeg?width=150&amp;height=150&amp;fit=crop&amp;quality=95&amp;auto=webp&quot;); width: 130px; height: 130px;">
        </div>
      </div>
    </aside>
  </div>
`;
