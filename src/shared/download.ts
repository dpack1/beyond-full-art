export function downloadBlobUrl(
    imageUrl: string,
    fileName: string,
    doc: Document = document,
): void {
  const link = doc.createElement('a');
  link.href = imageUrl;
  link.download = sanitizeDownloadFileName(fileName);
  link.rel = 'noopener';
  link.style.display = 'none';
  doc.body.append(link);
  link.click();
  link.remove();
}

export function createCharacterArtDownloadFileName(characterId: string): string {
  return `character-${characterId}-full-art`;
}

export function sanitizeDownloadFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();
  if (trimmedFileName === '') {
    return 'character-full-art';
  }

  return trimmedFileName.replace(/[\\/:*?"<>|]+/g, '-');
}
