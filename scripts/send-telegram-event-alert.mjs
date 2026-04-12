import {
  buildEventAlertSummary,
  buildTelegramEventAlertMessage,
  formatTaipeiDate,
  loadEventAlertData,
} from './lib/event-alerts.mjs';

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('Skip Telegram event alert: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram event alert failed: ${response.status} ${errorText}`);
  }

  return true;
}

async function main() {
  const today = process.env.ALERT_DATE || formatTaipeiDate();
  const data = await loadEventAlertData();
  const summary = buildEventAlertSummary({
    ...data,
    today,
  });
  const message = buildTelegramEventAlertMessage(summary);

  if (!message) {
    console.log(`Skip Telegram event alert: no actionable events for ${today}.`);
    return;
  }

  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log(`Telegram event alert sent for ${today}.`);
  }
}

await main();
