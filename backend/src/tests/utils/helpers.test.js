const { getMessages } = require('../../utils/helpers');

describe('Helpers Utility', () => {
  describe('getMessages', () => {
    it('should return null for messages if none are present in query', () => {
      const req = { query: {} };
      const messages = getMessages(req);
      expect(messages.successMessage).toBeNull();
      expect(messages.errorMessage).toBeNull();
    });

    it('should return success and error messages if present in query', () => {
      const req = {
        query: {
          'success-message': 'Operation successful',
          'error-message': 'Operation failed'
        }
      };
      const messages = getMessages(req);
      expect(messages.successMessage).toBe('Operation successful');
      expect(messages.errorMessage).toBe('Operation failed');
    });

    it('should return only success message if error message is not present', () => {
      const req = {
        query: {
          'success-message': 'Operation successful'
        }
      };
      const messages = getMessages(req);
      expect(messages.successMessage).toBe('Operation successful');
      expect(messages.errorMessage).toBeNull();
    });
  });
});
