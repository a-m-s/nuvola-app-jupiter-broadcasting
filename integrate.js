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

    var embeddiv = document.getElementById('videoembed');
    if (!embeddiv) {
        Nuvola.log ("Error: video not found!");
        return;
    }

    var ytframe = embeddiv.querySelector('iframe');
    if (ytframe) {
	// This is YouTube content
	var urlelms = ytframe.src.split('/');

	var videoId = urlelms[urlelms.length-1];
	var videoWidth = ytframe.width;
	var videoHeight = ytframe.height;

	// Delete the existing iframe, and create a new one
	var wrapper = embeddiv.querySelector(".responsive-object-wrapper");
	wrapper.innerHTML = "<div id='ytnuvola'></div>";
	
	onYouTubeIframeAPIReady = function() {
	    YTplayer = new YT.Player('ytnuvola', {
		height: videoHeight,
		width: videoWidth,
		videoId: videoId});
	}

	var tag = document.createElement('script');
	tag.src = "https://www.youtube.com/iframe_api";
	var firstScriptTag = document.getElementsByTagName('script')[0];
	firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else {
	var video = document.getElementById("video_html5_api");
	if (!video)
	    video = document.querySelector("video");
        if (!video) {
	    Nuvola.log ("Error: video not found!");
	    return;
	}
        SEplayer = video;
    }

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
	    player.setTrackPosition(SEplayer.currentTime * 1000000);
	    player.setCanSeek(!!SEplayer.duration);

	    if (SEplayer.muted)
		player.updateVolume(0);
	    else
		player.updateVolume(SEplayer.volume);
	}
    } else if (SEplayer) {
        state = PlaybackState.PAUSED;
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
