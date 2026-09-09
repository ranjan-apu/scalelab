import { describe, expect, it } from 'vitest';
import { exportToDockerCompose, exportToMermaid, sanitizeIdentifier } from './exportFormats';
import { PRESETS } from './sim/presets';
import type { Topology } from './sim/types';

describe('exportFormats', () => {
  it('sanitizes identifiers safely', () => {
    expect(sanitizeIdentifier('user-service')).toBe('user_service');
    expect(sanitizeIdentifier('123service')).toBe('node_123service');
    expect(sanitizeIdentifier('db.primary')).toBe('db_primary');
  });

  it('exports topology to valid Mermaid flowchart', () => {
    const singleServer = PRESETS.find((p) => p.id === 'single-server')!;
    const mermaid = exportToMermaid(singleServer.topology);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('-->');
    expect(mermaid).toContain('[("Database")]');
  });

  it('exports empty canvas to Mermaid placeholder', () => {
    const empty: Topology = { nodes: [], edges: [] };
    const mermaid = exportToMermaid(empty);
    expect(mermaid).toContain('flowchart TD');
    expect(mermaid).toContain('Empty Canvas');
  });

  it('exports topology to valid Docker Compose YAML', () => {
    const singleServer = PRESETS.find((p) => p.id === 'single-server')!;
    const compose = exportToDockerCompose(singleServer.topology);
    expect(compose).toContain('version: "3.8"');
    expect(compose).toContain('services:');
    expect(compose).toContain('postgres:16-alpine');
    expect(compose).toContain('depends_on:');
  });

  it('handles Kafka and RabbitMQ in event-driven preset', () => {
    const eventDriven = PRESETS.find((p) => p.id === 'event-driven')!;
    const compose = exportToDockerCompose(eventDriven.topology);
    expect(compose).toContain('services:');
    expect(compose).toContain('cp-kafka');
  });
});
