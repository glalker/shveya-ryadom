/*
 * maxapp.js — тонкий адаптер для будущего мини-аппа в MAX.
 *
 * Сейчас сайт работает как обычная веб-страница. Когда мы поместим его внутрь
 * MAX (мини-апп), MAX предоставит JS-мост (аналог Telegram.WebApp).
 * Этот файл определяет, открыт ли сайт внутри MAX, и даёт единый интерфейс,
 * чтобы остальной код (app.js) не зависел от платформы.
 *
 * Когда появится официальный SDK MAX — достаточно будет дополнить этот файл,
 * не трогая остальной код.
 */
(function () {
  // Возможные точки входа моста MAX (на будущее; имена могут уточниться по SDK).
  var bridge =
    window.MAX && window.MAX.WebApp ? window.MAX.WebApp :
    window.maxWebApp ? window.maxWebApp :
    null;

  var isInMax = !!bridge;

  var MaxApp = {
    isInMax: isInMax,

    /** Сообщить платформе, что приложение готово (и развернуть на весь экран). */
    ready: function () {
      try {
        if (bridge && typeof bridge.ready === "function") bridge.ready();
        if (bridge && typeof bridge.expand === "function") bridge.expand();
      } catch (e) { /* безопасно игнорируем вне MAX */ }
    },

    /** Данные пользователя из MAX, если доступны (имя/телефон можно подставить в форму). */
    getUser: function () {
      try {
        if (bridge && bridge.initDataUnsafe && bridge.initDataUnsafe.user) {
          return bridge.initDataUnsafe.user;
        }
      } catch (e) {}
      return null;
    },

    /** Лёгкая тактильная отдача, если платформа поддерживает. */
    haptic: function () {
      try {
        if (bridge && bridge.HapticFeedback && bridge.HapticFeedback.impactOccurred) {
          bridge.HapticFeedback.impactOccurred("light");
        }
      } catch (e) {}
    },

    /**
     * Заголовок, который видит мостовой контекст (initData) — пригодится бэкенду,
     * чтобы доверенно знать пользователя MAX. Сейчас пусто вне MAX.
     */
    initData: (bridge && bridge.initData) || "",
  };

  if (isInMax) {
    document.documentElement.classList.add("in-max");
    document.addEventListener("DOMContentLoaded", function () {
      document.body.classList.add("in-max");
    });
    MaxApp.ready();
  }

  window.MaxApp = MaxApp;
})();
