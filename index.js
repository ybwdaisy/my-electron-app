const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development'

// Custom protocol registration
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('lasoprinter', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('lasoprinter')
}

let printWindow

// Utility function to create a hidden window for printing
const createPrintWindow = () => {
  printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
}

// Function to print an image silently
const printImageSilently = async (imagePath) => {
  return new Promise((resolve, reject) => {
    // Load the HTML content
    printWindow.loadURL(imagePath);

    // Wait for content to load
    printWindow.webContents.on('did-finish-load', () => {
      // Configure print settings
      const printOptions = {
        silent: true,
        printBackground: true,
        margins: {
          marginType: 'none'
        }
      };

      // Print the window contents
      printWindow.webContents.print(printOptions, (success, reason) => {
        // printWindow.close();

        if (success) {
          resolve();
        } else {
          reject(new Error(`Print failed: ${reason}`));
        }
      });
    });

    // Handle errors
    printWindow.webContents.on('did-fail-load', (_, __, errorDescription) => {
      printWindow.close();
      reject(new Error(`Failed to load content: ${errorDescription}`));
    });
  });
}

const handleDeepLink = async (url) => {
  // Parse the URL and extract parameters
  const urlObj = new URL(url)
  const action = urlObj.hostname // or use pathname depending on your URL structure
  const params = Object.fromEntries(urlObj.searchParams)

  if (params.url) {
    const imagePaths = params.url.split(',')

    for (const imagePath of imagePaths) {
      try {
        await printImageSilently(decodeURIComponent(imagePath))
      } catch (error) {
        console.error(`Error printing ${imagePath}:`, error);
      }
    }
  }
}

// Handle deep linking in development
if (isDev) {
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', async (event, commandLine) => {
      if (printWindow) {
        if (printWindow.isMinimized()) {
          printWindow.restore()
        }
        printWindow.focus()
        // Handle the deep link URL
        const url = commandLine.pop();
        await handleDeepLink(url)
      }
    })
  }
}

// Handle deep linking in production
app.on('open-url', async (event, url) => {
  event.preventDefault();
  await handleDeepLink(url)
})

app.whenReady().then(createPrintWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createPrintWindow()
  }
})