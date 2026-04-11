import {
  buildCloseDigestSummary,
  buildDiscordPayload,
  formatTaipeiDate,
  loadCloseDigestData,
} from './lib/close-digest.mjs';

async function sendDiscordMessage(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Skip Discord push: missing DISCORD_WEBHOOK_URL.');
    return;
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
    throw new Error(`Discord send failed: ${response.status} ${errorText}`);
  }
}

async function main() {
  const today = formatTaipeiDate();
  const data = await loadCloseDigestData();
  const summary = buildCloseDigestSummary({
    ...data,
    today,
  });
  const payload = buildDiscordPayload(summary);

  if (!payload) {
    console.log(`Skip Discord push: market date does not match today (${today}).`);
    return;
  }

  await sendDiscordMessage(payload);
  console.log(`Discord push sent for ${today}.`);
}

await main();
