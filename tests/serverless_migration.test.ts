import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';

describe('Vercel & Firebase Split Architecture Migration Suite', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('verifies render.yaml and .bun-version are completely decommissioned', () => {
    const renderYamlExists = fs.existsSync(path.join(rootDir, 'render.yaml'));
    const bunVersionExists = fs.existsSync(path.join(rootDir, '.bun-version'));

    expect(renderYamlExists).toBe(false);
    expect(bunVersionExists).toBe(false);
  });

  it('verifies vercel.json contains NO references to onrender.com proxy', () => {
    const vercelJsonPath = path.join(rootDir, 'vercel.json');
    expect(fs.existsSync(vercelJsonPath)).toBe(true);

    const content = fs.readFileSync(vercelJsonPath, 'utf8');
    expect(content.includes('onrender.com')).toBe(false);
    expect(content.includes('diet-planner-backend-5e78')).toBe(false);

    const parsed = JSON.parse(content);
    expect(parsed.rewrites).toBeDefined();
    // Ensure all rewrites are local SPA fallbacks or local routes, not external Render proxies
    for (const rw of parsed.rewrites) {
      expect(rw.destination.includes('onrender.com')).toBe(false);
    }
  });

  it('verifies all expected Vercel Serverless Function files exist in api/', () => {
    const expectedApiFiles = [
      'api/health.ts',
      'api/food/barcode/[code].ts',
      'api/ai/match-meal-memory.ts',
      'api/ai/recompute-category-priors.ts',
      'api/ai/analyze-recipe.ts',
      'api/ai/weekly-audit.ts',
      'api/ai/smart-grocery-list.ts',
      'api/ai/calculate-profile.ts',
      'api/ai/personalized-recommendations.ts',
      'api/ai/voice-quick-log.ts',
      'api/ai/analyze-habits.ts',
      'api/ai/analyze-food.ts',
      'api/_lib/auth.ts',
      'api/_lib/gemini.ts'
    ];

    for (const relPath of expectedApiFiles) {
      const fullPath = path.join(rootDir, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  it('verifies api/health.ts returns 200 with healthy status', async () => {
    const healthHandler = (await import('../api/health')).default;

    let responseStatus = 200;
    let responseBody: any = null;

    const mockReq: any = { method: 'GET' };
    const mockRes: any = {
      setHeader() {
        return this;
      },
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      }
    };

    await healthHandler(mockReq, mockRes);

    expect(responseStatus).toBe(200);
    expect(responseBody).toBeDefined();
    expect(responseBody.status).toBe('ok');
    expect(responseBody.timestamp).toBeDefined();
  });

  it('verifies api/ai/analyze-food.ts exports maxDuration and enforces auth', async () => {
    const analyzeFoodModule = await import('../api/ai/analyze-food');
    expect(analyzeFoodModule.maxDuration).toBe(60);

    const handler = analyzeFoodModule.default;
    let responseStatus = 200;
    let responseBody: any = null;

    const mockReq: any = {
      method: 'POST',
      headers: {}, // No auth header
      body: { description: 'test food' }
    };
    const mockRes: any = {
      setHeader() {
        return this;
      },
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      }
    };

    await handler(mockReq, mockRes);
    // Should be rejected with 401 Unauthorized
    expect(responseStatus).toBe(401);
    expect(responseBody.success).toBe(false);
  });

  it('verifies api/ai/analyze-food.ts processes authenticated request cleanly without ERR_REQUIRE_ESM', async () => {
    const analyzeFoodModule = await import('../api/ai/analyze-food');
    const handler = analyzeFoodModule.default;

    let responseStatus = 200;
    let responseBody: any = null;

    const mockReq: any = {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-token-testuser99'
      },
      body: {
        description: 'Grilled chicken breast with steamed broccoli and brown rice'
      }
    };
    const mockRes: any = {
      setHeader() {
        return this;
      },
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseBody = data;
        return this;
      }
    };

    await handler(mockReq, mockRes);

    expect(responseStatus).toBe(200);
    expect(responseBody).toBeDefined();
    expect(responseBody.success).toBe(true);
    expect(responseBody.data).toBeDefined();
    expect(responseBody.data.foods).toBeDefined();
    expect(responseBody.data.foods.length).toBeGreaterThan(0);
  }, 15000);

  it('verifies Firebase Cloud Function configuration in functions/src/index.ts', () => {
    const functionIndexPath = path.join(rootDir, 'functions/src/index.ts');
    expect(fs.existsSync(functionIndexPath)).toBe(true);

    const content = fs.readFileSync(functionIndexPath, 'utf8');
    // Must export analyzeFood
    expect(content.includes('export const analyzeFood = onRequest(')).toBe(true);
    // Must be scale-to-zero (minInstances: 0)
    expect(content.includes('minInstances: 0')).toBe(true);
    // Must have extended timeout for heavy CV pipeline
    expect(content.includes('timeoutSeconds: 120')).toBe(true);
    // Must enable CORS
    expect(content.includes('cors: true')).toBe(true);
  });

  it('verifies .firebaserc maps default to level-up-424a6', () => {
    const firebasercPath = path.join(rootDir, '.firebaserc');
    expect(fs.existsSync(firebasercPath)).toBe(true);

    const content = fs.readFileSync(firebasercPath, 'utf8');
    const parsed = JSON.parse(content);
    expect(parsed.projects?.default).toBe('level-up-424a6');
  });
});
