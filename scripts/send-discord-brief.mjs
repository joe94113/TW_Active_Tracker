import {
  buildCloseDigestSummary,
  buildDiscordPayload,
  getDigestTargetDate,
  loadCloseDigestData,
} from './lib/close-digest.mjs';

async function sendDiscordMessage(payload) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log('Skip Discord push: missing DISCORD_WEBHOOK_URL.');
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
    throw new Error(`Discord send failed: ${response.status} ${errorText}`);
  }

  return true;
}

async function sendDiscordMessages(payload) {
  if (!payload?.embeds?.length) {
    return false;
  }

  if (payload.embeds.length === 1) {
    return sendDiscordMessage(payload);
  }

  for (const embed of payload.embeds) {
    await sendDiscordMessage({
      username: payload.username,
      avatar_url: payload.avatar_url,
      embeds: [embed],
      allowed_mentions: payload.allowed_mentions ?? { parse: [] },
    });
  }

  return true;
}

async function main() {
  const targetDate = process.env.DIGEST_TARGET_DATE || getDigestTargetDate();
  const data = await loadCloseDigestData();
  const summary = buildCloseDigestSummary({
    ...data,
    today: targetDate,
  });
  const payload = buildDiscordPayload(summary);

  if (!payload) {
    console.log(`Skip Discord push: market date does not match digest target date (${targetDate}).`);
    return;
  }

  const sent = await sendDiscordMessages(payload);

  if (sent) {
    console.log(`Discord push sent for ${targetDate}.`);
  }
}

await main();
