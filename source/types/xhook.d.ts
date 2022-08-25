declare module 'xhook' {
  type XHookResponse = {
    data: string;
    finalUrl: string;
    headers: Record<string, string>;
    status: number;
    statusText: string;
    text: string;
  };
  type XHookRequest = {
    method: string;
    url: string;
    body: string;
    headers: Record<string, string>;
    timeout: number;
    type: string;
    withCredentials: string;
  };
  type XHookHandler = (
    request: XHookRequest
  ) => Promise<XHookResponse | undefined>;
  function after(
    handler: (request: XHookRequest, response: XHookResponse) => void
  );
  function before(
    handler: (
      request: XHookRequest,
      callback: (response?: XHookResponse) => void
    ) => void
  );
}
