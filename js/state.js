function createInitialState() {
  return {
    step: 0,
    destinationId: null,
    instrumentIds: [],
    launcherId: null,
    powerId: null,
    communicationId: null,
    simulation: null,
    report: null,
    reportVisible: false
  };
}
const MissionState = {
  current: createInitialState(),
  reset() {
    this.current = createInitialState();
  }
};
