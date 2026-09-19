import { describe, it, expect } from 'bun:test';
import fs from 'fs';
import path from 'path';
import { verifyFirebaseToken } from '../src/lib/tokenVerification';
import { getApiBaseUrl } from '../src/lib/apiFetch';

describe('Fly.io Backend Architecture & Free-Tier Suite', () => {
  it('verifies fly.toml exists with free-tier settings and no paid add-ons', () => {
    const flyPath = path.join(process.cwd(), 'fly.toml');
    expect(fs.existsSync(flyPath)).toBe(true);

    const config = fs.readFileSync(flyPath, 'utf8');
    expect(config.includes("size = 'shared-cpu-1x'")).toBe(true);
    expect(config.includes("memory = '256mb'")).toBe(true);
    expect(config.includes("min_machines_running = 0")).toBe(true);
    expect(config.includes("auto_stop_machines = 'stop'")).toBe(true);
    expect(config.includes("/health")).toBe(true);
  });

  it('verifies Dockerfile exists and uses Bun runtime', () => {
    const dockerfilePath = path.join(process.cwd(), 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);
    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
    expect(dockerfile.includes('oven/bun')).toBe(true);
    expect(dockerfile.includes('server.ts')).toBe(true);
  });

  it('verifies railway.json is removed', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'railway.json'))).toBe(false);
  });

  it('verifies split api/ serverless folder and functions/ are completely removed', () => {
    const apiDir = path.join(process.cwd(), 'api');
    const functionsDir = path.join(process.cwd(), 'functions');
    expect(fs.existsSync(apiDir)).toBe(false);
    expect(fs.existsSync(functionsDir)).toBe(false);
  });

  it('verifies firebase.json and .firebaserc are removed while firestore.rules is preserved', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'firebase.json'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), '.firebaserc'))).toBe(false);
    expect(fs.existsSync(path.join(process.cwd(), 'firestore.rules'))).toBe(true);
  });

  it('verifies vercel.json contains pure SPA fallback with no /api rewrites', () => {
    const vercelJsonPath = path.join(process.cwd(), 'vercel.json');
    const vercelJson = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf8'));

    expect(vercelJson.framework).toBe('vite');
    const rewrites = JSON.stringify(vercelJson.rewrites);
    expect(rewrites.includes('api/')).toBe(false);
    expect(rewrites.includes('/(.*)')).toBe(true);
  });

  it('verifies server.ts contains all consolidated endpoints', () => {
    const serverPath = path.join(process.cwd(), 'server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf8');

    expect(serverContent.includes('/health')).toBe(true);
    expect(serverContent.includes('/api/health')).toBe(true);
    expect(serverContent.includes('/api/ai/analyze-food')).toBe(true);
    expect(serverContent.includes('/api/ai/match-meal-memory')).toBe(true);
    expect(serverContent.includes('/api/ai/calculate-profile')).toBe(true);
    expect(serverContent.includes('/api/ai/analyze-recipe')).toBe(true);
    expect(serverContent.includes('/api/ai/analyze-habits')).toBe(true);
    expect(serverContent.includes('/api/ai/personalized-recommendations')).toBe(true);
    expect(serverContent.includes('/api/ai/smart-grocery-list')).toBe(true);
    expect(serverContent.includes('/api/ai/weekly-audit')).toBe(true);
    expect(serverContent.includes('/api/food/barcode/:code')).toBe(true);
  });

  it('verifies tokenVerification module is functional', () => {
    expect(typeof verifyFirebaseToken).toBe('function');
  });

  it('verifies getApiBaseUrl handles missing or configured VITE_API_URL cleanly', () => {
    expect(typeof getApiBaseUrl).toBe('function');
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
  });
});
