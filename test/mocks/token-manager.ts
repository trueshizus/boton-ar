class MockTokenManager {
  private storage: {
    key: string;
    value: string;
    expires_at: number;
  } | null = null;

  async set(token: string, expiresIn: number) {
    const expiresAt = Date.now() + expiresIn * 1000;
    this.storage = {
      key: "reddit_token",
      value: token,
      expires_at: expiresAt,
    };
  }

  get(): string | null {
    if (!this.storage || this.storage.expires_at <= Date.now()) {
      return null;
    }
    return this.storage.value;
  }

  clear() {
    this.storage = null;
  }
}

const mockTokenManager = new MockTokenManager();

export default () => ({
  default: mockTokenManager,
  TokenManager: MockTokenManager,
});
