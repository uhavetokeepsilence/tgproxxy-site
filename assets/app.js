(function () {
  "use strict";

  var RAD_URL = "https://raw.githubusercontent.com/0xRadikal/Free-Telegram-Proxy/main/verified/proxies.json";
  var TG_URL = "https://raw.githubusercontent.com/tgmtproxy/telegram-mtproto-proxy-list/main/proxies.txt";
  var LIMIT = 60;

  var COUNTRIES = {
    AE: "ОАЭ", AL: "Албания", AM: "Армения", AR: "Аргентина", AT: "Австрия",
    AU: "Австралия", AZ: "Азербайджан", BE: "Бельгия", BG: "Болгария",
    BR: "Бразилия", BY: "Беларусь", CA: "Канада", CH: "Швейцария",
    CL: "Чили", CN: "Китай", CY: "Кипр", CZ: "Чехия", DE: "Германия",
    DK: "Дания", EE: "Эстония", EG: "Египет", ES: "Испания", FI: "Финляндия",
    FR: "Франция", GB: "Великобритания", GE: "Грузия", GR: "Греция",
    HK: "Гонконг", HR: "Хорватия", HU: "Венгрия", ID: "Индонезия",
    IE: "Ирландия", IL: "Израиль", IN: "Индия", IR: "Иран", IS: "Исландия",
    IT: "Италия", JP: "Япония", KR: "Южная Корея", KZ: "Казахстан",
    LT: "Литва", LU: "Люксембург", LV: "Латвия", MD: "Молдова",
    MX: "Мексика", MY: "Малайзия", NL: "Нидерланды", NO: "Норвегия",
    NZ: "Новая Зеландия", PH: "Филиппины", PK: "Пакистан", PL: "Польша",
    PT: "Португалия", QA: "Катар", RO: "Румыния", RS: "Сербия",
    RU: "Россия", SA: "Саудовская Аравия", SE: "Швеция", SG: "Сингапур",
    SK: "Словакия", TH: "Таиланд", TR: "Турция", TW: "Тайвань",
    UA: "Украина", US: "США", UZ: "Узбекистан", VN: "Вьетнам",
    ZA: "ЮАР"
  };

  var state = { all: [], filtered: [], generatedAt: null, source: "…" };

  var el = {
    list: document.getElementById("list"),
    empty: document.getElementById("empty"),
    search: document.getElementById("search"),
    country: document.getElementById("country"),
    sort: document.getElementById("sort"),
    reload: document.getElementById("reload"),
    count: document.getElementById("count"),
    updated: document.getElementById("updated"),
    freshness: document.getElementById("freshness"),
    status: document.getElementById("status"),
    toast: document.getElementById("toast")
  };

  var toastTimer = null;

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove("show"); }, 2600);
  }

  function countryName(code) {
    return COUNTRIES[code] || code || "?";
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }

  function pingClass(ms) {
    if (ms < 160) return "good";
    if (ms < 300) return "warn";
    return "bad";
  }

  function makeCard(p) {
    var li = document.createElement("li");
    li.className = "card";
    li.dataset.host = p.server;
    li.dataset.cc = p.country || "";

    var cc = document.createElement("div");
    cc.className = "cc";
    cc.textContent = (p.country || "??").slice(0, 2);
    cc.title = countryName(p.country);

    var addr = document.createElement("div");
    addr.className = "addr";
    var host = document.createElement("span");
    host.className = "host";
    host.textContent = p.server + ":" + p.port;
    var meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = countryName(p.country) + " · uptime " + Math.round(p.uptime) + "%";
    addr.appendChild(host);
    addr.appendChild(meta);

    var ping = document.createElement("span");
    ping.className = "ping " + pingClass(p.rtt);
    ping.textContent = p.rtt + " ms";

    var actions = document.createElement("div");
    actions.className = "actions";

    var connect = document.createElement("a");
    connect.className = "btn primary";
    connect.href = p.tg || ("tg://proxy?server=" + p.server + "&port=" + p.port + "&secret=" + p.secret);
    connect.textContent = "Подключить";
    connect.setAttribute("rel", "nofollow");

    var copy = document.createElement("button");
    copy.className = "btn ghost";
    copy.type = "button";
    copy.textContent = "Копировать";
    copy.addEventListener("click", function () {
      copyText(p.link || ("https://t.me/proxy?server=" + p.server + "&port=" + p.port + "&secret=" + p.secret));
      toast("Ссылка скопирована");
    });

    actions.appendChild(connect);
    actions.appendChild(copy);

    li.appendChild(cc);
    li.appendChild(addr);
    li.appendChild(ping);
    li.appendChild(actions);
    return li;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { legacyCopy(text); });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function applyFilters() {
    var q = el.search.value.trim().toLowerCase();
    var cc = el.country.value;
    var sort = el.sort.value;

    var items = state.all.filter(function (p) {
      if (cc && p.country !== cc) return false;
      if (!q) return true;
      return (p.server + " " + countryName(p.country) + " " + p.country).toLowerCase().indexOf(q) >= 0;
    });

    items.sort(function (a, b) {
      if (sort === "uptime") {
        if (b.uptime !== a.uptime) return b.uptime - a.uptime;
        return a.rtt - b.rtt;
      }
      if (a.rtt !== b.rtt) return a.rtt - b.rtt;
      return b.uptime - a.uptime;
    });

    state.filtered = items;
    renderList(items);
  }

  function renderList(items) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < items.length; i++) frag.appendChild(makeCard(items[i]));
    el.list.textContent = "";
    el.list.appendChild(frag);
    el.empty.hidden = items.length !== 0;
  }

  function fillCountries() {
    var seen = {};
    for (var i = 0; i < state.all.length; i++) seen[state.all[i].country] = true;

    var codes = Object.keys(seen).sort(function (a, b) {
      return countryName(a).localeCompare(countryName(b), "ru");
    });

    var current = el.country.value;
    el.country.textContent = "";
    var optAll = document.createElement("option");
    optAll.value = "";
    optAll.textContent = "Все страны";
    el.country.appendChild(optAll);

    for (var j = 0; j < codes.length; j++) {
      var o = document.createElement("option");
      o.value = codes[j];
      o.textContent = countryName(codes[j]);
      el.country.appendChild(o);
    }
    el.country.value = current;
  }

  function applyData(proxies, generatedAt, source) {
    state.all = proxies || [];
    state.generatedAt = generatedAt;
    state.source = source;

    el.count.textContent = state.all.length;
    el.updated.textContent = fmtDate(generatedAt);
    el.status.textContent = source;

    var ageH = generatedAt ? (Date.now() - new Date(generatedAt).getTime()) / 36e5 : 99;
    el.freshness.className = "chip " + (ageH <= 2 ? "chip-ok" : (ageH <= 12 ? "" : "chip-warn"));
    el.freshness.textContent = ageH <= 2 ? "свежие" : (ageH <= 12 ? "проверены" : "могут быть устаревшими");

    fillCountries();
    applyFilters();
  }

  function loadLocal() {
    return fetch("data/proxies.json?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        applyData(d.proxies, d.generated_at, "сохранённый список");
      });
  }

  function computeLive() {
    return Promise.all([
      fetch(RAD_URL, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }),
      fetch(TG_URL, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
    ]).then(function (res) {
      var rad = res[0];
      var alive = {};
      var re = /server=([^&]+)&port=(\d+)&secret=([0-9A-Za-z_\-+/=]+)/g;
      var m;
      while ((m = re.exec(res[1])) !== null) {
        var host = m[1].replace(/\.+$/, "").toLowerCase();
        alive[host + "|" + m[2] + "|" + m[3]] = true;
      }

      var out = [];
      for (var i = 0; i < rad.length; i++) {
        var p = rad[i];
        if (p.type !== "faketls") continue;
        if ((p.uptime || 0) < 0.95) continue;
        var srv = String(p.server || "").replace(/\.+$/, "").toLowerCase();
        if (!alive[srv + "|" + p.port + "|" + p.secret]) continue;
        out.push({
          server: srv,
          port: p.port,
          secret: p.secret,
          country: p.country || "??",
          rtt: p.rtt_ms || 9999,
          uptime: Math.round((p.uptime || 0) * 1000) / 10,
          net: String(p.ip || srv).split(".").slice(0, 3).join(".")
        });
      }

      out.sort(function (a, b) { return a.rtt - b.rtt; });

      var picked = [];
      var hosts = {};
      var nets = {};
      var perCountry = {};

      for (var j = 0; j < out.length; j++) {
        var c = out[j];
        if (hosts[c.server] || nets[c.net]) continue;
        if ((perCountry[c.country] || 0) >= 8) continue;
        hosts[c.server] = true;
        nets[c.net] = true;
        perCountry[c.country] = (perCountry[c.country] || 0) + 1;
        delete c.net;
        c.link = "https://t.me/proxy?server=" + c.server + "&port=" + c.port + "&secret=" + c.secret;
        c.tg = "tg://proxy?server=" + c.server + "&port=" + c.port + "&secret=" + c.secret;
        picked.push(c);
        if (picked.length >= LIMIT) break;
      }
      return picked;
    });
  }

  function reloadLive() {
    el.reload.disabled = true;
    el.reload.textContent = "Обновляю…";
    computeLive().then(function (proxies) {
      if (!proxies.length) throw new Error("пустой список");
      applyData(proxies, new Date().toISOString(), "живые данные");
      toast("Список обновлён: " + proxies.length + " прокси");
    }).catch(function () {
      toast("Не удалось обновить — показан сохранённый список");
    }).then(function () {
      el.reload.disabled = false;
      el.reload.textContent = "Обновить";
    });
  }

  el.search.addEventListener("input", function () { applyFilters(); });
  el.country.addEventListener("change", function () { applyFilters(); });
  el.sort.addEventListener("change", function () { applyFilters(); });
  el.reload.addEventListener("click", reloadLive);

  loadLocal().catch(function () {
    return computeLive().then(function (proxies) {
      applyData(proxies, new Date().toISOString(), "живые данные");
    });
  }).catch(function () {
    el.status.textContent = "не удалось загрузить данные";
    el.empty.hidden = false;
    el.empty.textContent = "Не удалось загрузить список. Проверьте интернет и обновите страницу.";
  });
})();
