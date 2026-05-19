import {
  buildCloseDigestSummary,
  getDigestTargetDate,
  loadCloseDigestData,
} from './lib/close-digest.mjs';
import { buildLineBroadcastMessages } from './lib/line-flex.mjs';

async function sendLineMessage(messages) {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    console.log('Skip LINE push: missing LINE_CHANNEL_ACCESS_TOKEN.');
    return false;
  }

  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE send failed: ${response.status} ${errorText}`);
  }

  const requestId = response.headers.get('x-line-request-id');

  if (requestId) {
    console.log(`LINE broadcast accepted. request-id=${requestId}`);
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
  const payload = buildLineBroadcastMessages(summary);

  if (!payload?.messages?.length) {
    console.log(`Skip LINE push: market date does not match digest target date (${targetDate}).`);
    return;
  }

  const sent = await sendLineMessage(payload.messages);

  if (sent) {
    console.log(`LINE push sent for ${targetDate}.`);
  }
}

await main();
