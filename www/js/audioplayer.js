export default function init() {
  var player = document.querySelector(".audio-player");
  var button = player.querySelector(".play-stream");
  var audio = player.querySelector("audio");

  var updatePlayer = function(e) {
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
    } else {
      audio.pause();
    }
  });

}