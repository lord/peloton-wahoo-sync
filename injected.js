let instructorCues = [];
let device = null;
let controlPointCharacteristic = null;
let powerCharacteristic = null;
let speedCadenceCharacteristic = null;
let currentResistanceLevel = 0;

const CYCLING_POWER_SERVICE = 0x1818;
const CYCLING_SPEED_CADENCE_SERVICE = 0x1816;
const FITNESS_MACHINE_SERVICE = 0x1826;
const POWER_MEASUREMENT = 0x2a63;
const CSC_MEASUREMENT = 0x2a5b;
const FITNESS_MACHINE_CONTROL_POINT = 0x2ad9;

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
  min-width: 200px;
`;

const connectBtn = document.createElement("button");
connectBtn.textContent = "Connect KICKR";
connectBtn.style.cssText = `
  margin: 5px 0;
  padding: 5px;
  width: 100%;
`;

const statusText = document.createElement("div");
const metricsDiv = document.createElement("div");
metricsDiv.innerHTML = `
  <div>Power: <span id="kickrPower">-- W</span></div>
  <div>Current Resistance: <span id="kickrResistance">--%</span></div>
  <div>Cadence: <span id="kickrCadence">-- rpm</span></div>
`;

timerDiv.appendChild(connectBtn);
timerDiv.appendChild(statusText);
timerDiv.appendChild(metricsDiv);
document.body.appendChild(timerDiv);

async function connectToKickr() {
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [CYCLING_POWER_SERVICE] }],
      optionalServices: [
        FITNESS_MACHINE_SERVICE,
        CYCLING_SPEED_CADENCE_SERVICE,
      ],
    });

    statusText.textContent = "Connecting...";
    const server = await device.gatt.connect();

    const powerService = await server.getPrimaryService(CYCLING_POWER_SERVICE);
    powerCharacteristic =
      await powerService.getCharacteristic(POWER_MEASUREMENT);
    await powerCharacteristic.startNotifications();
    powerCharacteristic.addEventListener(
      "characteristicvaluechanged",
      handlePowerData,
    );

    try {
      const cscService = await server.getPrimaryService(
        CYCLING_SPEED_CADENCE_SERVICE,
      );
      speedCadenceCharacteristic =
        await cscService.getCharacteristic(CSC_MEASUREMENT);
      await speedCadenceCharacteristic.startNotifications();
      speedCadenceCharacteristic.addEventListener(
        "characteristicvaluechanged",
        handleSpeedCadenceData,
      );
    } catch (e) {
      console.log("Speed/cadence not available:", e);
    }

    const fitnessService = await server.getPrimaryService(
      FITNESS_MACHINE_SERVICE,
    );
    controlPointCharacteristic = await fitnessService.getCharacteristic(
      FITNESS_MACHINE_CONTROL_POINT,
    );

    statusText.textContent = "Connected";
    connectBtn.textContent = "Disconnect";
    connectBtn.onclick = disconnectKickr;
  } catch (error) {
    console.error(error);
    statusText.textContent = `Error: ${error.message}`;
  }
}

function handlePowerData(event) {
  const data = event.target.value;
  const power = data.getUint16(2, true);
  document.getElementById("kickrPower").textContent = `${power} W`;
}

function handleSpeedCadenceData(event) {
  const data = event.target.value;
  const cadence = data.getUint16(3, true);
  document.getElementById("kickrCadence").textContent = `${cadence} rpm`;
}

async function setResistance(level) {
  if (controlPointCharacteristic) {
    const data = new Uint8Array([0x04, level]);
    await controlPointCharacteristic.writeValue(data);
    currentResistanceLevel = level;
    document.getElementById("kickrResistance").textContent = `${level}%`;
  }
}

async function disconnectKickr() {
  if (device && device.gatt.connected) {
    await device.gatt.disconnect();
  }

  powerCharacteristic = null;
  speedCadenceCharacteristic = null;
  controlPointCharacteristic = null;
  device = null;

  statusText.textContent = "Disconnected";
  connectBtn.textContent = "Connect KICKR";
  connectBtn.onclick = connectToKickr;
  document.getElementById("kickrPower").textContent = "-- W";
  document.getElementById("kickrCadence").textContent = "-- rpm";
  document.getElementById("kickrResistance").textContent = "--%";
  currentResistanceLevel = 0;
}

connectBtn.onclick = connectToKickr;

window.addEventListener("unload", () => {
  if (device && device.gatt.connected) {
    device.gatt.disconnect();
  }
});

setInterval(() => {
  const video = document.querySelector("video");
  if (video) {
    const currentTime = Math.floor(video.currentTime);
    const currentCue = instructorCues.find(
      (cue) =>
        currentTime >= cue.offsets.start && currentTime <= cue.offsets.end,
    );

    if (currentCue) {
      if (controlPointCharacteristic) {
        setResistance(currentCue.resistance_range.lower);
      }

      const timeDiv = document.createElement("div");
      timeDiv.textContent = `Time: ${currentTime}s
Target Resistance: ${currentCue.resistance_range.lower}-${currentCue.resistance_range.upper}
Target Cadence: ${currentCue.cadence_range.lower}-${currentCue.cadence_range.upper}`;

      // Replace existing time div if it exists
      const existingTimeDiv = timerDiv.querySelector(".time-info");
      if (existingTimeDiv) {
        existingTimeDiv.remove();
      }
      timeDiv.className = "time-info";
      timerDiv.insertBefore(timeDiv, metricsDiv);
    }
  }
}, 100);
