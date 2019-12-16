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
        var player = jwplayer(document.createElement("div"));

        playButton.addEventListener("click", function() {
          // play/pause the live stream
          // set aria-pressed to match
        });

        ok(player)
      };
    });
  }
  return loadPlayer;
};

export default {
  update: function(src, text) {
    ui.classList.remove("hidden");  
    playlist.innerHTML = "Loading player...";
    getPlayer().then(function(player) {
      console.log("*"+src+"*", text.trim(), player);
      playlist.innerHTML = text;
      // set JWPlayer source
    });
  },
  disable: function() {
    ui.classList.add("hidden");
  }
}