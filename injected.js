let instructorCues = [];
const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (...args) {
  this._url = args[1];
  return originalXHROpen.apply(this, args);
};

XMLHttpRequest.prototype.send = function (...args) {
  if (
    this._url.includes("api.onepeloton.com/api/ride/") &&
    this._url.includes("/details")
  ) {
    this.addEventListener("readystatechange", function () {
      if (this.readyState === 4) {
        instructorCues = this.response.instructor_cues;
      }
    });
  }
  return originalXHRSend.apply(this, args);
};

const timerDiv = document.createElement("div");
timerDiv.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-family: sans-serif;
  z-index: 9999;
`;

document.body.appendChild(timerDiv);

setInterval(() => {
  const video = document.querySelector("video");
  if (video) {
    const currentTime = Math.floor(video.currentTime);
    const currentCue = instructorCues.find(
      (cue) =>
        currentTime >= cue.offsets.start && currentTime <= cue.offsets.end,
    );

    if (currentCue) {
      timerDiv.textContent = `Time: ${currentTime}s
Resistance: ${currentCue.resistance_range.lower}-${currentCue.resistance_range.upper}
Cadence: ${currentCue.cadence_range.lower}-${currentCue.cadence_range.upper}`;
    } else {
      timerDiv.textContent = `Time: ${currentTime}s`;
    }
  }
}, 100);
