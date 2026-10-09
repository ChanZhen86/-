/* ===== 抽奖轮盘逻辑 ===== */
(() => {
  // ---------- 数据 ----------
  const DEFAULT_PRIZES = [
    { name: "一等奖", weight: 1 },
    { name: "二等奖", weight: 2 },
    { name: "三等奖", weight: 3 },
    { name: "优惠券",  weight: 4 },
    { name: "谢谢参与", weight: 5 },
    { name: "再来一次", weight: 3 },
  ];

  const PALETTE = [
    "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
    "#C77DFF", "#FF9F45", "#2EE6D6", "#FF6FB5",
    "#A0E426", "#FFB4B4", "#5C7CFA", "#F4A261",
  ];

  let prizes = loadPrizes();
  let spinning = false;
  let currentAngle = 0;

  const canvas = document.getElementById("wheel");
  const ctx = canvas.getContext("2d");
  const prizeListEl = document.getElementById("prizeList");
  const historyListEl = document.getElementById("historyList");
  const overlay = document.getElementById("overlay");
  const resultNameEl = document.getElementById("resultName");
  const nameInput = document.getElementById("nameInput");
  const weightInput = document.getElementById("weightInput");

  // ---------- 存取（奖项持久化，记录刷新即清空） ----------
  function loadPrizes() {
    try {
      const raw = localStorage.getItem("lucky_prizes");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length >= 2) return arr;
      }
    } catch (_) {}
    return DEFAULT_PRIZES.map(p => ({ ...p }));
  }

  function savePrizes() {
    localStorage.setItem("lucky_prizes", JSON.stringify(prizes));
  }

  let historyCache = [];

  function loadHistory() {
    return historyCache;
  }

  function saveHistory(list) {
    historyCache = list.slice(0, 30);
  }

  // ---------- 绘制轮盘 ----------
  function drawWheel() {
    const dpr = window.devicePixelRatio || 1;
    const size = canvas.clientWidth;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(currentAngle);

    const total = prizes.reduce((s, p) => s + (p.weight || 1), 0);
    let start = -Math.PI / 2; // 从顶部开始

    prizes.forEach((p, i) => {
      const slice = (p.weight || 1) / total * Math.PI * 2;
      const end = start + slice;

      // 扇区
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius, start, end);
      ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length];
      ctx.fill();

      // 分隔线
      ctx.strokeStyle = "rgba(255,255,255,.35)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // 文字
      const mid = start + slice / 2;
      ctx.save();
      ctx.rotate(mid);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";

      const label = p.name.length > 7 ? p.name.slice(0, 7) + "…" : p.name;
      const fontSize = Math.max(14, Math.min(26, radius / 9.5));
      ctx.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
      ctx.fillStyle = contrastColor(PALETTE[i % PALETTE.length]);
      ctx.shadowColor = "rgba(0,0,0,.25)";
      ctx.shadowBlur = 3;
      ctx.fillText(label, radius - 22, 0);
      ctx.restore();

      start = end;
    });

    // 外圈装饰
    ctx.beginPath();
    ctx.arc(0, 0, radius - 1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,.25)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // 小灯泡
    const bulbCount = 28;
    for (let i = 0; i < bulbCount; i++) {
      const a = (i / bulbCount) * Math.PI * 2;
      const bx = Math.cos(a) * (radius - 10);
      const by = Math.sin(a) * (radius - 10);
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? "#fff8dc" : "#ffaa00";
      ctx.shadowColor = i % 2 === 0 ? "#fff" : "#ffaa00";
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  function contrastColor(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#2c2c2c" : "#ffffff";
  }

  // ---------- 奖项列表 UI ----------
  function renderPrizeList() {
    prizeListEl.innerHTML = "";
    prizes.forEach((p, i) => {
      const li = document.createElement("li");
      li.className = "prize-item";
      li.style.borderLeftColor = PALETTE[i % PALETTE.length];

      li.innerHTML = `
        <span class="color-dot" style="background:${PALETTE[i % PALETTE.length]};color:${PALETTE[i % PALETTE.length]}"></span>
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="weight" title="点击修改概率权重">×${p.weight || 1}</span>
        <button class="del" title="删除">×</button>
      `;

      li.querySelector(".weight").addEventListener("click", () => {
        if (spinning) return;
        const span = li.querySelector(".weight");
        const input = document.createElement("input");
        input.type = "number";
        input.min = 1;
        input.max = 100;
        input.value = p.weight || 1;
        input.className = "weight";
        input.title = "输入后回车或失焦确认";
        span.replaceWith(input);
        input.focus();
        input.select();

        const commit = () => {
          const v = Math.max(1, Math.min(100, parseInt(input.value) || 1));
          prizes[i].weight = v;
          savePrizes();
          renderPrizeList();
          drawWheel();
        };

        input.addEventListener("keydown", e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") renderPrizeList();
          e.stopPropagation();
        });
        input.addEventListener("blur", commit);
      });

      li.querySelector(".del").addEventListener("click", () => {
        if (spinning) return;
        if (prizes.length <= 2) {
          alert("至少保留 2 个奖项");
          return;
        }
        prizes.splice(i, 1);
        savePrizes();
        renderPrizeList();
        drawWheel();
      });

      prizeListEl.appendChild(li);
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  // ---------- 历史 UI ----------
  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      historyListEl.innerHTML = '<li style="opacity:.35;border:none">暂无记录</li>';
      return;
    }
    historyListEl.innerHTML = list.map(h =>
      `<li><span>${escapeHtml(h.name)}</span><span class="time">${h.time}</span></li>`
    ).join("");
  }

  // ---------- 抽奖逻辑 ----------
  function pickPrize() {
    const total = prizes.reduce((s, p) => s + (p.weight || 1), 0);
    let r = Math.random() * total;
    for (let i = 0; i < prizes.length; i++) {
      r -= (prizes[i].weight || 1);
      if (r <= 0) return i;
    }
    return prizes.length - 1;
  }

  function spin() {
    if (spinning) return;
    if (prizes.length < 2) {
      alert("请至少添加 2 个奖项");
      return;
    }

    spinning = true;
    setButtonsDisabled(true);
    canvas.classList.add("spinning");

    const idx = pickPrize();
    const total = prizes.reduce((s, p) => s + (p.weight || 1), 0);

    // 目标扇区中心相对轮盘顶部的角度
    let acc = 0;
    for (let i = 0; i < idx; i++) acc += (prizes[i].weight || 1);
    const sliceCenterRatio = (acc + (prizes[idx].weight || 1) / 2) / total;
    const targetInWheel = -Math.PI / 2 + sliceCenterRatio * Math.PI * 2;

    // 指针固定在顶部，需让目标扇区中心转到顶部：
    // currentAngle + targetInWheel ≡ -PI/2 (mod 2π)
    const baseTarget = -Math.PI / 2 - targetInWheel;

    // 归一化到 [0, 2π)，再加多圈
    let delta = ((baseTarget - currentAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const extraTurns = 6 + Math.floor(Math.random() * 4); // 6~9 圈
    const totalDelta = delta + extraTurns * Math.PI * 2;

    const startAngle = currentAngle;
    const duration = 4200 + Math.random() * 800;
    const startTime = performance.now();

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3.2);
    }

    function frame(now) {
      const t = Math.min((now - startTime) / duration, 1);
      currentAngle = startAngle + totalDelta * easeOutCubic(t);
      drawWheel();

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        spinning = false;
        setButtonsDisabled(false);
        canvas.classList.remove("spinning");
        showResult(prizes[idx].name);
      }
    }

    requestAnimationFrame(frame);
  }

  function setButtonsDisabled(v) {
    document.getElementById("spinBtnMain").disabled = v;
    document.getElementById("addBtn").disabled = v;
    document.getElementById("resetBtn").disabled = v;
    document.getElementById("spinBtn").style.pointerEvents = v ? "none" : "auto";
    document.getElementById("spinBtn").style.opacity = v ? ".5" : "1";
  }

  // ---------- 结果展示 ----------
  function showResult(name) {
    resultNameEl.textContent = name;
    overlay.classList.add("show");
    spawnConfetti();

    const list = loadHistory();
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
    list.unshift({ name, time });
    saveHistory(list);
    renderHistory();
  }

  function spawnConfetti() {
    const colors = ["#FFD700", "#FF6B6B", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F45", "#fff"];
    for (let i = 0; i < 50; i++) {
      const el = document.createElement("div");
      el.className = "confetti";
      el.style.left = Math.random() * 100 + "vw";
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      el.style.animationDuration = 2.2 + Math.random() * 2 + "s";
      el.style.animationDelay = Math.random() * .6 + "s";
      el.style.width = 6 + Math.random() * 8 + "px";
      el.style.height = 10 + Math.random() * 10 + "px";
      el.style.transform = `rotate(${Math.random() * 360}deg)`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 5000);
    }
  }

  // ---------- 事件绑定 ----------
  document.getElementById("addBtn").addEventListener("click", () => {
    if (spinning) return;
    const name = nameInput.value.trim();
    const weight = Math.max(1, Math.min(100, parseInt(weightInput.value) || 1));

    if (!name) {
      nameInput.focus();
      return;
    }
    if (prizes.length >= 16) {
      alert("最多支持 16 个奖项");
      return;
    }

    prizes.push({ name, weight });
    savePrizes();
    renderPrizeList();
    drawWheel();
    nameInput.value = "";
    nameInput.focus();
  });

  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter") document.getElementById("addBtn").click();
  });

  document.getElementById("spinBtnMain").addEventListener("click", spin);
  document.getElementById("spinBtn").addEventListener("click", spin);
  canvas.addEventListener("click", spin);

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (spinning) return;
    prizes = DEFAULT_PRIZES.map(p => ({ ...p }));
    savePrizes();
    renderPrizeList();
    drawWheel();
  });

  document.getElementById("closeBtn").addEventListener("click", () => {
    overlay.classList.remove("show");
  });

  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.remove("show");
  });

  window.addEventListener("resize", drawWheel);

  // ---------- 初始化 ----------
  renderPrizeList();
  renderHistory();
  drawWheel();
})();
