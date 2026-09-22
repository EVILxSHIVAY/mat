const { app, BrowserWindow } = require('electron');

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 850,
        show: false,
        backgroundColor: '#f8fafc',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    const targetUrl = 'http://localhost:3000';

    const loadApp = () => {
        win.loadURL(targetUrl).catch(() => {
            console.log('Waiting for Next.js dev server at http://localhost:3000... Retrying in 1.5s');
            setTimeout(loadApp, 1500);
        });
    };

    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        if (validatedURL.includes('localhost:3000')) {
            console.log(`Connection to dev server failed (${errorDescription}). Retrying in 1.5s...`);
            setTimeout(loadApp, 1500);
        }
    });

    loadApp();
}

if (app) {
    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}
