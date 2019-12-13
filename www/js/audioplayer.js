
var player = document.querySelector(".audio-player");
var button = player.querySelector(".play-stream");
var audio = player.querySelector("audio");
var titleSpan = player.querySelector(".text");

var playedCounter = 0;

var updatePlayer = function(e) {
  var rounded = Math.floor(audio.currentTime / 30) * 30;
  if (rounded > playedCounter) {
    playedCounter = rounded;
    ANALYTICS.trackEvent('livestream-play-elapsed', rounded);
  }
  switch (e.type) {
    case "seeking":
    case "stalled":
    case "loadstart":
      button.classList.add("seeking");
      break;

    default: 
      button.classList.remove("seeking");
      button.setAttribute("aria-pressed", audio.paused ? "false" : "true");
  }
}

"timeupdate seeking seeked loadstart loadend canplay ended".split(" ").forEach(e => audio.addEventListener(e, updatePlayer));

button.addEventListener("click", function() {
  if (audio.paused) {
    audio.play();
    ANALYTICS.trackEvent('livestream-clicked-play');
  } else {
    audio.pause();
    ANALYTICS.trackEvent('livestream-clicked-pause');
  }
});

var update = function(src, text) {
  player.classList.remove("hidden");
  audio.src = src;
  titleSpan.innerHTML = text;
}

var disable = function() {
  player.classList.add("hidden");
}

export default { update, disable }