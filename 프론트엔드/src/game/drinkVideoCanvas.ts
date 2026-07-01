type WebKitVideoElement = HTMLVideoElement & {
  webkitSetPresentationMode?: (mode: 'inline' | 'fullscreen' | 'picture-in-picture') => void;
  webkitPresentationMode?: 'inline' | 'fullscreen' | 'picture-in-picture';
  webkitDisplayingFullscreen?: boolean;
  webkitExitFullscreen?: () => void;
  disableRemotePlayback?: boolean;
};

/** iOS WebView — 생성·표시·재생 직전마다 inline + controls 차단 */
export function applyDrinkVideoInlineAttributes(video: HTMLVideoElement) {
  const webkitVideo = video as WebKitVideoElement;
  video.preload = 'auto';
  video.controls = false;
  video.autoplay = false;
  video.muted = true;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('x5-playsinline', 'true');
  video.setAttribute('x5-video-player-type', 'h5');
  video.setAttribute('x5-video-player-fullscreen', 'false');
  video.setAttribute('x-webkit-airplay', 'deny');
  video.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
  video.setAttribute('disableRemotePlayback', '');
  video.removeAttribute('controls');
  if ('disableRemotePlayback' in video) {
    webkitVideo.disableRemotePlayback = true;
  }
  webkitVideo.webkitSetPresentationMode?.('inline');
}

export function enforceDrinkVideoInline(video: HTMLVideoElement) {
  const preserveAudio = !video.muted && video.volume > 0;
  applyDrinkVideoInlineAttributes(video);
  if (preserveAudio) {
    video.muted = false;
    video.removeAttribute('muted');
  }
  forceInlineVideo(video);

  const webkitVideo = video as WebKitVideoElement;
  const mode = webkitVideo.webkitPresentationMode;
  if (mode && mode !== 'inline') {
    console.warn('[drink-video] presentation-mode', {
      mode,
      currentTime: video.currentTime,
      controls: video.controls,
    });
    webkitVideo.webkitSetPresentationMode?.('inline');
  }

  if (video.controls) {
    console.warn('[drink-video] controls-reenabled', {
      currentTime: video.currentTime,
    });
    video.controls = false;
    video.removeAttribute('controls');
  }
}

/** 100% 대기 — display 붙인 뒤 첫 프레임만 표시 (재생 없음) */
export function prepareDrinkVideoFirstFramePreview(video: HTMLVideoElement) {
  enforceDrinkVideoInline(video);
  video.loop = false;
  video.pause();
  video.currentTime = 0;
  video.muted = true;
  video.setAttribute('muted', '');

  const seekToStart = () => {
    video.pause();
    video.currentTime = 0;
  };

  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    seekToStart();
  } else {
    video.addEventListener('loadeddata', seekToStart, { once: true });
  }

  console.log('[drink-video first-frame-preview]', {
    muted: video.muted,
    paused: video.paused,
    currentTime: video.currentTime,
    readyState: video.readyState,
    clientWidth: video.clientWidth,
    clientHeight: video.clientHeight,
  });
}

/** 커피마시기 클릭 — unmute 후 play (동기 호출, play 직전) */
export function prepareDrinkVideoForAudiblePlay(video: HTMLVideoElement) {
  const webkitVideo = video as WebKitVideoElement;
  video.controls = false;
  video.autoplay = false;
  video.playsInline = true;
  video.disablePictureInPicture = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');
  video.setAttribute('x5-playsinline', 'true');
  video.setAttribute('x5-video-player-type', 'h5');
  video.setAttribute('x5-video-player-fullscreen', 'false');
  video.removeAttribute('controls');
  webkitVideo.webkitSetPresentationMode?.('inline');

  video.muted = false;
  video.defaultMuted = false;
  video.volume = 1;
  video.currentTime = 0;
  video.removeAttribute('muted');
}

export function logDrinkVideoDisplayStyle(video: HTMLVideoElement) {
  const webkitVideo = video as WebKitVideoElement;
  console.log('[drink-video display-style]', {
    width: video.style.width,
    height: video.style.height,
    clientWidth: video.clientWidth,
    clientHeight: video.clientHeight,
    controls: video.controls,
    muted: video.muted,
    autoplay: video.autoplay,
    playsInline: video.playsInline,
    presentationMode: webkitVideo.webkitPresentationMode ?? null,
  });
}

export function configureDrinkVideoDisplay(video: HTMLVideoElement) {
  enforceDrinkVideoInline(video);
  video.className = 'plant-scene__drink-video';
  video.removeAttribute('style');
  video.style.position = 'absolute';
  video.style.inset = '0';
  video.style.width = '100%';
  video.style.height = '100%';
  video.style.minWidth = '100%';
  video.style.minHeight = '100%';
  video.style.maxWidth = '100%';
  video.style.maxHeight = '100%';
  video.style.objectFit = 'cover';
  video.style.objectPosition = 'center center';
  video.style.opacity = '1';
  video.style.display = 'block';
  video.style.visibility = 'visible';
  video.style.transform = 'none';
  video.style.zIndex = '2';
  video.style.pointerEvents = 'none';
  video.style.background = 'transparent';
  logDrinkVideoDisplayStyle(video);
}

/** display 스타일 적용 후 DOM에 붙임 — preload 2px 깜빡임 방지 */
export function attachVideoToDisplayHost(video: HTMLVideoElement, host: HTMLElement) {
  configureDrinkVideoDisplay(video);
  if (video.parentElement === host) return;
  if (video.parentElement) {
    video.remove();
  }
  host.appendChild(video);
}

export function configureDrinkVideoEngine(video: HTMLVideoElement) {
  enforceDrinkVideoInline(video);
  video.muted = true;
  video.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;opacity:0.001;pointer-events:none;z-index:0;object-fit:contain;';
}

const HIDDEN_PRELOAD_STYLE =
  'position:absolute;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;';

export function configureHiddenPreloadVideo(video: HTMLVideoElement) {
  enforceDrinkVideoInline(video);
  video.muted = true;
  video.style.cssText = HIDDEN_PRELOAD_STYLE;
}

export function attachVideoToHost(video: HTMLVideoElement, host: HTMLElement) {
  if (video.parentElement !== host) {
    host.prepend(video);
  }
}

export function detachDrinkVideo(video: HTMLVideoElement) {
  video.pause();
  video.removeAttribute('src');
  video.load();
  video.remove();
}

export function forceInlineVideo(video: HTMLVideoElement) {
  const webkitVideo = video as WebKitVideoElement;
  webkitVideo.webkitSetPresentationMode?.('inline');
  if (webkitVideo.webkitDisplayingFullscreen) {
    webkitVideo.webkitExitFullscreen?.();
  }
}

export function guardInlinePresentation(video: HTMLVideoElement) {
  const keepInline = () => {
    enforceDrinkVideoInline(video);
  };

  const onBeginFullscreen = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    console.warn('[drink-video event] webkitbeginfullscreen', video.currentTime);
    keepInline();
  };

  const onPresentationModeChanged = () => {
    const webkitVideo = video as WebKitVideoElement;
    console.log('[drink-video event] webkitpresentationmodechanged', {
      currentTime: video.currentTime,
      mode: webkitVideo.webkitPresentationMode ?? null,
      controls: video.controls,
    });
    keepInline();
  };

  video.addEventListener('webkitbeginfullscreen', onBeginFullscreen);
  video.addEventListener('webkitpresentationmodechanged', onPresentationModeChanged);
  video.addEventListener('play', keepInline);
  video.addEventListener('playing', keepInline);

  keepInline();
  const intervalId = window.setInterval(keepInline, 250);

  return () => {
    window.clearInterval(intervalId);
    video.removeEventListener('webkitbeginfullscreen', onBeginFullscreen);
    video.removeEventListener('webkitpresentationmodechanged', onPresentationModeChanged);
    video.removeEventListener('play', keepInline);
    video.removeEventListener('playing', keepInline);
  };
}

export function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || width <= 0 || height <= 0) return false;

  const scale = Math.max(width / vw, height / vh);
  const dw = vw * scale;
  const dh = vh * scale;
  const dx = (width - dw) / 2;
  const dy = (height - dh) / 2;
  ctx.drawImage(video, dx, dy, dw, dh);
  return true;
}
