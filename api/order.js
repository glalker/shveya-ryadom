/*
 * api/order.js — serverless-функция Vercel: принимает заявку с сайта и шлёт её маме в MAX.
 *
 * Чем отличается от server/server.js:
 *  - Это не постоянно работающий сервер, а функция, которая запускается на доли
 *    секунды только в момент отправки заявки. Сама страница (public/) отдаётся
 *    с CDN Vercel мгновенно — поэтому в мини-аппе MAX нет «загрузки сервера».
 *  - Токен MAX лежит в переменных окружения Vercel (Project → Settings → Environment),
 *    в браузер он не попадает и в репозиторий не коммитится.
 *
 * Переменные окружения (задаются в дашборде Vercel):
 *  MAX_BOT_TOKEN     — токен бота
 *  MAX_RECIPIENT_ID  — user_id получателя (мама)
 *  MAX_RECIPIENT_TYPE— "user" (личный диалог) или "chat" (группа)
 *  MAX_API_BASE      — https://botapi.max.ru
 */

const API_BASE = process.env.MAX_API_BASE || "https://botapi.max.ru";
const TOKEN = process.env.MAX_BOT_TOKEN || "";
const RECIPIENT_ID = process.env.MAX_RECIPIENT_ID || "";
const RECIPIENT_TYPE = (process.env.MAX_RECIPIENT_TYPE || "user").toLowerCase();

const URGENCY_LABEL = {
  regular: "Обычный срок",
  soon: "На этой неделе",
  urgent: "Срочно (1–2 дня)",
};

function clean(v, max = 600) {
  return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
}

function buildMessage(order) {
  const lines = [];
  lines.push("🧵 *Новая заявка с сайта*");
  lines.push("");
  if (order.service) lines.push(`*Услуга:* ${order.service}`);
  if (order.name) lines.push(`*Имя:* ${order.name}`);
  lines.push(`*Телефон:* ${order.phone}`);
  if (order.comment) lines.push(`*Комментарий:* ${order.comment}`);
  const urg = order.picker && URGENCY_LABEL[order.picker.urgency];
  if (urg) lines.push(`*Срочность:* ${urg}`);
  lines.push("");
  lines.push(`_Источник: ${order.source === "max-miniapp" ? "мини-апп MAX" : "сайт"}_`);
  lines.push(`_Время: ${new Date(order.ts || Date.now()).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}_`);
  return lines.join("\n");
}

async function sendToMax(text) {
  if (!TOKEN || !RECIPIENT_ID) {
    return { ok: false, error: "MAX не настроен: задайте MAX_BOT_TOKEN и MAX_RECIPIENT_ID" };
  }
  const recipientParam = RECIPIENT_TYPE === "chat" ? "chat_id" : "user_id";
  const url = `${API_BASE}/messages?${recipientParam}=${encodeURIComponent(RECIPIENT_ID)}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: TOKEN },
      body: JSON.stringify({ text, format: "markdown" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, body, error: `MAX API ответил ${res.status}` };
    return { ok: true, status: res.status, body };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

module.exports = async (req, res) => {
  // Разрешаем вызов и из мини-аппа, и при открытии сайта на любом домене.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Только POST" });

  const b = req.body || {};
  const order = {
    service: clean(b.service),
    name: clean(b.name, 120),
    phone: clean(b.phone, 40),
    comment: clean(b.comment, 1000),
    picker: b.picker && typeof b.picker === "object" ? b.picker : {},
    source: b.source === "max-miniapp" ? "max-miniapp" : "website",
    ts: b.ts,
  };

  const digits = order.phone.replace(/\D/g, "");
  if (digits.length < 10) {
    return res.status(400).json({ ok: false, error: "Некорректный телефон" });
  }

  // Дублируем заявку в логи Vercel — на случай, если доставка в MAX не пройдёт.
  console.log("Заявка:", JSON.stringify({ ...order, ts: undefined }));

  const result = await sendToMax(buildMessage(order));
  if (!result.ok) {
    console.error("MAX доставка не удалась:", result.error, result.body || "");
    return res.status(200).json({ ok: true, delivered: false });
  }
  return res.status(200).json({ ok: true, delivered: true });
};
