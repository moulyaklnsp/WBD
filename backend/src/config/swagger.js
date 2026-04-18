/**
 * Swagger / OpenAPI 3.0 configuration for ChessHive API.
 * Scans all route files for @swagger JSDoc comments.
 *
 * UI is served at: GET /api-docs
 * Raw JSON spec:   GET /api-docs.json
 */
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ChessHive API',
      version: '1.0.2',
      description:
        'REST API for ChessHive – a multi-role chess tournament management platform. ' +
        'Authenticate via Bearer token (JWT) or session cookie.'
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Development server' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Obtain a token via POST /api/login then include it as: Authorization: Bearer <token>'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id:       { type: 'string' },
            email:    { type: 'string', format: 'email' },
            role:     { type: 'string', enum: ['admin', 'organizer', 'coordinator', 'player'] },
            isSuperAdmin: { type: 'boolean' },
            username: { type: 'string' },
            college:  { type: 'string' }
          }
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken:  { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn:    { type: 'number', description: 'Seconds until access token expires' }
          }
        }
      }
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',        description: 'Authentication endpoints' },
      { name: 'Admin',       description: 'Admin-only endpoints' },
      { name: 'Organizer',   description: 'Organizer-only endpoints' },
      { name: 'Coordinator', description: 'Coordinator-only endpoints' },
      { name: 'Player',      description: 'Player-only endpoints' },
      { name: 'Chat',        description: 'Chat and messaging endpoints' },
      { name: 'Users',       description: 'Cross-role user search' },
      { name: 'Logs',        description: 'Frontend log ingestion' }
    ]
  },
  // Scan all route files for @swagger comments
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
