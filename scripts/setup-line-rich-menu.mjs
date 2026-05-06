import { readFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const richMenuConfigPath = path.join(rootDir, 'config', 'line-rich-menu.json');
const richMenuImagePath = process.env.LINE_RICH_MENU_IMAGE
  ? path.resolve(rootDir, process.env.LINE_RICH_MENU_IMAGE)
  : path.join(rootDir, 'public', 'line', 'rich-menu-main.png');

async function createRichMenu(channelAccessToken, config) {
  const validateResponse = await fetch('https://api.line.me/v2/bot/richmenu/validate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(config),
  });

  if (!validateResponse.ok) {
    const errorText = await validateResponse.text();
    throw new Error(`Validate rich menu failed: ${validateResponse.status} ${errorText}`);
  }

  const response = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create rich menu failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return payload.richMenuId;
}

async function uploadRichMenuImage(channelAccessToken, richMenuId, imageBuffer) {
  const response = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'content-type': 'image/png',
      authorization: `Bearer ${channelAccessToken}`,
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload rich menu image failed: ${response.status} ${errorText}`);
  }
}

async function setDefaultRichMenu(channelAccessToken, richMenuId) {
  const response = await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${channelAccessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Set default rich menu failed: ${response.status} ${errorText}`);
  }
}

async function main() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!channelAccessToken) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN.');
  }

  const [configText, imageBuffer] = await Promise.all([
    readFile(richMenuConfigPath, 'utf8'),
    readFile(richMenuImagePath),
  ]);

  const config = JSON.parse(configText);
  const richMenuId = await createRichMenu(channelAccessToken, config);
  await uploadRichMenuImage(channelAccessToken, richMenuId, imageBuffer);
  await setDefaultRichMenu(channelAccessToken, richMenuId);

  console.log(`LINE rich menu is ready. richMenuId=${richMenuId}`);
}

await main();
