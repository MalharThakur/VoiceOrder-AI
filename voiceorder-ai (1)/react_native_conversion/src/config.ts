export const CONFIG = {
  // TOGGLE THIS FLAG TO SWITCH BETWEEN LOCAL SEED DATA AND REAL SYSTEM API
  USE_MOCK_AUTH: true,

  // Public base URL endpoint managed from the central system configuration
  LOGIN_API_URL: 'https://reqres.in/api',

  // SEED DATA FOR LOCAL PLAYGROUND OR SIMULATION (Username to Password matching)
  SEED_ACCOUNTS: {
    admin: 'admin123',
    sales_user: 'sales123',
    test_user: 'test123',
  } as Record<string, string>,
};
