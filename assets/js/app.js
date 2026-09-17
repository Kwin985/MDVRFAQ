/* MDVR FAQ - MPA 增强脚本 (无 hash 路由, 真实链接导航)
 * 负责: 主题切换 / 移动端侧边栏 / 侧边栏折叠 / 搜索 / 图片灯箱 / 回到顶部
 */
(function () {
  "use strict";

  // ---------- 主题 ----------
  var themeBtn = document.getElementById("themeBtn");
  var themeMeta = document.getElementById("themeColorMeta");
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    if (themeMeta) themeMeta.setAttribute("content", t === "dark" ? "#0f172a" : "#ffffff");
    try { localStorage.setItem("theme", t); } catch (e) {}
  }
  // 初始化 theme-color（与当前主题一致，避免深色模式顶栏仍为白）
  if (themeMeta) {
    themeMeta.setAttribute("content", document.documentElement.getAttribute("data-theme") === "dark" ? "#0f172a" : "#ffffff");
  }
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(cur === "dark" ? "light" : "dark");
    });
  }

  // ---------- 移动端侧边栏 ----------
  var menuToggle = document.getElementById("menuToggle");
  var searchToggle = document.getElementById("searchToggle");
  var sidebar = document.getElementById("sidebar");
  var overlay = document.getElementById("sidebarOverlay");

  function openSidebar(focusSearch) {
    if (sidebar) sidebar.classList.add("open");
    if (overlay) overlay.classList.add("visible");
    document.body.classList.add("sidebar-open");
    if (focusSearch) {
      var si = document.getElementById("searchInput");
      if (si) setTimeout(function () { si.focus(); }, 260);
    }
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
    document.body.classList.remove("sidebar-open");
  }
  if (menuToggle && sidebar) {
    menuToggle.addEventListener("click", function () {
      if (sidebar.classList.contains("open")) closeSidebar();
      else openSidebar(false);
    });
    if (overlay) overlay.addEventListener("click", closeSidebar);
    // 点击正文链接后关闭(移动端)
    sidebar.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeSidebar();
    });
  }
  // 移动端：搜索按钮直接打开侧边栏并聚焦搜索框
  if (searchToggle && sidebar) {
    searchToggle.addEventListener("click", function () {
      openSidebar(true);
    });
  }

  // ---------- 侧边栏折叠 ----------
  document.querySelectorAll(".nav-tree-toggle").forEach(function (t) {
    function toggle() {
      t.classList.toggle("collapsed");
      var child = t.nextElementSibling;
      if (child && child.classList.contains("nav-tree-children")) child.classList.toggle("collapsed");
    }
    t.addEventListener("click", toggle);
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
  });

  // ---------- 图片灯箱 ----------
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxClose = document.getElementById("lightboxClose");
  if (lightbox) {
    document.querySelectorAll(".article-content").forEach(function (ac) {
      ac.addEventListener("click", function (e) {
        var img = e.target.closest("img");
        if (img && !img.classList.contains("img-broken")) {
          lightboxImg.src = img.src;
          lightboxImg.alt = img.alt || "";
          lightbox.classList.add("open");
        }
      });
    });
    function closeLb() { lightbox.classList.remove("open"); lightboxImg.src = ""; }
    lightboxClose.addEventListener("click", closeLb);
    lightbox.addEventListener("click", function (e) { if (e.target === lightbox) closeLb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLb(); });
  }

  // ---------- 回到顶部 ----------
  var backToTop = document.getElementById("backToTop");
  if (backToTop) {
    window.addEventListener("scroll", function () {
      backToTop.classList.toggle("visible", window.scrollY > 400);
    });
    backToTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  }

  // ---------- 搜索 (基于 content.json) ----------
  var searchInput = document.getElementById("searchInput");
  var searchClear = document.getElementById("searchClear");
  var searchResults = document.getElementById("searchResults");
  var SEARCH_DATA = null;

  function buildIndex() {
    if (SEARCH_DATA) return Promise.resolve(SEARCH_DATA);
    return fetch("/content.json").then(function (r) { return r.json(); }).then(function (d) {
      SEARCH_DATA = Object.values(d.pages).map(function (p) {
        var text = (p.content || "").replace(/[#*`>_~\-]/g, " ").replace(/\[TOC\]/gi, " ");
        return { id: p.id, section: p.section, title: p.title, cat: p.cat_name || "", text: text.slice(0, 400) };
      });
      return SEARCH_DATA;
    });
  }

  function sectionPath(section, id) {
    var map = { zh_docs: "/zh/docs/", en_docs: "/en/docs/", zh_videos: "/zh/videos/", en_videos: "/en/videos/" };
    return (map[section] || "/zh/docs/") + id + "/";
  }

  function doSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.style.display = "none"; searchResults.innerHTML = ""; return; }
    buildIndex().then(function (data) {
      var hits = [];
      for (var i = 0; i < data.length && hits.length < 20; i++) {
        var it = data[i];
        var hay = (it.title + " " + it.cat + " " + it.text).toLowerCase();
        if (hay.indexOf(q) !== -1) hits.push(it);
      }
      if (!hits.length) {
        searchResults.innerHTML = '<div class="search-no-results">未找到相关结果</div>';
      } else {
        searchResults.innerHTML = hits.map(function (h) {
          var idx = h.title.toLowerCase().indexOf(q);
          var t = idx >= 0 ? h.title.slice(0, idx) + '<span class="search-result-highlight">' + h.title.slice(idx, idx + q.length) + "</span>" + h.title.slice(idx + q.length) : h.title;
          return '<div class="search-result-item" data-href="' + sectionPath(h.section, h.id) + '"><div class="search-result-title">' + t + '</div><div class="search-result-snippet">' + (h.cat || "") + "</div></div>";
        }).join("");
        searchResults.querySelectorAll(".search-result-item").forEach(function (el) {
          el.addEventListener("click", function () { window.location.href = el.getAttribute("data-href"); });
        });
      }
      searchResults.style.display = "block";
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var v = searchInput.value;
      searchClear.style.display = v ? "block" : "none";
      doSearch(v);
    });
    searchClear.addEventListener("click", function () {
      searchInput.value = ""; searchClear.style.display = "none"; searchResults.style.display = "none"; searchInput.focus();
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".search-box") && !e.target.closest(".search-results")) searchResults.style.display = "none";
    });
  }

  // ---------- 平滑锚点 (页面内 #h-x) ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) { e.preventDefault(); el.scrollIntoView({ behavior: "smooth" }); }
    });
  });

  // ---------- 代码块一键复制 ----------
  var isZh = (document.documentElement.getAttribute("lang") || "").toLowerCase().indexOf("zh") === 0;
  function copyFeedback(btn, ok) {
    var original = btn.getAttribute("data-label") || (isZh ? "复制" : "Copy");
    btn.textContent = ok ? (isZh ? "已复制 ✓" : "Copied ✓") : (isZh ? "复制失败" : "Copy failed");
    btn.classList.add(ok ? "copied" : "copy-fail");
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove("copied", "copy-fail");
    }, 1600);
  }
  function fallbackCopy(text, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      cb(ok);
    } catch (e) { cb(false); }
  }
  document.querySelectorAll(".code-copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var block = btn.closest(".code-block");
      var pre = block ? block.querySelector("pre") : null;
      if (!pre) return;
      var text = pre.innerText;
      var done = function (ok) { copyFeedback(btn, ok); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    });
  });

  // 视频逐字稿：点击 [mm:ss] 时间戳跳转到视频对应进度
  document.addEventListener("click", function (e) {
    var ts = e.target.closest && e.target.closest(".transcript-list .ts");
    if (!ts) return;
    var t = parseFloat(ts.getAttribute("data-t"));
    if (isNaN(t)) return;
    var v = document.querySelector("article .article-content video") || document.querySelector("video");
    if (!v) return;
    try {
      v.currentTime = t;
      v.scrollIntoView({ behavior: "smooth", block: "center" });
      if (v.paused && v.play) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    } catch (_) {}
  });
})();
