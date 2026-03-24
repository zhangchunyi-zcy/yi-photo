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
  /** 防止同一次切换里 startAnim / setTimeout 重复执行（缓存图会 onload + complete 各触发一次） */
  var activeTransitionId = 0;
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
  /** 缩略图分批加载后高度变化，需重算 maxScroll，否则易误判「到底」 */
  var remeasureThumbTimer = null;
  /** 移动端同时请求过多缩略图会触发连接限制/失败 → 破图；按距当前项由近到远分批赋 src */
  var THUMB_RAF_BATCH = 4;
  var THUMB_SYNC_FIRST = 3;

  function buildCentrifugalOrder(center, n) {
    var o = [center];
    for (var d = 1; d < n; d++) {
      if (center + d < n) o.push(center + d);
      if (center - d >= 0) o.push(center - d);
    }
    return o;
  }

  function assignThumbImg(img, item) {
    if (!img || img.getAttribute("data-thumb-assigned") === "1") return;
    img.setAttribute("data-thumb-assigned", "1");
    img.decoding = "async";
    if (item.thumb) {
      img.onerror = function () {
        img.onerror = null;
        img.src = item.src;
      };
    }
    img.src = item.thumb || item.src;
  }

  function ensureThumbLoaded(index) {
    if (index < 0 || index >= data.length || !thumbListInner) return;
    var wrap = thumbListInner.querySelector('.thumb-item[data-index="' + index + '"]');
    if (!wrap) return;
    assignThumbImg(wrap.querySelector("img"), data[index]);
  }

  function prefetchThumbsAround(center) {
    var k;
    for (k = center - 2; k <= center + 16; k++) {
      ensureThumbLoaded(k);
    }
  }

  function startThumbPump(center) {
    var order = buildCentrifugalOrder(center, data.length);
    var qi = 0;
    var syncEnd = Math.min(THUMB_SYNC_FIRST, order.length);
    for (; qi < syncEnd; qi++) {
      ensureThumbLoaded(order[qi]);
    }
    function pump() {
      var b = 0;
      for (; b < THUMB_RAF_BATCH && qi < order.length; b++, qi++) {
        ensureThumbLoaded(order[qi]);
      }
      if (qi < order.length) requestAnimationFrame(pump);
    }
    if (qi < order.length) requestAnimationFrame(pump);
  }

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
      img.alt = item.caption || "作品 " + (i + 1);
      img.addEventListener("load", function (idx) {
        return function () {
          if (idx === currentIndex) setLandscapeFromIndex(idx);
          scheduleRemeasureThumbs();
        };
      }(i));
      wrap.appendChild(img);
      thumbListInner.appendChild(wrap);
    }
    measureItems();
    startThumbPump(currentIndex);
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

  function scheduleRemeasureThumbs() {
    if (remeasureThumbTimer) clearTimeout(remeasureThumbTimer);
    remeasureThumbTimer = setTimeout(function () {
      remeasureThumbTimer = null;
      measureItems();
      setScrollOffset(scrollOffsetPx);
    }, 40);
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
    mainImage.alt = item.caption || "作品 " + (index + 1);
    setCaptionTwoLines(item.caption || "", captionLine1, captionLine2);
    if (!noScroll) snapScrollToIndex(index);

    prefetchThumbsAround(index);

    /* 首屏先显示压缩图；原图稍后再拉，避免与缩略图首波争抢带宽 */
    mainImage.onerror = null;
    if (item.thumb) {
      mainImage.src = item.thumb;
      mainImage.onerror = function () {
        mainImage.onerror = null;
        mainImage.src = item.src;
        updateLandscapeClass();
      };
    } else {
      mainImage.src = item.src;
    }
    var preloadFull = new Image();
    var capIdx = index;
    preloadFull.onload = function () {
      if (currentIndex === capIdx) {
        mainImage.src = item.src;
        updateLandscapeClass();
      }
    };
    function kickPreloadFull() {
      preloadFull.src = item.src;
    }
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(kickPreloadFull, { timeout: 2000 });
    } else {
      setTimeout(kickPreloadFull, 120);
    }

    if (mainImage.complete) updateLandscapeClass();
    else mainImage.addEventListener("load", updateLandscapeClass, { once: true });
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
    prefetchThumbsAround(bestIdx);
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
    /* 不在列表首尾做「循环到另一端 / 换张」，避免滑到中途因 maxScroll 未更新误触「到底」后跳回开头 */
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
    var nextThumbSrc = data[nextIndex].thumb || nextSrc;
    var thisTransitionId = ++activeTransitionId;

    ensureThumbLoaded(nextIndex);
    ensureThumbLoaded(prevIndex);

    var fullImg = new Image();
    fullImg.src = nextSrc;

    var thumbImgEl = thumbListInner.querySelector('.thumb-item[data-index="' + nextIndex + '"] img');
    var natW = 0;
    var natH = 0;
    if (fullImg.complete && fullImg.naturalWidth > 0) {
      natW = fullImg.naturalWidth;
      natH = fullImg.naturalHeight;
    } else if (thumbImgEl && thumbImgEl.naturalWidth > 0) {
      natW = thumbImgEl.naturalWidth;
      natH = thumbImgEl.naturalHeight;
    }

    while (transitionLayer.firstChild) {
      transitionLayer.removeChild(transitionLayer.firstChild);
    }

    var mainImgRect = getRect(mainImage);
    setLandscapeFromIndex(nextIndex);
    var wrapRect = getRect(mainImageWrap);
    var isMobile = window.matchMedia("(max-width: 900px)").matches;
    var endMainRect = null;
    if (natW > 0 && natH > 0) {
      endMainRect = getContainRectInWrap(
        natW,
        natH,
        wrapRect,
        mainImageWrap.classList.contains("is-landscape"),
        isMobile
      );
    }
    if (!endMainRect) {
      endMainRect = { x: wrapRect.x, y: wrapRect.y, w: wrapRect.w, h: wrapRect.h };
    }

    var outT = uniformFlipTransform(mainImgRect, fromThumbRect);
    var inT = uniformFlipTransform(nextThumbRect, endMainRect);

    var outSrc =
      mainImage.getAttribute("src") ||
      data[prevIndex].thumb ||
      data[prevIndex].src;
    var cloneOut = createClone(outSrc, mainImgRect);
    cloneOut.style.zIndex = "1";
    cloneOut.style.willChange = "transform";

    /* 入场必须与原先一致：克隆层在缩略槽位置且内容填满槽，再 transform 到主图区；
       勿把大图绝对定位到主图区（与左侧裁切框不重叠时会完全看不见）。 */
    var cloneIn = createClone(nextThumbSrc, nextThumbRect);
    cloneIn.style.zIndex = "2";
    cloneIn.style.willChange = "transform";
    transitionLayer.appendChild(cloneOut);
    transitionLayer.appendChild(cloneIn);

    var imgIn = cloneIn.querySelector("img");
    if (imgIn && !imgIn.complete) {
      imgIn.style.opacity = "0";
      imgIn.addEventListener("load", function onImgInLoad() {
        imgIn.removeEventListener("load", onImgInLoad);
        imgIn.style.opacity = "1";
      });
    }

    mainImage.style.visibility = "hidden";
    mainImage.style.opacity = "0";
    mainImage.setAttribute("data-transitioning", "1");
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
      if (thisTransitionId !== activeTransitionId) return;
      cloneOut.style.willChange = "";
      cloneIn.style.willChange = "";
      if (cloneOut.parentNode === transitionLayer) transitionLayer.removeChild(cloneOut);
      if (cloneIn.parentNode === transitionLayer) transitionLayer.removeChild(cloneIn);

      currentIndex = nextIndex;
      updateCurrentClass();
      setLandscapeFromIndex(nextIndex);
      setCaptionTwoLines(data[nextIndex].caption || "", captionLine1, captionLine2);
      snapScrollToIndex(nextIndex);

      mainImage.onerror = null;
      mainImage.src = nextThumbSrc;
      mainImage.alt = data[nextIndex].caption || "作品 " + (nextIndex + 1);
      mainImage.onerror = function () {
        mainImage.onerror = null;
        mainImage.src = nextSrc;
        updateLandscapeClass();
      };

      var capturedId = thisTransitionId;
      function upgradeToFull() {
        if (activeTransitionId !== capturedId) return;
        mainImage.src = nextSrc;
        updateLandscapeClass();
      }
      if (fullImg.complete && fullImg.naturalWidth > 0) {
        upgradeToFull();
      } else {
        fullImg.onload = upgradeToFull;
        fullImg.onerror = function () {};
      }

      if (mainImage.complete) updateLandscapeClass();
      else mainImage.addEventListener("load", updateLandscapeClass, { once: true });

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          mainImage.style.visibility = "";
          mainImage.style.opacity = "";
          mainImage.removeAttribute("data-transitioning");
          isAnimating = false;
          var flush = pendingTargetIndex;
          pendingTargetIndex = null;
          if (flush !== null && flush !== currentIndex && flush >= 0 && flush < data.length) {
            requestAnimationFrame(function () {
              runTransition(flush, callback, true);
            });
          } else if (callback) {
            callback();
          }
        });
      });
    }, transitionDuration);
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
