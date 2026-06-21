import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import process from 'node:process'
import { dialog, Menu } from 'electron'

interface MenuOptions {
  win: BrowserWindow
  onOpen: (absPath: string) => void
}

// App menu with native Open dialog. Handlers reload the window with the chosen trace.
export function buildMenu({ win, onOpen }: MenuOptions): void {
  const openTrace = async (): Promise<void> => {
    const res = await dialog.showOpenDialog(win, {
      title: 'Open Playwright trace',
      properties: ['openFile'],
      filters: [{ name: 'Playwright trace', extensions: ['zip'] }],
    })
    if (!res.canceled && res.filePaths[0])
      onOpen(res.filePaths[0])
  }

  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' } as MenuItemConstructorOptions] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open Trace…', accelerator: 'CmdOrCtrl+O', click: () => { void openTrace() } },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
