import {
  buildCloseDigestSummary,
  buildTelegramMessage,
  formatTaipeiDate,
  loadCloseDigestData,
} from './lib/close-digest.mjs';

async function sendTelegramMessage(message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('Skip Telegram push: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID.');
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
    throw new Error(`Telegram send failed: ${response.status} ${errorText}`);
  }

  return true;
}

async function main() {
  const today = formatTaipeiDate();
  const data = await loadCloseDigestData();
  const summary = buildCloseDigestSummary({
    ...data,
    today,
  });
  const message = buildTelegramMessage(summary);

  if (!message) {
    console.log(`Skip Telegram push: market date does not match today (${today}).`);
    return;
  }

  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log(`Telegram push sent for ${today}.`);
  }
}

await main();
