import { EidsClientError, EidsHttpClient } from './eids.client';

function config(values: Record<string, unknown>) {
  return { get: jest.fn((key: string) => values[key]) };
}

const settings = {
  EIDS_API_BASE_URL: 'https://eids.test/api',
  EIDS_GET_USER_CODE_PATH: '/GetKullaniciKodu',
  EIDS_GET_USER_CODE_REQUEST_FIELD: 'yetkiKodu',
  EIDS_GET_USER_CODE_RESPONSE_FIELD: 'data.kullaniciKodu',
  EIDS_BASIC_AUTH_USERNAME: 'client-user',
  EIDS_BASIC_AUTH_PASSWORD: 'client-password',
  EIDS_REQUEST_TIMEOUT_MS: 50,
};

describe('EidsHttpClient', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the configured request and validates the configured response path', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { kullaniciKodu: 'user-code' } }), { status: 200 }));
    const result = await new EidsHttpClient(config(settings) as never).getUserCode({ authorizationCode: 'authorization-code' });
    expect(result).toEqual({ userCode: 'user-code' });
    expect(fetchMock).toHaveBeenCalledWith('https://eids.test/GetKullaniciKodu', expect.objectContaining({ method: 'POST', body: JSON.stringify({ yetkiKodu: 'authorization-code' }) }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
  });

  it.each([
    [401, 'http_4xx'],
    [500, 'http_5xx'],
  ] as const)('maps HTTP %s without exposing upstream content', async (status, reason) => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('upstream-secret', { status }));
    const error = await new EidsHttpClient(config(settings) as never).getUserCode({ authorizationCode: 'authorization-code' }).catch((value) => value as EidsClientError);
    expect(error).toBeInstanceOf(EidsClientError);
    expect(error.reason).toBe(reason);
    expect(error.message).not.toContain('upstream-secret');
  });

  it('rejects malformed and empty user-code responses', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{bad-json', { status: 200 }));
    await expect(new EidsHttpClient(config(settings) as never).getUserCode({ authorizationCode: 'authorization-code' })).rejects.toMatchObject({ reason: 'invalid_response' });
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ data: { kullaniciKodu: ' ' } }), { status: 200 }));
    await expect(new EidsHttpClient(config(settings) as never).getUserCode({ authorizationCode: 'authorization-code' })).rejects.toMatchObject({ reason: 'missing_user_code' });
  });

  it('does not call the network when EİDS client configuration is incomplete', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    await expect(new EidsHttpClient(config({ ...settings, EIDS_GET_USER_CODE_PATH: '' }) as never).getUserCode({ authorizationCode: 'authorization-code' })).rejects.toMatchObject({ reason: 'configuration' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps timeout and network failures without exposing transport details', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('socket detail'), { name: 'AbortError' })));
    }));
    await expect(new EidsHttpClient(config({ ...settings, EIDS_REQUEST_TIMEOUT_MS: 1 }) as never).getUserCode({ authorizationCode: 'authorization-code' })).rejects.toMatchObject({ reason: 'timeout' });

    jest.restoreAllMocks();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('socket detail'));
    const error = await new EidsHttpClient(config(settings) as never).getUserCode({ authorizationCode: 'authorization-code' }).catch((value) => value as EidsClientError);
    expect(error).toMatchObject({ reason: 'network' });
    expect(error.message).not.toContain('socket detail');
  });
});
