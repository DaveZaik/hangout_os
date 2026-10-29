(function () {
  console.log("Chibi script loaded");
  const POSES = [
    "idle",
    "walk_1",
    "walk_2",
    "run_1",
    "run_2",
    "jump",
    "fall",
    "getup",
    "grabbed",
    "sit",
    "wave",
    "dance1",
    "dance2",
    "dance3",
    "dance4",
    "peek",
  ];
  const WALK_FPS = 7;
  const RUN_FPS = 10;
  const DANCE_FPS = 4;
  const BASE_HEIGHT_DESKTOP = 64;
  const BASE_HEIGHT_MOBILE = 56;

  let charEl = null;
  let spriteEl = null;
  let shadowEl = null;
  let bubbleEl = null;
  let bubbleTextEl = null;
  let loadedPoses = {};
  let currentPose = "idle";
  let poseFrame = 0;
  let poseTimer = 0;
  let currentBehaviour = "idle";
  let behaviourTimer = 0;
  let posX = 20;
  let posY = 60;
  let targetX = 20;
  let targetY = 60;
  let facingRight = true;
  let velocityY = 0;
  let isJumping = false;
  let isMoonwalking = false;
  let squashX = 1;
  let squashY = 1;
  let bobPhase = 0;
  let tiltAngle = 0;
  let shadowScale = 1;
  let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let isMobile = innerWidth < 700;
  let rafId = null;
  let lastTime = 0;
  let speechTimer = 0;
  let currentPhrase = "";
  let phraseIndex = 0;
  let personality = null;
  let baseHeight = isMobile ? BASE_HEIGHT_MOBILE : BASE_HEIGHT_DESKTOP;
  let baseH = 64;
  let isHeld = false;
  let holdTimer = null;
  let pointerX = 0;
  let pointerY = 0;
  let pointerPrevX = 0;
  let pointerPrevY = 0;
  let velocityX = 0;
  let isThrown = false;
  let isDazed = false;
  let dazedTimer = 0;
  let isFrozen = false;
  let frozenTimer = 0;
  let isOnPlatform = false;
  let platformEl = null;
  let isPeeking = false;
  let peekTimer = 0;
  let peekTarget = null;
  let walkIdentical = false;
  let runIdentical = false;

  function getSlug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function compareImages(img1, img2) {
    if (!img1 || !img2) return false;
    const cvs = document.createElement("canvas");
    cvs.width = 32;
    cvs.height = 32;
    const ctx = cvs.getContext("2d");
    ctx.drawImage(img1, 0, 0, 32, 32);
    const d1 = ctx.getImageData(0, 0, 32, 32).data;
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(img2, 0, 0, 32, 32);
    const d2 = ctx.getImageData(0, 0, 32, 32).data;
    let diff = 0;
    for (let i = 0; i < d1.length; i += 4) {
      diff += Math.abs(d1[i] - d2[i]) + Math.abs(d1[i + 1] - d2[i + 1]) + Math.abs(d1[i + 2] - d2[i + 2]) + Math.abs(d1[i + 3] - d2[i + 3]);
    }
    return diff < 1000;
  }

  function loadPoses(slug) {
    loadedPoses = {};
    const promises = POSES.map((pose) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedPoses[pose] = img;
          resolve();
        };
        img.onerror = () => {
          loadedPoses[pose] = null;
          resolve();
        };
        img.src = `img/chars/${slug}/${pose}.png`;
      });
    });
    return Promise.all(promises).then(() => {
      walkIdentical = compareImages(loadedPoses["walk_1"], loadedPoses["walk_2"]);
      runIdentical = compareImages(loadedPoses["run_1"], loadedPoses["run_2"]);
    });
  }

  function getPose() {
    const img = loadedPoses[currentPose];
    if (img) return img;
    return loadedPoses["idle"];
  }

  function updatePose(dt) {
    poseTimer += dt;
    let fps = 0;
    if (currentBehaviour === "walk" || currentBehaviour === "moonwalk") {
      fps = WALK_FPS;
    } else if (currentBehaviour === "run") {
      fps = RUN_FPS;
    } else if (currentBehaviour === "dance") {
      fps = DANCE_FPS;
    }

    if (fps > 0 && poseTimer > 1000 / fps) {
      poseTimer = 0;
      if (currentBehaviour === "walk" || currentBehaviour === "moonwalk") {
        currentPose = currentPose === "walk_1" ? "walk_2" : "walk_1";
      } else if (currentBehaviour === "run") {
        currentPose = currentPose === "run_1" ? "run_2" : "run_1";
      } else if (currentBehaviour === "dance") {
        const dancePoses = ["dance1", "dance2", "dance3", "dance4"];
        const idx = dancePoses.indexOf(currentPose);
        currentPose = dancePoses[(idx + 1) % dancePoses.length];
      }
    }
  }

  function pickBehaviour() {
    const prevBehaviour = currentBehaviour;
    const weights = personality.behaviourWeights;
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [beh, w] of Object.entries(weights)) {
      rand -= w;
      if (rand <= 0) {
        currentBehaviour = beh;
        break;
      }
    }

    if (prevBehaviour === "dance" && currentBehaviour !== "dance") {
      if (window.SFX) window.SFX.stopLoop("dance");
    }

    if (currentBehaviour === "idle") {
      currentPose = "idle";
    } else if (currentBehaviour === "sit" || currentBehaviour === "nap") {
      currentPose = "sit";
    } else if (currentBehaviour === "wave") {
      currentPose = "wave";
    } else if (currentBehaviour === "jump") {
      currentPose = "jump";
      isJumping = true;
      velocityY = -12;
    } else if (currentBehaviour === "dance") {
      currentPose = "dance1";
      if (window.SFX) window.SFX.startLoop("dance");
    } else if (currentBehaviour === "moonwalk") {
      currentPose = "walk_1";
      isMoonwalking = true;
    } else {
      currentPose = "walk_1";
    }

    const minX = 5;
    const maxX = 95;
    const minY = 45;
    const maxY = 75;
    targetX = minX + Math.random() * (maxX - minX);
    targetY = minY + Math.random() * (maxY - minY);
  }

  function updateBehaviour(dt) {
    if (isHeld) {
      const desk = document.getElementById("desk");
      if (desk) {
        const rect = desk.getBoundingClientRect();
        const relX = ((pointerX - rect.left) / rect.width) * 100;
        const relY = ((pointerY - rect.top) / rect.height) * 100;
        posX = Math.max(2, Math.min(98, relX));
        posY = Math.max(2, Math.min(98, relY));
      }
      return;
    }

    if (isThrown) {
      velocityY += 0.8;
      posX += velocityX * dt * 0.02;
      posY += velocityY * dt * 0.02;

      if (posX < 2) {
        posX = 2;
        velocityX = -velocityX * 0.5;
      }
      if (posX > 98) {
        posX = 98;
        velocityX = -velocityX * 0.5;
      }
      if (posY >= 65) {
        posY = 65;
        velocityY = -velocityY * 0.4;
        velocityX *= 0.7;
        squashX = 1.3;
        squashY = 0.7;
        if (Math.abs(velocityY) < 2) {
          isThrown = false;
          isDazed = true;
          dazedTimer = 0;
          currentPose = "sit";
          if (window.SFX) window.SFX.play("land");
          showSpeech("Dizzy...");
        }
      }
      return;
    }

    if (isDazed) {
      dazedTimer += dt;
      if (dazedTimer > 1200) {
        isDazed = false;
        currentPose = "getup";
        if (window.SFX) window.SFX.play("getUp");
        setTimeout(() => {
          currentPose = "idle";
          currentBehaviour = "idle";
          pickBehaviour();
        }, 300);
      }
      return;
    }

    if (isFrozen) {
      frozenTimer += dt;
      if (frozenTimer > 2000) {
        isFrozen = false;
        pickBehaviour();
      }
      return;
    }

    if (isPeeking) {
      peekTimer += dt;
      if (peekTimer > 2000) {
        isPeeking = false;
        currentPose = "idle";
        pickBehaviour();
      }
      return;
    }

    behaviourTimer += dt;
    const interval = 3000 + Math.random() * 5000;
    if (behaviourTimer > interval) {
      behaviourTimer = 0;
      if (Math.random() < 0.15 && !reducedMotion) {
        startParkour();
      } else if (Math.random() < 0.1) {
        startPeek();
      } else {
        pickBehaviour();
      }
    }

    if (currentBehaviour === "walk" || currentBehaviour === "run" || currentBehaviour === "moonwalk") {
      const speed = personality.speed * (currentBehaviour === "run" ? 1.5 : 1) * 0.3;
      const dx = targetX - posX;
      const dy = targetY - posY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const moveX = (dx / dist) * speed * dt * 0.05;
        const moveY = (dy / dist) * speed * dt * 0.05;
        if (isMoonwalking) {
          posX -= moveX;
          posY += moveY;
          facingRight = moveX < 0;
        } else {
          posX += moveX;
          posY += moveY;
          facingRight = moveX > 0;
        }
      } else {
        if (currentBehaviour !== "moonwalk") {
          currentBehaviour = "idle";
          currentPose = "idle";
        }
      }
    }

    if (isJumping) {
      velocityY += 0.5;
      posY += velocityY * dt * 0.05;
      if (posY >= 65) {
        posY = 65;
        isJumping = false;
        velocityY = 0;
        currentPose = "idle";
        currentBehaviour = "idle";
      }
    }
  }

  function startParkour() {
    if (reducedMotion) return;
    const icons = document.querySelectorAll(".folder");
    const windows = document.querySelectorAll(".win");
    const platforms = Array.from(icons).concat(Array.from(windows));
    if (platforms.length === 0) return;

    const target = platforms[Math.floor(Math.random() * platforms.length)];
    const rect = target.getBoundingClientRect();
    const desk = document.getElementById("desk");
    if (!desk) return;

    const deskRect = desk.getBoundingClientRect();
    targetX = ((rect.left + rect.width / 2 - deskRect.left) / deskRect.width) * 100;
    targetY = ((rect.top - deskRect.top) / deskRect.height) * 100;

    currentBehaviour = "run";
    currentPose = "run_1";
    isOnPlatform = true;
    platformEl = target;

    setTimeout(() => {
      if (isOnPlatform) {
        currentPose = "jump";
        isJumping = true;
        velocityY = -10;
        isOnPlatform = false;
        platformEl = null;
      }
    }, 2000);
  }

  function startPeek() {
    const icons = document.querySelectorAll(".folder");
    if (icons.length === 0) return;

    const target = icons[Math.floor(Math.random() * icons.length)];
    const rect = target.getBoundingClientRect();
    const desk = document.getElementById("desk");
    if (!desk) return;

    const deskRect = desk.getBoundingClientRect();
    targetX = ((rect.left + rect.width / 2 - deskRect.left) / deskRect.width) * 100;
    targetY = ((rect.top - deskRect.top) / deskRect.height) * 100;

    currentBehaviour = "walk";
    currentPose = "walk_1";
    peekTarget = target;

    setTimeout(() => {
      isPeeking = true;
      currentPose = "peek";
      peekTimer = 0;
      charEl.style.zIndex = "0";
    }, 3000);
  }

  function updateMotion(dt) {
    bobPhase += dt * 0.003;
    const bob = Math.sin(bobPhase) * 0.02;

    if (currentBehaviour === "jump" || isThrown) {
      if (velocityY < 0) {
        squashX = 0.9;
        squashY = 1.1;
      } else {
        squashX = 1.1;
        squashY = 0.9;
      }
      shadowScale = 0.5;
    } else if (currentBehaviour === "walk" || currentBehaviour === "moonwalk") {
      if (walkIdentical) {
        const lean = Math.sin(bobPhase * 2) * 0.07;
        tiltAngle = lean;
        const stepSquash = Math.abs(Math.sin(bobPhase * 2)) * 0.05;
        squashX = 1 + stepSquash;
        squashY = 1 - stepSquash;
        const stepHop = Math.abs(Math.sin(bobPhase * 2)) * 0.03;
        bobPhase += stepHop;
      } else {
        squashX = 1;
        squashY = 1;
        const walkBob = Math.abs(Math.sin(bobPhase * 2)) * 0.03;
        squashY = 1 - walkBob;
      }
      shadowScale = 0.9 + Math.abs(Math.sin(bobPhase * 2)) * 0.1;
    } else if (currentBehaviour === "run") {
      if (runIdentical) {
        const lean = Math.sin(bobPhase * 3) * 0.08;
        tiltAngle = lean;
        const stepSquash = Math.abs(Math.sin(bobPhase * 3)) * 0.06;
        squashX = 1 + stepSquash;
        squashY = 1 - stepSquash;
        const stepHop = Math.abs(Math.sin(bobPhase * 3)) * 0.04;
        bobPhase += stepHop;
      } else {
        squashX = 1;
        squashY = 1;
        const walkBob = Math.abs(Math.sin(bobPhase * 2)) * 0.03;
        squashY = 1 - walkBob;
      }
      shadowScale = 0.9 + Math.abs(Math.sin(bobPhase * 2)) * 0.1;
    } else if (currentBehaviour === "dance") {
      squashX = 1 + Math.sin(bobPhase * 3) * 0.05;
      squashY = 1 - Math.sin(bobPhase * 3) * 0.05;
      shadowScale = 0.8 + Math.sin(bobPhase * 2) * 0.2;
    } else {
      squashX = squashX * 0.95 + 1 * 0.05;
      squashY = squashY * 0.95 + 1 * 0.05;
      shadowScale = 1;
    }

    if ((currentBehaviour === "walk" || currentBehaviour === "moonwalk") && !walkIdentical && Math.random() < 0.02) {
      tiltAngle = (Math.random() - 0.5) * 0.1;
    } else if (currentBehaviour === "run" && !runIdentical && Math.random() < 0.02) {
      tiltAngle = (Math.random() - 0.5) * 0.1;
    } else {
      tiltAngle = tiltAngle * 0.95;
    }
  }

  function updateSpeech(dt) {
    speechTimer += dt;
    const interval = 20000 + Math.random() * 40000;
    if (speechTimer > interval && !bubbleEl && !isHeld && !isThrown && !isFrozen && !isDazed) {
      speechTimer = 0;
      currentPhrase = personality.phrases[Math.floor(Math.random() * personality.phrases.length)];
      phraseIndex = 0;
      showBubble();
    }

    if (bubbleEl) {
      if (phraseIndex < currentPhrase.length) {
        if (Math.random() < 0.3) {
          phraseIndex++;
          bubbleTextEl.textContent = currentPhrase.substring(0, phraseIndex + 1);
          if (window.SFX) window.SFX.blip(slug);
        }
      } else if (speechTimer > 5000) {
        hideBubble();
      }
    }
  }

  function showBubble() {
    if (!charEl) return;
    bubbleEl = document.createElement("div");
    bubbleEl.className = "chibi-bubble";
    bubbleTextEl = document.createElement("span");
    bubbleTextEl.textContent = "";
    bubbleEl.appendChild(bubbleTextEl);
    document.body.appendChild(bubbleEl);
  }

  function hideBubble() {
    if (bubbleEl) {
      bubbleEl.remove();
      bubbleEl = null;
      bubbleTextEl = null;
    }
  }

  function render() {
    if (!charEl || !spriteEl) return;

    const img = getPose();
    if (img) {
      spriteEl.src = img.src;
      spriteEl.style.display = "block";
    } else {
      spriteEl.style.display = "none";
    }

    if (isHeld || isThrown) {
      charEl.style.zIndex = "100";
    } else if (!isPeeking) {
      charEl.style.zIndex = "1";
    }

    charEl.style.opacity = isPeeking ? "0.3" : "1";

    charEl.style.left = posX + "%";
    charEl.style.top = posY + "%";
    charEl.style.width = baseH + "px";
    charEl.style.height = baseH + "px";
    charEl.style.transform = `scaleX(${facingRight ? 1 : -1}) rotate(${tiltAngle}rad)`;
    charEl.style.pointerEvents = "auto";
    charEl.style.cursor = "pointer";
    spriteEl.style.width = "100%";
    spriteEl.style.height = "100%";
    spriteEl.style.objectFit = "contain";
    spriteEl.style.transform = `scale(${squashX}, ${squashY})`;
    spriteEl.style.pointerEvents = "none";

    if (shadowEl) {
      shadowEl.style.left = posX + "%";
      shadowEl.style.top = posY + "%";
      shadowEl.style.width = baseH * 0.8 + "px";
      shadowEl.style.height = baseH * 0.2 + "px";
      shadowEl.style.transform = `scale(${shadowScale})`;
    }

    if (bubbleEl) {
      const rect = charEl.getBoundingClientRect();
      bubbleEl.style.left = rect.left + rect.width / 2 + "px";
      bubbleEl.style.top = rect.bottom + 10 + "px";
      bubbleEl.style.transform = "translateX(-50%)";
    }
  }

  function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = timestamp - lastTime;
    lastTime = timestamp;

    if (!document.hidden && !reducedMotion) {
      updatePose(dt);
      updateBehaviour(dt);
      updateMotion(dt);
      updateSpeech(dt);
      render();
    }

    rafId = requestAnimationFrame(loop);
  }

  function initChar(user) {
    if (charEl) {
      if (rafId) cancelAnimationFrame(rafId);
      charEl.remove();
      if (shadowEl) shadowEl.remove();
      hideBubble();
    }

    const slug = getSlug(user.name);
    personality = window.personalities[slug] || window.personalities.david;

    const folderH = document.querySelector(".folder")?.offsetHeight || 64;
    baseH = folderH * (personality.height || 1);

    charEl = document.createElement("div");
    charEl.className = "chibi-container";
    charEl.style.position = "absolute";
    charEl.style.zIndex = "1";
    charEl.style.pointerEvents = "auto";
    charEl.style.touchAction = "none";
    charEl.style.cursor = "pointer";

    spriteEl = document.createElement("img");
    spriteEl.style.display = "block";
    charEl.appendChild(spriteEl);

    shadowEl = document.createElement("div");
    shadowEl.className = "chibi-shadow";
    shadowEl.style.position = "absolute";
    shadowEl.style.zIndex = "0";
    shadowEl.style.background = "rgba(0,0,0,0.2)";
    shadowEl.style.borderRadius = "50%";
    shadowEl.style.filter = "blur(4px)";

    const desk = document.getElementById("desk");
    if (desk) {
      desk.appendChild(shadowEl);
      desk.appendChild(charEl);
    }

    loadPoses(slug).then(() => {
      console.log("Loaded poses for", slug, Object.keys(loadedPoses).filter(k => loadedPoses[k]));
      console.log("Initial render:", posX, posY, baseH);
      console.log("Chibi element:", charEl, "dimensions:", charEl.offsetWidth, charEl.offsetHeight);
      pickBehaviour();
      lastTime = 0;
      rafId = requestAnimationFrame(loop);
      setupPointerEvents();
    }).catch((err) => {
      console.error("Failed to load poses:", err);
    });
  }

  function setupPointerEvents() {
    charEl.addEventListener("pointerdown", handlePointerDown);
  }

  function handlePointerDown(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log("Pointer down on chibi");
    if (window.SFX) window.SFX.play("tap");
    pointerX = e.clientX;
    pointerY = e.clientY;
    pointerPrevX = pointerX;
    pointerPrevY = pointerY;
    velocityX = 0;
    velocityY = 0;

    const rect = charEl.getBoundingClientRect();

    holdTimer = setTimeout(() => {
      console.log("Hold complete - grabbing");
      isHeld = true;
      currentPose = "grabbed";
      if (window.SFX) window.SFX.play("pickUp");
      showSpeech("Whoa!");
    }, 300);

    const moveHandler = (ev) => {
      if (isHeld) {
        pointerPrevX = pointerX;
        pointerPrevY = pointerY;
        pointerX = ev.clientX;
        pointerY = ev.clientY;
        velocityX = (pointerX - pointerPrevX) * 0.5;
        velocityY = (pointerY - pointerPrevY) * 0.5;
      }
    };

    const upHandler = () => {
      console.log("Pointer up - held:", isHeld);
      clearTimeout(holdTimer);
      document.removeEventListener("pointermove", moveHandler);
      document.removeEventListener("pointerup", upHandler);

      if (isHeld) {
        isHeld = false;
        isThrown = true;
        currentPose = "fall";
        velocityX = Math.max(-15, Math.min(15, velocityX));
        velocityY = Math.max(-15, Math.min(15, velocityY));
        if (window.SFX) window.SFX.play("throw");
      } else {
        if (currentBehaviour === "walk" || currentBehaviour === "run") {
          isFrozen = true;
          frozenTimer = 0;
          currentBehaviour = "idle";
          currentPose = "idle";
          facingRight = e.clientX > rect.left + rect.width / 2;
          showSpeech("Hey!");
        } else {
          currentPose = "jump";
          isJumping = true;
          velocityY = -12;
          showSpeech("Squeak!");
        }
      }
    };

    document.addEventListener("pointermove", moveHandler);
    document.addEventListener("pointerup", upHandler);
  }

  function showSpeech(text) {
    if (bubbleEl) hideBubble();
    currentPhrase = text;
    phraseIndex = 0;
    speechTimer = 0;
    showBubble();
  }

  function stopChar() {
    if (rafId) cancelAnimationFrame(rafId);
    if (charEl) charEl.remove();
    if (shadowEl) shadowEl.remove();
    hideBubble();
    if (holdTimer) clearTimeout(holdTimer);
    charEl = null;
    shadowEl = null;
    rafId = null;
    holdTimer = null;
  }

  window.initChibi = initChar;
  window.stopChibi = stopChar;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
    } else if (charEl && !reducedMotion) {
      lastTime = 0;
      rafId = requestAnimationFrame(loop);
    }
  });
})();
