/*
 * app.js — логика страницы: рендер контента из config.js, «умный подбор»,
 * валидация и отправка заявки на бэкенд (который перешлёт её в MAX).
 */
(function () {
  "use strict";

  var CFG = window.ATELIER_CONFIG;
  if (!CFG) { console.error("Не найден ATELIER_CONFIG (config.js)"); return; }

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  var fmtPrice = function (work) {
    if (work.price == null) return "по договорённости";
    var s = "от " + work.price.toLocaleString("ru-RU") + " ₽";
    if (work.unit) s += " <small>" + work.unit + "</small>";
    return s;
  };

  /* ---------- 1. Заполняем тексты из конфига ---------- */
  function fillTexts() {
    document.title = CFG.brand.name + " — ремонт и пошив одежды, ЖК «Парадный ансамбль»";

    setText("#place-title", CFG.place.title);
    setText("#place-text", CFG.place.text);
    fillList("#place-points", CFG.place.points);

    setText("#about-title", CFG.about.title);
    setText("#about-text", CFG.about.text);
    fillList("#about-why", CFG.about.why);
    var facts = $("#about-facts");
    CFG.about.facts.forEach(function (f) {
      var box = el("div", "fact");
      box.appendChild(el("div", "fact__value", f.value));
      box.appendChild(el("div", "fact__label", f.label));
      facts.appendChild(box);
    });

    setText("#history-title", CFG.history.title);
    var hb = $("#history-body");
    CFG.history.paragraphs.forEach(function (p) { hb.appendChild(el("p", null, p)); });

    setText("#form-title", CFG.form.title);
    setText("#form-subtitle", CFG.form.subtitle);
    setText("#form-privacy", CFG.form.privacyNote);

    setText("#footer-name", CFG.brand.name);
    setText("#footer-address", CFG.brand.address);
  }
  function setText(sel, txt) { var n = $(sel); if (n) n.textContent = txt; }
  function fillList(sel, arr) {
    var ul = $(sel); if (!ul) return;
    arr.forEach(function (t) { ul.appendChild(el("li", null, t)); });
  }

  /* ---------- 2. Прайс ---------- */
  function renderPrices() {
    var wrap = $("#price-groups");
    CFG.categories.forEach(function (cat) {
      cat.items.forEach(function (item) {
        var card = el("div", "price-card");
        card.appendChild(el("div", "price-card__title", item.title));
        item.works.forEach(function (work) {
          var row = el("div", "price-row");
          var name = el("div", "price-row__name", work.title);
          row.appendChild(name);
          row.appendChild(el("div", "price-row__price", fmtPrice(work)));
          card.appendChild(row);
        });
        wrap.appendChild(card);
      });
    });
  }

  /* ---------- 3. Умный подбор (Aviasales-строка) ---------- */
  var pick = {
    category: $("#pick-category"),
    item: $("#pick-item"),
    work: $("#pick-work"),
    urgency: $("#pick-urgency"),
    price: $("#picker-price"),
  };

  function opt(value, label) {
    var o = document.createElement("option");
    o.value = value; o.textContent = label;
    return o;
  }
  function currentCategory() {
    return CFG.categories.find(function (c) { return c.id === pick.category.value; });
  }
  function currentItem() {
    var c = currentCategory(); if (!c) return null;
    return c.items.find(function (i) { return i.id === pick.item.value; });
  }
  function currentWork() {
    var i = currentItem(); if (!i) return null;
    return i.works.find(function (w) { return w.id === pick.work.value; });
  }

  function initPicker() {
    CFG.categories.forEach(function (c) { pick.category.appendChild(opt(c.id, c.title)); });
    CFG.urgency.forEach(function (u) { pick.urgency.appendChild(opt(u.id, u.title)); });

    pick.category.addEventListener("change", function () { fillItems(); });
    pick.item.addEventListener("change", function () { fillWorks(); });
    pick.work.addEventListener("change", updatePrice);

    fillItems();
  }
  function fillItems() {
    pick.item.innerHTML = "";
    var c = currentCategory();
    c.items.forEach(function (i) { pick.item.appendChild(opt(i.id, i.title)); });
    fillWorks();
  }
  function fillWorks() {
    pick.work.innerHTML = "";
    var i = currentItem();
    i.works.forEach(function (w) { pick.work.appendChild(opt(w.id, w.title)); });
    updatePrice();
  }
  function updatePrice() {
    var w = currentWork();
    pick.price.innerHTML = w ? fmtPrice(w) : "";
  }

  /** Текстовое описание выбранной услуги — попадёт в форму и в заявку маме. */
  function pickerSummary() {
    var c = currentCategory(), i = currentItem(), w = currentWork();
    var u = CFG.urgency.find(function (x) { return x.id === pick.urgency.value; });
    if (!c || !i || !w) return "";
    var s = c.title + " · " + i.title + " · " + w.title;
    if (w.price != null) s += " (от " + w.price.toLocaleString("ru-RU") + " ₽)";
    if (u) s += " · " + u.title;
    return s;
  }

  /* ---------- 4. Форма заявки ---------- */
  var form = $("#request-form");
  var phoneInput = $("#f-phone");
  var serviceInput = $("#f-service");
  var statusBox = $("#form-status");
  var submitBtn = $("#submit-btn");

  // Маска телефона (мягкая, не мешает вводу)
  phoneInput.addEventListener("input", function () {
    var d = phoneInput.value.replace(/\D/g, "");
    if (d.startsWith("8")) d = "7" + d.slice(1);
    if (d.startsWith("9")) d = "7" + d;
    d = d.slice(0, 11);
    var out = "";
    if (d.length > 0) out = "+7";
    if (d.length > 1) out += " (" + d.slice(1, 4);
    if (d.length >= 4) out += ") " + d.slice(4, 7);
    if (d.length >= 7) out += "-" + d.slice(7, 9);
    if (d.length >= 9) out += "-" + d.slice(9, 11);
    phoneInput.value = out;
  });

  function phoneIsValid() {
    return phoneInput.value.replace(/\D/g, "").length >= 11;
  }

  // Submit «умного подбора» = прокрутить к форме, подставив выбранную услугу
  $("#picker").addEventListener("submit", function (e) {
    e.preventDefault();
    var summary = pickerSummary();
    if (summary) serviceInput.value = summary;
    if (window.MaxApp) window.MaxApp.haptic();
    document.getElementById("request").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { phoneInput.focus({ preventScroll: true }); }, 500);
  });

  // Кнопки/ссылки с прокруткой
  document.querySelectorAll(".js-scroll").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      document.getElementById("request").scrollIntoView({ behavior: "smooth" });
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    statusBox.textContent = "";
    statusBox.className = "form-status";

    if (!phoneIsValid()) {
      $("#f-phone").closest(".field").classList.add("field--invalid");
      phoneInput.focus();
      return;
    }
    $("#f-phone").closest(".field").classList.remove("field--invalid");

    // Если поле услуги пустое — подставим текущий выбор из подбора
    if (!serviceInput.value.trim()) {
      var s = pickerSummary();
      if (s) serviceInput.value = s;
    }

    var payload = {
      service: serviceInput.value.trim(),
      name: $("#f-name").value.trim(),
      phone: phoneInput.value.trim(),
      comment: $("#f-comment").value.trim(),
      picker: {
        category: pick.category.value,
        item: pick.item.value,
        work: pick.work.value,
        urgency: pick.urgency.value,
      },
      source: window.MaxApp && window.MaxApp.isInMax ? "max-miniapp" : "website",
      maxInitData: window.MaxApp ? window.MaxApp.initData : "",
      ts: new Date().toISOString(),
    };

    sendOrder(payload);
  });

  function sendOrder(payload) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Отправляю…";

    fetch(CFG.api.orderEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json().catch(function () { return {}; });
      })
      .then(function () {
        form.reset();
        openModal();
        if (window.MaxApp) window.MaxApp.haptic();
      })
      .catch(function (err) {
        console.error(err);
        statusBox.textContent = CFG.form.errorText;
        statusBox.className = "form-status form-status--error";
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = "Отправить заявку";
      });
  }

  /* ---------- 5. Модалка «успех» ---------- */
  var modal = $("#success-modal");
  function openModal() {
    setText("#modal-title", CFG.form.successTitle);
    setText("#modal-text", CFG.form.successText);
    modal.hidden = false;
  }
  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute("data-close")) modal.hidden = true;
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") modal.hidden = true;
  });

  /* ---------- 6. Префилл из MAX (если открыто в мини-аппе) ---------- */
  function prefillFromMax() {
    if (!window.MaxApp || !window.MaxApp.isInMax) return;
    var u = window.MaxApp.getUser();
    if (u) {
      if (u.first_name && !$("#f-name").value) {
        $("#f-name").value = [u.first_name, u.last_name].filter(Boolean).join(" ");
      }
      if (u.phone_number && !phoneInput.value) {
        phoneInput.value = u.phone_number;
        phoneInput.dispatchEvent(new Event("input"));
      }
    }
  }

  /* ---------- Запуск ---------- */
  fillTexts();
  renderPrices();
  initPicker();
  prefillFromMax();
})();
