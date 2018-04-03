/*
 * Copyright 2017 Andrew Stubbs <andrew.stubbs@gmail.com>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met: 
 * 
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer. 
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution. 
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

var sites = [
  "http://www.jupiterbroadcasting.com",
  "http://linuxactionnews.com",
  "http://linuxunplugged.com",
  "http://techsnap.systems",
  "http://coder.show",
  "http://jblive.tv",
  "http://jblive.fm",
  "http://www.patreon.com/jupitersignal",
  "http://www.patreon.com/unfilter"
];

var onYouTubeIframeAPIReady = function() {
    console.log("ERROR: onYouTubeIframeAPIReady called undefined.");
};

// The player variables a global for easier debugging.
var YTplayer = null;
var SEplayer = null;

(function(Nuvola)
{

// Create media player component
var player = Nuvola.$object(Nuvola.MediaPlayer);

// Handy aliases
var PlaybackState = Nuvola.PlaybackState;
var PlayerAction = Nuvola.PlayerAction;

// Create new WebApp prototype
var WebApp = Nuvola.$WebApp();

// Delayed seek (for when the video is not yet seekable)
var delayedSeek = null;

// Initialization routines
WebApp._onInitWebWorker = function(emitter)
{
    Nuvola.WebApp._onInitWebWorker.call(this, emitter);

    var state = document.readyState;
    if (state === "interactive" || state === "complete")
        this._onPageReady();
    else
        document.addEventListener("DOMContentLoaded", this._onPageReady.bind(this));
}

// Page is ready for magic
WebApp._onPageReady = function()
{
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect("ActionActivated", this);

    // Add site-selector header
    var newheader = document.createElement("div");
    newheader.classList.add("nuvolanav");

    var innerheader = document.createElement("div");
    innerheader.classList.add("nuvola-slide");
    innerheader.classList.add("nuvola-slide-closed");
    newheader.appendChild(innerheader);
    newheader.addEventListener("mouseover", function() {innerheader.classList.remove("nuvola-slide-closed")})
    newheader.addEventListener("mouseleave", function() {innerheader.classList.add("nuvola-slide-closed")})

    var selector = document.createElement("select");
    selector.addEventListener("change", function() {document.location = selector.value;});
    innerheader.appendChild(selector);
    sites.forEach(function (site) {
      var option = document.createElement("option");
      option.innerText = site;
      option.value = site;
      if (document.URL.startsWith(site))
	option.selected = true;
      selector.appendChild(option);
    });
    var bar = document.createElement("div");
    bar.classList.add("nuvolatab");
    bar.innerText = "Nuvola"
    newheader.appendChild(bar);
    var body = document.querySelector("body");
    body.insertBefore(newheader, body.firstChild);

    var css = document.createElement("style");
    css.type = "text/css";
    css.innerHTML = `
      .nuvolatab {
        background-color: blue;
        position: relative;
        left: 45%;
        width: 10%;
        height: 1em;
        text-align: center;
        color: white;
        border-bottom-right-radius: 0.5em;
        border-bottom-left-radius: 0.5em;
        font-size: 10pt;
      }
      .nuvolanav {
        position: fixed;
        top: 0;
        z-index: 10000;
        width: 100%;
      }
      .nuvola-slide {
        -webkit-transition: max-height 1s;
        transition: max-height 1s;
      }
      .nuvola-slide-closed {
        max-height: 0;            
        overflow-y: hidden;
      }
      .nuvolanav select {
        padding: 0.5em;
        width: 100%;
        background-color: white;
        font-size: 12pt;
      }
      .nuvolatab, .nuvolanav select {
        font-family: sans-serif;
      }
    `;
    body.appendChild(css);

    // Detect content
    var ytframe = null;
    var iframes = document.getElementsByTagName('iframe');
    for (var i=0; i < iframes.length; i++) {
        if (iframes[i].src && iframes[i].src.indexOf("youtube.com") >= 0) {
	    ytframe = iframes[i];
	    break;
	}
    }
    if (ytframe) {
	// This is YouTube content
	var urlelms = ytframe.src.split('/');

	var videoId = urlelms[urlelms.length-1].split('?')[0];
	var videoWidth = ytframe.width;
	var videoHeight = ytframe.height;

	// Delete the existing iframe, and create a new one
	var placeholder = document.createElement("div");
	placeholder.id = 'ytnuvola';
        placeholder.className = ytframe.className;
	placeholder.style.height = ytframe.style.height;
        placeholder.style.width = ytframe.style.width;
        placeholder.setAttribute("data-ratio","16:9")
        ytframe.parentElement.insertBefore(placeholder, ytframe);
        ytframe.remove();
	
	onYouTubeIframeAPIReady = function() {
	    YTplayer = new YT.Player('ytnuvola', {
		height: videoHeight,
		width: videoWidth,
		videoId: videoId,
	        playerVars: {
		  rel: 0,
		  start: localStorage.getItem(document.URL)
		}});
	}

	var tag = document.createElement('script');
	tag.src = "https://www.youtube.com/iframe_api";
	var firstScriptTag = document.getElementsByTagName('script')[0];
	firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
	var video = (document.getElementById("video_html5_api")
	             || document.querySelector("video")
                     || document.querySelector("audio"));
        if (video) {
	    SEplayer = video;
	    delayedSeek = localStorage.getItem(document.URL);
	}
    }

    document.querySelectorAll(".thumbnail a").forEach(function(thumb) {
	var viewed = thumb.href ? localStorage.getItem(thumb.href + "$percent") : 0;
        if (!viewed) return;
	var bar = document.createElement('div');
	bar.setAttribute("style", "display: block; width: " + viewed + "%; height: 0.5em; border-radius: 4px; background-color: green;");
        thumb.append(bar);
    });

    // Start update routine
    this.update();
}

// Extract data from the web page
WebApp.update = function()
{
    var track = {
        title: null,
        artist: null,
        album: null,
        artLocation: null,
        rating: null,
        length: null
    }
    var state = PlaybackState.UNKNOWN;

    if (YTplayer && YTplayer.getPlayerState) {
	state = (YTplayer.getPlayerState() == 1
	         ? PlaybackState.PLAYING
		 : PlaybackState.PAUSED);
	track.length = YTplayer.getDuration() * 1000000;

	if (Nuvola.checkVersion && Nuvola.checkVersion(4, 4, 18)) { // @API 4.5
	    localStorage.setItem(document.URL, Math.floor(YTplayer.getCurrentTime()));
	    if (!!track.length)
		localStorage.setItem(document.URL + "$percent", Math.floor((YTplayer.getCurrentTime()*1000000/track.length)*100));
	    player.setTrackPosition(YTplayer.getCurrentTime() * 1000000);
	    player.setCanSeek(!!track.length);

	    if (YTplayer.isMuted())
		player.updateVolume(0);
	    else
		player.updateVolume(YTplayer.getVolume() / 100);
	    player.setCanChangeVolume(true);
	}
    } else if (SEplayer && !!SEplayer.readyState) {
	state = (SEplayer.paused
		 ? PlaybackState.PAUSED
	  	 : PlaybackState.PLAYING);
	track.length = SEplayer.duration * 1000000;

	if (Nuvola.checkVersion && Nuvola.checkVersion(4, 4, 18)) { // @API 4.5
	    if (!!SEplayer.duration) {
		if (delayedSeek) {
		    SEplayer.currentTime = delayedSeek;
		    delayedSeek = null;
		} else {
		    localStorage.setItem(document.URL, Math.floor(SEplayer.currentTime));
		    if (!!track.length)
		        localStorage.setItem(document.URL + "$percent", Math.floor((SEplayer.currentTime*10000000/track.length)*100));
		}
		player.setTrackPosition(SEplayer.currentTime * 1000000);
		player.setCanSeek(true);
	    } else
		player.setCanSeek(false);

	    if (SEplayer.muted)
		player.updateVolume(0);
	    else
		player.updateVolume(SEplayer.volume);
	}
    } else if (SEplayer) {
        state = PlaybackState.PAUSED;
    }

    var elm = (document.querySelector(".thumbnail img")
               || document.querySelector(".fixed-header-logo img"));
    if (elm) {
      track.artLocation = elm.src;
    }

    if (YTplayer || SEplayer) {
      var pos = document.title.lastIndexOf("|");
      if (pos == -1) {
	  track.title = document.title;
      } else {
	  track.title = document.title.substr(0, pos-1).trim();
	  track.artist = document.title.substr(pos+1).trim();
      }
    }

    player.setTrack(track);
    player.setPlaybackState(state);
    player.setCanPause(state == PlaybackState.PLAYING);
    player.setCanPlay(state == PlaybackState.PAUSED);

    // Schedule the next update
    setTimeout(this.update.bind(this), 500);
}

// Handler of playback actions
WebApp._onActionActivated = function(emitter, name, param)
{
    if (YTplayer) {
	switch (name) {
	    case PlayerAction.TOGGLE_PLAY:
		var state = YTplayer.getPlayerState();
		if (state != 1 && state != 3)
		    YTplayer.playVideo();
		else
		    YTplayer.pauseVideo();
		break;
	    case PlayerAction.PLAY:
		YTplayer.playVideo();
		break;
	    case PlayerAction.PAUSE:
		YTplayer.pauseVideo();
		break;
	    case PlayerAction.STOP:
		YTplayer.stopVideo();
		break;
	    case PlayerAction.SEEK:  // @API 4.5: undefined & ignored in Nuvola < 4.5
		YTplayer.seekTo(param/1000000, true);
		break;
	    case PlayerAction.CHANGE_VOLUME:  // @API 4.5: undefined & ignored in Nuvola < 4.5
		YTplayer.setVolume(param*100);
		if (YTplayer.isMuted() && param != 0)
		    YTplayer.unMute();
		break;
	}
    } else if (SEplayer) {
	switch (name) {
	    case PlayerAction.TOGGLE_PLAY:
		if (SEplayer.paused)
		    SEplayer.play();
		else
		    SEplayer.pause();
		break;
	    case PlayerAction.PLAY:
		SEplayer.play();
		break;
	    case PlayerAction.PAUSE:
		SEplayer.pause();
		break;
	    case PlayerAction.STOP:
		SEplayer.pause();
		break;
	    case PlayerAction.SEEK:  // @API 4.5: undefined & ignored in Nuvola < 4.5
	        SEplayer.currentTime = param/1000000;
		break;
	    case PlayerAction.CHANGE_VOLUME:  // @API 4.5: undefined & ignored in Nuvola < 4.5
		SEplayer.volume = param;
		if (SEplayer.muted && param != 0)
		    SEplayer.muted = false;
		break;
	}
    }
}

WebApp.start();

})(this);  // function(Nuvola)
