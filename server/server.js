/*
 * server.js — небольшой сервер: отдаёт сайт и принимает заявки.
 *
 * Поток заявки:
 *   браузер -> POST /api/order -> сервер форматирует сообщение
 *           -> отправляет маме в MAX -> дублирует в файл-журнал (на всякий случай)
 *
 * Телефон мамы нигде не публикуется: клиент оставляет СВОЙ телефон,
 * заявка приходит маме в MAX, и она сама перезванивает.
 *
 * Запуск:  cd server && cp .env.example .env && (заполнить) && npm install && npm start
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const max = require("./maxClient");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_LOG = path.join(DATA_DIR, "orders.jsonl");

app.use(express.json({ limit: "32kb" }));
app.use(express.static(PUBLIC_DIR));

// --- Утилиты ---
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

function backupToFile(order) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const record = {
      receivedAt: new Date().toISOString(),
      service: order.service,
      name: order.name,
      phone: order.phone,
      comment: order.comment,
      source: order.source,
    };
    fs.appendFileSync(ORDERS_LOG, JSON.stringify(record) + "\n", "utf8");
  } catch (e) {
    console.error("Не удалось записать заявку в журнал:", e.message);
  }
}

// --- Приём заявки ---
app.post("/api/order", async (req, res) => {
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

  // Минимальная валидация: телефон обязателен.
  const digits = order.phone.replace(/\D/g, "");
  if (digits.length < 10) {
    return res.status(400).json({ ok: false, error: "Некорректный телефон" });
  }

  // 1) Всегда сохраняем заявку локально, чтобы она не потерялась.
  backupToFile(order);

  // 2) Отправляем маме в MAX.
  const result = await max.sendMessage(buildMessage(order));

  if (!result.ok) {
    // Заявка уже в журнале — отвечаем 200, чтобы клиент видел успех,
    // но логируем проблему доставки для разбора.
    console.error("MAX доставка не удалась:", result.error, result.body || "");
    return res.json({ ok: true, delivered: false });
  }

  return res.json({ ok: true, delivered: true });
});

// healthcheck
app.get("/api/health", (req, res) => {
  res.json({ ok: true, maxConfigured: max.isConfigured() });
});

app.listen(PORT, () => {
  console.log(`\n  Сайт «Ваша швея рядом» запущен:  http://localhost:${PORT}`);
  console.log(`  MAX настроен: ${max.isConfigured() ? "да" : "НЕТ (заявки сохраняются в server/data/orders.jsonl)"}\n`);
});
