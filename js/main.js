(function () {
  "use strict";

  /**
   * Pablo Escudero 式底层逻辑：
   * 1. 列表由 transform: translateY(-scrollOffsetPx) 驱动，不用原生 scroll，避免回流与抽动
   * 2. 当前项仅 opacity:0 标记，不改变尺寸，避免 collapse 导致的布局跳动
   * 3. 当前索引由 scrollOffset 唯一推导；滑动结束做一次 snap，不反复补偿
   */

  var data = window.PHOTOS_DATA || [];
  var currentIndex = 0;
  var isAnimating = false;
  var transitionDuration = 400;
  /** 位移+缩放同一缓动：贝塞尔，观感为「边移边放大」 */
  var transitionEase = "cubic-bezier(0.45, 0.05, 0.25, 1)";
  var scrollEndTimer = null;
  var transitionLockUntil = 0;
  var rafScheduled = false;
  var lastTriggerTime = 0;
  var SCROLL_END_DELAY = 220;
  var TRANSITION_LOCK_MS = 480;
  var SNAP_LOCK_MS = 280;
  var TRIGGER_THROTTLE_MS = 280;
  /** 桌面滚轮阻尼（略提高，避免过钝）；触摸单独处理 */
  var WHEEL_DAMP = 0.38;
  var TOUCH_DAMP = 0.55;
  /** 动画进行中由滚动推导的「待切换」索引，解决快速滑动时漏切 / 错乱 */
  var pendingTargetIndex = null;
  var touchLastY = null;
  var touchScrollRaf = null;

  var thumbListEl = document.getElementById("thumbList");
  var thumbListInner = document.getElementById("thumbListInner");
  var mainImageWrap = document.getElementById("mainImageWrap");
  var mainImage = document.getElementById("mainImage");
  var captionLine1 = document.getElementById("captionLine1");
  var captionLine2 = document.getElementById("captionLine2");
  var transitionLayer = document.getElementById("transitionLayer");
  var headerEl = document.querySelector(".site-header");

  var scrollOffsetPx = 0;
  var maxScroll = 0;
  var itemTops = [];
  var itemHeights = [];

  function getTriggerY() {
    return headerEl ? headerEl.getBoundingClientRect().bottom + 2 : 80;
  }

  function getThumbWidthPx() {
    var first = thumbListInner && thumbListInner.querySelector(".thumb-item");
    if (first) return first.getBoundingClientRect().width;
    return 72;
  }

  function updateLandscapeClass() {
    if (!mainImageWrap || !mainImage) return;
    if (mainImage.naturalWidth > 0 && mainImage.naturalWidth >= mainImage.naturalHeight) {
      mainImageWrap.classList.add("is-landscape");
    } else {
      mainImageWrap.classList.remove("is-landscape");
    }
  }

  /** 用同索引的缩略图判断是否横图并立即应用，避免等大图加载 */
  function setLandscapeFromIndex(index) {
    if (!mainImageWrap) return;
    var thumb = thumbListInner.querySelector('.thumb-item[data-index="' + index + '"] img');
    if (thumb && thumb.naturalWidth > 0 && thumb.naturalWidth >= thumb.naturalHeight) {
      mainImageWrap.classList.add("is-landscape");
    } else if (thumb && thumb.naturalWidth > 0) {
      mainImageWrap.classList.remove("is-landscape");
    }
  }

  function renderThumbnails() {
    if (!thumbListInner || !data.length) return;
    thumbListInner.innerHTML = "";
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      var wrap = document.createElement("div");
      wrap.className = "thumb-item" + (i === currentIndex ? " is-current" : "");
      wrap.setAttribute("data-index", String(i));
      var img = document.createElement("img");
      img.src = item.src;
      img.alt = item.caption || "作品 " + (i + 1);
      /* 仅首屏附近 eager：缩略图与主图共用原图，过多 eager 会拖垮首屏 */
      img.loading = i < 6 ? "eager" : "lazy";
      img.decoding = "async";
      img.addEventListener("load", function (idx) {
        return function () { if (idx === currentIndex) setLandscapeFromIndex(idx); };
      }(i));
      wrap.appendChild(img);
      thumbListInner.appendChild(wrap);
    }
    measureItems();
  }

  function measureItems() {
    itemTops = [];
    itemHeights = [];
    var items = thumbListInner.querySelectorAll(".thumb-item");
    for (var i = 0; i < items.length; i++) {
      itemTops[i] = items[i].offsetTop;
      itemHeights[i] = items[i].offsetHeight;
    }
    var totalHeight = thumbListInner.scrollHeight;
    var listHeight = thumbListEl ? thumbListEl.clientHeight : 0;
    maxScroll = Math.max(0, totalHeight - listHeight);
  }

  function setScrollOffset(val) {
    scrollOffsetPx = Math.max(0, Math.min(val, maxScroll));
    if (thumbListInner) {
      thumbListInner.style.transform = "translate3d(0, " + -scrollOffsetPx + "px, 0)";
    }
  }

  /** 根据当前 scrollOffset 与触发线位置，计算应显示的索引 */
  function getIndexFromScrollOffset() {
    if (!itemTops.length || !thumbListEl) return 0;
    var triggerY = getTriggerY();
    var listRect = thumbListEl.getBoundingClientRect();
    var triggerInList = scrollOffsetPx + (triggerY - listRect.top);
    var i = 0;
    for (; i < itemTops.length; i++) {
      var top = itemTops[i];
      var bottom = top + itemHeights[i];
      if (triggerInList >= top && triggerInList < bottom) return i;
      if (triggerInList < top) return i > 0 ? i - 1 : 0;
    }
    return i > 0 ? i - 1 : 0;
  }

  function updateCurrentClass() {
    thumbListInner.querySelectorAll(".thumb-item").forEach(function (el) {
      var idx = parseInt(el.getAttribute("data-index"), 10);
      el.classList.toggle("is-current", idx === currentIndex);
    });
  }

  /** 按第一个空格分两行：第一行 0.8 字号，第二行 0.6 字号（由 CSS 控制） */
  function setCaptionTwoLines(caption, line1El, line2El) {
    if (!line1El || !line2El) return;
    var i = caption.indexOf(" ");
    if (i === -1) {
      line1El.textContent = caption;
      line2El.textContent = "";
    } else {
      line1El.textContent = caption.slice(0, i);
      line2El.textContent = caption.slice(i + 1);
    }
  }

  function setMainImage(index, noScroll) {
    if (index < 0 || index >= data.length) return;
    var item = data[index];
    currentIndex = index;
    if (thumbListInner.querySelector(".thumb-item")) {
      updateCurrentClass();
    } else {
      renderThumbnails();
    }
    setLandscapeFromIndex(index);
    mainImage.src = item.src;
    mainImage.alt = item.caption || "作品 " + (index + 1);
    setCaptionTwoLines(item.caption || "", captionLine1, captionLine2);
    if (!noScroll) snapScrollToIndex(index);
    if (mainImage.complete) updateLandscapeClass();
    else { setTimeout(updateLandscapeClass, 100); setTimeout(updateLandscapeClass, 400); }
  }

  /** 将列表滚动到使指定索引的项居中于触发线（与 getIndexFromScrollOffset 同一坐标系） */
  function snapScrollToIndex(index) {
    if (index < 0 || index >= itemTops.length) return;
    var triggerY = getTriggerY();
    var listRect = thumbListEl.getBoundingClientRect();
    var listTop = listRect.top;
    var centerY = itemTops[index] + itemHeights[index] / 2;
    var triggerInList = triggerY - listTop;
    var targetOffset = centerY - triggerInList;
    setScrollOffset(targetOffset);
  }

  function getRect(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  /** 缩略列表里某张图的真实显示矩形（与主图同一宽高比，避免用方槽压扁） */
  function getThumbImgRect(index) {
    var img = thumbListInner.querySelector('.thumb-item[data-index="' + index + '"] img');
    return img ? getRect(img) : null;
  }

  /**
   * 下一张图在 mainImageWrap 内 object-fit:contain 的显示矩形（左顶点与页面一致）
   * 与 CSS 中横图右对齐 / 移动端居中一致
   */
  function getContainRectInWrap(natW, natH, wrapRect, isLandscape, isMobile) {
    if (!natW || !natH || !wrapRect.w || !wrapRect.h) return null;
    var scale = Math.min(wrapRect.w / natW, wrapRect.h / natH);
    var iw = natW * scale;
    var ih = natH * scale;
    var x;
    var y = wrapRect.y + (wrapRect.h - ih) / 2;
    if (isLandscape && !isMobile) {
      x = wrapRect.x + wrapRect.w - iw;
    } else {
      x = wrapRect.x + (wrapRect.w - iw) / 2;
    }
    return { x: x, y: y, w: iw, h: ih };
  }

  /** 左顶点对齐 + 等比缩放：translate 与单一 scale，避免非等比压扁 */
  function uniformFlipTransform(start, end) {
    var sx = end.w / start.w;
    var sy = end.h / start.h;
    var s = Math.abs(sx - sy) < 0.02 ? sx : Math.min(sx, sy);
    return {
      dx: end.x - start.x,
      dy: end.y - start.y,
      s: s,
    };
  }

  /** 滑动结束：将最接近触发线中心的非当前项对齐到中心 */
  function snapToNearestItem() {
    if (isAnimating || Date.now() < transitionLockUntil) return;
    transitionLockUntil = Date.now() + SNAP_LOCK_MS;
    var triggerY = getTriggerY();
    var listRect = thumbListEl.getBoundingClientRect();
    var triggerInList = scrollOffsetPx + (triggerY - listRect.top);
    var bestIdx = 0;
    var bestDist = Infinity;
    for (var i = 0; i < itemTops.length; i++) {
      var center = itemTops[i] + itemHeights[i] / 2;
      var dist = Math.abs(center - triggerInList);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    snapScrollToIndex(bestIdx);
  }

  function getSlotRectForIndex(index) {
    return getThumbImgRect(index);
  }

  function checkTriggerAndTransition() {
    rafScheduled = false;
    var idx = getIndexFromScrollOffset();
    if (idx !== currentIndex && idx >= 0) {
      pendingTargetIndex = idx;
    }
    if (isAnimating) return;
    if (Date.now() < transitionLockUntil) return;
    if (Date.now() - lastTriggerTime < TRIGGER_THROTTLE_MS) return;
    if (pendingTargetIndex === null || pendingTargetIndex === currentIndex) return;
    lastTriggerTime = Date.now();
    var go = pendingTargetIndex;
    pendingTargetIndex = null;
    runTransition(go, null, true);
  }

  function onScrollEnd() {
    if (!isAnimating && Date.now() >= transitionLockUntil) snapToNearestItem();
  }

  /** 统一处理虚拟列表位移：滚轮（阻尼）与触摸（像素） */
  function applyScrollDelta(rawDelta, opts) {
    opts = opts || {};
    var delta = rawDelta;
    if (opts.fromWheel) {
      var mode = opts.deltaMode != null ? opts.deltaMode : 0;
      if (mode === 1) delta *= 24;
      else if (mode === 2) delta *= 400;
      delta *= WHEEL_DAMP;
    } else if (opts.fromTouch) {
      delta *= TOUCH_DAMP;
    }
    if (scrollOffsetPx <= 0 && delta < 0 && data.length > 1) {
      setScrollOffset(maxScroll);
      runTransition((currentIndex - 1 + data.length) % data.length, null, true);
      return;
    }
    if (scrollOffsetPx >= maxScroll - 2 && delta > 0 && data.length > 1) {
      setScrollOffset(0);
      runTransition((currentIndex + 1) % data.length, null, true);
      return;
    }
    setScrollOffset(scrollOffsetPx + delta);
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
    scrollEndTimer = setTimeout(onScrollEnd, SCROLL_END_DELAY);
    /* 动画进行中也要 rAF，持续更新 pendingTargetIndex，避免快滑结束只对上最后一张 */
    if (!rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(checkTriggerAndTransition);
    }
  }

  function onWheel(e) {
    if (e.cancelable) e.preventDefault();
    applyScrollDelta(e.deltaY, { fromWheel: true, deltaMode: e.deltaMode });
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchLastY = e.touches[0].clientY;
    if (scrollEndTimer) clearTimeout(scrollEndTimer);
  }

  function onTouchMove(e) {
    if (touchLastY == null || e.touches.length !== 1) return;
    var y = e.touches[0].clientY;
    var dy = touchLastY - y;
    touchLastY = y;
    if (e.cancelable) e.preventDefault();
    if (touchScrollRaf) cancelAnimationFrame(touchScrollRaf);
    touchScrollRaf = requestAnimationFrame(function () {
      touchScrollRaf = null;
      applyScrollDelta(dy, { fromTouch: true });
    });
  }

  function onTouchEnd() {
    touchLastY = null;
    if (touchScrollRaf) {
      cancelAnimationFrame(touchScrollRaf);
      touchScrollRaf = null;
    }
    scrollEndTimer = setTimeout(onScrollEnd, SCROLL_END_DELAY);
  }

  function createClone(src, rect) {
    var wrap = document.createElement("div");
    wrap.className = "clone";
    wrap.style.cssText =
      "left:" +
      rect.x +
      "px;top:" +
      rect.y +
      "px;width:" +
      rect.w +
      "px;height:" +
      rect.h +
      "px;transform-origin:0 0;overflow:hidden;";
    var img = document.createElement("img");
    img.src = src;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = "contain";
    img.style.objectPosition = "left top";
    img.decoding = "async";
    wrap.appendChild(img);
    return wrap;
  }

  function runTransition(nextIndex, callback, fromWheel) {
    if (nextIndex === currentIndex || isAnimating || !data[nextIndex]) return;
    if (!fromWheel) pendingTargetIndex = null;
    isAnimating = true;
    transitionLockUntil = Date.now() + transitionDuration + 400;

    var prevIndex = currentIndex;
    var toThumb = thumbListInner.querySelector('.thumb-item[data-index="' + nextIndex + '"]');
    if (!toThumb) {
      isAnimating = false;
      if (callback) callback();
      return;
    }
    var fromThumbRect = getThumbImgRect(prevIndex);
    var nextThumbRect = getThumbImgRect(nextIndex);
    if (!fromThumbRect || !nextThumbRect) {
      isAnimating = false;
      if (callback) callback();
      return;
    }
    if (!fromWheel) {
      currentIndex = nextIndex;
      updateCurrentClass();
    }

    var nextSrc = data[nextIndex].src;
    var nextImg = new Image();

    function startAnim() {
      var mainImgRect = getRect(mainImage);
      setLandscapeFromIndex(nextIndex);
      var wrapRect = getRect(mainImageWrap);
      var isMobile = window.matchMedia("(max-width: 900px)").matches;
      var endMainRect;
      if (nextImg.naturalWidth > 0 && nextImg.naturalHeight > 0) {
        endMainRect = getContainRectInWrap(
          nextImg.naturalWidth,
          nextImg.naturalHeight,
          wrapRect,
          mainImageWrap.classList.contains("is-landscape"),
          isMobile
        );
      }
      if (!endMainRect) {
        endMainRect = mainImgRect;
      }

      var outT = uniformFlipTransform(mainImgRect, fromThumbRect);
      var inT = uniformFlipTransform(nextThumbRect, endMainRect);

      var cloneOut = createClone(data[prevIndex].src, mainImgRect);
      cloneOut.style.zIndex = "1";
      cloneOut.style.willChange = "transform";
      var cloneIn = createClone(nextSrc, nextThumbRect);
      cloneIn.style.zIndex = "2";
      cloneIn.style.willChange = "transform";
      transitionLayer.appendChild(cloneOut);
      transitionLayer.appendChild(cloneIn);

      var imgIn = cloneIn.querySelector("img");
      if (imgIn && !imgIn.complete) {
        imgIn.style.opacity = "0";
        imgIn.addEventListener("load", function onLoad() {
          imgIn.removeEventListener("load", onLoad);
          imgIn.style.opacity = "1";
        });
      }

      mainImage.style.visibility = "hidden";
      cloneOut.style.transition = "none";
      cloneIn.style.transition = "none";
      cloneOut.style.transform = "translate3d(0,0,0) scale3d(1,1,1)";
      cloneIn.style.transform = "translate3d(0,0,0) scale3d(1,1,1)";

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          cloneOut.style.transition = "transform " + transitionDuration + "ms " + transitionEase;
          cloneIn.style.transition = "transform " + transitionDuration + "ms " + transitionEase;
          cloneOut.style.transform =
            "translate3d(" + outT.dx + "px," + outT.dy + "px,0) scale3d(" + outT.s + "," + outT.s + ",1)";
          cloneIn.style.transform =
            "translate3d(" + inT.dx + "px," + inT.dy + "px,0) scale3d(" + inT.s + "," + inT.s + ",1)";
        });
      });

      setTimeout(function () {
        cloneOut.style.willChange = "";
        cloneIn.style.willChange = "";
        transitionLayer.removeChild(cloneOut);
        transitionLayer.removeChild(cloneIn);
        mainImage.style.visibility = "";
        currentIndex = nextIndex;
        updateCurrentClass();
        setLandscapeFromIndex(nextIndex);
        mainImage.src = nextSrc;
        mainImage.alt = data[nextIndex].caption || "作品 " + (nextIndex + 1);
        setCaptionTwoLines(data[nextIndex].caption || "", captionLine1, captionLine2);
        if (mainImage.complete) updateLandscapeClass();
        else { setTimeout(updateLandscapeClass, 100); setTimeout(updateLandscapeClass, 400); }
        snapScrollToIndex(nextIndex);
        isAnimating = false;
        /* 快滑时：动画期间列表已滚到更远的项，补切到 pending 目标 */
        var flush = pendingTargetIndex;
        pendingTargetIndex = null;
        if (flush !== null && flush !== currentIndex && flush >= 0 && flush < data.length) {
          requestAnimationFrame(function () {
            runTransition(flush, callback, true);
          });
        } else if (callback) {
          callback();
        }
      }, transitionDuration);
    }

    nextImg.onload = startAnim;
    nextImg.onerror = startAnim;
    nextImg.src = nextSrc;
    if (nextImg.complete) startAnim();
  }

  function onThumbClick(e) {
    var item = e.target.closest(".thumb-item");
    if (!item || item.classList.contains("is-current")) return;
    var index = parseInt(item.getAttribute("data-index"), 10);
    runTransition(index, null, false);
  }

  function onKeyDown(e) {
    if (isAnimating) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight")
      runTransition((currentIndex + 1) % data.length, null, false);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft")
      runTransition((currentIndex - 1 + data.length) % data.length, null, false);
  }

  function onResize() {
    measureItems();
    setScrollOffset(scrollOffsetPx);
  }

  function init() {
    if (!data.length) return;
    renderThumbnails();
    setMainImage(0);
    mainImage.addEventListener("load", updateLandscapeClass);
    thumbListEl.addEventListener("click", onThumbClick);
    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    var scrollHost = document.querySelector(".works-page");
    if (scrollHost) {
      scrollHost.addEventListener("touchstart", onTouchStart, { passive: true });
      scrollHost.addEventListener("touchmove", onTouchMove, { passive: false });
      scrollHost.addEventListener("touchend", onTouchEnd, { passive: true });
      scrollHost.addEventListener("touchcancel", onTouchEnd, { passive: true });
    }
  }

  init();
})();
