var playerURL = "https://cdn.jwplayer.com/libraries/JNfsuMc9.js";
var ui = document.querySelector(".audio-player");
var playButton = ui.querySelector("button.play-stream");
var playlist = ui.querySelector("span.text");

var loadPlayer = null;
var getPlayer = function(src) {
  if (!loadPlayer) {
    loadPlayer = new Promise(function(ok, fail) {
      var script = document.createElement("script");
      script.src = playerURL;
      document.body.appendChild(script);
      script.onload = function() {
        // create a hidden player element
        var div = document.createElement("div");
        div.style.visibility = "hidden";
        div.style.position = "absolute";
        div.style.left = "-1000px";
        div.setAttribute("aria-hidden", "true");
        div.id = "jwplayer";
        document.body.appendChild(div);

        // instantiate player
        var player = jwplayer("jwplayer")
        player.setup({
          file: src
        });

        playButton.addEventListener("click", function() {
          // play/pause the live stream
          if (player.getState() == "playing") {
            player.pause();
          } else {
            player.play();
          }
        });

        var pressed = function(e) {
          playButton.classList.remove("seeking");
          playButton.setAttribute("aria-pressed", "true");
        };

        var unpressed = function(e) {
          playButton.classList.remove("seeking");
          playButton.setAttribute("aria-pressed", "false");
        };

        var seeking = function() {
          playButton.classList.add("seeking");
        }

        // register for events
        player.on("ready", function() {
          player.on("play", pressed);
          player.on("pause", unpressed);
          player.on("buffer", seeking);
          player.on("seek", seeking);
        });

        window.player = player;

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
    ui.classList.toggle("no-audio", !src);
    if (src && lastSrc != src) {
      lastSrc = src;
      playlist.innerHTML = "Loading player...";
      getPlayer(src).then(function(player) {
        playlist.innerHTML = text;
        // set JWPlayer playlist
        console.log(src);
        player.load([{
          file: src
        }]);
      });
    } else {
      playlist.innerHTML = text;
    }
  },
  disable: function() {
    ui.classList.add("hidden");
  }
}