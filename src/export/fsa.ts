export async function pickVaultDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome·Edge·Arc·Brave를 사용해주세요.');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
  return handle as FileSystemDirectoryHandle;
}

export async function ensureWritePermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const h = handle as any;
  const opts = { mode: 'readwrite' } as const;
  if ((await h.queryPermission(opts)) === 'granted') return true;
  return (await h.requestPermission(opts)) === 'granted';
}

export async function writeMarkdown(
  vault: FileSystemDirectoryHandle,
  categoryName: string,
  filename: string,
  contents: string,
): Promise<void> {
  const categoryDir = await vault.getDirectoryHandle(categoryName, { create: true });
  const fileHandle = await categoryDir.getFileHandle(`${filename}.md`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}
