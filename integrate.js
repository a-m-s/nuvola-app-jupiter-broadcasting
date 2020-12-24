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

(function (Nuvola) {
  'use strict'

  const localStorage = window ? window.localStorage : null

  const sites = [
    'http://www.jupiterbroadcasting.com',
    'https://linuxactionnews.com',
    'https://linuxunplugged.com',
    'https://techsnap.systems',
    'https://coder.show',
    'https://techtalk.today',
    'https://podcast.asknoahshow.com',
    'https://www.bsdnow.tv',
    'https://unfilter.show',
    'https://error.show',
    'https://chooselinux.show',
    'https://fridaystream.com',
    'https://linuxheadlines.show',
    'https://extras.show',
    'http://jblive.tv',
    'http://jblive.fm',
    'https://www.patreon.com/jupitersignal'
  ]

  function progressKey (uri) {
    const episodePatterns = {
      linuxactionnews: [
        /^https?:\/\/linuxactionnews.com\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/linux-action-news-([0-9]+)/
      ],
      linuxunplugged: [
        /^https?:\/\/linuxunplugged.com\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-lup-([0-9]+)/
      ],
      techsnap: [
        /^https?:\/\/techsnap.systems\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-techsnap-([0-9]+)/
      ],
      coderradio: [
        /^https?:\/\/code.show\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-cr-([0-9]+)(\/|$)/
      ],
      techtalktoday: [
        /^https?:\/\/techtalk.today\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/tech-talk-today-([0-9]+)(\/|$)/
      ],
      asknoah: [
        /^https?:\/\/podcast.asknoahshow.com\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-ask-noah-([0-9]+)(\/|$)/
      ],
      bsdnow: [
      // FIXME: bsdnow.tv doesn't have episode numbers in the URL
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-bsd-now-([0-9]+)(\/|$)/
      ],
      unfilter: [
        /^https?:\/\/unfilter.show\/([0-9]+)/,
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-unfilter-([0-9]+)(\/|$)/
      ],
      usererror: [
      // No special site yet
        /^https?:\/\/www.jupiterbroadcasting.com\/[0-9]+\/.*-user-error-([0-9]+)(\/|$)/
      ]
    }

    for (const show in episodePatterns) {
      for (let i = 0; i < episodePatterns[show].length; i++) {
        const match = episodePatterns[show][i].exec(uri)
        if (match) {
          return show + match[1]
        }
      }
    }
    return uri
  }

  function getProgressTime (uri) {
    const key = progressKey(uri)
    return localStorage.getItem(key) || localStorage.getItem(uri)
  }

  function getProgressPercent (uri) {
    const key = progressKey(uri)
    return localStorage.getItem(key + '$percent') || localStorage.getItem(uri + '$percent')
  }

  function setProgress (uri, time, length) {
    const key = progressKey(uri)
    localStorage.setItem(key, Math.floor(time))
    if (length) {
      localStorage.setItem(key + '$percent', Math.floor((Math.floor(time) / Math.floor(length)) * 100))
    }
  }

  // The player variables a global for easier debugging.
  let YTplayer = null
  let H5player = null

  // Create media player component
  const player = Nuvola.$object(Nuvola.MediaPlayer)

  // Handy aliases
  const PlaybackState = Nuvola.PlaybackState
  const PlayerAction = Nuvola.PlayerAction

  // Create new WebApp prototype
  const WebApp = Nuvola.$WebApp()

  // Delayed seek (for when the video is not yet seekable)
  let delayedSeek = null

  // Initialization routines
  WebApp._onInitWebWorker = function (emitter) {
    Nuvola.WebApp._onInitWebWorker.call(this, emitter)

    const state = document.readyState
    if (state === 'interactive' || state === 'complete') {
      this._onPageReady()
    } else {
      document.addEventListener('DOMContentLoaded', this._onPageReady.bind(this))
    }
  }

  // Page is ready for magic
  WebApp._onPageReady = function () {
    // Connect handler for signal ActionActivated
    Nuvola.actions.connect('ActionActivated', this)

    // Add site-selector header
    const newheader = document.createElement('div')
    newheader.classList.add('nuvolanav')

    const innerheader = document.createElement('div')
    innerheader.classList.add('nuvola-slide')
    innerheader.classList.add('nuvola-slide-closed')
    newheader.appendChild(innerheader)
    newheader.addEventListener('mouseover', function () { innerheader.classList.remove('nuvola-slide-closed') })
    newheader.addEventListener('mouseleave', function () { innerheader.classList.add('nuvola-slide-closed') })

    const selector = document.createElement('select')
    selector.addEventListener('change', function () { document.location = selector.value })
    innerheader.appendChild(selector)
    sites.forEach(function (site) {
      const option = document.createElement('option')
      option.innerText = site
      option.value = site
      if (document.URL.startsWith(site)) { option.selected = true }
      selector.appendChild(option)
    })
    const bar = document.createElement('div')
    bar.classList.add('nuvolatab')
    bar.innerText = 'Nuvola'
    newheader.appendChild(bar)
    const body = document.querySelector('body')
    body.insertBefore(newheader, body.firstChild)

    const css = document.createElement('style')
    css.type = 'text/css'
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
        color: black;
        font-size: 12pt;
      }
      .nuvolatab, .nuvolanav select {
        font-family: sans-serif;
      }
    `
    body.appendChild(css)

    // Detect content
    let ytframe = null
    const iframes = document.getElementsByTagName('iframe')
    for (let i = 0; i < iframes.length; i++) {
      if (iframes[i].src && iframes[i].src.indexOf('youtube.com') >= 0) {
        ytframe = iframes[i]
        break
      }
    }
    if (ytframe) {
      // This is YouTube content
      const urlelms = ytframe.src.split('/')

      const videoId = urlelms[urlelms.length - 1].split('?')[0]
      const videoWidth = ytframe.width
      const videoHeight = ytframe.height

      // Delete the existing iframe, and create a new one
      const placeholder = document.createElement('div')
      placeholder.id = 'ytnuvola'
      placeholder.className = ytframe.className
      placeholder.style.height = ytframe.style.height
      placeholder.style.width = ytframe.style.width
      placeholder.setAttribute('data-ratio', '16:9')
      ytframe.parentElement.insertBefore(placeholder, ytframe)
      ytframe.remove()

      window.onYouTubeIframeAPIReady = function () {
        YTplayer = new window.YT.Player('ytnuvola', {
          height: videoHeight,
          width: videoWidth,
          videoId: videoId,
          playerVars: {
            rel: 0,
            start: getProgressTime(document.URL)
          }
        })
      }

      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
    } else {
      const video = (document.getElementById('video_html5_api') ||
                     document.querySelector('video') ||
                     document.querySelector('audio'))
      if (video) {
        H5player = video
        delayedSeek = getProgressTime(document.URL)
      }
    }

    document.querySelectorAll('.thumbnail a').forEach(function (thumb) {
      const viewed = thumb.href ? getProgressPercent(thumb.href) : 0
      if (!viewed) return
      const bar = document.createElement('div')
      bar.setAttribute('style', 'display: block; width: ' + viewed + '%; height: 0.5em; border-radius: 4px; background-color: green;')
      thumb.append(bar)
    })
    document.querySelectorAll('.list-item a').forEach(function (listitem) {
      const viewed = listitem.href ? getProgressPercent(listitem.href) : 0
      if (!viewed) return
      const outer = document.createElement('div')
      outer.setAttribute('style', 'display:block; width: 10em; height: 0.5em; border-radius: 4px; background-color: grey;')
      const bar = document.createElement('div')
      bar.setAttribute('style', 'display: block; width: ' + viewed + '%; height: 0.5em; border-radius: 4px; background-color: green;')
      outer.append(bar)
      listitem.parentNode.append(document.createElement('br'))
      listitem.parentNode.append(outer)
    })

    // Start update routine
    this.update()
  }

  // Extract data from the web page
  WebApp.update = function () {
    const track = {
      title: null,
      artist: null,
      album: null,
      artLocation: null,
      rating: null,
      length: null
    }
    let state = PlaybackState.UNKNOWN

    if (YTplayer && YTplayer.getPlayerState) {
      state = (YTplayer.getPlayerState() === 1
        ? PlaybackState.PLAYING
        : PlaybackState.PAUSED)
      track.length = YTplayer.getDuration() * 1000000

      setProgress(document.URL, YTplayer.getCurrentTime(),
        YTplayer.getDuration())
      player.setTrackPosition(YTplayer.getCurrentTime() * 1000000)
      player.setCanSeek(!!track.length)

      if (YTplayer.isMuted()) {
        player.updateVolume(0)
      } else {
        player.updateVolume(YTplayer.getVolume() / 100)
      }
      player.setCanChangeVolume(true)
    } else if (H5player && !!H5player.readyState) {
      state = (H5player.paused
        ? PlaybackState.PAUSED
        : PlaybackState.PLAYING)
      track.length = H5player.duration * 1000000

      if (H5player.duration) {
        if (delayedSeek) {
          H5player.currentTime = delayedSeek
          delayedSeek = null
        } else if (state === PlaybackState.PLAYING) {
          setProgress(document.URL, H5player.currentTime, H5player.duration)
        }
        player.setTrackPosition(H5player.currentTime * 1000000)
        player.setCanSeek(true)
      } else {
        player.setCanSeek(false)
      }

      if (H5player.muted) {
        player.updateVolume(0)
      } else {
        player.updateVolume(H5player.volume)
      }
      player.setCanChangeVolume(true)
    } else if (H5player) {
      state = PlaybackState.PAUSED
    }

    const elm = (document.querySelector('.thumbnail img') ||
               document.querySelector('.fixed-header-logo img'))
    if (elm) {
      track.artLocation = elm.src
    }

    if (YTplayer || H5player) {
      const pos = document.title.lastIndexOf('|')
      if (pos === -1) {
        track.title = document.title
      } else {
        track.title = document.title.substr(0, pos - 1).trim()
        track.artist = document.title.substr(pos + 1).trim()
      }
    }

    player.setTrack(track)
    player.setPlaybackState(state)
    player.setCanPause(state === PlaybackState.PLAYING)
    player.setCanPlay(state === PlaybackState.PAUSED)

    // Schedule the next update
    setTimeout(this.update.bind(this), 500)
  }

  // Handler of playback actions
  WebApp._onActionActivated = function (emitter, name, param) {
    if (YTplayer) {
      switch (name) {
        case PlayerAction.TOGGLE_PLAY: {
          const state = YTplayer.getPlayerState()
          if (state !== 1 && state !== 3) {
            YTplayer.playVideo()
          } else {
            YTplayer.pauseVideo()
          }
          break
        }
        case PlayerAction.PLAY:
          YTplayer.playVideo()
          break
        case PlayerAction.PAUSE:
          YTplayer.pauseVideo()
          break
        case PlayerAction.STOP:
          YTplayer.stopVideo()
          break
        case PlayerAction.SEEK:
          YTplayer.seekTo(param / 1000000, true)
          break
        case PlayerAction.CHANGE_VOLUME:
          YTplayer.setVolume(param * 100)
          if (YTplayer.isMuted() && param !== 0) {
            YTplayer.unMute()
          }
          break
      }
    } else if (H5player) {
      switch (name) {
        case PlayerAction.TOGGLE_PLAY:
          if (H5player.paused) {
            H5player.play()
          } else {
            H5player.pause()
          }
          break
        case PlayerAction.PLAY:
          H5player.play()
          break
        case PlayerAction.PAUSE:
          H5player.pause()
          break
        case PlayerAction.STOP:
          H5player.pause()
          break
        case PlayerAction.SEEK:
          H5player.currentTime = param / 1000000
          break
        case PlayerAction.CHANGE_VOLUME:
          H5player.volume = param
          if (H5player.muted && param !== 0) {
            H5player.muted = false
          }
          break
      }
    }
  }

  WebApp.start()
})(this) // function(Nuvola)
