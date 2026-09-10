import { describe, expect, it } from 'vitest';
import { exportToHldMarkdown } from './hldExport';
import type { Topology } from './sim/types';
import { makeNode } from './sim/presets';

describe('exportToHldMarkdown', () => {
  it('exports structured markdown with requirements and component table', () => {
    const svc = makeNode('service', 0, 0, 'Order Service');
    svc.id = 'svc-1';
    svc.description = 'Validates checkout and emits payment events';
    svc.config.instances = 4;

    const topology: Topology = {
      nodes: [svc],
      edges: [
        {
          id: 'svc-1->queue-1',
          from: 'svc-1',
          to: 'queue-1',
          protocol: 'kafka',
          edgeLabel: 'OrderCreatedEvent',
          sync: false,
          weight: 1,
        },
      ],
    };

    const doc = exportToHldMarkdown(topology, { systemName: 'E-Commerce Platform' });
    expect(doc).toContain('# High-Level Design (HLD): E-Commerce Platform');
    expect(doc).toContain('Requirements & Scale Targets');
    expect(doc).toContain('Order Service');
    expect(doc).toContain('Validates checkout and emits payment events');
    expect(doc).toContain('KAFKA');
    expect(doc).toContain('OrderCreatedEvent');
    expect(doc).toContain('Async Event');
    expect(doc).toContain('Cloud Infrastructure Sizing & Monthly Cost');
  });
});
