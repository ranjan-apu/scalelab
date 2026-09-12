/**
 * Full-pack canvas documents for the "Practice on canvas" button.
 *
 * One click drops the whole interview track onto a fresh canvas as a
 * two-column spread: scope and contract on the left, design and depth on
 * the right. Pure data transform, no canvas access, so layout math and
 * completeness are unit-testable here and the App only places boxes.
 *
 * Content is the pack's own original text, formatted the same way as the
 * per-section pin buttons.
 */

import type { InterviewPack } from './interviewPacks';

export interface DocBox {
  title: string;
  text: string;
}

export interface PackDoc {
  header: DocBox;
  left: DocBox[];
  right: DocBox[];
}

function bullets(lines: readonly string[]): string {
  return lines.map((l) => `• ${l}`).join('\n');
}

function numbered(lines: readonly string[]): string {
  return lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
}

export function packToCanvasDoc(pack: InterviewPack): PackDoc {
  const header: DocBox = {
    title: `${pack.title}: interview practice`,
    text: `${pack.tagline}\n${pack.difficulty} · ${pack.minutes} min\n\n${pack.prompt}`,
  };

  const left: DocBox[] = [
    {
      title: 'Scoping questions',
      text: bullets(pack.checkpoints.map((c) => `${c.question} Decides: ${c.decides}`)),
    },
    {
      title: 'Requirements',
      text: [
        'Functional:',
        bullets(pack.functional),
        '',
        'Non-functional:',
        bullets(pack.nonfunctional),
        '',
        'Estimations:',
        bullets(pack.estimations),
      ].join('\n'),
    },
    {
      title: 'Core entities',
      text: bullets(pack.entities.map((e) => `${e.name}: ${e.fields}`)),
    },
    {
      title: `API: ${pack.api.protocol}`,
      text: [
        pack.api.protocolWhy,
        '',
        ...pack.api.endpoints.map((e) => `• ${e.method} ${e.path}: ${e.purpose}`),
      ].join('\n'),
    },
  ];

  const right: DocBox[] = [
    {
      title: 'High-level design',
      text: [
        ...(pack.dataFlow ? ['Data flow:', numbered(pack.dataFlow), ''] : []),
        'Build order:',
        numbered(pack.hldSteps),
      ].join('\n'),
    },
    ...pack.deepDives.map((d) => ({
      title: `Deep dive: ${d.title}`,
      text: [`Problem: ${d.problem}`, '', ...d.approach.map((a) => `• ${a}`), '', `Tradeoff: ${d.tradeoff}`].join(
        '\n',
      ),
    })),
  ];

  return { header, left, right };
}
