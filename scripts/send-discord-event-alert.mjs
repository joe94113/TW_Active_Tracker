import {
  buildDiscordEventAlertPayload,
  buildEventAlertSummary,
  formatTaipeiDate,
  loadEventAlertData,
} from './lib/event-alerts.mjs';

async function sendDiscordMessage(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Skip Discord event alert: missing DISCORD_WEBHOOK_URL.');
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord event alert failed: ${response.status} ${errorText}`);
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
  const payload = buildDiscordEventAlertPayload(summary);

  if (!payload) {
    console.log(`Skip Discord event alert: no actionable events for ${today}.`);
    return;
  }

  const sent = await sendDiscordMessage(payload);

  if (sent) {
    console.log(`Discord event alert sent for ${today}.`);
  }
}

await main();
