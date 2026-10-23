import {
  ensureCompanionPortraitStyles,
  reconcileCompanionControls,
  reconcileCompanionOverlay,
  removeCompanionPortraitView,
} from './companion-portrait-view';
import {
  COMPANION_PORTRAIT_ENABLED_KEY,
  COMPANION_PORTRAIT_SELECTION_KEY_PREFIX,
  COMPANION_PORTRAIT_SELECTION_SCHEMA_VERSION,
  deleteCompanionPortraitSelection,
  getCompanionPortraitEnabled,
  getCompanionPortraitSelection,
  setCompanionPortraitSelection,
  type CompanionPortraitSelection,
} from '../../platform/chrome/companion-portrait-storage';
import {
  openExtrasCompanionSidebar,
  observeExtrasCompanionTargets,
  type ExtrasCompanionTarget,
  type ExtrasCompanionTargets,
} from '../../platform/dndbeyond/extras-companion-adapter';
import type {Cleanup} from '../../shared/types';

export interface CompanionPortraitController {
  cleanup: Cleanup;
  syncRoute: () => void;
}

export function installCompanionPortraitFeature(
    getCharacterId: () => string | null,
    doc: Document = document,
): CompanionPortraitController {
  ensureCompanionPortraitStyles(doc);
  let targets: ExtrasCompanionTargets = {companions: [], header: null};
  let currentCharacterId = getCharacterId();
  let enabled = false;
  let selection: CompanionPortraitSelection | null = null;
  let loadGeneration = 0;
  let destroyed = false;
  let openingCompanion = false;

  const reconcile = () => {
    if (destroyed) {
      return;
    }
    reconcileCompanionControls({
      companions: targets.companions,
      doc,
      enabled,
      onChange: handleSelectionChange,
      selectedCompanionId: selection?.companionId ?? null,
    });
    reconcileCompanionOverlay({
      doc,
      enabled,
      header: targets.header,
      onActivate: handleCompanionActivation,
      selection,
    });
  };

  async function handleCompanionActivation(): Promise<void> {
    if (openingCompanion || selection === null) {
      return;
    }
    openingCompanion = true;
    try {
      await openExtrasCompanionSidebar(
          selection.companionId,
          targets.companions,
          doc,
      );
    } finally {
      openingCompanion = false;
    }
  }

  const loadState = async () => {
    const generation = ++loadGeneration;
    const characterId = getCharacterId();
    currentCharacterId = characterId;
    if (characterId === null) {
      enabled = false;
      selection = null;
      reconcile();
      return;
    }

    try {
      const [nextEnabled, nextSelection] = await Promise.all([
        getCompanionPortraitEnabled(),
        getCompanionPortraitSelection(characterId),
      ]);
      if (destroyed || generation !== loadGeneration || getCharacterId() !== characterId) {
        return;
      }
      enabled = nextEnabled;
      selection = nextSelection;
      reconcile();
      void refreshSelectionFromObservedRow();
    } catch {
      if (!destroyed && generation === loadGeneration) {
        enabled = false;
        selection = null;
        reconcile();
      }
    }
  };

  const selectCompanion = async (
      companion: ExtrasCompanionTarget,
      checked: boolean,
  ) => {
    const characterId = getCharacterId();
    if (characterId === null || !enabled) {
      return;
    }

    const previousSelection = selection;
    selection = checked
      ? toSelection(companion, characterId)
      : selection?.companionId === companion.companionId
        ? null
        : selection;
    reconcile();
    try {
      if (selection === null) {
        await deleteCompanionPortraitSelection(characterId);
      } else {
        await setCompanionPortraitSelection(selection);
      }
    } catch {
      selection = previousSelection;
      reconcile();
    }
  };

  const handleSelectionChange = (companionId: string, checked: boolean) => {
    const companion = targets.companions.find(
        (target) => target.companionId === companionId,
    );
    if (companion !== undefined) {
      void selectCompanion(companion, checked);
    }
  };

  const refreshSelectionFromObservedRow = async () => {
    const characterId = currentCharacterId;
    if (characterId === null || selection === null) {
      return;
    }
    const observed = targets.companions.find(
        (companion) => companion.companionId === selection?.companionId,
    );
    if (observed === undefined) {
      return;
    }
    const refreshed = toSelection(observed, characterId);
    if (
      refreshed.group === selection.group
      && refreshed.imageUrl === selection.imageUrl
      && refreshed.name === selection.name
      && refreshed.type === selection.type
    ) {
      return;
    }
    selection = refreshed;
    reconcile();
    try {
      await setCompanionPortraitSelection(refreshed);
    } catch {
      // The current D&D Beyond row is still safe to show for this page load.
    }
  };

  const stopObservingTargets = observeExtrasCompanionTargets((nextTargets) => {
    targets = nextTargets;
    reconcile();
    void refreshSelectionFromObservedRow();
  }, doc);

  const stopStorageListener = installStorageListener(() => {
    void loadState();
  });
  void loadState();

  return {
    cleanup: () => {
      destroyed = true;
      loadGeneration += 1;
      stopObservingTargets();
      stopStorageListener();
      removeCompanionPortraitView(doc);
    },
    syncRoute: () => {
      if (getCharacterId() !== currentCharacterId) {
        void loadState();
      }
    },
  };
}

function toSelection(
    companion: ExtrasCompanionTarget,
    characterId: string,
): CompanionPortraitSelection {
  return {
    characterId,
    companionId: companion.companionId,
    group: companion.group,
    imageUrl: companion.imageUrl,
    name: companion.name,
    schemaVersion: COMPANION_PORTRAIT_SELECTION_SCHEMA_VERSION,
    type: companion.type,
    updatedAt: new Date().toISOString(),
  };
}

function installStorageListener(onChange: () => void): Cleanup {
  if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) {
    return () => {};
  }
  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] =
    (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }
      if (
        Object.hasOwn(changes, COMPANION_PORTRAIT_ENABLED_KEY)
        || Object.keys(changes).some((key) =>
          key.startsWith(COMPANION_PORTRAIT_SELECTION_KEY_PREFIX))
      ) {
        onChange();
      }
    };
  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

