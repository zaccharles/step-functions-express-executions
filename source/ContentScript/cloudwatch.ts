import * as crypto from 'crypto';
import {
  DescribeLogStreamsRequest,
  DescribeLogStreamsResponse,
  FilterLogEventsRequest,
  FilterLogEventsResponse,
  GetLogEventsRequest,
  GetLogEventsResponse,
} from '@aws-sdk/client-cloudwatch-logs';
import {xfetch} from './xfetch';

let cachedCsrfToken: string;

async function getCsrfToken(region: string): Promise<string> {
  if (!cachedCsrfToken) {
    const newCsrfToken = await xfetch<string>(
      `https://${region}.console.aws.amazon.com/cloudwatch/dashboard`,
      {bodyMode: 'text'}
    )
      .then((response) => response.body)
      .then((html) => html.match(/<meta.*?csrf.*?content="(.+?)"/)?.[1]);

    if (!newCsrfToken) {
      throw new Error('Failed to get CloudWatch CSRF token.');
    }

    cachedCsrfToken = newCsrfToken;
  }

  return cachedCsrfToken;
}

interface SignedRequestHeaders {
  Authorization: string;
  'X-Amz-Date': string;
  'X-Amz-Requested-Operation': string;
  'X-Amz-Security-Token': string;
  'X-Amz-Target': string;
  'X-Amz-User-Agent': string;
}

interface SdkSignRequest {
  Service: 'logs';
  Endpoint: string;
  HttpMethod: string;
  Region: string;
  Path: '/';
  Headers: {
    'X-Amz-User-Agent': 'aws-sdk-js/2.1071.0 promise';
    'X-Amz-Requested-Operation': string;
    'Content-Type': 'application/x-amz-json-1.1';
    'X-Amz-Target': string;
    'X-Amz-Content-Sha256': string;
    'Content-Length': number;
    Host: string;
    'X-Amz-Date': string;
    'x-amz-security-token': 'placeholder-session-token';
    Authorization: string;
  };
  Body: string;
}

interface SdkSignResponse {
  Authorization: string;
  Host: string;
  'X-Amz-Date': string;
  'X-Amz-Requested-Operation': string;
  'X-Amz-Security-Token': string;
  'X-Amz-Target': string;
  'X-Amz-User-Agent': string;
}

interface SignableRequestDetails {
  /**
   * Example: `{}`
   */
  body: string;
  /**
   * Example: `describeLogStreams`
   */
  operation: string;
  /**
   * Example: `Logs_20140328.DescribeLogStreams`
   */
  target: string;
  /**
   * Example: `us-east-1`
   */
  region: string;
  /**
   * Example: `POST`
   */
  httpMethod: string;
}

async function signRequest(
  input: SignableRequestDetails
): Promise<SignedRequestHeaders> {
  const csrfToken = await getCsrfToken(input.region);

  const now = new Date();
  const date =
    now.getUTCFullYear() +
    (now.getUTCMonth() + 1).toString().padStart(2, '0') +
    now.getUTCDate().toString().padStart(2, '0');

  const request: SdkSignRequest = {
    Service: 'logs',
    Endpoint: `logs.${input.region}.amazonaws.com`,
    HttpMethod: input.httpMethod,
    Region: window.region,
    Path: '/',
    Headers: {
      'X-Amz-User-Agent': 'aws-sdk-js/2.1071.0 promise',
      'X-Amz-Requested-Operation': input.operation,
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': input.target,
      'X-Amz-Content-Sha256': crypto
        .createHash('sha256')
        .update(input.body)
        .digest('base64'),
      'Content-Length': input.body.length,
      Host: `logs.${input.region}.amazonaws.com`,
      'X-Amz-Date': now.toISOString(),
      'x-amz-security-token': 'placeholder-session-token',
      Authorization:
        `AWS4-HMAC-SHA256 Credential=placeholder-access-key-id/${date}/${input.region}/logs/aws4_request,` +
        `SignedHeaders=host;x-amz-content-sha256;x-amz-date;x-amz-requested-operation;x-amz-security-token;x-amz-target;` +
        `x-amz-user-agent, Signature=b9ce27a9f6de29581cddabbfd8afd7479f4a8366eebf099c349b491ec1ad8943`,
    },
    Body: input.body,
  };

  const response = await xfetch<SdkSignResponse>(
    `https://${input.region}.console.aws.amazon.com/cloudwatch/CloudWatch/data/auth.SdkSign`,
    {
      method: 'POST',
      body: JSON.stringify(request),
      headers: {
        'X-Amz-Target': 'auth.SdkSign',
        'x-csrf-token': csrfToken,
      },
    }
  );

  return response.body;
}

export async function sendRequest<TRequest, TResponse>(
  region: string,
  operation: string,
  target: string,
  httpMethod: string,
  input: TRequest
): Promise<TResponse> {
  const body = JSON.stringify(input);
  const headers = await signRequest({
    body,
    operation,
    target,
    region,
    httpMethod,
  });

  const response = await xfetch<TResponse>(
    `https://logs.${region}.amazonaws.com`,
    {
      method: httpMethod,
      body,
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        ...headers,
      },
    }
  );

  return response.body;
}

export async function describeLogStreams(
  region: string,
  input: DescribeLogStreamsRequest
): Promise<DescribeLogStreamsResponse> {
  return sendRequest(
    region,
    'describeLogStreams',
    'Logs_20140328.DescribeLogStreams',
    'POST',
    input
  );
}

export async function getLogEvents(
  region: string,
  input: GetLogEventsRequest
): Promise<GetLogEventsResponse> {
  return sendRequest(
    region,
    'getLogEvents',
    'Logs_20140328.GetLogEvents',
    'POST',
    input
  );
}

export async function filterLogEvents(
  region: string,
  input: FilterLogEventsRequest
): Promise<FilterLogEventsResponse> {
  return sendRequest(
    region,
    'filterLogEvents',
    'Logs_20140328.FilterLogEvents',
    'POST',
    input
  );
}
