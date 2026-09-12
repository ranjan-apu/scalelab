// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CONCEPTS } from '../../content/concepts';
import { ALL_CONCEPT_ARTICLES, getConceptArticle } from '../../content/conceptArticles';
import { ConceptDiagram } from './ConceptDiagram';
import { ConceptsView } from './ConceptsView';

describe('Concept Articles content validity', () => {
  it('covers all 34 concept lessons with complete articles', () => {
    expect(ALL_CONCEPT_ARTICLES.length).toBe(34);
    for (const c of CONCEPTS) {
      const article = getConceptArticle(c.id);
      expect(article.id).toBe(c.id);
      expect(article.lesson.title).toBe(c.title);
      expect(article.readTime.length).toBeGreaterThan(0);
      expect(['Foundational', 'Intermediate', 'Advanced']).toContain(article.difficulty);
      expect(article.realWorldScenario.length).toBeGreaterThan(20);
      expect(article.deepDive.length).toBeGreaterThanOrEqual(2);
      expect(article.productionGotchas.length).toBeGreaterThanOrEqual(1);
      expect(article.interviewProbes.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains dedicated rich breakdowns for core distributed patterns', () => {
    const ch = getConceptArticle('consistent-hashing');
    expect(ch.diagramType).toBe('consistent-hash-ring');
    expect(ch.tradeoffs).toBeDefined();
    expect(ch.tradeoffs!.rows.length).toBeGreaterThan(2);

    const ca = getConceptArticle('caching');
    expect(ca.diagramType).toBe('cache-aside-flow');
    expect(ca.tradeoffs).toBeDefined();

    const sh = getConceptArticle('sharding');
    expect(sh.diagramType).toBe('sharding-architecture');

    const cc = getConceptArticle('contention-control');
    expect(cc.diagramType).toBe('concurrency-control');

    const lb = getConceptArticle('large-blobs');
    expect(lb.diagramType).toBe('blob-presigned-upload');

    const es = getConceptArticle('event-streams');
    expect(es.diagramType).toBe('queue-stream-partitions');
  });
});

describe('ConceptDiagram component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('renders various diagram types safely', () => {
    const types = [
      'consistent-hash-ring',
      'cache-aside-flow',
      'sharding-architecture',
      'circuit-breaker-fsm',
      'queue-stream-partitions',
      'blob-presigned-upload',
      'system-architecture-overview',
    ] as const;

    for (const type of types) {
      act(() => {
        root.render(<ConceptDiagram type={type} title="Test Diagram" />);
      });
      expect(container.querySelector('svg')).toBeTruthy();
    }
  });
});

describe('ConceptsView component', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.innerHTML = '';
  });

  it('does not render dialog into body when closed', () => {
    act(() => {
      root.render(<ConceptsView open={false} onClose={() => {}} />);
    });
    expect(document.querySelector('.concepts-view-root')).toBeNull();
  });

  it('renders all tracks and lessons when open', () => {
    act(() => {
      root.render(<ConceptsView open={true} onClose={() => {}} initialConceptId="consistent-hashing" />);
    });

    const dialog = document.querySelector('.concepts-view-root');
    expect(dialog).toBeTruthy();
    expect(document.body.textContent).toContain('Concept Academy');
    expect(document.body.textContent).toContain('34 Topics');

    // Verify track categories
    expect(document.body.textContent).toContain('Core Fundamentals');
    expect(document.body.textContent).toContain('Building Blocks');
    expect(document.body.textContent).toContain('Architectural Patterns');
    expect(document.body.textContent).toContain('Advanced Topics');

    // Verify active article content
    expect(document.body.textContent).toContain('Consistent Hashing');
    expect(document.body.textContent).toContain('Consistent Hash Ring with Virtual Replicas');
  });

  it('switches active article on sidebar item click', () => {
    act(() => {
      root.render(<ConceptsView open={true} onClose={() => {}} initialConceptId="consistent-hashing" />);
    });

    const cachingBtn = Array.from(document.querySelectorAll<HTMLButtonElement>('.concepts-nav-item')).find(
      (b) => b.textContent?.includes('Caching')
    );
    expect(cachingBtn).toBeTruthy();

    act(() => {
      cachingBtn!.click();
    });

    expect(document.body.textContent).toContain('Cache-Aside (Lazy Loading) Request Lifecycle');
  });

  it('calls onClose when clicking back button or pressing Escape', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<ConceptsView open={true} onClose={onClose} />);
    });

    const backBtn = document.querySelector<HTMLButtonElement>('.concepts-topbar-actions button');
    expect(backBtn).toBeTruthy();

    act(() => {
      backBtn!.click();
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('triggers demo preset load and canvas pin callbacks', () => {
    const onLoadDemoPreset = vi.fn();
    const onPinSection = vi.fn();
    const onClose = vi.fn();

    act(() => {
      root.render(
        <ConceptsView
          open={true}
          onClose={onClose}
          initialConceptId="consistent-hashing"
          onLoadDemoPreset={onLoadDemoPreset}
          onPinSection={onPinSection}
        />
      );
    });

    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.concepts-action-banner-btns button'));
    const loadDemoBtn = buttons.find((b) => b.textContent?.includes('Load Demo'));
    expect(loadDemoBtn).toBeTruthy();

    act(() => {
      loadDemoBtn!.click();
    });
    expect(onClose).toHaveBeenCalled();
    expect(onLoadDemoPreset).toHaveBeenCalled();

    const pinBtn = buttons.find((b) => b.textContent?.includes('Pin to Canvas'));
    expect(pinBtn).toBeTruthy();

    act(() => {
      pinBtn!.click();
    });
    expect(onPinSection).toHaveBeenCalled();
  });
});
