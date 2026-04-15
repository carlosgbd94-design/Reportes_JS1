/**
 * JS1 Reportes - Store
 * Gestión de estado global compatible con la lógica original.
 */

export const store = {
  state: {
    user: null,
    token: null,
    bioIsEnabled: false,
    conIsEnabled: false,
    unitBatches: [],
    batchCatalog: [],
    configBiologicosCatalog: [],
    // El LIVE_STATE original
    liveState: {
      pinolPendientes: null,
      summaryCapturadas: null,
      summaryFaltantes: null,
      todayExistenciaCaptured: null,
      todayConsCaptured: null,
      lastHistoryRows: null,
      summaryKey: null,
      notifCount: 0,
      notifWarnCount: 0,
      notifGoodCount: 0,
      lastToastKey: "",
      lastEventKey: "",
      mutedUntil: 0,
      lastEventTs: 0,
      eventCooldownMs: 2200,
      eventHistory: {},
      pinolWatching: false,
      summaryWatching: false,
      unidadWatching: false,
      historyWatching: false,
      toastMeta: { key: "", ts: 0 }
    }
  },

  // Helper para actualizar partes del liveState sin perder el resto
  updateLiveState(patch) {
    this.state.liveState = { ...this.state.liveState, ...patch };
  }
};
