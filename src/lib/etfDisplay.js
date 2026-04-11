export function getEtfDetailAvailability(item) {
  return item?.detailAvailability ?? (item?.trackingStatus === '已串接' ? 'full' : 'market');
}

export function getEtfAvailabilityLabel(item) {
  const availability = getEtfDetailAvailability(item);

  if (availability === 'full') {
    return '完整資料';
  }

  if (availability === 'market') {
    return '行情圖表';
  }

  return '整理中';
}

export function getEtfAvailabilityNote(item) {
  const availability = getEtfDetailAvailability(item);

  if (availability === 'full') {
    return '最新成分、異動與行情都已整理。';
  }

  if (availability === 'market') {
    return '目前先提供行情與技術面，成分股與異動整理中。';
  }

  return '更多資料整理中，稍後會陸續補齊。';
}
