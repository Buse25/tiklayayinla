import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type EidsGetUserCodeInput = {
  authorizationCode: string;
};

export type EidsGetUserCodeResult = {
  userCode: string;
};

export type EidsClientFailureReason =
  | 'configuration'
  | 'timeout'
  | 'network'
  | 'http_4xx'
  | 'http_5xx'
  | 'invalid_response'
  | 'missing_user_code';

export class EidsClientError extends Error {
  constructor(readonly reason: EidsClientFailureReason) {
    super('EİDS kullanıcı kodu alınamadı.');
    this.name = 'EidsClientError';
  }
}

/**
 * EİDS dış servis sınırı.
 *
 * Request/response alan adları environment üzerinden verilir; resmi Bakanlık
 * sözleşmesi repository'de bulunmadığı için payload burada varsayım olarak
 * sabitlenmez. Gerçek contract geldiğinde yalnızca config değiştirilebilir.
 */
@Injectable()
export class EidsHttpClient {
  constructor(private readonly config: ConfigService) {}

  async getUserCode(input: EidsGetUserCodeInput): Promise<EidsGetUserCodeResult> {
    const baseUrl = this.config.get<string>('EIDS_API_BASE_URL')?.trim();
    const path = this.config.get<string>('EIDS_GET_USER_CODE_PATH')?.trim();
    const requestField = this.config.get<string>('EIDS_GET_USER_CODE_REQUEST_FIELD')?.trim();
    const responseField = this.config.get<string>('EIDS_GET_USER_CODE_RESPONSE_FIELD')?.trim();
    const username = this.config.get<string>('EIDS_BASIC_AUTH_USERNAME');
    const password = this.config.get<string>('EIDS_BASIC_AUTH_PASSWORD');
    const timeoutMs = this.config.get<number>('EIDS_REQUEST_TIMEOUT_MS') ?? 5_000;

    if (!baseUrl || !path || !requestField || !responseField || !username || !password) {
      throw new EidsClientError('configuration');
    }

    let url: string;
    try {
      url = new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
    } catch {
      throw new EidsClientError('configuration');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        },
        body: JSON.stringify({ [requestField]: input.authorizationCode }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new EidsClientError('timeout');
      throw new EidsClientError('network');
    } finally {
      clearTimeout(timer);
    }

    if (response.status >= 400 && response.status < 500) throw new EidsClientError('http_4xx');
    if (response.status >= 500) throw new EidsClientError('http_5xx');
    if (!response.ok) throw new EidsClientError('invalid_response');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EidsClientError('invalid_response');
    }

    const value = readPath(payload, responseField);
    if (typeof value !== 'string') throw new EidsClientError('missing_user_code');
    const userCode = value.trim();
    if (!userCode) throw new EidsClientError('missing_user_code');
    return { userCode };
  }
}

function readPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || !(key in current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
