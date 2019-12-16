var playerURL = "https://cdn.jwplayer.com/libraries/JNfsuMc9.js";
var ui = document.querySelector(".audio-player");
var playButton = ui.querySelector("button.play-stream");
var playlist = ui.querySelector("span.text");

var loadPlayer = null;
var getPlayer = function(callback) {
  if (!loadPlayer) {
    loadPlayer = new Promise(function(ok, fail) {
      var script = document.createElement("script");
      script.src = playerURL;
      document.body.appendChild(script);
      script.onload = function(callback) {
        var player = jwplayer(document.createElement("div"))

        playButton.addEventListener("click", function() {
          // play/pause the live stream
          player.play();
        });

        var pressed = function() {
          playButton.classList.remove("seeking");
          playButton.setAttribute("aria-pressed", "true");
        };

        var unpressed = function() {
          playButton.classList.remove("seeking");
          playButton.setAttribute("aria-pressed", "false");
        };

        var seeking = function() {
          playButton.classList.add("seeking");
        }

        player.on("play", pressed);
        player.on("pause", unpressed);
        player.on("buffer", seeking);
        player.on("seek", seeking);

        ok(player)
      };
    });
  }
  return loadPlayer;
};

var lastSrc = null;
export default {
  update: function(src, text) {
    ui.classList.remove("hidden");
    if (src && lastSrc != src) {
      lastSrc = src;
      playlist.innerHTML = "Loading player...";
      getPlayer().then(function(player) {
        // console.log("*"+src+"*", text.trim(), player);
        playlist.innerHTML = text;
        // set JWPlayer source
        player.setup({
          file: src
        });
      });
    } else {
      playlist.innerHTML = text;
    }
  },
  disable: function() {
    ui.classList.add("hidden");
  }
}