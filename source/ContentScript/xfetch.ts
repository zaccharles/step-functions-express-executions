const requestEventType = 'x-fetch-request';
const responseEventType = 'x-fetch-response';

interface XFetchInput {
  readonly id: string;
  readonly url: string;
  readonly options?: Parameters<typeof fetch>['1'] & {
    bodyMode?: 'json' | 'text';
  };
}

interface XFetchOutput<T> {
  readonly id: string;
  readonly error?: Error;
  readonly response: {
    readonly status: number;
    readonly ok: boolean;
    readonly body: T;
  };
}

export async function xfetch<T = unknown>(
  url: string,
  options?: Parameters<typeof fetch>['1'] & {bodyMode?: 'json' | 'text'}
): Promise<XFetchOutput<T>['response']> {
  const requestId = Math.random().toString();

  return new Promise((resolve, reject) => {
    document.addEventListener(responseEventType, function listener(event) {
      const {
        id: responseId,
        response,
        error,
      } = (event as unknown as {detail: unknown}).detail as XFetchOutput<T>;

      if (responseId !== requestId) return;

      if (error) {
        reject(error);
        return;
      }

      resolve(response);
      document.removeEventListener(responseEventType, listener);
    });

    document.dispatchEvent(
      new CustomEvent<XFetchInput>(requestEventType, {
        detail: {
          id: requestId,
          url,
          options,
        },
      })
    );
  });
}

export function setupXFetch(): void {
  document.addEventListener(requestEventType, function handle(event) {
    const {id, url, options} = (event as unknown as {detail: unknown})
      .detail as XFetchInput;

    fetch(url, {
      ...options,
      headers: options?.headers,
    })
      .then(async (response) => {
        const body = await (options?.bodyMode === 'text'
          ? response.text()
          : response.json());

        document.dispatchEvent(
          new CustomEvent<XFetchOutput<unknown>>(responseEventType, {
            detail: {
              id,
              response: {
                status: response.status,
                ok: response.ok,
                body,
              },
            },
          })
        );
      })
      .catch((error: Error) => {
        document.dispatchEvent(
          new CustomEvent<Partial<XFetchOutput<unknown>>>(responseEventType, {
            detail: {
              id,
              error: {
                name: error.name,
                message: error.message,
                stack: error.stack,
              },
            },
          })
        );
      });
  });
}
