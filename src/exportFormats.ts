import type { Topology } from './sim/types';

/**
 * Sanitizes a node ID to be safe for Mermaid identifiers.
 */
export function sanitizeIdentifier(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[a-zA-Z_]/.test(clean) ? clean : `node_${clean}`;
}

/**
 * Escapes labels for Mermaid strings.
 */
function escapeMermaidLabel(text: string): string {
  return text.replace(/"/g, "'");
}

/**
 * Generates Mermaid.js flowchart code from a Topology.
 */
export function exportToMermaid(topology: Topology): string {
  const lines: string[] = ['flowchart TD'];

  if (topology.nodes.length === 0) {
    return 'flowchart TD\n  empty["Empty Canvas"]';
  }

  // Define nodes with appropriate Mermaid shapes based on NodeKind
  for (const n of topology.nodes) {
    const id = sanitizeIdentifier(n.id);
    const label = escapeMermaidLabel(n.label);

    switch (n.kind) {
      case 'db':
      case 'timeseriesdb':
      case 'graphdb':
      case 'vectordb':
      case 'replica':
      case 'shard':
        lines.push(`  ${id}[("${label}")]`);
        break;
      case 'cache':
      case 'writebehind':
        lines.push(`  ${id}{{"${label}"}}`);
        break;
      case 'lb':
      case 'cdn':
      case 'apigateway':
      case 'edgecompute':
        lines.push(`  ${id}(["${label}"])`);
        break;
      case 'queue':
      case 'streambroker':
      case 'pubsub':
      case 'retryqueue':
        lines.push(`  ${id}[["${label}"]]`);
        break;
      case 'breaker':
      case 'ratelimiter':
      case 'bulkhead':
      case 'loadshedder':
        lines.push(`  ${id}{{"${label}"}}`);
        break;
      case 'client':
      case 'producer':
        lines.push(`  ${id}>"${label}"]`);
        break;
      default:
        lines.push(`  ${id}["${label}"]`);
        break;
    }
  }

  lines.push('');

  // Define edges
  for (const e of topology.edges) {
    const from = sanitizeIdentifier(e.from);
    const to = sanitizeIdentifier(e.to);

    if (e.control) {
      lines.push(`  ${from} -.->|controls| ${to}`);
    } else if (e.latencyMs && e.latencyMs > 0) {
      lines.push(`  ${from} -->|${e.latencyMs}ms| ${to}`);
    } else {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return lines.join('\n');
}
