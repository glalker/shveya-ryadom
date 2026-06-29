/*
 * maxClient.js — отправка сообщения в мессенджер MAX через Bot API.
 *
 * Как это работает:
 *  1. В приложении MAX через системного бота-помощника (поиск: «MasterBot»
 *     или раздел для разработчиков) создаётся бот и выдаётся токен доступа.
 *  2. Мама один раз пишет своему боту «Привет» — так бот узнаёт её ID получателя.
 *     ID можно увидеть в обновлениях бота (GET /updates) — см. README.
 *  3. Токен и ID кладём в server/.env. Сюда заявки и будут «прилетать».
 *
 * Базовый URL и способ указания получателя вынесены в переменные окружения,
 * чтобы при уточнении деталей API ничего не пришлось менять в коде —
 * только в .env.
 *
 * Актуально на 2026 год (см. https://dev.max.ru/docs-api):
 *  - хост: https://botapi.max.ru (проверено: platform-api2.max.ru не резолвится);
 *  - токен передаётся в заголовке Authorization, НЕ в query-параметре;
 *  - получатель — query-параметр user_id (личный диалог) или chat_id (группа).
 */

const API_BASE = process.env.MAX_API_BASE || "https://botapi.max.ru";
const TOKEN = process.env.MAX_BOT_TOKEN || "";
const RECIPIENT_ID = process.env.MAX_RECIPIENT_ID || "";
// Тип получателя: "user" (личный диалог с мамой) или "chat" (группа/чат).
const RECIPIENT_TYPE = (process.env.MAX_RECIPIENT_TYPE || "user").toLowerCase();

function isConfigured() {
  return Boolean(TOKEN && RECIPIENT_ID);
}

/**
 * Отправить текстовое сообщение получателю по умолчанию.
 * @param {string} text — текст сообщения (поддерживает markdown).
 * @returns {Promise<{ok: boolean, status?: number, body?: any, error?: string}>}
 */
async function sendMessage(text) {
  if (!isConfigured()) {
    return { ok: false, error: "MAX не настроен: задайте MAX_BOT_TOKEN и MAX_RECIPIENT_ID в server/.env" };
  }

  // Получателя MAX Bot API принимает как query-параметр user_id или chat_id.
  const recipientParam = RECIPIENT_TYPE === "chat" ? "chat_id" : "user_id";
  const url =
    `${API_BASE}/messages?${recipientParam}=${encodeURIComponent(RECIPIENT_ID)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Токен — только в заголовке Authorization (query больше не поддерживается).
        Authorization: TOKEN,
      },
      body: JSON.stringify({ text, format: "markdown" }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `MAX API ответил ${res.status}` };
    }
    return { ok: true, status: res.status, body };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = { sendMessage, isConfigured, API_BASE, RECIPIENT_TYPE };
