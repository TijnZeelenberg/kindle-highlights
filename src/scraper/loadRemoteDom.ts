import cheerio, { Root } from 'cheerio';
import { BrowserWindow, remote } from 'electron';

import { ee } from '~/eventEmitter';

const { BrowserWindow: RemoteBrowserWindow } = remote;

const LOAD_DEADLINE_MS = 45_000;

type DomResult = {
  dom: Root;
  didNavigateUrl: string;
};

type LoadRemoteDomOptions = {
  log?: boolean;
  label?: string;
};

export const loadRemoteDom = async (
  targetUrl: string,
  timeout = 0,
  options: LoadRemoteDomOptions = {}
): Promise<DomResult> => {
  const shouldLog = options.log !== false;
  const labelPrefix = options.label ? `${options.label}: ` : '';

  const window: BrowserWindow = new RemoteBrowserWindow({
    width: 1000,
    height: 600,
    webPreferences: {
      webSecurity: false,
      nodeIntegration: false,
      partition: 'persist:kindle-highlights',
    },
    show: false,
  });

  // Rejections are handled by the deadline below; loadURL also rejects on harmless redirects
  window.loadURL(targetUrl).catch(() => undefined);

  return new Promise<DomResult>((resolveWrapper, rejectWrapper) => {
    let didNavigateUrl: string = null;
    let settled = false;

    const finish = (error: Error | null, result?: DomResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(deadline);
      if (!window.isDestroyed()) {
        window.destroy();
      }
      if (error) {
        rejectWrapper(error);
      } else {
        resolveWrapper(result);
      }
    };

    // Amazon pages sometimes re-navigate mid-load, after which did-finish-load or
    // executeJavaScript never settles; without a deadline the whole sync hangs
    const deadline = setTimeout(() => {
      if (shouldLog) {
        ee.emit('syncLog', `${labelPrefix}Timed out loading ${targetUrl}`);
      }
      finish(new Error(`Timed out loading ${targetUrl}`));
    }, timeout + LOAD_DEADLINE_MS);

    window.webContents.on('did-navigate', (_event, url) => {
      didNavigateUrl = url;

      if (url !== targetUrl) {
        if (shouldLog) {
          ee.emit('syncLog', `${labelPrefix}Navigated to ${url}`);
        }
      }
    });

    window.webContents.once('did-finish-load', () => {
      if (shouldLog) {
        ee.emit('syncLog', `${labelPrefix}Page loaded`);
      }
      Promise.resolve()
        .then(() => {
          if (timeout > 0) {
            if (shouldLog) {
              ee.emit(
                'syncLog',
                `${labelPrefix}Waiting ${Math.round(timeout / 1000)}s for content to render…`
              );
            }
            return new Promise((resolve) => {
              setTimeout(resolve, timeout);
            });
          }
        })
        .then(() => {
          if (settled) {
            return null;
          }
          if (shouldLog) {
            ee.emit('syncLog', `${labelPrefix}Extracting page content…`);
          }
          return window.webContents.executeJavaScript(
            `document.querySelector('body').innerHTML`
          ) as Promise<string>;
        })
        .then((html) => {
          if (settled) {
            return;
          }
          if (shouldLog) {
            ee.emit('syncLog', `${labelPrefix}Parsing HTML…`);
          }
          const $ = cheerio.load(html);

          if (shouldLog) {
            ee.emit('syncLog', `${labelPrefix}Page ready`);
          }

          finish(null, {
            dom: $,
            didNavigateUrl: didNavigateUrl,
          });
        })
        .catch((error: Error) => finish(error));
    });
  });
};
