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
        console.log("MEOW:", this.response); // response is already parsed as JSON
      }
    });
  }
  return originalXHRSend.apply(this, args);
};
